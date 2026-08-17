import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Paystack sends webhooks from their servers, so we must use Service Role key to bypass RLS
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-paystack-signature')

    // Verify webhook signature
    const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
      .update(rawBody)
      .digest('hex')
    
    if (hash !== signature) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
      }
    }

    const event = JSON.parse(rawBody)

    if (event.event === 'charge.success') {
      const data = event.data
      const metadata = data.metadata

      if (metadata?.type === 'credit_topup') {
        const userId = metadata.user_id || metadata.userId
        const creditsPurchased = parseInt(metadata.credits || '0', 10)
        
        if (userId && creditsPurchased > 0) {
          // Verify amount loosely
          
          // Use the new atomic RPC to prevent race conditions
          const { error: rpcError } = await adminSupabase.rpc('increment_credit_wallet', {
            p_user_id: userId,
            p_amount: creditsPurchased
          });

          if (rpcError) {
            console.error('Failed to increment credit wallet via RPC:', rpcError);
          } else {
            console.log(`Topped up ${creditsPurchased} credits for user ${userId}`);
          }

        // 3. Log to audit
        await adminSupabase.from('ai_request_log').insert({
          user_id: userId,
          provider: 'system',
          feature: 'credit_purchase',
          pool_type: 'credit_funded',
          requests_cost: -creditsPurchased, // negative cost means topup
          was_cached: false,
          drew_from_pool: false,
          user_plan: 'credit_system'
        })
        }
        // 4. Send Confirmation Email
        if (resend && data.customer?.email) {
          await resend.emails.send({
            from: 'UniStudy AI <billing@unistudy.ai>',
            to: [data.customer.email],
            subject: 'Credit Top-Up Successful — UniStudy AI',
            text: `Thank you for your purchase! We've successfully topped up your wallet with ${creditsPurchased} AI credits. Enjoy all the fully unlocked features!`
          })
        }
      }
    }

    return NextResponse.json({ received: true })

  } catch (err) {
    console.error('Paystack webhook error:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
