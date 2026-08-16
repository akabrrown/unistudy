'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Loader2, Award, Bot, RefreshCw, MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { toast } from 'sonner'

export default function ExamResults() {
  const params = useParams()
  const [answers, setAnswers] = useState<any[]>([])
  const [attempt, setAttempt] = useState<any>(null)
  const [grading, setGrading] = useState(true)
  const [overallScore, setOverallScore] = useState(0)
  const [totalAvailable, setTotalAvailable] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    const fetchAndGrade = async () => {
      setGrading(true)
      
      // 1. Fetch Attempt & Answers
      const { data: attData } = await supabase
        .from('past_paper_attempts')
        .select('*, past_papers!past_paper_attempts_past_paper_id_fkey(*)')
        .eq('id', params.attemptId)
        .single()
        
      if (attData) setAttempt(attData)

      const { data: ansData } = await supabase
        .from('past_paper_answers')
        .select('*, past_paper_questions(*)')
        .eq('attempt_id', params.attemptId)
        .order('id', { ascending: true })

      if (!ansData) {
        setGrading(false)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()

      let totalAwarded = 0
      let totalAvail = 0
      const gradedAnswers = [...ansData]

      // 2. Grade any ungraded answers via AI using batch endpoint
      const ungraded = gradedAnswers.filter(a => a.marks_awarded === null);
      
      if (ungraded.length > 0) {
        const payload = ungraded.map(ans => {
          const q = ans.past_paper_questions;
          totalAvail += (q.marks_available || 0);
          return {
            id: ans.id,
            question_content: q.text_content,
            marks_available: q.marks_available,
            student_answer: ans.user_answer_text?.trim() ? ans.user_answer_text : "[No answer provided]"
          };
        });

        const courseId = attData?.past_papers?.course_id;

        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8005'}/api/past-papers/grade-batch`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              ...(session && { Authorization: `Bearer ${session.access_token}` })
            },
            body: JSON.stringify({ answers: payload, is_ultra: false, course_id: courseId })
          });
          const result = await res.json();
          
          if (result.success && result.data && Array.isArray(result.data)) {
            // Apply results
            for (const gradedItem of result.data) {
              const ans = gradedAnswers.find(a => a.id === gradedItem.id);
              if (ans) {
                ans.marks_awarded = gradedItem.marks_awarded;
                ans.feedback = gradedItem.feedback;
                ans.model_answer = gradedItem.model_answer;
                
                // Persist to DB
                await supabase.from('past_paper_answers').update({
                  marks_awarded: ans.marks_awarded,
                  feedback: ans.feedback,
                  model_answer: ans.model_answer
                }).eq('id', ans.id);
              }
            }
          }
        } catch (e) {
          console.error('Batch grading failed', e);
        }
      }

      // Calculate total awarded and total available for already graded ones
      for (const ans of gradedAnswers) {
        if (!ungraded.find(u => u.id === ans.id)) {
            totalAvail += (ans.past_paper_questions.marks_available || 0);
        }
        totalAwarded += (ans.marks_awarded || 0);
      }

      setAnswers(gradedAnswers)
      setTotalAvailable(totalAvail)
      setOverallScore(totalAwarded)

      // Update attempt score
      if (totalAvail > 0 && attData) {
        const pct = (totalAwarded / totalAvail) * 100
        await supabase.from('past_paper_attempts').update({
          score_percentage: pct
        }).eq('id', params.attemptId)

        // Trigger drills generation
        try {
          await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8005'}/api/drills/generate-from-attempt`, {
             method: 'POST',
             headers: {
                 'Content-Type': 'application/json',
                 ...(session && { Authorization: `Bearer ${session.access_token}` })
             },
             body: JSON.stringify({ attemptId: params.attemptId })
          })
        } catch (e) {
          console.error("Failed to generate drills", e)
        }
      }
      
      setGrading(false)
    }

    if (params.attemptId) {
      fetchAndGrade()
    }
  }, [params.attemptId])

  const percentage = totalAvailable > 0 ? Math.round((overallScore / totalAvailable) * 100) : 0

  if (grading) {
    return (
      <div className="max-w-2xl mx-auto text-center py-24 space-y-6">
        <div className="relative w-24 h-24 mx-auto">
          <div className="absolute inset-0 border-4 border-muted rounded-full"></div>
          <div className="absolute inset-0 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
          <Bot className="absolute inset-0 m-auto w-8 h-8 text-purple-500 animate-pulse" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">AI is grading your exam...</h2>
          <p className="text-muted-foreground">The AI examiner is carefully reviewing your answers against the marking scheme.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Report Card Header */}
      <Card className="overflow-hidden border-none shadow-xl bg-gradient-to-br from-background to-muted relative">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Award className="w-48 h-48" />
        </div>
        <CardContent className="p-8 sm:p-12">
          <div className="flex flex-col md:flex-row items-center gap-8 justify-between relative z-10">
            <div className="space-y-4 text-center md:text-left">
              <h1 className="text-4xl font-black tracking-tight">Exam Results</h1>
              <p className="text-lg text-muted-foreground max-w-md">
                You've completed the {attempt?.past_papers?.year} {attempt?.past_papers?.exam_type} exam. Here is your AI-graded report card.
              </p>
              <div className="flex gap-4 justify-center md:justify-start pt-2">
                <Link href="/dashboard/past-papers">
                  <Button variant="outline">Back to Bank</Button>
                </Link>
                {attempt?.past_papers?.course_id && (
                  <Link href={`/dashboard/courses/${attempt.past_papers.course_id}/past-papers`}>
                    <Button className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20 border-none">
                      <RefreshCw className="w-4 h-4 mr-2" /> Start Weakness Drill
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            
            {/* Score Circle */}
            <div className="relative flex items-center justify-center">
              <svg className="w-40 h-40 transform -rotate-90">
                <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-muted" />
                <circle 
                  cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="8" fill="transparent" 
                  strokeDasharray="440" 
                  strokeDashoffset={440 - (440 * percentage) / 100} 
                  className={`${percentage >= 70 ? 'text-green-500' : percentage >= 40 ? 'text-yellow-500' : 'text-destructive'} transition-all duration-1000 ease-out`}
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-4xl font-black">{percentage}%</span>
                <span className="text-sm font-semibold text-muted-foreground">{overallScore} / {totalAvailable}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Feedback */}
      <div className="space-y-6">
        <h3 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="w-6 h-6 text-purple-500" /> AI Examiner Feedback
        </h3>
        
        {answers.map((ans, idx) => {
          const q = ans.past_paper_questions
          const marksAwarded = ans.marks_awarded || 0
          const isPerfect = marksAwarded === q.marks_available
          const isZero = marksAwarded === 0
          
          return (
            <Card key={ans.id} className={`border-l-4 ${isPerfect ? 'border-l-green-500' : isZero ? 'border-l-destructive' : 'border-l-yellow-500'}`}>
              <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base font-semibold">Question {q.question_number || (idx + 1)}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{q.text_content}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full font-bold text-sm ${isPerfect ? 'bg-green-500/10 text-green-600' : isZero ? 'bg-destructive/10 text-destructive' : 'bg-yellow-500/10 text-yellow-600'}`}>
                    {marksAwarded} / {q.marks_available}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-sm">
                <div>
                  <h4 className="font-semibold text-muted-foreground mb-1 uppercase tracking-wider text-[10px]">Your Answer</h4>
                  <div className="bg-background border border-border p-3 rounded font-mono text-muted-foreground">
                    {ans.user_answer_text || <span className="italic opacity-50">No answer provided.</span>}
                  </div>
                </div>
                
                {ans.feedback && (
                  <div className="bg-purple-500/5 border border-purple-500/20 p-4 rounded-lg">
                    <h4 className="font-semibold text-purple-600 flex items-center gap-2 mb-2">
                      <Bot className="w-4 h-4" /> Examiner Comments
                    </h4>
                    <p className="text-foreground/90 leading-relaxed">{ans.feedback}</p>
                  </div>
                )}
                
                {ans.model_answer && !isPerfect && (
                  <div className="bg-green-500/5 border border-green-500/20 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-600 flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4" /> Model Answer
                    </h4>
                    <p className="text-foreground/90 leading-relaxed">{ans.model_answer}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
