"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

export function MobileSidebar({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the sheet when the pathname changes (e.g., when a user clicks a link)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card sticky top-0 z-40">
      <div className="flex items-center gap-2">
        <img src="/logo.jpeg" alt="UniStudy AI" className="h-8 w-auto object-contain dark:hidden" />
        <img src="/logo-dark.jpeg" alt="UniStudy AI" className="h-8 w-auto object-contain hidden dark:block" />
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="p-2 text-foreground focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary rounded-md">
          <Menu className="w-6 h-6" />
        </SheetTrigger>
        <SheetContent side="left" className="p-0 flex flex-col w-72 bg-card border-r border-border">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="h-full flex flex-col overflow-y-auto pt-4">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
