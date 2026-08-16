-- Scale existing credit balances by 100 to support fractional "Micro-Credit" deductions.
-- For example, 10 credits -> 1000 tokens. A 0.54 cost will deduct 54 tokens.

UPDATE credit_wallets
SET balance = balance * 100;

-- Scale daily used quotas in the user_quota table
-- If columns don't exist in older schemas, this will error, but we know they exist based on previous migrations
UPDATE user_quota
SET 
  gemini_daily_used = gemini_daily_used * 100,
  groq70_daily_used = groq70_daily_used * 100,
  groq8_daily_used = groq8_daily_used * 100,
  cohere_daily_used = cohere_daily_used * 100,
  youtube_daily_used = youtube_daily_used * 100;
