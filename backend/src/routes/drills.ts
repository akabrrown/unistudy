import { Router } from 'express';
import { supabaseAsUser, supabaseAdmin } from '../lib/supabase';
import { authenticateUser } from '../middleware/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

const router = Router();
router.use(authenticateUser);
import { withAIQuota } from '../middleware/quotaGuard';
import { consumeUserQuota } from '../lib/ai/quota';

// Generate drills based on weak performance in an attempt
router.post('/generate-from-attempt', async (req: any, res: any) => {
    try {
        const { attemptId } = req.body;
        if (!attemptId) return res.status(400).json({ error: 'Missing attemptId' });

        const supabase = supabaseAsUser(req.user!.jwt);
        
        // Fetch answers for the attempt that are scored < 70%
        const { data: answers, error: aErr } = await supabase
            .from('past_paper_answers')
            .select(`
                *,
                past_paper_questions (
                    id, text_content, extracted_topic, marks_available, past_paper_id,
                    past_papers (
                        course_id
                    )
                )
            `)
            .eq('attempt_id', attemptId)
            .not('marks_awarded', 'is', null);

        if (aErr) throw aErr;
        if (!answers || answers.length === 0) {
            return res.json({ success: true, message: 'No graded answers found.' });
        }

        const weakTopics = new Set<string>();

        for (const ans of answers) {
            const q = (ans as any).past_paper_questions;
            if (!q) continue;
            
            const maxMarks = q.marks_available || 1;
            const awarded = ans.marks_awarded || 0;
            const percentage = awarded / maxMarks;

            if (percentage < 0.7 && q.extracted_topic) {
                // Topic format is often "TYPE|Topic Name"
                let topicName = q.extracted_topic;
                if (topicName.includes('|')) {
                    topicName = topicName.split('|')[1];
                }
                const courseId = q.past_papers?.course_id;
                
                if (courseId && topicName) {
                    weakTopics.add(JSON.stringify({ topic: topicName.trim(), courseId }));
                }
            }
        }

        const newDrills = [];
        
        // Check if drill already exists and is mastered
        for (const topicStr of weakTopics) {
            const { topic, courseId } = JSON.parse(topicStr);
            
            // Check existing drill
            const { data: existing } = await supabase
                .from('weakness_drills')
                .select('id, mastered')
                .eq('user_id', req.user!.id)
                .eq('course_id', courseId)
                .ilike('topic', topic)
                .maybeSingle();
                
            if (!existing || !existing.mastered) {
                if (!existing) {
                    newDrills.push({
                        user_id: req.user!.id,
                        course_id: courseId,
                        topic: topic,
                        difficulty_level: 'medium',
                        consecutive_correct: 0,
                        mastered: false
                    });
                }
            }
        }

        if (newDrills.length > 0) {
            const { error: insertErr } = await supabaseAdmin
                .from('weakness_drills')
                .insert(newDrills);
            if (insertErr) throw insertErr;
        }

        res.json({ success: true, message: `Created ${newDrills.length} drills.`, count: newDrills.length });
    } catch (err: any) {
        console.error('Error generating drills:', err);
        res.status(500).json({ error: err.message });
    }
});

// Generate dynamic practice questions for a specific drill
router.get('/:id/practice', withAIQuota('weakness_drill'), async (req: any, res: any) => {
    try {
        const drillId = req.params.id;
        const supabase = supabaseAsUser(req.user!.jwt);
        
        const { data: drill, error: dErr } = await supabase
            .from('weakness_drills')
            .select('*, courses(title)')
            .eq('id', drillId)
            .single();
            
        if (dErr || !drill) throw new Error("Drill not found");

        const courseName = (drill as any).courses?.title || 'Unknown Course';
        
        const prompt = `
        You are an expert tutor creating practice questions for a student who is weak in a specific topic.
        Course: ${courseName}
        Topic: ${drill.topic}
        Difficulty: ${drill.difficulty_level}

        Generate exactly 3 multiple choice practice questions to test their understanding of this topic.
        Return EXACTLY ONE valid JSON object. 
        It MUST have a single root key called "questions" which is an array of objects.
        Do not include markdown blocks or any other text.
        Each object in the array must have:
        - "type": "mcq"
        - "question": string
        - "options": array of strings (exactly 4 options)
        - "correct_answer": string (must exactly match one of the options)
        `;

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });
        const result = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' }
        });
        
        const text = result.choices[0]?.message?.content || '{"questions":[]}';
        const parsed = JSON.parse(text);

        await consumeUserQuota(req.user!.id, 'weakness_drill');
        res.json({ success: true, questions: parsed.questions || [], drill });
    } catch (err: any) {
        console.error('Error getting practice:', err);
        res.status(500).json({ error: err.message });
    }
});

// Grade a submitted drill session
router.post('/:id/submit', async (req: any, res: any) => {
    try {
        const drillId = req.params.id;
        const { score, total } = req.body; 
        
        if (typeof score !== 'number' || typeof total !== 'number' || score < 0 || total < 1 || score > total || total > 20) {
            return res.status(400).json({ error: 'Invalid score payload' });
        }
        
        const supabase = supabaseAsUser(req.user!.jwt);
        
        const { data: drill, error: dErr } = await supabase
            .from('weakness_drills')
            .select('*')
            .eq('id', drillId)
            .single();
            
        if (dErr || !drill) throw new Error("Drill not found");

        const percentage = score / (total || 1);
        const isPassed = percentage >= 0.7;

        let newConsecutive = isPassed ? (drill.consecutive_correct || 0) + 1 : 0;
        let mastered = newConsecutive >= 3;
        
        // Optional: level up difficulty if they get it right
        let newDifficulty = drill.difficulty_level;
        if (isPassed && newConsecutive === 1) newDifficulty = 'hard';
        if (!isPassed) newDifficulty = 'medium'; // drop down if failed

        const { data: updated, error: uErr } = await supabaseAdmin
            .from('weakness_drills')
            .update({
                consecutive_correct: newConsecutive,
                mastered,
                difficulty_level: newDifficulty,
                updated_at: new Date().toISOString()
            })
            .eq('id', drillId)
            .select()
            .single();

        if (uErr) throw uErr;

        res.json({ success: true, drill: updated, passed: isPassed });
    } catch (err: any) {
        console.error('Error submitting drill:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
