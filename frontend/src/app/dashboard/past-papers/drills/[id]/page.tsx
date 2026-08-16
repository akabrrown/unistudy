'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bot, CheckCircle2, XCircle, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import Link from 'next/link'

export default function WeaknessDrillPage() {
  const params = useParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [drill, setDrill] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [isPassed, setIsPassed] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    const fetchDrill = async () => {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8005'}/api/drills/${params.id}/practice`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        })
        const data = await res.json()
        if (data.success) {
          setDrill(data.drill)
          setQuestions(data.questions)
        } else {
          toast.error("Failed to load drill questions")
        }
      } catch (err) {
        console.error(err)
        toast.error("Error loading drill")
      }
      setLoading(false)
    }
    
    if (params.id) {
      fetchDrill()
    }
  }, [params.id])

  const handleSelectOption = (qIndex: number, option: string) => {
    if (submitted) return
    setAnswers(prev => ({ ...prev, [qIndex]: option }))
  }

  const handleSubmit = async () => {
    if (Object.keys(answers).length < questions.length) {
      toast.error("Please answer all questions before submitting.")
      return
    }

    setSubmitting(true)
    let correctCount = 0
    
    // Auto-grade on frontend
    questions.forEach((q, idx) => {
      if (answers[idx] === q.correct_answer) {
        correctCount++
      }
    })

    setScore(correctCount)
    setSubmitted(true)

    // Send result to backend
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8005'}/api/drills/${params.id}/submit`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}` 
          },
          body: JSON.stringify({ score: correctCount, total: questions.length })
        })
        const data = await res.json()
        if (data.success) {
          setIsPassed(data.passed)
          if (data.drill.mastered) {
            toast.success("Topic Mastered! 🎉")
          } else if (data.passed) {
            toast.success("Great job! Keep it up to reach Mastery.")
          } else {
            toast.error("Keep practicing. You'll get it next time!")
          }
        }
      } catch (err) {
        console.error("Failed to save drill results", err)
      }
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto text-center py-24 space-y-6">
        <div className="relative w-24 h-24 mx-auto">
          <div className="absolute inset-0 border-4 border-muted rounded-full"></div>
          <div className="absolute inset-0 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
          <Bot className="absolute inset-0 m-auto w-8 h-8 text-purple-500 animate-pulse" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Generating Drills...</h2>
          <p className="text-muted-foreground">AI is creating targeted practice questions based on your weak areas.</p>
        </div>
      </div>
    )
  }

  if (!drill || questions.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Drill not found</h2>
        <Link href="/dashboard/courses">
          <Button>Back to Courses</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-8">
      <div>
        <Link href={`/dashboard/courses/${drill.course_id}/past-papers`}>
          <Button variant="ghost" className="pl-0 text-muted-foreground mb-4 hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-foreground">Weakness Drill</h1>
        <p className="text-muted-foreground mt-1">Topic: <span className="font-semibold text-purple-600">{drill.topic}</span></p>
      </div>

      {submitted && (
        <Card className={`border-l-4 ${isPassed ? 'border-l-green-500 bg-green-500/5' : 'border-l-yellow-500 bg-yellow-500/5'}`}>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold mb-1">
                {isPassed ? 'Drill Passed!' : 'Needs More Practice'}
              </h2>
              <p className="text-muted-foreground">You scored {score} out of {questions.length}.</p>
            </div>
            <div className="text-4xl font-black">{Math.round((score / questions.length) * 100)}%</div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {questions.map((q, qIndex) => {
          const isCorrect = answers[qIndex] === q.correct_answer;
          
          return (
            <Card key={qIndex} className={submitted ? (isCorrect ? 'border-green-500/50' : 'border-destructive/50') : ''}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg leading-relaxed font-medium flex gap-3">
                  <span className="text-purple-500 flex-shrink-0">Q{qIndex + 1}.</span> 
                  {q.question}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {q.options?.map((opt: string, i: number) => {
                  const isSelected = answers[qIndex] === opt;
                  const isActuallyCorrect = opt === q.correct_answer;
                  
                  let optionClass = "border-border hover:border-purple-500/50";
                  if (isSelected) optionClass = "border-purple-500 bg-purple-500/10";
                  
                  if (submitted) {
                    if (isActuallyCorrect) {
                      optionClass = "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400";
                    } else if (isSelected && !isActuallyCorrect) {
                      optionClass = "border-destructive bg-destructive/10 text-destructive";
                    } else {
                      optionClass = "border-border opacity-50";
                    }
                  }

                  return (
                    <div 
                      key={i}
                      onClick={() => handleSelectOption(qIndex, opt)}
                      className={`p-4 border rounded-xl cursor-pointer transition-all ${optionClass} flex items-center justify-between`}
                    >
                      <span>{opt}</span>
                      {submitted && isActuallyCorrect && <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />}
                      {submitted && isSelected && !isActuallyCorrect && <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {!submitted ? (
        <div className="flex justify-end pt-4">
          <Button 
            size="lg" 
            onClick={handleSubmit} 
            disabled={submitting || Object.keys(answers).length < questions.length}
            className="w-full sm:w-auto"
          >
            {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Grading...</> : 'Submit Answers'}
          </Button>
        </div>
      ) : (
        <div className="flex justify-end pt-4">
          <Link href={`/dashboard/courses/${drill.course_id}/past-papers`}>
            <Button size="lg" className="w-full sm:w-auto gap-2">
              Continue <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
