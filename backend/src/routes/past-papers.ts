import { Router } from 'express';
import { supabaseAsUser } from '../lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import pdfParse from 'pdf-parse';

const router = Router();

import { authenticateUser } from '../middleware/auth';
import { withAIQuota } from '../middleware/quotaGuard';
import { AIRequest, routeRequest } from '../lib/ai/router';
router.use(authenticateUser);

import multer from 'multer';
import { supabaseAdmin } from '../lib/supabase';

const upload = multer({ storage: multer.memoryStorage() });

// Upload and mock OCR extraction
router.post('/upload', upload.single('file'), async (req: any, res) => {
    try {
        const { courseCode, courseName, year, examType } = req.body;
        
        // Lookup or create course to satisfy NOT NULL constraint
        let courseId = null;
        const { data: existingCourse } = await supabaseAdmin
            .from('courses')
            .select('id')
            .eq('course_code', courseCode || 'TEST101')
            .maybeSingle();

        if (existingCourse) {
            courseId = existingCourse.id;
        } else {
            const { data: newCourse, error: cErr } = await supabaseAdmin
                .from('courses')
                .insert({
                    course_code: courseCode || 'TEST101',
                    title: courseName || 'Test Course',
                    semester: 1,
                    year: parseInt(year) || new Date().getFullYear(),
                    user_id: req.user!.id,
                    colour: '#hidden'
                })
                .select('id')
                .single();
            if (cErr) throw cErr;
            courseId = newCourse.id;
        }

        // 1. In reality, upload req.file.buffer to Supabase Storage.
        // For MVP, we just create the DB record.
        const { data: paper, error: pErr } = await supabaseAdmin
            .from('past_papers')
            .insert({
                user_id: req.user!.id,
                course_id: courseId, // Satisfy NOT NULL constraint
                title: `${courseCode} - ${year} ${examType}`,
                year: parseInt(year) || new Date().getFullYear(),
                exam_type: examType || 'Final',
                status: 'ready', // Immediately ready for demo
                shared_to_community: false
            })
            .select()
            .single();
            
        if (pErr) throw pErr;

        if (!req.file) throw new Error("No PDF file provided");

        // 2. Real PDF extraction using pdf-parse + Groq
        const parseFn = typeof pdfParse === 'function' ? pdfParse : (pdfParse as any).default || pdfParse;
        const data = await parseFn(req.file.buffer);
        const extractedText = data.text;
        if (!extractedText) throw new Error("Could not extract text from PDF");

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });
        
        const prompt = `
You are an expert exam analyzer. I am providing you with the extracted raw text from a past exam paper.
Extract all the questions from this exam paper in the EXACT sequential order they appear from top to bottom.
Keep main questions (e.g., Question 1, Question 2, Question 3) grouped together as a SINGLE object. Do NOT split a question into multiple objects for its sub-questions (e.g., do not create separate objects for 1a, 1b). Instead, include the main preamble and all sub-questions beautifully formatted as markdown lists inside the "text_content" of the main question.

CRITICAL INSTRUCTIONS FOR TABLES AND FIGURES:
- If a question contains a table, you MUST convert it into a markdown formatted table within the "text_content".
- If a question contains a figure, image, diagram, or graph, you MUST include a highly detailed descriptive placeholder in the "text_content", for example: "[Figure: A bar chart showing population growth over 10 years]". Do not ignore images!

Return EXACTLY ONE valid JSON object. 
It MUST have a single root key called "questions" which is an array containing objects with the following keys:
- "question_number": (string, the main question number, e.g. "1", "2", "3")
- "question_type": (string, EXACTLY "mcq" for Multiple Choice Questions, or "theory" for Theory/Essay questions)
- "text_content": (string, the full text of the question, including markdown tables and [Figure: ...] descriptions)
- "extracted_topic": (string, a brief 1-3 word topic identifying what the question is about)
- "marks_available": (integer, if stated, otherwise 0)

Raw Extracted Text:
${extractedText}
`;

        const aiResult = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' }
        });
        
        const rawJson = aiResult.choices[0]?.message?.content || '{"questions":[]}';
        const start = rawJson.indexOf('{');
        const end = rawJson.lastIndexOf('}');
        const parsed = JSON.parse(rawJson.slice(start, end + 1));
        const extractedQuestions = parsed.questions || [];
        
        if (extractedQuestions.length === 0) {
            require('fs').writeFileSync('upload_debug.txt', `Extracted Text:\n${extractedText}\n\nAI Response:\n${rawJson}`);
            throw new Error("AI did not extract any questions");
        }

        // Generate embeddings for the extracted questions (optional)
        let embeddings: any[] = [];
        try {
            const textsToEmbed = extractedQuestions.map((q: any) => `Question: ${q.text_content}`);
            const embedReq: AIRequest = {
                task: 'embedding',
                feature: 'search_embedding',
                payload: { texts: textsToEmbed },
                userId: req.user!.id,
                priority: 'medium'
            };
            const embedRes = await routeRequest(embedReq);
            embeddings = embedRes.result || [];
        } catch (embedErr) {
            console.error("Warning: Failed to generate embeddings for past paper questions. Skipping.", embedErr);
        }

        const dbQuestions = extractedQuestions.map((q: any, i: number) => {
            const isMcq = q.question_type?.toLowerCase() === 'mcq';
            return {
                past_paper_id: paper.id,
                question_number: String(q.question_number || '1'),
                text_content: String(q.text_content || 'Unknown Question'),
                extracted_topic: `${isMcq ? 'MCQ' : 'THEORY'}|${String(q.extracted_topic || 'General')}`,
                marks_available: Number(q.marks_available || 0),
                embedding: embeddings[i] ? `[${embeddings[i].join(',')}]` : null
            }
        });

        const { error: qErr } = await supabaseAdmin
            .from('past_paper_questions')
            .insert(dbQuestions);
            
        if (qErr) throw qErr;

        res.json({ success: true, message: "Upload and OCR successful", paper });
    } catch (e: any) {
        console.error("Upload error fully detailed:", e);
        require('fs').writeFileSync('upload_error.txt', e.stack || e.message);
        res.status(500).json({ error: e.message || 'Unknown upload error' });
    }
});

router.post('/grade-batch', async (req, res) => {
    try {
        const { answers, is_ultra, course_id } = req.body;
        
        if (!answers || !Array.isArray(answers) || answers.length === 0) {
            return res.status(400).json({ error: 'Missing or empty answers array' });
        }

        // Pre-fetch contexts for each answer using embeddings
        if (course_id) {
            try {
                const textsToEmbed = answers.map((a: any) => a.question_content);
                const embedReq: AIRequest = {
                    task: 'embedding',
                    feature: 'search_embedding',
                    payload: { texts: textsToEmbed },
                    userId: req.user!.id,
                    priority: 'high'
                };
                const embedRes = await routeRequest(embedReq);
                const embeddings = embedRes.result || [];

                for (let i = 0; i < answers.length; i++) {
                    const emb = embeddings[i];
                    if (emb) {
                        const { data: matches } = await supabaseAdmin.rpc('match_study_content', {
                            query_embedding: `[${emb.join(',')}]`,
                            match_threshold: 0.5,
                            match_count: 3,
                            p_user_id: req.user!.id
                        });
                        if (matches) {
                            const relevantSlides = matches.filter((m: any) => m.content_type === 'slide' && m.course_id === course_id);
                            if (relevantSlides.length > 0) {
                                answers[i].slide_context = relevantSlides.map((s: any) => `[Slide ${s.slide_number}]: ${s.text_content}`).join('\n\n');
                            }
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to fetch context for RAG grading", e);
            }
        }

        const personality = is_ultra 
            ? "You are a STRICT and UNFORGIVING university examiner. Do not offer encouragement or praise. Use pure mark-scheme language."
            : "You are a helpful teaching assistant grading an exam. Be encouraging but accurate.";

        const prompt = `
        ${personality}
        Grade the following answers to exam questions.
        
        CRITICAL INSTRUCTION: If "Lecturer's Slide Context" is provided for a question, you MUST strongly base your grading on that context before considering general factual correctness. Accept factually correct answers if the slides are incomplete, but explicitly reference the slides when applicable (e.g., "According to Slide X...").
        
        ${answers.map((ans: any, idx: number) => `
        --- Item ${idx} (ID: ${ans.id}) ---
        Question: ${ans.question_content}
        Total Marks Available: ${ans.marks_available}
        Student's Answer: ${ans.student_answer}
        ${ans.slide_context ? `\nLecturer's Slide Context (PRIORITIZE THIS):\n${ans.slide_context}` : ''}
        `).join('\n')}
        
        Return EXACTLY ONE valid JSON object. 
        It MUST have a single root key called "results" which is an array containing an object for each item graded, IN THE EXACT SAME ORDER.
        Each object MUST have these keys:
        - "id": (string, the exact ID provided in the item)
        - "marks_awarded": (integer)
        - "feedback": (string)
        - "model_answer": (string, showing the ideal answer based heavily on the slides if available)
        `;

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });
        const result = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            response_format: { type: 'json_object' }
        });
        
        const text = result.choices[0]?.message?.content || '{"results":[]}';
        const parsed = JSON.parse(text);
        
        res.json({ success: true, data: parsed.results || [] });
    } catch (err: any) {
        console.error('Error grading batch:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/grade', async (req, res) => {
    try {
        const { question_content, marks_available, student_answer, is_ultra, course_id } = req.body;
        
        if (!question_content || !student_answer) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        let slide_context = "";
        if (course_id) {
            try {
                const embedReq: AIRequest = {
                    task: 'embedding',
                    feature: 'search_embedding',
                    payload: { texts: [question_content] },
                    userId: req.user!.id,
                    priority: 'high'
                };
                const embedRes = await routeRequest(embedReq);
                const embedding = embedRes.result?.[0];
                if (embedding) {
                    const { data: matches } = await supabaseAdmin.rpc('match_study_content', {
                        query_embedding: `[${embedding.join(',')}]`,
                        match_threshold: 0.5,
                        match_count: 3,
                        p_user_id: req.user!.id
                    });
                    if (matches) {
                        const relevantSlides = matches.filter((m: any) => m.content_type === 'slide' && m.course_id === course_id);
                        if (relevantSlides.length > 0) {
                            slide_context = relevantSlides.map((s: any) => `[Slide ${s.slide_number}]: ${s.text_content}`).join('\n\n');
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to fetch context for RAG single grading", e);
            }
        }

        const personality = is_ultra 
            ? "You are a STRICT and UNFORGIVING university examiner. Do not offer encouragement or praise. Use pure mark-scheme language (e.g. 'Candidate correctly identified X [1 mark] but failed to...')."
            : "You are a helpful teaching assistant grading an exam. Be encouraging but accurate.";

        const prompt = `
        ${personality}
        Grade the following answer to this exam question.
        
        CRITICAL INSTRUCTION: If "Lecturer's Slide Context" is provided, you MUST strongly base your grading on that context before considering general factual correctness. Accept factually correct answers if the slides are incomplete, but explicitly reference the slides when applicable (e.g., "According to Slide X...").
        
        Question: ${question_content}
        Total Marks Available: ${marks_available}
        ${slide_context ? `\nLecturer's Slide Context (PRIORITIZE THIS):\n${slide_context}\n` : ''}
        
        Student's Answer:
        ${student_answer}
        
        Return exactly ONE valid JSON object with these keys:
        - "marks_awarded": (integer)
        - "feedback": (string)
        - "model_answer": (string, showing the ideal answer based heavily on the slides if available)
        `;

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("AI did not return valid JSON");
        
        res.json({ success: true, data: JSON.parse(jsonMatch[0]) });
    } catch (err: any) {
        console.error('Error grading:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/chat', async (req, res) => {
    try {
        const { question_content, student_answer, feedback, user_message } = req.body;
        
        const prompt = `
        You are a tutor discussing a past paper question with a student.
        Question: ${question_content}
        Student's Answer: ${student_answer}
        Feedback given: ${feedback}
        
        The student is now asking: "${user_message}"
        
        Answer their question clearly and concisely.
        `;

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
        const result = await model.generateContent(prompt);
        res.json({ text: result.response.text() });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const paperId = req.params.id;
        
        // Check ownership
        const { data: paper, error: fetchErr } = await supabaseAdmin
            .from('past_papers')
            .select('user_id')
            .eq('id', paperId)
            .single();
            
        if (fetchErr) throw fetchErr;
        if (paper.user_id !== req.user!.id) {
            return res.status(403).json({ error: 'Unauthorized to delete this paper' });
        }

        const { error: delErr } = await supabaseAdmin
            .from('past_papers')
            .delete()
            .eq('id', paperId);
            
        if (delErr) throw delErr;
        
        res.json({ success: true });
    } catch (err: any) {
        console.error('Error deleting paper:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
