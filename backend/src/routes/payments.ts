import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin, supabaseAsUser } from '../lib/supabase';
import { authenticateUser as requireAuth } from '../middleware/auth';
import { env } from '../config/env';
import crypto from 'crypto';

const router = Router();

import { CREDIT_BUNDLES } from '../../../shared/constants/quota';

const CheckoutSchema = z.object({
  bundle_id: z.string(),
  type: z.literal('credit_topup').optional().default('credit_topup')
});

router.post('/checkout', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const email = req.user!.email;

    const parseResult = CheckoutSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parseResult.error.format() });
    }

    const { bundle_id, type } = parseResult.data;
    const bundle = CREDIT_BUNDLES[bundle_id];
    
    if (!bundle) {
      return res.status(400).json({ error: 'Invalid bundle ID' });
    }

    const { price: amount, credits } = bundle;
    const amountInPesewas = amount * 100; // Convert GHS to pesewas

    // Ensure we have a valid site URL for callback
    const baseUrl = env.FRONTEND_URL || 'http://localhost:3000';

    const params = {
      email,
      amount: amountInPesewas,
      currency: 'GHS',
      callback_url: `${baseUrl}/dashboard?payment=success`,
      metadata: {
        userId,
        type,
        credits: credits.toString()
      }
    };

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY || 'sk_test_mock_key'}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to initialize Paystack transaction');
    }

    res.json({ url: data.data.authorization_url });
  } catch (error: any) {
    console.error('Checkout Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

router.post('/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Missing token' });
    }

    const supabase = supabaseAsUser(token);
    
    // Simulating cancellation natively in our app
    const { error: dbError } = await supabase
      .from('profiles')
      .update({ plan: 'free' })
      .eq('id', userId);

    if (dbError) throw dbError;

    res.json({ success: true, message: 'Subscription cancelled successfully' });
  } catch (error: any) {
    console.error('Cancel Subscription Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

router.post('/portal', requireAuth, async (req: Request, res: Response) => {
  try {
    // Paystack doesn't have a direct "billing portal" like Stripe.
    // Return to dashboard for now, or redirect to a native manage-subscription page.
    const baseUrl = env.FRONTEND_URL || 'http://localhost:3000';
    res.json({ url: `${baseUrl}/dashboard/settings/billing` });
  } catch (error: any) {
    console.error('Portal Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Placeholder for upgrading subscription (future implementation)
router.post('/upgrade', requireAuth, async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const supabase = supabaseAsUser(token);
    const UpgradeSchema = z.object({
      plan: z.enum(['pro', 'ultra', 'starter']).default('pro')
    });
    const result = UpgradeSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid payload', details: result.error.format() });
    }
    const { plan } = result.data;
    const { error: dbError } = await supabase
      .from('profiles')
      .update({ plan })
      .eq('id', req.user!.id);
    if (dbError) throw dbError;
    res.json({ success: true, message: `Plan upgraded to ${plan}` });
  } catch (error: any) {
    console.error('Upgrade Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Placeholder for referral rewards endpoint
router.post('/referral', requireAuth, async (req: Request, res: Response) => {
  try {
    // Generate a 8‑character alphanumeric referral code
    const code = crypto.randomBytes(4).toString('hex');
    const { error: dbError } = await supabaseAdmin
      .from('referrals')
      .insert({ user_id: req.user!.id, code, created_at: new Date().toISOString() });
    if (dbError) throw dbError;
    res.json({ success: true, referralCode: code });
  } catch (error: any) {
    console.error('Referral Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Placeholder for gifting a subscription to another user
router.post('/gift', requireAuth, async (req: Request, res: Response) => {
  try {
    const GiftSchema = z.object({
      recipientEmail: z.string().email(),
      plan: z.enum(['pro', 'ultra', 'starter']).default('pro')
    });
    const result = GiftSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid payload', details: result.error.format() });
    }
    const { recipientEmail, plan } = result.data;
    // Find recipient user id via admin client
    const { data: userData, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', recipientEmail)
      .single();
    if (userError || !userData) {
      return res.status(404).json({ error: 'Recipient not found' });
    }
    const recipientId = userData.id;
    // Update recipient's plan
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ plan })
      .eq('id', recipientId);
    if (updateError) throw updateError;
    // Record transaction as a gift
    await supabaseAdmin.from('payment_transactions').insert({
      user_id: recipientId,
      amount: 0,
      status: 'gift',
      reference: `gift-${req.user!.id}-${Date.now()}`
    });
    // Optionally notify recipient (placeholder)
    res.json({ success: true, message: `Gifted ${plan} plan to ${recipientEmail}` });
  } catch (error: any) {
    console.error('Gift Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

export default router;
