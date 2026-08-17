'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Download, MoreHorizontal, Microscope, Volume2, PenTool, StickyNote, Monitor, Eye, EyeOff, Loader2, PlaySquare, Play, X, Pin, Frown, Meh, Smile, Zap, Flame, Square, Eraser, RefreshCw, MessageCircle, Send, Hourglass, Pause, Calculator, Music, FileText, DownloadCloud, BookOpen, Languages, ChevronDown, SlidersHorizontal, Maximize } from 'lucide-react'
import { FocusTimer, FocusTimerRef } from '@/components/study/FocusTimer'
import { CalculatorPanel } from '@/components/study/CalculatorPanel'
import { generateSlideExplanation } from '@/app/actions/explain'
import { downloadLecturePack } from '@/lib/downloadPack'
import { getFlashcards } from '@/app/actions/flashcards'
import { Button } from '@/components/ui/button'
import { useSettings } from '@/contexts/SettingsContext'
import { ShareButton } from '@/components/study/ShareButton'
import { toast } from 'sonner'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup } from '@/components/ui/dropdown-menu'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { apiFetch, apiFetchRaw } from '@/lib/api/client'
export default function LectureViewer() {
  const params = useParams()
  const courseId = params.courseId as string;
  const lectureId = params.lectureId as string;
  
  const { settings } = useSettings();

  const [slides, setSlides] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [slidesLoading, setSlidesLoading] = useState(true)
  const [courseLectures, setCourseLectures] = useState<any[]>([])
  const [courseContext, setCourseContext] = useState('University Course')
  const [headerTitle, setHeaderTitle] = useState('Loading...')
  const [headerWeek, setHeaderWeek] = useState('Week -')
  const [lecture, setLecture] = useState<any>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [slideIndex, setSlideIndex] = useState(0)
  const currentSlide = slides[slideIndex]
  const totalSlides = slides.length
  const [level, setLevel] = useState('Med')
  const [confidence, setConfidence] = useState<number | null>(null)
  
  // Cache explanations so we don't re-fetch when navigating back and forth
  const [slideExplanations, setSlideExplanations] = useState<Record<number, string>>({})
  const explanation = slideExplanations[slideIndex] || (currentSlide?.explanation || '')
  
  const [loadingAI, setLoadingAI] = useState(false)

  // --- NEW TOOLBAR STATES ---
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isDrawMode, setIsDrawMode] = useState(false)
  const [isNotesOpen, setIsNotesOpen] = useState(false)
  const [showExplanation, setShowExplanation] = useState(true)
  const [isFocusMode, setIsFocusMode] = useState(false)

  // Listen for Escape key and arrows in focus mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFocusMode) return;
      if (e.key === 'Escape') {
        setIsFocusMode(false);
        toast.info('Exited Focus Mode');
      } else if (e.key === 'ArrowRight') {
        setSlideIndex(prev => Math.min(totalSlides - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setSlideIndex(prev => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocusMode, totalSlides]);
  
  // Focus timer panel
  const [isTimerOpen, setIsTimerOpen] = useState(false)
  const [timerDisplay, setTimerDisplay] = useState<{ time: string; mode: 'focus' | 'break'; isRunning: boolean } | null>(null)
  const timerRef = useRef<FocusTimerRef>(null)

  // AI Chat state
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<{ role: string, content: string }[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)

  // S18 Features State
  const [isSongOpen, setIsSongOpen] = useState(false)
  const [songContent, setSongContent] = useState('')
  const [isSongLoading, setIsSongLoading] = useState(false)
  const [explainMode, setExplainMode] = useState<'standard' | 'story' | 'conceptual'>('standard')
  const [isDownloadingPack, setIsDownloadingPack] = useState(false)

  // Translation state
  const [isTranslatingExplanation, setIsTranslatingExplanation] = useState(false)
  const [translatedExplanation, setTranslatedExplanation] = useState<Record<number, string>>({})

  // Load chat history and offline explanations from local storage when slide changes
  useEffect(() => {
    if (!currentSlide) return;
    const slideId = currentSlide.id || `${lectureId}-${slideIndex}`;
    const savedChat = localStorage.getItem(`slideChat_${slideId}`);
    if (savedChat) {
      try {
        setChatMessages(JSON.parse(savedChat));
      } catch (e) {
        setChatMessages([]);
      }
    } else {
      setChatMessages([]);
    }
    
    // Load offline explanation
    const offlineEx = localStorage.getItem(`offline_exp_${slideId}`);
    if (offlineEx && !slideExplanations[slideIndex]) {
      setSlideExplanations(prev => ({ ...prev, [slideIndex]: offlineEx }));
    }
  }, [slideIndex, currentSlide?.id, lectureId]);

  // Notes state
  const [slideNotes, setSlideNotes] = useState<string>('')
  const [savingNotes, setSavingNotes] = useState(false)

  // Fullscreen ref
  const slideContainerRef = useRef<HTMLDivElement>(null)

  // Canvas Drawing ref
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  // Load notes when slide changes
  useEffect(() => {
    async function loadNotes() {
      if (!currentSlide) return;
      const slideId = currentSlide.id || `${lectureId}-${slideIndex}`;
      try {
        const data = await apiFetch(`/lectures/${slideId}/notes`);
        setSlideNotes(data.content || '');
      } catch (err) {
        setSlideNotes('');
      }
    }
    loadNotes()
  }, [slideIndex, currentSlide, lectureId])

  const handleSaveNotes = async () => {
    if (!currentSlide) return;
    setSavingNotes(true)
    
    const slideId = currentSlide.id || `${lectureId}-${slideIndex}`;
    try {
      await apiFetch(`/lectures/${slideId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content: slideNotes })
      });
      toast.success('Note saved successfully!')
    } catch (err: any) {
      toast.error('Failed to save note')
    }
    setSavingNotes(false)
    setIsNotesOpen(false)
  }

  // Text to Speech
  const toggleSpeech = () => {
    if (settings.low_bandwidth) {
      toast.error("Text-to-Speech is disabled in Low Bandwidth mode.");
      return;
    }
    if (!window.speechSynthesis) {
      toast.error("Your browser does not support Text-to-Speech")
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      if (loadingAI) {
        toast.info("Please wait for the explanation to finish generating...");
        return;
      }
      
      // Clear any stuck synthesis
      window.speechSynthesis.cancel();
      
      // Strip HTML tags, markdown asterisks, and hash symbols
      let cleanExplanation = explanation.replace(/<[^>]+>/g, ' ').replace(/[*#]/g, '').trim();
      let cleanRaw = currentSlide?.raw_text?.replace(/[*#]/g, '').trim() || "";
      
      let textToRead = cleanExplanation || cleanRaw;
      
      if (!textToRead) {
        toast.error("There is no text available to read for this slide.");
        return;
      }

      const utterance = new SpeechSynthesisUtterance(textToRead);
      // Keep a reference on the window object to prevent the Chrome garbage collection bug
      (window as any)._currentUtterance = utterance;

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (e) => {
        console.error("SpeechSynthesis error:", e);
        setIsSpeaking(false);
        // "interrupted" is often thrown when cancel() is called, we don't need to show an error for that
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          toast.error("An error occurred while trying to read the text: " + e.error);
        }
      };
      
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  }

  // Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      slideContainerRef.current?.requestFullscreen().catch(err => {
        toast.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }

  // Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = '#e11d48'; // Rose 600 (Primary-ish)
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  const stopDrawing = () => {
    setIsDrawing(false);
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  // --- END NEW TOOLBAR STATES ---

  // YouTube Integration
  const [isYoutubeOpen, setIsYoutubeOpen] = useState(false)
  const [youtubeQuery, setYoutubeQuery] = useState('')
  const [youtubeResults, setYoutubeResults] = useState<any[]>([])
  const [isSearchingYoutube, setIsSearchingYoutube] = useState(false)

  const handleSearchYoutube = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!youtubeQuery.trim()) return

    setIsSearchingYoutube(true)
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(youtubeQuery)}`)
      const data = await res.json()
      if (data.videos) {
        setYoutubeResults(data.videos)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setIsSearchingYoutube(false)
    }
  }

  const handlePinVideo = async (video: any) => {
    try {
      await fetch('/api/youtube/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.videoId,
          title: video.title,
          channel: video.channel,
          thumbnail: video.thumbnail,
          courseId,
          lectureId
        })
      })
      // Could show a toast here
      alert('Video pinned successfully!')
    } catch (error) {
      console.error(error)
    }
  }

  // AI Chat Handler
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;
    
    const slideId = currentSlide?.id || `${lectureId}-${slideIndex}`;
    const userMsg = { role: 'user', content: chatInput };
    const newMessages = [...chatMessages, userMsg];
    
    setChatMessages(newMessages);
    localStorage.setItem(`slideChat_${slideId}`, JSON.stringify(newMessages));
    setChatInput('');
    setIsChatLoading(true);

    try {
      // Build context for the AI
      const slideText = currentSlide?.raw_text ? `Slide text: ${currentSlide.raw_text}` : '';
      const slideExplanation = explanation ? `AI explanation of slide: ${explanation.replace(/<[^>]*>?/gm, '')}` : '';
      
      const systemPrompt = `You are an AI tutor helping a student understand a slide. Context: Course: ${courseContext}. ${slideText}. ${slideExplanation}. Keep answers concise, helpful, and directly related to the student's question.`;

      const payloadMessages = [
        ...newMessages
      ];

      const res = await apiFetch('/ai/ask', {
        method: 'POST',
        body: JSON.stringify({
          feature: 'chat_message', // Groq 70b
          payload: { stream: false, systemPrompt, messages: payloadMessages }
        })
      });

      if (res.result) {
        // Handle standard response (non-streamed)
        const content = res.result.choices?.[0]?.message?.content || res.result;
        setChatMessages(prev => {
          const updated = [...prev, { role: 'assistant', content: typeof content === 'string' ? content : JSON.stringify(content) }];
          localStorage.setItem(`slideChat_${slideId}`, JSON.stringify(updated));
          return updated;
        });
      } else {
        toast.error('Failed to get a response from AI');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to send message: ' + err.message);
    } finally {
      setIsChatLoading(false);
    }
  }

  // Fetch real data
  useEffect(() => {
    async function loadData() {
      try {
        // Fetch lecture and course info
        const lectureData = await apiFetch(`/lectures/detail/${lectureId}`)
          
        if (lectureData) {
          setLecture(lectureData)
          const cTitle = Array.isArray(lectureData.courses) ? lectureData.courses[0]?.title : (lectureData.courses as any)?.title;
          const cCode = Array.isArray(lectureData.courses) ? lectureData.courses[0]?.course_code : (lectureData.courses as any)?.course_code;
          
          setCourseContext(`${cCode || ''}: ${cTitle || ''}`)
          setHeaderTitle(`${cCode || 'Course'} - ${lectureData.title}`)
          setHeaderWeek(`Week ${lectureData.week || '-'}`)
          setYoutubeQuery(`${cCode || ''} ${lectureData.title}`)
        }

        // Fetch all lectures for dropdown
        const allLectures = await apiFetch(`/lectures/${courseId}`)
        if (allLectures) {
          setCourseLectures(allLectures)
        }

        // Fetch slides
        const slidesData = await apiFetch(`/lectures/${lectureId}/slides`)
        if (slidesData && slidesData.length > 0) {
          setSlides(slidesData)
        } else {
          setSlides([])
        }
      } catch (err: any) {
        console.error('Failed to load lecture data:', err)
        // Distinguish a genuine network failure from an empty result so the
        // "No Slides Found" screen isn't shown when the backend is unreachable.
        const msg = err?.message || 'Unknown error';
        const isNetworkError = msg.toLowerCase().includes('failed to fetch') ||
          msg.toLowerCase().includes('network') ||
          msg.toLowerCase().includes('load');
        setLoadError(isNetworkError
          ? 'Could not reach the server. Check your connection or wait a moment and refresh.'
          : `Failed to load lecture: ${msg}`);
      } finally {
        setSlidesLoading(false)
        setLoadingData(false)
      }
    }

    loadData()
  }, [lectureId, courseId])

  // Poll for slides if they are still processing in the background
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (lecture?.processing) {
      interval = setInterval(async () => {
        try {
          const lData = await apiFetch(`/lectures/detail/${lectureId}`);
          if (lData) setLecture(lData);

          const slidesData = await apiFetch(`/lectures/${lectureId}/slides`);
          if (slidesData) {
            setSlides(slidesData);
          }
        } catch (e) {
          console.error("Polling error:", e);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [lecture?.processing, lectureId]);

  const handleGenerateExplanation = async () => {
    if (!currentSlide || (!currentSlide.raw_text && !currentSlide.explanation && !currentSlide.image_url)) {
      return;
    }
    setLoadingAI(true);
    try {
      const res = await apiFetchRaw('/ai/explain', {
        method: 'POST',
        body: JSON.stringify({
          slideText: currentSlide.raw_text || '',
          level,
          courseContext,
          visionExplanation: currentSlide.explanation,
          imageUrl: currentSlide.image_url,
          mode: explainMode,
          prevSlideText: slideIndex > 0 ? slides[slideIndex - 1]?.raw_text : '',
          nextSlideText: slideIndex < slides.length - 1 ? slides[slideIndex + 1]?.raw_text : ''
        })
      });
      
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('No readable stream')
      
      setSlideExplanations(prev => ({ ...prev, [slideIndex]: '' }));
      setLoadingAI(false);

      let fullEx = '';
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n\n')) {
          if (!line.startsWith('data: ')) continue
          const dataStr = line.slice(6)
          if (dataStr === '[DONE]') break
          try {
            const data = JSON.parse(dataStr)
            fullEx += data;
            setSlideExplanations(prev => ({ ...prev, [slideIndex]: prev[slideIndex] + data }));
          } catch {
            // ignore malformed chunks
          }
        }
      }
      const slideId = currentSlide.id || `${lectureId}-${slideIndex}`;
      localStorage.setItem(`offline_exp_${slideId}`, fullEx);
    } catch (e: any) {
      setLoadingAI(false);
      setSlideExplanations(prev => ({ ...prev, [slideIndex]: `**Error:** ${e.message}` }));
    }
  }

  const handleDownloadPack = async () => {
    setIsDownloadingPack(true);
    try {
      const lectureData = await apiFetch(`/lectures/detail/${lectureId}`);
      const flashcardsRes = await getFlashcards([lectureId]);
      
      let allExplanations = '';
      for (const idx in slideExplanations) {
        allExplanations += `<h3>Slide ${parseInt(idx)+1}</h3>\n${slideExplanations[idx]}<hr/>\n`;
      }

      await downloadLecturePack(
        lectureData?.title || 'Lecture',
        flashcardsRes?.data || [],
        lectureData?.summary || 'No summary available.',
        allExplanations
      );
      toast.success('Lecture Pack downloaded!');
    } catch (e: any) {
      toast.error('Failed to download pack: ' + e.message);
    } finally {
      setIsDownloadingPack(false);
    }
  }

  const handleGenerateSong = async () => {
    if (!currentSlide?.raw_text) {
      toast.error("No text on this slide to generate a song from.");
      return;
    }
    setIsSongLoading(true);
    setSongContent('');
    try {
      const res = await apiFetch('/ai/ask', {
        method: 'POST',
        body: JSON.stringify({
          feature: 'revision_song',
          payload: { prompt: currentSlide.raw_text, stream: false }
        })
      });
      if (res.result) {
        const content = res.result.choices?.[0]?.message?.content || res.result;
        setSongContent(typeof content === 'string' ? content : JSON.stringify(content));
      } else {
        toast.error("Failed to generate song.");
      }
    } catch (e: any) {
      toast.error("Failed to generate song: " + e.message);
    } finally {
      setIsSongLoading(false);
    }
  }

  const handleTranslateExplanation = async () => {
    if (!explanation) {
      toast.error("No explanation to translate. Generate one first.");
      return;
    }
    if (translatedExplanation[slideIndex]) {
      // Toggle off: clear translation for this slide
      setTranslatedExplanation(prev => {
        const next = { ...prev };
        delete next[slideIndex];
        return next;
      });
      return;
    }
    setIsTranslatingExplanation(true);
    const targetLanguage = settings.language || 'fr';
    try {
      const plainText = explanation.replace(/<[^>]+>/g, '');
      const res = await apiFetch('/translate', {
        method: 'POST',
        body: JSON.stringify({ text: plainText, targetLanguage })
      });
      if (res.translatedText) {
        setTranslatedExplanation(prev => ({ ...prev, [slideIndex]: res.translatedText }));
      } else {
        toast.error("Translation returned empty.");
      }
    } catch (err) {
      toast.error("Translation failed.");
    } finally {
      setIsTranslatingExplanation(false);
    }
  }

  if (slidesLoading) {
    return (
      <div className="h-[calc(100vh-theme(spacing.16))] flex flex-col items-center justify-center gap-3 bg-background border border-border rounded-xl shadow-sm relative">
        <Loader2 className="animate-spin w-10 h-10 text-primary" />
        <p className="text-sm text-muted-foreground">Loading lecture — this may take a few seconds on first open.</p>
      </div>
    );
  }

  if (lecture?.processing) {
    return (
      <div className="h-[calc(100vh-theme(spacing.16))] flex flex-col items-center justify-center bg-background border border-border rounded-xl shadow-sm relative text-center space-y-4 p-8">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
          <Loader2 size={64} className="text-primary animate-spin relative z-10" />
        </div>
        <h2 className="text-2xl font-bold">Processing Slides</h2>
        <div className="text-muted-foreground max-w-md space-y-2">
          <p>We are extracting text and using AI to generate explanations for your presentation.</p>
          <p className="font-medium text-primary py-2 text-lg">Processed {slides.length} of {lecture?.slide_count || '?'} slides...</p>
          <p className="text-sm">This can take a few minutes for large presentations. Please wait, this page will automatically update when ready...</p>
        </div>
        <div className="pt-4 flex gap-4">
          <Link href={`/dashboard/courses/${courseId}`}>
            <Button variant="outline">Back to Course</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="h-[calc(100vh-theme(spacing.16))] flex flex-col items-center justify-center bg-background border border-border rounded-xl shadow-sm relative text-center space-y-4 p-8">
        <div className="relative text-destructive">
          <Frown size={64} className="relative z-10" />
        </div>
        <h2 className="text-2xl font-bold">Couldn't load this lecture</h2>
        <div className="text-muted-foreground max-w-md space-y-2">
          <p>{loadError}</p>
        </div>
        <div className="pt-4 flex gap-4">
          <Button onClick={() => { setLoadError(null); setSlidesLoading(true); window.location.reload(); }}>Try again</Button>
          <Link href={`/dashboard/courses/${courseId}`}>
            <Button variant="outline">Back to course</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (slides.length === 0) {
    return (
      <div className="h-[calc(100vh-theme(spacing.16))] flex flex-col items-center justify-center bg-background border border-border rounded-xl shadow-sm relative text-center space-y-4 p-8">
        <div className="relative text-destructive">
          <Frown size={64} className="relative z-10" />
        </div>
        <h2 className="text-2xl font-bold">No slides found</h2>
        <div className="text-muted-foreground max-w-md space-y-2">
          <p>Processing may have failed. Delete this lecture and re-upload the PDF to try again.</p>
        </div>
        <div className="pt-4 flex gap-4">
          <Link href={`/dashboard/courses/${courseId}`}>
            <Button variant="outline">Back to course</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col overflow-hidden bg-background shadow-sm relative ${isFocusMode ? 'fixed inset-0 z-50 rounded-none border-none' : 'h-[calc(100vh-theme(spacing.16))] border border-border rounded-xl'}`}>
      
      {/* Top bar */}
      {!isFocusMode && (
      <div className="h-14 flex-shrink-0 flex items-center gap-3 px-5 border-b border-border bg-card">
        <Link href={`/dashboard/courses/${courseId}`} className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
          <ChevronLeft size={16} /> Back
        </Link>
        <span className="text-border">|</span>
        <span className="text-sm font-semibold text-foreground truncate">{headerTitle}</span>

        {/* Live countdown pill — visible when timer is running or paused */}
        {timerDisplay && (
          <div className={`flex items-center gap-1 rounded-full border transition-all ${
            timerDisplay.mode === 'focus'
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-green-500/10 border-green-500/30 text-green-600'
          }`}>
            <button 
              onClick={() => timerRef.current?.toggle()} 
              className="p-1 hover:bg-black/5 rounded-full ml-1"
              title={timerDisplay.isRunning ? "Pause Timer" : "Play Timer"}
            >
              {timerDisplay.isRunning ? <Pause size={12} className="fill-current" /> : <Play size={12} className="fill-current translate-x-px" />}
            </button>
            <button
              onClick={() => setIsTimerOpen(true)}
              className="pr-2.5 py-1 text-xs font-bold tabular-nums flex items-center gap-1.5"
              title="Open timer panel"
            >
              {timerDisplay.time}
            </button>
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger className="ml-auto flex items-center justify-center h-9 px-3 text-xs font-semibold tracking-widest uppercase text-muted-foreground hover:text-primary hover:bg-accent rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            {headerWeek}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 max-h-[300px] overflow-y-auto">
            {courseLectures.map(lecture => (
              <DropdownMenuItem key={lecture.id} className="p-0">
                <Link href={`/dashboard/courses/${courseId}/lectures/${lecture.id}`} className={`w-full px-2 py-1.5 flex justify-between items-center cursor-pointer ${lecture.id === lectureId ? 'bg-muted font-medium' : ''}`}>
                  <span className="truncate pr-2">{lecture.title}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Week {lecture.week || '-'}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-primary h-8 w-8" onClick={handleDownloadPack} disabled={isDownloadingPack} title="Download Lecture Pack">
          {isDownloadingPack ? <Loader2 size={16} className="animate-spin" /> : <DownloadCloud size={16} />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-primary hover:bg-accent rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <MoreHorizontal size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => toast.info('Issue reported. Thank you for your feedback!')}>
              Report Issue
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info('Keyboard shortcuts coming soon!')}>
              Keyboard Shortcuts
            </DropdownMenuItem>
            <DropdownMenuItem className="p-0">
              <Link href={`/dashboard/courses/${courseId}/lectures/${lectureId}/poster`} className="w-full h-full px-2 py-1.5 cursor-pointer block text-primary">
                <FileText size={14} className="inline mr-2" /> Study Poster
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="p-0">
              <Link href={`/dashboard/courses/${courseId}/lectures/${lectureId}/cheat-sheet`} className="w-full h-full px-2 py-1.5 cursor-pointer block text-primary">
                <BookOpen size={14} className="inline mr-2" /> Exam Cheat Sheet
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="p-0">
              <Link href={`/dashboard/courses/${courseId}`} className="w-full h-full px-2 py-1.5 cursor-pointer block">
                Back to Course
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Slide panel */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
          {/* Slide display */}
          <div className="flex-1 flex items-center justify-center p-6 overflow-hidden bg-muted/10">
            <div ref={slideContainerRef} className="w-full max-w-3xl aspect-video rounded-2xl border border-border shadow-md flex items-center justify-center relative overflow-hidden bg-card">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10 opacity-50" />
              {currentSlide?.image_url && currentSlide.image_url !== 'https://example.com/placeholder.png' ? (
                <>
                  <div className="absolute inset-0 z-10 select-none overflow-hidden bg-white flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={settings.low_bandwidth ? currentSlide.image_url.replace('/upload/', '/upload/q_50/') : currentSlide.image_url} 
                      alt="Slide Content" 
                      className="w-full h-full object-contain pointer-events-none"
                    />
                  </div>
                  {isDrawMode && (
                    <>
                      <canvas 
                        ref={canvasRef}
                        width={800} // Logical width, scales via CSS
                        height={450} // 16:9 ratio logical height
                        className="absolute inset-0 w-full h-full z-20 cursor-crosshair touch-none"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                      />
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={clearCanvas}
                        className="absolute bottom-4 right-4 z-30 shadow-lg rounded-full"
                      >
                        <Eraser className="w-4 h-4 mr-2" /> Clear Drawings
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <div className="relative z-20 w-full h-full p-8 overflow-y-auto flex flex-col items-center justify-center text-center">
                  <h2 className="text-3xl font-bold text-foreground tracking-tight mb-6">{currentSlide?.title || `Slide ${slideIndex + 1}`}</h2>
                  <div className="text-muted-foreground text-left max-w-2xl whitespace-pre-wrap leading-relaxed text-lg">
                    {currentSlide?.raw_text || "No text extracted."}
                  </div>
                </div>
              )}

              {/* Floating Nav Buttons in Focus Mode */}
              {isFocusMode && (
                <>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/70 hover:bg-background backdrop-blur-sm rounded-full w-12 h-12 shadow-lg z-50"
                    onClick={(e) => { e.stopPropagation(); setSlideIndex(Math.max(0, slideIndex - 1)); }}
                    disabled={slideIndex === 0}
                  >
                    <ChevronLeft size={24} />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/70 hover:bg-background backdrop-blur-sm rounded-full w-12 h-12 shadow-lg z-50"
                    onClick={(e) => { e.stopPropagation(); setSlideIndex(Math.min(totalSlides - 1, slideIndex + 1)); }}
                    disabled={slideIndex === totalSlides - 1}
                  >
                    <ChevronRight size={24} />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="absolute right-4 top-4 bg-background/70 hover:bg-background backdrop-blur-sm rounded-full w-10 h-10 shadow-lg z-50"
                    onClick={(e) => { e.stopPropagation(); setIsFocusMode(false); toast.info('Exited Focus Mode'); }}
                    title="Exit Focus Mode (Esc)"
                  >
                    <X size={20} />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Nav strip */}
          {!isFocusMode && (
          <>
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-t border-border bg-card">
            <div className="flex items-center gap-1 w-[200px]">
              <Button 
                onClick={toggleSpeech} 
                variant={isSpeaking ? "secondary" : "ghost"} 
                size="icon-sm" 
                className={isSpeaking ? "text-primary bg-primary/10 animate-pulse" : "text-muted-foreground hover:bg-muted"}
                disabled={settings.low_bandwidth}
                title="Read Explanation (Text-to-Speech)"
              >
                {isSpeaking ? <Square size={16} className="fill-current" /> : <Volume2 size={16} />}
              </Button>
              <Button 
                onClick={() => setIsNotesOpen(!isNotesOpen)} 
                variant={isNotesOpen ? "secondary" : "ghost"} 
                size="icon-sm" 
                className={isNotesOpen ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-muted"}
                title="Slide Notes"
              >
                <StickyNote size={16} />
              </Button>
              <Button 
                onClick={toggleFullscreen} 
                variant="ghost" 
                size="icon-sm" 
                className="text-muted-foreground hover:bg-muted"
                title="Fullscreen"
              >
                <Monitor size={16} />
              </Button>
              <Button 
                onClick={() => setShowExplanation(!showExplanation)} 
                variant={!showExplanation ? "secondary" : "ghost"} 
                size="icon-sm" 
                className={!showExplanation ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-muted"}
                title="Toggle Explanation Panel"
              >
                {showExplanation ? <EyeOff size={16} /> : <Eye size={16} />}
              </Button>
              {!settings.simplified_mode && (
                <>
                  <Button 
                    onClick={() => setIsDrawMode(!isDrawMode)} 
                    variant={isDrawMode ? "secondary" : "ghost"} 
                    size="icon-sm" 
                    className={isDrawMode ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-muted"}
                    title="Draw on Slide"
                  >
                    <PenTool size={16} />
                  </Button>
                  <Button
                    onClick={() => setIsTimerOpen(!isTimerOpen)}
                    variant={isTimerOpen ? "secondary" : "ghost"}
                    size="icon-sm"
                    className={isTimerOpen ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-muted"}
                    title="Focus Timer"
                  >
                    <Hourglass size={16} />
                  </Button>
                  <Button
                    onClick={() => setIsFocusMode(true)}
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:bg-muted"
                    title="Focus Mode (Press Esc to exit)"
                  >
                    <Maximize size={16} />
                  </Button>
                </>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setSlideIndex(Math.max(0, slideIndex - 1))} disabled={slideIndex === 0}>
                <ChevronLeft size={20} />
              </Button>
              <span className="text-sm font-semibold text-foreground">Slide {slideIndex + 1} of {totalSlides}</span>
              <Button variant="ghost" size="icon" onClick={() => setSlideIndex(Math.min(totalSlides - 1, slideIndex + 1))} disabled={slideIndex === totalSlides - 1}>
                <ChevronRight size={20} />
              </Button>
            </div>
            <div className="w-[200px]" /> {/* Spacer for balance */}
          </div>

          {/* Thumbnail strip */}
          <div className="flex-shrink-0 flex gap-2 overflow-x-auto px-4 py-3 border-t border-border bg-muted/30">
            {slides.map((_, i) => (
              <button key={i} onClick={() => setSlideIndex(i)}
                className={`flex-shrink-0 w-20 h-12 rounded-lg border-2 transition-all ${i === slideIndex ? 'border-primary' : 'border-border bg-card hover:border-primary/50'}`}>
                <div className="w-full h-full flex items-center justify-center">
                  <span className={`text-xs font-bold ${i === slideIndex ? 'text-primary' : 'text-muted-foreground'}`}>{i + 1}</span>
                </div>
              </button>
            ))}
          </div>
          </>
          )}
        </div>

        {/* Right: Explanation panel */}
        {showExplanation && (
        <div className="w-[400px] flex-shrink-0 flex flex-col overflow-hidden bg-card border-l border-border transition-all">
          {/* Action Header */}
          {!isFocusMode && (
          <div className="flex-shrink-0 flex items-center gap-1 px-4 py-3 border-b border-border justify-between">
            <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap" >
              <Button variant="ghost" size="icon-sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setIsYoutubeOpen(true)} title="Find Resources">
                <PlaySquare size={16} />
              </Button>
              <Button variant="ghost" size="icon-sm" className="text-blue-500 hover:text-blue-600 hover:bg-blue-50" onClick={handleGenerateExplanation} title="Regenerate Explanation" disabled={loadingAI}>
                <RefreshCw size={16} className={loadingAI ? "animate-spin" : ""} />
              </Button>
              <Button variant="ghost" size="icon-sm" className="text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50" onClick={() => setIsChatOpen(true)} title="Ask AI about this slide">
                <MessageCircle size={16} />
              </Button>
              <Button variant="ghost" size="icon-sm" className="text-purple-500 hover:text-purple-600 hover:bg-purple-50" onClick={() => setIsCalculatorOpen(true)} title="Open Math Calculator">
                <Calculator size={16} />
              </Button>
              <Button variant="ghost" size="icon-sm" className="text-orange-500 hover:text-orange-600 hover:bg-orange-50" onClick={() => { setIsSongOpen(true); handleGenerateSong(); }} title="Generate Revision Song">
                <Music size={16} />
              </Button>
              <Button 
                variant="ghost" 
                size="icon-sm" 
                className={translatedExplanation[slideIndex] ? "text-teal-600 bg-teal-50" : "text-teal-500 hover:text-teal-600 hover:bg-teal-50"}
                onClick={handleTranslateExplanation} 
                disabled={isTranslatingExplanation}
                title={translatedExplanation[slideIndex] ? "Show original" : `Translate to ${settings.language || 'fr'}`}
              >
                {isTranslatingExplanation ? <Loader2 size={16} className="animate-spin" /> : <Languages size={16} />}
              </Button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border text-foreground hover:bg-muted transition-colors focus:outline-none">
                <SlidersHorizontal size={13} className="text-muted-foreground" />
                <span>{level}</span>
                <span className="text-muted-foreground">/</span>
                <span>{explainMode === 'standard' ? 'Std' : explainMode === 'story' ? 'Story' : 'Concept'}</span>
                <ChevronDown size={12} className="text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[10px] tracking-widest uppercase text-muted-foreground">Depth</DropdownMenuLabel>
                  {['ELI5', 'Med', 'Expert'].map((l) => (
                    <DropdownMenuItem key={l} onClick={() => setLevel(l)} className={level === l ? 'bg-primary/10 text-primary font-semibold' : ''}>
                      {l}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[10px] tracking-widest uppercase text-muted-foreground">Style</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => { setExplainMode('standard'); handleGenerateExplanation(); }} className={explainMode === 'standard' ? 'bg-primary/10 text-primary font-semibold' : ''}>
                    Standard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setExplainMode('story'); handleGenerateExplanation(); }} className={explainMode === 'story' ? 'bg-primary/10 text-primary font-semibold' : ''}>
                    Story
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setExplainMode('conceptual'); handleGenerateExplanation(); }} className={explainMode === 'conceptual' ? 'bg-primary/10 text-primary font-semibold' : ''}>
                    Conceptual
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          )}

          {/* Explanation text */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <p className="text-xs font-bold tracking-widest uppercase text-primary">AI Explanation</p>
                {currentSlide && localStorage.getItem(`offline_exp_${currentSlide.id || `${lectureId}-${slideIndex}`}`) && (
                  <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                    <DownloadCloud size={10} /> Saved offline
                  </span>
                )}
              </div>
              
              {loadingAI ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-4">
                  <Loader2 size={32} className="animate-spin text-primary/50" />
                  <p className="text-sm font-medium animate-pulse">Generating tailored explanation...</p>
                </div>
              ) : explanation ? (
                <div className="text-sm leading-relaxed text-foreground space-y-4 [&>p]:mb-4 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-4 [&>ul>li]:mb-2 [&>strong]:text-primary [&>strong]:font-bold prose prose-slate dark:prose-invert max-w-none prose-headings:text-primary prose-headings:font-bold prose-strong:text-foreground prose-li:my-1 prose-p:leading-relaxed">
                  {translatedExplanation[slideIndex] ? (
                    <p className="whitespace-pre-wrap">{translatedExplanation[slideIndex]}</p>
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {explanation}
                    </ReactMarkdown>
                  )}
                </div>
              ) : (!currentSlide?.raw_text && !currentSlide?.image_url && !currentSlide?.explanation) ? (
                <div className="text-sm text-muted-foreground italic bg-muted/20 p-4 rounded-lg border border-border text-center">
                  This slide doesn't contain enough text or visual information to generate an explanation yet.
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 border border-dashed border-border rounded-xl bg-muted/10 px-4">
                  <Zap className="w-10 h-10 text-primary opacity-50" />
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Manual Explanations Enabled</p>
                    <p className="text-xs text-muted-foreground">Generate an AI explanation only when you need it to save your quota.</p>
                  </div>
                  <Button onClick={handleGenerateExplanation} disabled={loadingAI} className="gap-2">
                    <Zap size={16} /> Generate Explanation
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Confidence meter */}
          {!isFocusMode && (
          <div className="flex-shrink-0 p-5 border-t border-border bg-muted/10">
            <p className="text-xs font-bold tracking-widest uppercase text-muted-foreground mb-4 text-center">How confident are you?</p>
            <div className="flex gap-2 justify-center">
              {[Frown, Meh, Smile, Zap, Flame].map((Icon, i) => (
                <button key={i} onClick={() => setConfidence(i)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all
                    ${confidence === i ? 'bg-primary/10 ring-2 ring-primary scale-110 shadow-lg shadow-primary/20 text-primary' : 'bg-card border border-border hover:bg-muted hover:scale-105 text-muted-foreground hover:text-foreground'}`}>
                  <Icon size={24} />
                </button>
              ))}
            </div>
          </div>
          )}
        </div>
        )}
      </div>

      {/* YouTube Slide-over Panel */}
      {isYoutubeOpen && (
        <div className="absolute right-0 top-14 bottom-0 w-[400px] bg-card border-l border-border shadow-2xl flex flex-col z-50 animate-in slide-in-from-right">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-bold flex items-center gap-2"><PlaySquare className="text-red-500" /> Find Resources</h3>
            <Button variant="ghost" size="icon-sm" onClick={() => setIsYoutubeOpen(false)}>
              <X size={16} />
            </Button>
          </div>
          
          <div className="p-4 border-b border-border bg-muted/10">
            <form onSubmit={handleSearchYoutube} className="flex gap-2">
              <input 
                className="flex-1 text-sm bg-background border border-border rounded-md px-3 py-2"
                placeholder="Search YouTube..."
                value={youtubeQuery}
                onChange={(e) => setYoutubeQuery(e.target.value)}
              />
              <Button type="submit" size="sm" disabled={isSearchingYoutube}>
                {isSearchingYoutube ? <Loader2 className="animate-spin w-4 h-4" /> : 'Search'}
              </Button>
            </form>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {youtubeResults.length === 0 && !isSearchingYoutube ? (
              <div className="text-center py-12 text-muted-foreground">
                <PlaySquare className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Search to find helpful videos for this lecture.</p>
              </div>
            ) : (
              youtubeResults.map(video => (
                <div key={video.videoId} className="bg-background border border-border rounded-lg overflow-hidden flex flex-col group">
                  <div className="relative aspect-video">
                    <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-3 flex-1 flex flex-col">
                    <h4 className="font-semibold text-sm line-clamp-2 mb-1">{video.title}</h4>
                    <p className="text-xs text-muted-foreground mb-3">{video.channel}</p>
                    <Button size="sm" variant="secondary" className="w-full mt-auto gap-2" onClick={() => handlePinVideo(video)}>
                      <Pin size={14} /> Pin to Course
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {/* Slide Notes Panel */}
      {isNotesOpen && (
        <div className="absolute right-0 top-14 bottom-0 w-[400px] bg-card border-l border-border shadow-2xl flex flex-col z-[60] animate-in slide-in-from-right">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-bold flex items-center gap-2"><StickyNote className="text-primary" /> Slide Notes</h3>
            <Button variant="ghost" size="icon-sm" onClick={() => setIsNotesOpen(false)}>
              <X size={16} />
            </Button>
          </div>
          
          <div className="flex-1 p-4 flex flex-col gap-4 bg-muted/5">
            <p className="text-sm text-muted-foreground">These notes are attached to <strong>Slide {slideIndex + 1}</strong> and sync securely to your account.</p>
            <textarea 
              className="flex-1 w-full bg-background border border-border rounded-lg p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none shadow-sm"
              placeholder="Type your personal notes here..."
              value={slideNotes}
              onChange={(e) => setSlideNotes(e.target.value)}
            />
          </div>
          <div className="p-4 border-t border-border bg-card flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsNotesOpen(false)}>Close</Button>
            <Button onClick={handleSaveNotes} disabled={savingNotes}>
              {savingNotes ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
              Save Notes
            </Button>
          </div>
        </div>
      )}

      {/* Revision Song Panel */}
      {isSongOpen && (
        <div className="absolute right-0 top-14 bottom-0 w-[400px] bg-card border-l border-border shadow-2xl flex flex-col z-[60] animate-in slide-in-from-right">
          <div className="flex items-center justify-between p-4 border-b border-border bg-orange-500/10">
            <h3 className="font-bold flex items-center gap-2 text-orange-600"><Music size={18} /> Revision Song</h3>
            <Button variant="ghost" size="icon-sm" onClick={() => setIsSongOpen(false)}>
              <X size={16} />
            </Button>
          </div>
          
          <div className="flex-1 p-6 overflow-y-auto bg-muted/5 whitespace-pre-wrap font-serif text-sm leading-loose">
            {isSongLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Loader2 size={32} className="animate-spin mb-4 text-orange-500" />
                <p>Composing revision song...</p>
              </div>
            ) : songContent ? (
              songContent
            ) : (
              <p className="text-muted-foreground italic text-center mt-10">No song generated.</p>
            )}
          </div>
          <div className="p-4 border-t border-border bg-card flex justify-end">
            <Button onClick={handleGenerateSong} disabled={isSongLoading} className="bg-orange-500 hover:bg-orange-600 text-white">
              <RefreshCw size={16} className={`mr-2 ${isSongLoading ? 'animate-spin' : ''}`} /> Regenerate Song
            </Button>
          </div>
        </div>
      )}

      {/* AI Chat Panel */}
      {isChatOpen && (
        <div className="absolute right-0 top-14 bottom-0 w-[400px] bg-card border-l border-border shadow-2xl flex flex-col z-[60] animate-in slide-in-from-right">
          <div className="flex items-center justify-between p-4 border-b border-border bg-emerald-500/10">
            <h3 className="font-bold flex items-center gap-2 text-emerald-600"><MessageCircle size={18} /> AI Tutor</h3>
            <div className="flex gap-1">
              {chatMessages.length > 0 && (
                <Button variant="ghost" size="icon-sm" onClick={() => {
                  const slideId = currentSlide?.id || `${lectureId}-${slideIndex}`;
                  localStorage.removeItem(`slideChat_${slideId}`);
                  setChatMessages([]);
                }} title="Start New Chat">
                  <Eraser size={16} className="text-muted-foreground hover:text-destructive transition-colors" />
                </Button>
              )}
              <Button variant="ghost" size="icon-sm" onClick={() => setIsChatOpen(false)}>
                <X size={16} />
              </Button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/5">
            {chatMessages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-20 text-emerald-500" />
                <p className="text-sm font-medium">Have a question about this slide?</p>
                <p className="text-xs mt-1">Ask the AI tutor for clarification, examples, or further details.</p>
              </div>
            ) : (
              chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted border border-border rounded-tl-sm'}`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-muted border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-foreground/30 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-foreground/30 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-foreground/30 rounded-full animate-bounce"></span>
                </div>
              </div>
            )}
          </div>
          
          <div className="p-3 border-t border-border bg-card">
            <form onSubmit={handleSendChatMessage} className="flex gap-2">
              <input 
                className="flex-1 bg-background border border-border rounded-full px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="Ask about this slide..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={isChatLoading}
              />
              <Button type="submit" size="icon" disabled={!chatInput.trim() || isChatLoading} className="rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shrink-0">
                <Send size={16} />
              </Button>
            </form>
          </div>
        </div>
      )}
      {isCalculatorOpen && <CalculatorPanel onClose={() => setIsCalculatorOpen(false)} />}
      
      {/* Background Focus Timer */}
      <FocusTimer ref={timerRef} isOpen={isTimerOpen} onClose={() => setIsTimerOpen(false)} onTick={setTimerDisplay} />
    </div>
  )
}
