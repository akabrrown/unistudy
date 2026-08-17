'use client'

import { useState } from "react"
import Link from 'next/link'
import { MarketingNavbar } from '@/components/layout/MarketingNavbar'
import {
  Brain, ArrowRight, Play, Layers,
  Upload, Zap, CheckCircle, Eye,
  Globe, MessageCircle, Share2
} from "lucide-react"

function Badge({ children, variant = "default", className = "" }: {
  children: React.ReactNode; variant?: "default" | "pro" | "new" | "success" | "warning" | "error"; className?: string;
}) {
  const styles: Record<string, string> = {
    default: "bg-[#EDE7F6] text-[#5B2D8E]",
    pro: "bg-gradient-to-r from-[#5B2D8E] to-[#7B4DB5] text-white",
    new: "bg-[#5B2D8E] text-white",
    success: "bg-[#E8F5E9] text-[#2E7D32]",
    warning: "bg-[#FFF3E0] text-[#E65100]",
    error: "bg-[#FFEBEE] text-[#B71C1C]",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
}

export default function LandingPage() {

  return (
    <div className="min-h-screen bg-[#FAF8FF] dark:bg-[#0F0C29] overflow-auto transition-colors" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Navbar */}
      <MarketingNavbar />

      {/* Hero */}
      <section className="relative max-w-7xl mx-auto px-8 pt-20 pb-16 grid lg:grid-cols-2 gap-12 items-center">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-1/3 w-[600px] h-[600px] bg-[#EDE7F6] dark:bg-[#5B2D8E]/20 rounded-full blur-[120px] opacity-50" />
        </div>
        <div className="relative space-y-6">
          <h1 className="text-5xl lg:text-[60px] font-bold leading-[1.1] text-[#1A0A2E] dark:text-white" style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}>
            Elevate Learning.<br />
            Achieve Excellence.
          </h1>
          <p className="text-[18px] text-[#6B5A8A] dark:text-[#B39DDB] leading-relaxed max-w-md">
            Upload your lecture slides and let UniStudy AI explain, quiz, and revise with you, tailored to your university module.
          </p>
          <div className="flex gap-3 flex-wrap">
            <Link href="/signup" className="flex items-center gap-2 bg-[#5B2D8E] text-white font-semibold px-6 py-3 rounded-[14px] hover:bg-[#3D1A6E] transition-colors">
              Get Started Free <ArrowRight size={16} />
            </Link>
          </div>
          <p className="text-[13px] text-[#9E8CB5]">No credit card required · Free forever plan</p>
        </div>

        {/* Mockup */}
        <div className="relative hidden lg:block">
          <div className="bg-white dark:bg-[#1A0A2E] rounded-2xl shadow-[0_12px_48px_rgba(91,45,142,0.18)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-[#D1C4E9] dark:border-white/10 p-4 overflow-hidden">
            <div className="flex items-center gap-1.5 mb-3">
              <div className="w-3 h-3 rounded-full bg-[#EDE7F6]" />
              <div className="w-3 h-3 rounded-full bg-[#EDE7F6]" />
              <div className="w-3 h-3 rounded-full bg-[#EDE7F6]" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 bg-[#F5F3FA] dark:bg-white/5 rounded-xl p-3">
                <div className="h-28 bg-gradient-to-br from-[#EDE7F6] to-[#D1C4E9] dark:from-[#5B2D8E]/40 dark:to-[#3D1A6E]/40 rounded-lg mb-3 flex items-center justify-center">
                  <Layers size={32} className="text-[#5B2D8E] opacity-40" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-2 bg-[#D1C4E9] rounded-full w-3/4" />
                  <div className="h-2 bg-[#D1C4E9] rounded-full w-full" />
                  <div className="h-2 bg-[#D1C4E9] rounded-full w-5/6" />
                </div>
              </div>
              <div className="space-y-2">
                {["Explain", "Quiz", "Revise"].map((t, i) => (
                  <div key={t} className={`p-2 rounded-lg border text-xs font-semibold ${i === 0 ? "bg-[#EDE7F6] dark:bg-[#5B2D8E] border-[#5B2D8E] dark:border-transparent text-[#5B2D8E] dark:text-white" : "bg-white dark:bg-transparent border-[#D1C4E9] dark:border-white/10 text-[#9E8CB5]"}`}>{t}</div>
                ))}
                <div className="mt-3 p-2 bg-[#5B2D8E] rounded-lg text-white text-xs font-semibold text-center">Smart Summaries</div>
              </div>
            </div>
          </div>
        </div>
      </section>




      {/* Footer */}
      <footer className="bg-[#F5F3FA] dark:bg-[#0F0C29] border-t border-[#D1C4E9] dark:border-white/10 px-8 py-6">
        <div className="flex justify-between items-center flex-wrap gap-4 max-w-6xl mx-auto">
          <p className="text-[13px] text-[#9E8CB5]">© 2025 UniStudy AI Ltd. All rights reserved.</p>
          <div className="flex gap-4 text-[#B39DDB]">
            <Globe size={16} /><MessageCircle size={16} /><Share2 size={16} />
          </div>
        </div>
      </footer>
    </div>
  )
}
