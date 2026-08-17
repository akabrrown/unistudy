import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { supabaseAdmin } from '../../lib/supabase';
import { env } from '../../config/env';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  // express.raw() passes req.body as a Buffer
  const payloadBuffer = req.body as Buffer;
  
  const webhookSecret = env.PAYSTACK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('PAYSTACK_WEBHOOK_SECRET is not configured');
    return res.status(500).send('Webhook not configured');
  }

  const hash = crypto.createHmac('sha512', webhookSecret)
    .update(payloadBuffer)
    .digest('hex');
  
  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(payloadBuffer.toString('utf8'));

  if (event.event === 'charge.success') {
    const { reference, customer, metadata, amount } = event.data;
    
    // In metadata we expect to find the userId
    if (metadata && metadata.userId) {
      const plan = metadata.plan || 'pro';
      
      // Update profile
      await supabaseAdmin
        .from('profiles')
        .update({ plan: plan })
        .eq('id', metadata.userId);
        
      // Record the transaction audit
      await supabaseAdmin
        .from('payment_transactions')
        .insert({
          user_id: metadata.userId,
          amount: amount,
          status: 'success',
          reference: reference
        });
    }
  }

  res.sendStatus(200);
});

export default router;
