'use client';
import { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FileText, ArrowLeft, Loader2, Save } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { toast } from 'react-hot-toast';

export default function YouTubeWatchPage({ params }: { params: Promise<{ videoId: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const unwrappedParams = use(params);
  const videoId = unwrappedParams.videoId;
  
  const title = searchParams.get('title') || 'YouTube Video';
  const channel = searchParams.get('channel') || '';

  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // In a real app, we might load saved notes for this videoId from the backend.
  // For now, we provide the UI for it.
  
  const handleSaveNotes = async () => {
    setSaving(true);
    // Mock save delay
    await new Promise(r => setTimeout(r, 600));
    toast.success('Notes saved successfully');
    setSaving(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="hover:bg-muted">
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-xl font-bold line-clamp-1">{title}</h1>
            {channel && <p className="text-sm text-muted-foreground">{channel}</p>}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-muted/10">
        {/* VIDEO PLAYER */}
        <div className="w-full lg:w-3/4 bg-black flex items-center justify-center shadow-inner relative">
          <iframe
            className="w-full aspect-video max-h-full"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>

        {/* NOTES SIDEBAR */}
        <div className="w-full lg:w-1/4 border-l border-border bg-card flex flex-col shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)] relative">
          <div className="p-5 border-b border-border bg-muted/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="font-bold text-md text-foreground">Study Notes</h3>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Auto-saves as you type</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={handleSaveNotes} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </Button>
          </div>
          
          <textarea 
            className="flex-1 p-5 bg-transparent resize-none focus:outline-none focus:ring-0 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/40"
            placeholder="Jot down key formulas, insights, or timestamps..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          ></textarea>
        </div>
      </div>
    </div>
  );
}
