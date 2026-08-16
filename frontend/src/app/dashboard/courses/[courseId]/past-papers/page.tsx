import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Upload, FileText, ArrowRight, TrendingUp, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default async function PastPapersPage(props: { params: Promise<{ courseId: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return notFound();

  // Fetch real past papers
  const { data: pastPapers } = await supabase
    .from('past_papers')
    .select('*')
    .eq('course_id', params.courseId)
    .order('year', { ascending: false });

  // Fetch real weakness drills
  const { data: drills } = await supabase
    .from('weakness_drills')
    .select('*')
    .eq('course_id', params.courseId)
    .eq('mastered', false)
    .order('updated_at', { ascending: false });

  const papers = pastPapers || [];
  const activeDrills = drills || [];

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Past Papers & Drills</h1>
          <p className="text-muted-foreground mt-1">Upload exams, get AI grading, and track your weak areas.</p>
        </div>
        <Button className="gap-2">
          <Upload className="w-4 h-4" />
          Upload Past Paper
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Papers List */}
        <div className="md:col-span-2 space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-500" />
            Available Papers
          </h2>
          {papers.length === 0 ? (
            <div className="text-center p-8 border border-dashed rounded-xl bg-muted/20">
              <p className="text-muted-foreground">No past papers uploaded yet.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {papers.map(paper => (
                <div key={paper.id} className="flex items-center justify-between p-4 bg-card border border-border rounded-xl shadow-sm hover:border-purple-500/50 transition-colors">
                  <div>
                    <h3 className="font-semibold text-base">{paper.year} {paper.exam_type === 'end-semester' ? 'Final Exam' : 'Midterm'}</h3>
                    <p className="text-sm text-muted-foreground">Uploaded {new Date(paper.created_at).toLocaleDateString()}</p>
                  </div>
                  <Link href={`/dashboard/courses/${params.courseId}/past-papers/${paper.id}/attempt`}>
                    <Button variant="outline" size="sm" className="gap-2">
                      Attempt
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Trends and Drills */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold flex items-center gap-2 mb-4 text-foreground">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              Weak Areas
            </h3>
            {activeDrills.length === 0 ? (
              <p className="text-sm text-muted-foreground">Attempt a past paper to uncover your weak areas.</p>
            ) : (
              <div className="space-y-3">
                {activeDrills.map(drill => (
                  <div key={drill.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
                    <span className="text-sm font-medium line-clamp-1" title={drill.topic}>{drill.topic}</span>
                    <Link href={`/dashboard/past-papers/drills/${drill.id}`}>
                      <Button size="sm" variant="secondary" className="h-7 text-xs flex-shrink-0">Drill</Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
