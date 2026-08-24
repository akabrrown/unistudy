"use client";
import React, { useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export function MarketingNavbar() {
  const links = [
    { label: "Home", href: "/" },
    { label: "Features", href: "/features" },
    { label: "How it works", href: "/how-it-works" },
    { label: "Pricing", href: "/pricing" },
    { label: "Contact", href: "/contact" },
  ];

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 bg-[#FAF8FF]/90 dark:bg-[#0F0C29]/90 backdrop-blur border-b border-[#D1C4E9]/60 dark:border-white/10 px-8 h-16 flex items-center justify-between transition-colors">
      <Link href="/" className="flex items-center gap-2">
        <img src="/logo.jpeg" alt="UniStudy AI" className="h-8 w-auto object-contain dark:hidden" />
        <img src="/logo-dark.jpeg" alt="UniStudy AI" className="h-8 w-auto object-contain hidden dark:block" />
      </Link>
      {/* Desktop links */}
      <div className="hidden md:flex items-center gap-7 text-[14px] text-[#6B5A8A] dark:text-[#B39DDB]">
        {links.map((link) => (
          <Link key={link.label} href={link.href} className="hover:text-[#5B2D8E] dark:hover:text-white transition-colors">
            {link.label}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          <button
            className="p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#5B2D8E]"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            <svg className="h-6 w-6 text-[#5B2D8E] dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          <Link href="/login" className="text-[14px] font-medium text-[#5B2D8E] dark:text-[#D1C4E9] px-4 py-2 hover:bg-[#EDE7F6] dark:hover:bg-white/5 rounded-xl transition-colors">
            Log in
          </Link>
          <Link href="/signup" className="text-[14px] font-medium bg-[#5B2D8E] text-white px-5 py-2 rounded-[14px] hover:bg-[#3D1A6E] transition-colors">
            Get Started Free
          </Link>
        </div>
      </div>
      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="fixed z-50 top-16 left-0 w-full bg-[#FAF8FF] dark:bg-[#0F0C29] border-b border-[#D1C4E9]/60 dark:border-white/10 md:hidden shadow-lg">
          <div className="flex flex-col p-4 space-y-4">
            {links.map((link) => (
              <Link key={link.label} href={link.href} className="text-[15px] font-medium text-[#6B5A8A] dark:text-[#B39DDB] hover:text-[#5B2D8E] dark:hover:text-white transition-colors" onClick={() => setMobileMenuOpen(false)}>
                {link.label}
              </Link>
            ))}
            <hr className="border-[#D1C4E9]/60 dark:border-white/10" />
            <div className="flex flex-col gap-3">
              <Link href="/login" className="text-center text-[15px] font-medium text-[#5B2D8E] dark:text-[#D1C4E9] px-4 py-3 hover:bg-[#EDE7F6] dark:hover:bg-white/5 rounded-xl transition-colors border border-[#5B2D8E]/20 dark:border-white/10" onClick={() => setMobileMenuOpen(false)}>
                Log in
              </Link>
              <Link href="/signup" className="text-center text-[15px] font-medium bg-[#5B2D8E] text-white px-5 py-3 rounded-[14px] hover:bg-[#3D1A6E] transition-colors shadow-sm" onClick={() => setMobileMenuOpen(false)}>
                Get Started Free
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
