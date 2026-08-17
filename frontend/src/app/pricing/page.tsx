import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Zap, Coins } from 'lucide-react';
import { MarketingNavbar } from '@/components/layout/MarketingNavbar';
import CheckoutButton from './checkout-button';

export default function PricingPage() {
  const bundles = [
    {
      id: 'starter',
      name: 'Starter',
      price: 10,
      credits: 100,
      description: 'Perfect for a quick top-up during finals',
      popular: false
    },
    {
      id: 'standard',
      name: 'Standard',
      price: 25,
      credits: 300,
      description: 'Our most popular bundle for regular study sessions',
      popular: true
    },
    {
      id: 'value',
      name: 'Value',
      price: 50,
      credits: 700,
      description: 'Great value for the dedicated student',
      popular: false
    },
    {
      id: 'bulk',
      name: 'Bulk',
      price: 100,
      credits: 1600,
      description: 'For power users. Never run out of credits.',
      popular: false
    }
  ];

  return (
    <div className='min-h-screen bg-background text-foreground' style={{ fontFamily: "Inter, sans-serif" }}>
      <MarketingNavbar />
      <div className='py-20 px-6'>
        <div className='max-w-7xl mx-auto text-center space-y-4 mb-16'>
          <h1 className='text-5xl font-black tracking-tight'>Pay only for what you use.</h1>
          <p className='text-xl text-[var(--text-muted)] max-w-2xl mx-auto'>
            Every feature on UniStudy is 100% free to access. You only pay for AI compute credits when your daily free allowance runs out.
          </p>
        </div>

        <div className='grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto pt-8'>
          {bundles.map((bundle) => (
            <Card
              key={bundle.name}
              className={`flex flex-col border transition-all duration-300 relative overflow-visible ${
                bundle.popular 
                  ? 'border-2 border-[var(--color-plum-500)] bg-[var(--color-plum-50)] dark:bg-[var(--color-plum-950)/10] shadow-xl md:-translate-y-4 z-10' 
                  : 'border-border shadow-sm'
              }`}
            >
              {bundle.popular && (
                <div className='absolute -top-3.5 inset-x-0 flex justify-center z-20 pointer-events-none'>
                  <span className='bg-[var(--color-plum-500)] text-white px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest shadow-md inline-flex items-center gap-1.5 whitespace-nowrap pointer-events-auto'>
                    <Zap className='w-3 h-3' fill="currentColor" />
                    Most Popular
                  </span>
                </div>
              )}

              <CardHeader className={bundle.popular ? 'pt-8' : ''}>
                <CardTitle className={`text-2xl ${bundle.popular ? 'text-[var(--color-plum-700)] dark:text-[var(--color-plum-400)]' : ''}`}>
                  {bundle.name}
                </CardTitle>
                <CardDescription>{bundle.description}</CardDescription>
                <div className='mt-6 flex items-baseline text-4xl font-extrabold'>
                  GH₵{bundle.price}
                </div>
                <div className='mt-2 flex items-center gap-2 text-[var(--color-plum-600)] dark:text-[var(--color-plum-400)] font-semibold'>
                  <Coins className='w-5 h-5' /> {bundle.credits} Credits
                </div>
              </CardHeader>
              <CardContent className='flex-1'>
                <ul className='space-y-4 text-sm text-[var(--text-primary)]'>
                  <li className='flex items-center gap-3'>
                    <div className={`w-1.5 h-1.5 rounded-full ${bundle.popular ? 'bg-[var(--color-plum-500)]' : 'bg-muted-foreground'}`} />
                    Credits never expire
                  </li>
                  <li className='flex items-center gap-3'>
                    <div className={`w-1.5 h-1.5 rounded-full ${bundle.popular ? 'bg-[var(--color-plum-500)]' : 'bg-muted-foreground'}`} />
                    Use on any AI feature
                  </li>
                  <li className='flex items-center gap-3'>
                    <div className={`w-1.5 h-1.5 rounded-full ${bundle.popular ? 'bg-[var(--color-plum-500)]' : 'bg-muted-foreground'}`} />
                    One-time payment, no subscriptions
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <CheckoutButton 
                  bundle_id={bundle.id}
                  label="Purchase"
                  className={`w-full py-3 rounded-md font-medium transition-colors border ${
                    bundle.popular 
                      ? 'bg-[var(--color-plum-500)] text-white hover:bg-[var(--color-plum-600)] border-transparent' 
                      : 'bg-transparent text-foreground border-border hover:bg-muted'
                  }`}
                />
              </CardFooter>
            </Card>
          ))}
        </div>
        
        <div className='max-w-3xl mx-auto mt-20 p-8 rounded-2xl bg-muted/30 border border-border text-center'>
            <h2 className='text-2xl font-bold mb-4'>How do credits work?</h2>
            <p className='text-muted-foreground mb-6'>
                You get a generous free daily allowance of AI requests (e.g. 50 Gemini requests, 10 Groq 70B requests) that resets every midnight. 
                If you need more compute power on a busy day, your purchased credits will be used. 1 Credit = 1 AI Request. 
            </p>
        </div>
      </div>
    </div>
  );
}
