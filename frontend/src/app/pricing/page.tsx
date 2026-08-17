import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Zap, Coins, Check, AlertTriangle, ShieldCheck, Clock } from 'lucide-react';
import { MarketingNavbar } from '@/components/layout/MarketingNavbar';
import CheckoutButton from './checkout-button';

export default function PricingPage() {
  const bundles = [
    {
      id: 'starter',
      name: 'Starter',
      price: 10,
      credits: 100,
      description: 'Perfect for a quick top-up during finals week.',
      popular: false
    },
    {
      id: 'standard',
      name: 'Standard',
      price: 25,
      credits: 300,
      description: 'Our most popular bundle for regular study sessions.',
      popular: true
    },
    {
      id: 'value',
      name: 'Value',
      price: 50,
      credits: 700,
      description: 'Great value for the dedicated student.',
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
    <div className='min-h-screen bg-[#FAF8FF] dark:bg-[#0F0C29] text-foreground transition-colors' style={{ fontFamily: "Inter, sans-serif" }}>
      <MarketingNavbar />
      
      <div className='py-24 px-8'>
        
        {/* Header Section */}
        <div className='max-w-4xl mx-auto text-center space-y-6 mb-20'>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F5F3FA] dark:bg-[#5B2D8E]/20 text-[#5B2D8E] dark:text-[#D1C4E9] text-sm font-bold tracking-wide border border-[#EBE5F0] dark:border-[#3D266E] mb-2">
            <ShieldCheck size={16} />
            The No-Subscription Guarantee
          </div>
          <h1 className='text-5xl md:text-6xl font-black tracking-tight text-[#1A0A2E] dark:text-white'>
            Pay only for what you <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5B2D8E] to-[#9B72CF]">actually use.</span>
          </h1>
          <p className='text-xl text-[#6B5A8A] dark:text-[#B39DDB] leading-relaxed max-w-3xl mx-auto'>
            Subscriptions are a trap for students. Why pay a monthly fee when you only study heavily during midterms and finals? With our Pay-As-You-Go credit system, your credits never expire.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className='grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto pt-4'>
          {bundles.map((bundle) => (
            <Card
              key={bundle.name}
              className={`flex flex-col border transition-all duration-300 relative overflow-visible ${
                bundle.popular 
                  ? 'border-2 border-[#5B2D8E] bg-white dark:bg-[#1A0A2E] shadow-2xl md:-translate-y-4 z-10' 
                  : 'border-[#EBE5F0] dark:border-white/10 bg-white/50 dark:bg-[#1A0A2E]/50 shadow-sm hover:shadow-md'
              }`}
            >
              {bundle.popular && (
                <div className='absolute -top-4 inset-x-0 flex justify-center z-20 pointer-events-none'>
                  <span className='bg-[#5B2D8E] text-white px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest shadow-lg inline-flex items-center gap-2 whitespace-nowrap pointer-events-auto'>
                    <Zap className='w-3.5 h-3.5' fill="currentColor" />
                    Most Popular
                  </span>
                </div>
              )}

              <CardHeader className={bundle.popular ? 'pt-10 pb-6' : 'pt-8 pb-6'}>
                <CardTitle className={`text-2xl font-black ${bundle.popular ? 'text-[#1A0A2E] dark:text-white' : 'text-[#1A0A2E] dark:text-white'}`}>
                  {bundle.name}
                </CardTitle>
                <CardDescription className="text-[#6B5A8A] dark:text-[#B39DDB] min-h-[40px] mt-2">
                  {bundle.description}
                </CardDescription>
                
                <div className='mt-8 mb-2 flex items-baseline text-5xl font-black text-[#1A0A2E] dark:text-white'>
                  <span className="text-2xl text-[#9E8CB5] mr-1 font-bold">GH₵</span>{bundle.price}
                </div>
                
                <div className='inline-flex items-center justify-center gap-2 text-[#5B2D8E] dark:text-[#D1C4E9] font-bold bg-[#F5F3FA] dark:bg-[#5B2D8E]/20 px-4 py-2 rounded-xl mt-2 w-full'>
                  <Coins className='w-5 h-5' /> {bundle.credits} Credits
                </div>
              </CardHeader>

              <CardContent className='flex-1 px-8 pt-4 pb-8'>
                <ul className='space-y-4 text-[15px] font-medium text-[#1A0A2E] dark:text-[#D1C4E9]'>
                  <li className='flex items-start gap-3'>
                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${bundle.popular ? 'bg-[#5B2D8E]/10 text-[#5B2D8E]' : 'bg-[#EBE5F0] dark:bg-white/10 text-[#6B5A8A]'}`}>
                      <Check size={12} strokeWidth={3} />
                    </div>
                    Credits never expire
                  </li>
                  <li className='flex items-start gap-3'>
                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${bundle.popular ? 'bg-[#5B2D8E]/10 text-[#5B2D8E]' : 'bg-[#EBE5F0] dark:bg-white/10 text-[#6B5A8A]'}`}>
                      <Check size={12} strokeWidth={3} />
                    </div>
                    Use on any AI feature
                  </li>
                  <li className='flex items-start gap-3'>
                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${bundle.popular ? 'bg-[#5B2D8E]/10 text-[#5B2D8E]' : 'bg-[#EBE5F0] dark:bg-white/10 text-[#6B5A8A]'}`}>
                      <Check size={12} strokeWidth={3} />
                    </div>
                    Access to Smart & Fast models
                  </li>
                </ul>
              </CardContent>

              <CardFooter className="px-8 pb-8">
                <CheckoutButton 
                  bundle_id={bundle.id}
                  label="Purchase Credits"
                  className={`w-full py-3.5 rounded-xl font-bold transition-all duration-300 border ${
                    bundle.popular 
                      ? 'bg-[#5B2D8E] text-white hover:bg-[#4A2475] shadow-lg shadow-[#5B2D8E]/25 border-transparent hover:-translate-y-0.5' 
                      : 'bg-white dark:bg-transparent text-[#1A0A2E] dark:text-white border-[#D1C4E9] dark:border-white/20 hover:bg-[#F5F3FA] dark:hover:bg-white/5'
                  }`}
                />
              </CardFooter>
            </Card>
          ))}
        </div>
        
        {/* Deep Dive Explainer Section */}
        <div className='max-w-5xl mx-auto mt-32'>
          <div className="grid md:grid-cols-2 gap-12">
            
            {/* Free Tier Info */}
            <div className="bg-white dark:bg-[#1A0A2E] rounded-[32px] p-10 border border-[#EBE5F0] dark:border-white/10 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-[#F5F3FA] dark:bg-[#5B2D8E]/20 flex items-center justify-center text-[#5B2D8E] mb-6">
                <Clock size={24} />
              </div>
              <h3 className="text-2xl font-bold text-[#1A0A2E] dark:text-white mb-4">Generous Free Daily Limits</h3>
              <p className="text-[#6B5A8A] dark:text-[#B39DDB] leading-relaxed mb-6">
                You get a generous free daily allowance of AI requests (e.g. 50 Fast Model requests, 10 Smart Model requests) that resets every single midnight. 
              </p>
              <div className="p-4 bg-[#F5F3FA] dark:bg-white/5 rounded-xl border border-[#EBE5F0] dark:border-transparent">
                <p className="text-sm font-medium text-[#1A0A2E] dark:text-[#D1C4E9]">
                  Most students only ever need to buy credits during midterms and finals week when their study volume skyrockets.
                </p>
              </div>
            </div>

            {/* Model Tier Info */}
            <div className="bg-white dark:bg-[#1A0A2E] rounded-[32px] p-10 border border-[#EBE5F0] dark:border-white/10 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-[#FFF4E5] dark:bg-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 mb-6">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-2xl font-bold text-[#1A0A2E] dark:text-white mb-4">Smart vs Fast Models</h3>
              <p className="text-[#6B5A8A] dark:text-[#B39DDB] leading-relaxed mb-6">
                Not all AI models are created equal. You have full control over which model processes your requests.
              </p>
              <ul className="space-y-4 text-[#1A0A2E] dark:text-[#D1C4E9] font-medium">
                <li className="flex gap-3">
                  <span className="font-bold text-[#5B2D8E] dark:text-[#9B72CF]">Fast Tier:</span> 
                  <span>(1x Multiplier) Uses Groq 8B or Gemini Flash for instant, cheap answers.</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-orange-600 dark:text-orange-400">Smart Tier:</span> 
                  <span>(10x Multiplier) Uses Groq 70B or Claude for deep, complex essay grading and analysis.</span>
                </li>
              </ul>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
