'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Coins, ExternalLink, Zap } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import CheckoutButton from '@/app/pricing/checkout-button';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
export default function BillingSettings() {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWallet() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('credit_wallets').select('balance').eq('user_id', user.id).single();
        if (data) {
          setBalance(data.balance);
        }
      }
      setLoading(false);
    }
    loadWallet();
  }, []);

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Wallet & Credits</h2>
        <p className="text-muted-foreground">Manage your AI credits and view your balance.</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 md:p-8">
        <div className="flex flex-col md:flex-row gap-8 justify-between items-start">
          
          {/* Current Balance Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Coins className="w-5 h-5 text-[var(--color-plum-500)]" /> Current Balance
            </h3>
            
            <div className="flex items-end gap-3">
              <span className="text-4xl font-extrabold text-foreground">{(balance / 100).toFixed(2).replace(/\.00$/, '')}</span>
              <Button onClick={() => document.getElementById('top-up-options')?.scrollIntoView({ behavior: 'smooth' })}>
                Top Up Credits
              </Button>
            </div>

            <p className="text-sm text-muted-foreground max-w-sm">
              Credits never expire. They are only consumed when you exceed your free daily allowance for AI features.
            </p>
          </div>
        </div>
      </div>

      <div id="top-up-options" className="space-y-6 scroll-mt-6">
        <div>
          <h3 className="text-xl font-bold">Top Up Credits</h3>
          <p className="text-sm text-muted-foreground">Purchase more credits to continue using AI features beyond your daily allowance.</p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
          {[
            { 
              name: 'Starter', 
              price: 10, 
              credits: 100, 
              description: 'Quick boost for finals',
              popular: false 
            },
            { 
              name: 'Standard', 
              price: 25, 
              credits: 300, 
              description: 'Most popular for regular study',
              popular: true 
            },
            { 
              name: 'Value', 
              price: 50, 
              credits: 700, 
              description: 'Best value per credit',
              popular: false 
            },
            { 
              name: 'Bulk', 
              price: 100, 
              credits: 1600, 
              description: 'For power users & heavy revision',
              popular: false 
            }
          ].map((bundle) => (
            <Card 
              key={bundle.name} 
              className={`flex flex-col relative transition-all duration-300 overflow-visible ${
                bundle.popular 
                  ? 'border-2 border-[var(--color-plum-500)] shadow-lg bg-[var(--color-plum-50)]/60 dark:bg-[var(--color-plum-950)/20] md:-translate-y-1' 
                  : 'border border-border shadow-sm hover:border-muted-foreground/30'
              }`}
            >
              {bundle.popular && (
                <div className='absolute -top-3.5 inset-x-0 flex justify-center z-20 pointer-events-none'>
                  <span className='bg-[var(--color-plum-500)] text-white px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest shadow-md inline-flex items-center gap-1.5 whitespace-nowrap pointer-events-auto'>
                    <Zap className='w-3 h-3' fill="currentColor" /> Most Popular
                  </span>
                </div>
              )}
              <CardHeader className={bundle.popular ? 'pt-7 pb-3' : 'pb-3'}>
                <CardTitle className={`text-lg font-bold ${bundle.popular ? 'text-[var(--color-plum-700)] dark:text-[var(--color-plum-300)]' : ''}`}>
                  {bundle.name}
                </CardTitle>
                <CardDescription className="text-xs">{bundle.description}</CardDescription>
                <div className='mt-3 flex items-baseline text-3xl font-black'>
                  GH₵{bundle.price}
                </div>
                <div className='mt-1 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-plum-600)] dark:text-[var(--color-plum-400)]'>
                  <Coins className='w-4 h-4' /> {bundle.credits} Credits
                </div>
              </CardHeader>
              <CardContent className="flex-1 pb-4">
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${bundle.popular ? 'bg-[var(--color-plum-500)]' : 'bg-muted-foreground/60'}`} />
                    Credits never expire
                  </li>
                  <li className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${bundle.popular ? 'bg-[var(--color-plum-500)]' : 'bg-muted-foreground/60'}`} />
                    Usable across all AI features
                  </li>
                  <li className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${bundle.popular ? 'bg-[var(--color-plum-500)]' : 'bg-muted-foreground/60'}`} />
                    Instant wallet credit deposit
                  </li>
                </ul>
              </CardContent>
              <CardFooter className="pt-0">
                <CheckoutButton 
                  amount={bundle.price}
                  credits={bundle.credits * 100}
                  label="Purchase Bundle"
                  className={`w-full py-2.5 rounded-lg font-semibold transition-all border text-sm shadow-xs ${
                    bundle.popular 
                      ? 'bg-[var(--color-plum-500)] text-white hover:bg-[var(--color-plum-600)] border-transparent shadow-md hover:shadow-lg' 
                      : 'bg-background hover:bg-muted text-foreground border-border'
                  }`}
                />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>

      <div className="bg-muted/30 border border-border rounded-xl p-6 mt-8">
        <h3 className="text-lg font-semibold mb-2">How it works</h3>
        <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Every feature on UniStudy is free to use.</li>
            <li>You receive a free daily allowance of AI requests.</li>
            <li>If you exhaust your daily allowance, your wallet balance will be used.</li>
            <li>If your balance reaches 0, you can top up anytime.</li>
        </ul>
      </div>
    </div>
  );
}
