-- Function to safely and atomically increment user credit wallet balance
CREATE OR REPLACE FUNCTION increment_credit_wallet(p_user_id uuid, p_amount int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Upsert the wallet balance
    INSERT INTO credit_wallets (user_id, balance, updated_at)
    VALUES (p_user_id, p_amount, now())
    ON CONFLICT (user_id)
    DO UPDATE SET 
        balance = credit_wallets.balance + EXCLUDED.balance,
        updated_at = EXCLUDED.updated_at;
END;
$$;
