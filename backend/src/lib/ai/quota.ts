import { redis } from '../redis';
import { supabaseAdmin } from '../supabase';
import { Feature, FEATURE_PROVIDER_MAP, FEATURE_COSTS, PROVIDER_CONFIG, FREE_DAILY_ALLOWANCES, MODEL_MULTIPLIERS } from '@unistudy/shared/constants/quota';

export type QuotaCheckResult = {
  allowed: boolean
  reason?: 'limit_reached' | 'pool_disabled' | 'free_tier_suspended'
  cost: number
  daily_used: number
  daily_limit: number
  wallet_balance: number
}

export async function getCreditBalance(userId: string) {
  const { data, error } = await supabaseAdmin.from('credit_wallets').select('balance').eq('user_id', userId).single();
  
  if (!data) {
    const { data: inserted } = await supabaseAdmin.from('credit_wallets').insert({ user_id: userId, balance: 0 }).select('balance').single();
    return inserted?.balance || 0;
  }
  return data.balance;
}

export async function getUserQuota(userId: string) {
  if (redis) {
    const cached = await redis.get(`user_quota:${userId}`);
    if (cached) return cached as any;
  }

  const { data } = await supabaseAdmin.from('user_quota').select('*').eq('user_id', userId).single();

  let result = data;

  if (!result) {
    const { data: insertedData, error: insertErr } = await supabaseAdmin
      .from('user_quota')
      .insert({ user_id: userId })
      .select('*')
      .single();
    
    if (insertErr) {
      console.error("Failed to auto-create user_quota row:", insertErr);
    } else {
      result = insertedData;
    }
  }

  if (redis && result) {
    try {
      await redis.set(`user_quota:${userId}`, result, { ex: 30 });
    } catch (e) {
      console.warn("Redis write failed:", e);
    }
  }

  return result;
}

export async function checkUserQuota(userId: string, feature: Feature, model_tier: string = 'default'): Promise<QuotaCheckResult> {
  const provider = FEATURE_PROVIDER_MAP[feature]
  const baseCost = FEATURE_COSTS[feature]
  const multiplier = MODEL_MULTIPLIERS[model_tier] || MODEL_MULTIPLIERS['default']
  const cost = Math.round(baseCost * multiplier)
  const config = PROVIDER_CONFIG[provider]

  if (!config.has_user_quota || !config.user_quota_column) {
    return { allowed: true, cost: 0, daily_used: 0, daily_limit: 9999, wallet_balance: 9999 }
  }

  const colPrefix = config.user_quota_column
  const dailyLimit = FREE_DAILY_ALLOWANCES[colPrefix] || 0
  
  const quota = await getUserQuota(userId)
  if (!quota) return { allowed: false, cost, daily_used: 0, daily_limit: dailyLimit, wallet_balance: 0 }

  const walletBalance = await getCreditBalance(userId)

  let used = quota[`${colPrefix}_daily_used`] || 0
  let resetsAt = new Date(quota[`${colPrefix}_daily_reset`] || new Date())
  resetsAt.setUTCDate(resetsAt.getUTCDate() + 1)
  resetsAt.setUTCHours(0, 0, 0, 0)
  
  const isNewPeriod = new Date() > resetsAt
  const actualUsed = isNewPeriod ? 0 : used

  const dailyRemaining = dailyLimit - actualUsed
  
  const isAllowed = dailyRemaining >= cost || walletBalance >= cost

  return {
    allowed: isAllowed,
    reason: isAllowed ? undefined : 'limit_reached',
    cost,
    daily_used: actualUsed,
    daily_limit: dailyLimit,
    wallet_balance: walletBalance
  }
}

export async function consumeUserQuota(userId: string, feature: Feature, model_tier: string = 'default') {
  const provider = FEATURE_PROVIDER_MAP[feature]
  const baseCost = FEATURE_COSTS[feature]
  const multiplier = MODEL_MULTIPLIERS[model_tier] || MODEL_MULTIPLIERS['default']
  const cost = Math.round(baseCost * multiplier)
  if (cost <= 0) return true;

  const config = PROVIDER_CONFIG[provider]
  if (!config.has_user_quota || !config.user_quota_column) {
    return true; 
  }

  const colPrefix = config.user_quota_column
  const dailyLimit = FREE_DAILY_ALLOWANCES[colPrefix] || 0
  
  const quota = await getUserQuota(userId)
  const walletBalance = await getCreditBalance(userId)
  
  let used = quota[`${colPrefix}_daily_used`] || 0
  let resetsAt = new Date(quota[`${colPrefix}_daily_reset`] || new Date())
  resetsAt.setUTCDate(resetsAt.getUTCDate() + 1)
  resetsAt.setUTCHours(0, 0, 0, 0)
  const isNewPeriod = new Date() > resetsAt
  const actualUsed = isNewPeriod ? 0 : used
  
  const dailyRemaining = dailyLimit - actualUsed

  if (dailyRemaining >= cost) {
    const rpcName = `increment_user_${colPrefix}_daily`
    await supabaseAdmin.rpc(rpcName as any, { p_user_id: userId, p_amount: cost });
  } else if (walletBalance >= cost) {
    await supabaseAdmin.rpc('decrement_credit_wallet', { p_user_id: userId, p_amount: cost });
  } else {
    throw new Error('quota_exhausted')
  }

  await supabaseAdmin.from('ai_request_log').insert({
    user_id: userId,
    provider,
    feature,
    pool_type: config.pool_type,
    requests_cost: cost,
    was_cached: false,
    drew_from_pool: false,
    user_plan: 'credit_system'
  });

  if (redis) {
    try {
      await redis.del(`user_quota:${userId}`);
    } catch (e) {
      console.warn("Redis delete failed:", e);
    }
  }

  return true;
}
