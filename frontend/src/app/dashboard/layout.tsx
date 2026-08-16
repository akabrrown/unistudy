import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { signout } from '../(auth)/actions'
import { Button } from '@/components/ui/button'
// Removed Gamification Component
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { ModelSelector } from '@/components/layout/ModelSelector'
import SmartSearchBar from '@/components/layout/SmartSearchBar'
import { 
  LayoutDashboard, 
  BookOpen, 
  CalendarDays, 
  Timer, 
  Users, 
  Trophy, 
  Calculator, 
  Camera, 
  FileText, 
  LineChart,
  Accessibility,
  CreditCard,
  Shield,
  PlaySquare,
  Share2,
  MessageSquare,
  User as UserIcon,
  Award
} from 'lucide-react'

import { AnnouncementBanner } from '@/components/layout/AnnouncementBanner'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, institutions(abbreviation, name)')
    .eq('id', user.id)
    .single()

  // Fetch the single most recent announcement
  const { data: latestAnnouncement } = await supabase
    .from('announcements')
    .select('id, title, body')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-card border-r border-border p-4 flex flex-col">
        <div className="mb-6">
          <img src="/logo.jpeg" alt="UniStudy AI" className="h-10 w-auto object-contain dark:hidden" />
          <img src="/logo-dark.jpeg" alt="UniStudy AI" className="h-10 w-auto object-contain hidden dark:block" />
        </div>
        <div className="mb-6 px-2">
          <SmartSearchBar />
        </div>
        <nav className="space-y-1 flex-1 overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar">
          <div className="space-y-1">
            <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Overview</p>
            <Link href="/dashboard" className="flex items-center px-4 py-2.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors">
              <LayoutDashboard className="w-4 h-4 mr-3" /> Dashboard
            </Link>
          <Link href="/dashboard/courses" className="flex items-center px-4 py-2.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors">
            <BookOpen className="w-4 h-4 mr-3" /> Courses
          </Link>
          <Link href="/dashboard/past-papers" className="flex items-center px-4 py-2.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors">
            <Award className="w-4 h-4 mr-3" /> Past Papers
          </Link>
          <Link href="/dashboard/calendar" className="flex items-center px-4 py-2.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors">
            <CalendarDays className="w-4 h-4 mr-3" /> Study Calendar
          </Link>
          <Link href="/dashboard/scanner" className="flex items-center px-4 py-2.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors">
            <Camera className="w-4 h-4 mr-3" /> Notes Scanner
          </Link>
          <Link href="/dashboard/essay-grader" className="flex items-center px-4 py-2.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors">
            <FileText className="w-4 h-4 mr-3" /> Essay Grader
          </Link>
          <Link href="/dashboard/analytics" className="flex items-center px-4 py-2.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors">
            <LineChart className="w-4 h-4 mr-3" /> Analytics & Insights
          </Link>
          </div>
          
          <div className="pt-4 border-t border-border mt-4 space-y-1">
            <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Resources</p>
            <Link href="/dashboard/youtube" className="flex items-center px-4 py-2.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors">
              <PlaySquare className="w-4 h-4 mr-3 text-red-500" /> YouTube Study
            </Link>
          </div>
          
          <div className="pt-4 border-t border-border mt-4 space-y-1">
            <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Settings</p>
            <Link href="/dashboard/settings/profile" className="flex items-center px-4 py-2.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors">
              <UserIcon className="w-4 h-4 mr-3" /> Profile
            </Link>
            <Link href="/dashboard/settings/accessibility" className="flex items-center px-4 py-2.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors">
              <Accessibility className="w-4 h-4 mr-3" /> Accessibility
            </Link>
            <Link href="/dashboard/settings/billing" className="flex items-center px-4 py-2.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors"><CreditCard className="w-4 h-4 mr-3" /> Billing</Link>
          </div>

          {profile?.role === 'admin' && (
            <Link href="/admin" className="flex items-center justify-center px-4 py-2.5 mt-4 border border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground rounded-md transition-colors font-medium text-center">
              <Shield className="w-4 h-4 mr-2" /> Admin Panel
            </Link>
          )}
        </nav>
        <div className="mt-auto border-t border-border pt-4">
          <div className="flex items-center gap-3 mb-4 px-2">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                {profile?.full_name?.charAt(0) || 'U'}
              </div>
            )}
            <div className="text-sm">
              <div className="font-medium text-foreground">{profile?.username || profile?.full_name?.split(' ')[0] || 'Student'}</div>
              <div className="text-muted-foreground text-xs">
                {profile?.institutions?.abbreviation || profile?.institutions?.name ? (
                  profile.institutions.abbreviation || profile.institutions.name
                ) : (
                  <Link href="/dashboard/settings/profile" className="text-plum-500 hover:underline">Setup needed</Link>
                )}
              </div>
            </div>
          </div>
          
          <div className="px-2 mb-4">
            {/* Removed Gamification Bar */}
          </div>

          <ModelSelector />

          <div className="flex items-center gap-2 mb-6 px-2">
            <div className="flex-1">
              <form action={signout}>
                <Button variant="outline" className="w-full" type="submit">Sign Out</Button>
              </form>
            </div>
            <div className="flex-none">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto relative">
        <AnnouncementBanner announcement={latestAnnouncement} />
        {children}
      </main>
    </div>
  )
}
