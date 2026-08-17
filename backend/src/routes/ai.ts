import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { withAIQuota } from '../middleware/quotaGuard';
import { routeRequest, AIRequest } from '../lib/ai/router';
import { consumeUserQuota, checkUserQuota } from '../lib/ai/quota';
import { supabaseAdmin } from '../lib/supabase';

const router = Router();

router.use(authenticateUser);
router.use(rateLimit);

import multer from 'multer';
import { GoogleGenerativeAI } from '@google/generative-ai';

const upload = multer({ storage: multer.memoryStorage() });

const GEMINI_VISION_MODELS = [
  'gemini-flash-latest',
  'gemini-flash-latest',
  'gemini-1.5-pro',
];

async function callWithFallback(
  genAI: GoogleGenerativeAI,
  models: string[],
  buildRequest: (model: any) => Promise<any>
): Promise<any> {
  let lastErr: any;
  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      return await buildRequest(model);
    } catch (err: any) {
      const msg = err?.message?.toLowerCase() || '';
      const status = err?.status;
      const isTransientError = 
        msg.includes('503') || msg.includes('unavailable') || status === 503 ||
        msg.includes('429') || msg.includes('too many requests') || msg.includes('quota') || status === 429 ||
        msg.includes('404') || msg.includes('not found') || status === 404 ||
        msg.includes('403') || msg.includes('forbidden') || status === 403;

      if (isTransientError) {
        lastErr = err;
        continue; // try next model
      }
      throw err; // unrecoverable — surface immediately
    }
  }
  throw lastErr;
}

router.post('/search-math', withAIQuota('answer_improver'), async (req: Request, res: Response) => {
  try {
    const { type, query } = req.body;
    if (!type || !query) return res.status(400).json({ error: 'Missing type or query' });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const prompt = type === 'formula'
      ? `You are a scientific math assistant. The user is searching for a formula related to: "${query}".
         Return EXACTLY ONE JSON object (and nothing else) with these keys: 
         "name" (string), "formula" (string, standard notation), "subject" (string, e.g. Physics, Calculus, Algebra).`
      : `You are a scientific math assistant. The user is searching for a scientific constant related to: "${query}".
         Return EXACTLY ONE JSON object (and nothing else) with these keys: 
         "name" (string), "symbol" (string), "value" (string, scientific notation is okay), "unit" (string), "subject" (string).`;

    const result = await callWithFallback(genAI, GEMINI_VISION_MODELS, async (model) => {
      const response = await model.generateContent(prompt);
      return response.response.text();
    });

    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI did not return valid JSON");
    
    res.json({ success: true, data: JSON.parse(jsonMatch[0]) });
  } catch (err: any) {
    console.error('Math AI search error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/scan-notes', upload.single('file'), withAIQuota('handwriting_scan'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No image uploaded' });
    if (!file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'Please upload a valid image' });

    const base64Image = file.buffer.toString('base64');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

    const prompt = `
      You are an expert transcriber and academic assistant.
      The attached image contains handwritten (or typed) study notes.
      Please transcribe the notes precisely.
      Format the transcribed notes in clean Markdown.
      Use appropriate headings (H2, H3), bullet points, and bold text for emphasis.
      CRITICAL: For mathematical expressions, you MUST use $ for inline math (e.g. $x^2$) and $$ for block math equations (e.g. $$y = mx + b$$). DO NOT use \\( \\) or \\[ \\].
      If there are diagrams, describe them briefly.
      Do not add external information, just transcribe and format what is in the image.
    `;

    let transcription: string;
    try {
      const result = await callWithFallback(genAI, GEMINI_VISION_MODELS, model =>
        model.generateContent([
          prompt,
          { inlineData: { data: base64Image, mimeType: file!.mimetype } },
        ])
      );
      transcription = result.response.text();
    } catch (geminiErr: any) {
      console.warn('Gemini vision models failed, falling back to OpenRouter:', geminiErr.message);
      
      const fallbackRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:${file!.mimetype};base64,${base64Image}` } }
              ]
            }
          ]
        })
      });
      
      const fallbackData = await fallbackRes.json();
      if (!fallbackRes.ok) throw new Error(fallbackData.error?.message || 'OpenRouter vision request failed');
      transcription = fallbackData.choices[0]?.message?.content || '';
      if (!transcription) throw new Error('OpenRouter returned empty response');
    }

    let cleanTranscription = transcription.trim();
    if (cleanTranscription.startsWith('```markdown')) cleanTranscription = cleanTranscription.substring(11).trim();
    else if (cleanTranscription.startsWith('```')) cleanTranscription = cleanTranscription.substring(3).trim();
    if (cleanTranscription.endsWith('```')) cleanTranscription = cleanTranscription.substring(0, cleanTranscription.length - 3).trim();

    consumeUserQuota(req.user!.id, 'handwriting_scan', req.body?.model_tier || req.headers?.['x-model-tier'] || 'default').catch(console.error);
    res.json({ transcription: cleanTranscription });
  } catch (err: any) {
    console.error('Notes Scanner Error:', err);
    const msg = err?.message?.toLowerCase() || '';
    const isTransientError = msg.includes('503') || msg.includes('unavailable') || msg.includes('429') || msg.includes('too many requests') || msg.includes('quota');
    
    res.status(isTransientError ? 429 : 500).json({
      error: isTransientError
        ? 'The AI service is currently experiencing high demand or rate limits. Please try again in a moment.'
        : err.message,
    });
  }
});

router.post('/ask', async (req: Request, res: Response) => {
  const { feature, payload, priority, identifiers } = req.body;
  if (!feature || !payload) return res.status(400).json({ error: 'Missing feature or payload' });

  // Manually check quota
  const modelTier = req.body?.model_tier || req.headers?.['x-model-tier'] || 'default';
  const hasQuota = await checkUserQuota(req.user!.id, feature as any, modelTier as any);
  if (!hasQuota.allowed) {
    return res.status(429).json({ error: 'Insufficient credits or quota', details: hasQuota.reason });
  }
  
  // Fetch user settings
  let userSettings = null;
  try {
    const { supabaseAsUser } = await import('../lib/supabase');
    const supabase = supabaseAsUser(req.user!.jwt);
    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', req.user!.id)
      .single();
    if (data) userSettings = data;
  } catch (err) {
    console.error('Failed to fetch user settings for AI:', err);
  }

  const aiReq: AIRequest = {
    task: payload.stream ? 'streaming' : 'batch_text',
    feature,
    payload,
    userSettings,
    userId: req.user!.id,
    priority: priority || 'medium',
    identifiers
  };

  try {
    const response = await routeRequest(aiReq);
    
    // Deduct quota asynchronously
    consumeUserQuota(aiReq.userId, aiReq.feature, req.body?.model_tier || req.headers?.['x-model-tier'] || 'default').catch(console.error);
    
    // For streaming like the calculator feature, the provider might return a stream object
    if (payload.stream && response.result?.tee) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      for await (const chunk of response.result) {
        res.write(`data: ${JSON.stringify(chunk.choices[0]?.delta || {})}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// For specific routes that use the middleware strictly:
router.post('/calculator', withAIQuota('calculator'), async (req: Request, res: Response) => {
  const { problem, subject, level } = req.body;
  
  const aiReq: AIRequest = {
    task: 'streaming',
    feature: 'calculator',
    payload: { prompt: problem, subject, level, stream: true },
    userId: req.user!.id,
    priority: 'high'
  };

  try {
    const response = await routeRequest(aiReq);
    
    consumeUserQuota(aiReq.userId, aiReq.feature, req.body?.model_tier || req.headers?.['x-model-tier'] || 'default').catch(console.error);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    for await (const chunk of response.result) {
      res.write(`data: ${JSON.stringify(chunk.choices[0]?.delta?.content || "")}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/explain', authenticateUser, withAIQuota('slide_explanation'), async (req: Request, res: Response) => {
  const { slideText, level, courseContext, visionExplanation, imageUrl, mode, prevSlideText, nextSlideText } = req.body;

  let levelPrompt = 'standard university level';
  if (level === 'ELI5') levelPrompt = 'a high school student with no prior knowledge (ELI5). Use simple analogies.';
  if (level === 'Med') levelPrompt = 'a typical undergraduate student taking this module. Focus on core concepts.';
  if (level === 'Expert') levelPrompt = 'an expert level. Dive deep into the technical nuances, advanced terminology, and underlying mechanisms.';

  let tutorName = "Uni";
  let tutorPersonality = "neutral";
  let tone = "academic";
  let language = "en";
  let readingLevel = "intermediate";

  const { supabaseAsUser } = await import('../lib/supabase');
  const supabase = supabaseAsUser(req.user!.jwt);
  const { data: settings } = await supabase.from('user_settings').select('*').eq('user_id', req.user!.id).single();
  
  if (settings) {
    if (settings.ai_tutor_name) tutorName = settings.ai_tutor_name;
    if (settings.ai_personality) tutorPersonality = settings.ai_personality;
    if (settings.ai_tone) tone = settings.ai_tone;
    if (settings.language) language = settings.language;
    if (settings.ai_reading_level) readingLevel = settings.ai_reading_level;
  }

  const systemPrompt = `You are an expert university AI tutor named ${tutorName}. You are known for being ${tutorPersonality}.`;

  const prompt = `
You are an expert university AI tutor named ${tutorName}. You are known for being ${tutorPersonality}.
The student is studying the course: "${courseContext}".
${mode === 'story' 
  ? 'Your task is to explain the following slide content to them by rewriting the concept as a short, engaging narrative story. Characters should represent variables or concepts, conflicts represent opposing forces, and the resolution represents the solution. Do not include a standard academic explanation; only tell the story.'
  : mode === 'conceptual'
  ? 'Your task is to explain the following theory, definitions, diagrams, or descriptive content from the slide. Start with a real-world analogy the student will recognise. Give the academic definition after the analogy. Explain WHY the concept exists — what problem it solves. Give one concrete example. End with exam-likely phrasing of the concept.'
  : 'Your task is to explain the following slide content to them.'}

Accessibility Overrides for this user:
- Reading Complexity: ${readingLevel}
- Tone: ${tone}
- Language: You MUST respond in this language code: ${language}.

${slideText ? `Slide Content (Extracted Text):\n"${slideText}"` : ''}

${(slideText && slideText.split(' ').length < 20 && !visionExplanation && !imageUrl) ? `
**GAP FILLER MODE TRIGGERED**:
The text on this slide is extremely sparse (under 20 words) and no image is available. You must infer what the missing content should be based on the surrounding context.
Previous Slide Text: "${prevSlideText || 'None available'}"
Next Slide Text: "${nextSlideText || 'None available'}"

Write a dedicated section at the bottom of your explanation titled "### Gap Fill". In this section, provide the detailed content, context, and steps that are implied but missing from the sparse slide text. Use the surrounding slides to deduce what the lecturer meant to explain here.
` : ''}

${visionExplanation ? `Visual Context & Details (from AI Vision Model viewing the slide image):
"${visionExplanation}"
Use this visual context to enrich your explanation if it mentions charts, diagrams, or pictures.` : ''}

Format your response in clean Markdown. For mathematical expressions, use $ for inline math and $$ for block math equations. Do not use HTML tags. 
Provide a clear, engaging explanation adapted to their Reading Complexity. Highlight key terms using markdown bold (**term**).
Keep it concise enough to fit in a sidebar pane (max 300 words).

CRITICAL COPY CONSTRAINTS (Human Voice Only):
- DO NOT use AI filler words (e.g., delve, robust, seamless, leverage, journey, "in today's fast-paced world", "supercharge", "elevate").
- DO NOT use rhetorical questions (e.g., "Ready to dive in?").
- DO NOT use exclamation marks.
- DO NOT use em-dashes ("—" or "--"). Use commas or separate sentences instead.
- DO NOT use rule-of-three adjective stacks (e.g., "fast, reliable, and secure").
- Write like a smart, knowledgeable human explaining a concept to a friend. Use verbs over nouns, concrete over abstract.
- Do not introduce yourself, do not apologize, and do not say "Here is an explanation." Just start the explanation immediately.
`;

  try {
    const parts: any[] = [{ text: prompt }];

    if (imageUrl && imageUrl !== 'https://example.com/placeholder.png') {
      try {
        const imageRes = await fetch(imageUrl);
        if (imageRes.ok) {
          const arrayBuffer = await imageRes.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          let mimeType = imageRes.headers.get('content-type') || 'image/png';
          mimeType = mimeType.split(';')[0];
          parts.push({
            inlineData: {
              data: base64,
              mimeType: mimeType
            }
          });
        }
      } catch (err) {
        console.error("Failed to fetch image for Gemini vision processing:", err);
      }
    }

    let fullText = '';
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const result = await callWithFallback(genAI, GEMINI_VISION_MODELS, model =>
        model.generateContent({ contents: [{ role: 'user', parts }] })
      );
      fullText = result.response.text();
    } catch (geminiErr: any) {
      console.log('Gemini failed, falling back to Groq (llama-3.3-70b-versatile)...');
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ]
        })
      });

      if (groqRes.ok) {
        const groqData = await groqRes.json();
        fullText = groqData.choices?.[0]?.message?.content || '';
      } else {
        const errBody = await groqRes.json().catch(() => ({}));
        console.error('Groq fallback also failed:', errBody);
        throw geminiErr;
      }
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write(`data: ${JSON.stringify(fullText)}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();

    consumeUserQuota(req.user!.id, 'slide_explanation', req.body?.model_tier || req.headers?.['x-model-tier'] || 'default').catch(console.error);
  } catch (err: any) {
    console.error('Gemini API Error:', err);
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.write(`data: ${JSON.stringify(`\n\n**Note:** *AI API returned an error (${err?.message?.split('.')[0] || 'Quota Exceeded'}). Showing mock response.*\n\nThis is a tailored explanation of the slide content at the **${level}** level.`)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
});

// --- Wellbeing AI Endpoints ---

router.get('/motivational-quote', async (req: Request, res: Response) => {
  try {
    // 1. Fetch user calendar events for context
    const { data: upcomingExams } = await supabaseAdmin
      .from('calendar_events')
      .select('*')
      .eq('user_id', req.user!.id)
      .eq('type', 'exam')
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date', { ascending: true })
      .limit(3);

    // 2. Fetch user effort stats for context
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: sessions } = await supabaseAdmin
      .from('study_sessions')
      .select('duration_minutes')
      .eq('user_id', req.user!.id)
      .eq('status', 'completed')
      .gte('created_at', sevenDaysAgo.toISOString());
      
    const totalMinutes = sessions?.reduce((a: any, c: any) => a + (c.duration_minutes || 0), 0) || 0;

    const prompt = `Generate a short, single-sentence motivational quote for a university student.
Context:
- Upcoming exams: ${upcomingExams?.length ? upcomingExams.map((e: any) => e.title).join(', ') : 'None scheduled'}
- Study effort this week: ${totalMinutes} minutes
The quote must reference their actual situation naturally (e.g. "You have an Engineering exam in 8 days and your effort this week shows you are building real momentum."). Do NOT use generic quotes.`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are an inspiring academic coach.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!groqRes.ok) throw new Error('Groq failed');
    const data = await groqRes.json();
    const quote = data.choices?.[0]?.message?.content?.replace(/["']/g, '') || "Keep pushing forward, you're doing great!";

    res.json({ quote });
  } catch (err: any) {
    console.error('Motivational Quote Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/study-break', withAIQuota('break_suggestion'), async (req: Request, res: Response) => {
  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You suggest highly practical, specific 5-minute study breaks to prevent burnout.' },
          { role: 'user', content: 'I just finished a 25-minute pomodoro study session. Suggest one specific, actionable 5-minute break activity (e.g. physical movement, visual rest). Keep it under 2 sentences.' }
        ]
      })
    });

    if (!groqRes.ok) throw new Error('Groq failed');
    const data = await groqRes.json();
    const suggestion = data.choices?.[0]?.message?.content || "Take a 5-minute walk and drink some water.";

    res.json({ suggestion });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/anxiety-response', withAIQuota('chat_message'), async (req: Request, res: Response) => {
  try {
    const { feeling } = req.body;
    
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a supportive academic coach helping students with pre-exam anxiety.' },
          { role: 'user', content: `I have an exam tomorrow and I am feeling: ${feeling}. Suggest one specific, quick technique (like box breathing or positive visualization) to help me right now. Keep it under 3 sentences and very supportive.` }
        ]
      })
    });

    if (!groqRes.ok) throw new Error('Groq failed');
    const data = await groqRes.json();
    const suggestion = data.choices?.[0]?.message?.content || "Take a deep breath. You have prepared for this, and you can handle whatever comes tomorrow.";

    res.json({ suggestion });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
