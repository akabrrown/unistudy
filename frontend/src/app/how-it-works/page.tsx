import { MarketingNavbar } from "@/components/layout/MarketingNavbar";
import { Upload, Brain, Zap, Video, Scan, Heart, Activity, LineChart, FileText } from "lucide-react";

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-[#FAF8FF] dark:bg-[#0F0C29] transition-colors" style={{ fontFamily: "Inter, sans-serif" }}>
      <MarketingNavbar />
      <main className="max-w-6xl mx-auto px-8 py-20">
        
        {/* Core Workflow Section */}
        <div className="mb-24">
          <div className="text-center mb-16">
            <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9B72CF] mb-4">Core Workflow</p>
            <h1 className="text-5xl md:text-6xl font-black text-[#1A0A2E] dark:text-white mb-6 tracking-tight">
              From material to mastery in 3 steps
            </h1>
            <p className="text-xl text-[#6B5A8A] dark:text-[#B39DDB] max-w-2xl mx-auto">
              UniStudy's AI engine is built specifically for university students. Here is how you can use it to dominate your semester.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { n: "01", icon: Upload, title: "Upload your slides", desc: "Drag in any PDF lecture deck. We parse and structure the content automatically based on your specific university curriculum." },
              { n: "02", icon: Brain, title: "AI explains everything", desc: "Get layered explanations at your chosen complexity level with examples tailored to your exact degree programme." },
              { n: "03", icon: Zap, title: "Practice until confident", desc: "Flashcards, quizzes, and past papers, all generated specifically from your actual lecture content." },
            ].map(({ n, icon: Icon, title, desc }) => (
              <div key={n} className="group relative p-8 bg-white dark:bg-[#1A0A2E] rounded-[32px] border border-[#EBE5F0] dark:border-white/10 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 overflow-hidden">
                <span className="text-7xl font-black text-[#F5F3FA] dark:text-[#5B2D8E]/20 absolute top-4 right-4 select-none group-hover:text-[#EDE7F6] dark:group-hover:text-[#5B2D8E]/40 transition-colors">{n}</span>
                <div className="w-16 h-16 rounded-2xl bg-[#F5F3FA] dark:bg-[#5B2D8E]/30 flex items-center justify-center text-[#5B2D8E] mb-8 relative z-10 group-hover:bg-[#5B2D8E] group-hover:text-white transition-colors">
                  <Icon size={28} />
                </div>
                <h3 className="text-[22px] font-bold text-[#1A0A2E] dark:text-white mb-4 relative z-10" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>{title}</h3>
                <p className="text-[15px] text-[#6B5A8A] dark:text-[#B39DDB] leading-relaxed relative z-10">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Flexible Inputs Section */}
        <div className="mb-24">
          <div className="text-center mb-12">
            <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9B72CF] mb-4">Any Input</p>
            <h2 className="text-4xl font-bold text-[#1A0A2E] dark:text-white" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Learn from any source
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              { icon: Video, title: "YouTube Videos", desc: "Paste any educational YouTube link. Our AI instantly extracts the transcript, summarizes the key points, and generates structured notes." },
              { icon: Scan, title: "Handwritten Notes (OCR)", desc: "Take a picture of your whiteboard or notebook. We'll scan, digitize, and turn your handwriting into searchable, studyable text." },
            ].map(({ icon: Icon, title, desc }, i) => (
              <div key={i} className="flex gap-6 p-8 bg-white dark:bg-[#1A0A2E] rounded-[24px] border border-[#EBE5F0] dark:border-white/10 shadow-sm hover:border-[#5B2D8E]/30 transition-colors">
                <div className="w-14 h-14 flex-shrink-0 rounded-2xl bg-[#F5F3FA] dark:bg-[#5B2D8E]/40 flex items-center justify-center text-[#5B2D8E]">
                  <Icon size={26} />
                </div>
                <div>
                  <h3 className="text-[19px] font-bold text-[#1A0A2E] dark:text-white mb-3" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>{title}</h3>
                  <p className="text-[15px] text-[#6B5A8A] dark:text-[#B39DDB] leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ecosystem & Wellbeing Section */}
        <div>
          <div className="text-center mb-12">
            <p className="text-[12px] font-bold tracking-[0.2em] uppercase text-[#9B72CF] mb-4">Track & Optimize</p>
            <h2 className="text-4xl font-bold text-[#1A0A2E] dark:text-white" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Work smart, stay healthy
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: LineChart, title: "Performance Analytics", desc: "See exactly which modules you're failing in flashcards and quizzes, so you know exactly where to direct your energy." },
              { icon: FileText, title: "Essay Grader", desc: "Don't wait for your professor. Paste your essay drafts and get instant structural and grammatical feedback to improve your grade." },
              { icon: Heart, title: "Wellbeing Tracker", desc: "Log your mood and anxiety levels. We'll automatically suggest optimal study breaks and interventions to ensure you avoid burnout." },
            ].map(({ icon: Icon, title, desc }, i) => (
              <div key={i} className="p-8 bg-white dark:bg-[#1A0A2E] rounded-[24px] border border-[#EBE5F0] dark:border-white/10 shadow-sm text-center hover:-translate-y-1 transition-transform">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-[#F5F3FA] dark:bg-[#5B2D8E]/40 flex items-center justify-center text-[#5B2D8E] mb-6">
                  <Icon size={28} />
                </div>
                <h3 className="text-[20px] font-bold text-[#1A0A2E] dark:text-white mb-3" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>{title}</h3>
                <p className="text-[15px] text-[#6B5A8A] dark:text-[#B39DDB] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
