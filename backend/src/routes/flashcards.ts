import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { withAIQuota } from '../middleware/quotaGuard';
import { routeRequest, AIRequest } from '../lib/ai/router';
import { consumeUserQuota } from '../lib/ai/quota';
import { supabaseAsUser } from '../lib/supabase';
import { calculateNextReview, Rating } from '../lib/utils/sm2';

const router = Router();
router.use(authenticateUser);

// Generate flashcards using AI
router.post('/generate', withAIQuota('flashcard_generation'), async (req: Request, res: Response) => {
  const { lectureId } = req.body;

  if (!lectureId) {
    return res.status(400).json({ error: 'lectureId is required' });
  }

  try {
    // 1. Fetch all slides for the lecture
    const supabase = supabaseAsUser(req.user!.jwt);
    const { data: slides, error: slidesError } = await supabase
      .from('slides')
      .select('raw_text, explanation, slide_number')
      .eq('lecture_id', lectureId)
      .order('slide_number', { ascending: true });

    if (slidesError) throw slidesError;
    if (!slides || slides.length === 0) {
      return res.status(400).json({ error: 'No slides found for this lecture. Ensure the file was processed completely.' });
    }

    // 2. Combine all text for the prompt
    let combinedText = '';
    slides.forEach(s => {
      combinedText += `\n\n--- Slide ${s.slide_number} ---\nText: ${s.raw_text || ''}\nExplanation: ${s.explanation || ''}`;
    });

    if (combinedText.trim().length < 20) {
      const { data: lec } = await supabase.from('lectures').select('title').eq('id', lectureId).single();
      if (lec?.title) {
        combinedText += `\nLecture Title: ${lec.title}`;
      }
    }

    // 3. Request AI generation
    const aiReq: AIRequest = {
      task: 'batch_text',
      feature: 'flashcard_generation',
      payload: { prompt: combinedText },
      userId: req.user!.id,
      priority: 'medium',
      identifiers: [lectureId] // Cache per lecture
    };

    const response = await routeRequest(aiReq);

    console.log(`[Flashcards] Provider: ${response.provider}, responseMs: ${response.responseMs}ms`)
    console.log(`[Flashcards] Result type: ${typeof response.result}, isArray: ${Array.isArray(response.result)}`)
    if (typeof response.result === 'string') {
      console.log(`[Flashcards] Result preview: ${response.result.substring(0, 300)}`)
    } else if (response.result && typeof response.result === 'object') {
      console.log(`[Flashcards] Result keys: ${Object.keys(response.result).join(', ')}`)
    }
    
    consumeUserQuota(aiReq.userId, aiReq.feature, req.body?.model_tier || req.headers?.['x-model-tier'] || 'default').catch(console.error);
    
    // Parse result robustly (array, JSON string, or object with array property)
    let rawResult = response.result;
    if (typeof rawResult === 'string') {
      try {
        const cleaned = rawResult.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        rawResult = JSON.parse(cleaned);
      } catch (e) {
        console.error('Failed to parse flashcards JSON string:', e, rawResult);
      }
    }

    let extractedList: any[] = [];
    if (Array.isArray(rawResult)) {
      extractedList = rawResult;
    } else if (rawResult && typeof rawResult === 'object') {
      const possibleArray = Object.values(rawResult).find(v => Array.isArray(v));
      if (Array.isArray(possibleArray)) {
        extractedList = possibleArray;
      }
    }

    const generatedCards = extractedList
      .map((c: any) => ({
        front: String(c.front || c.question || c.term || c.concept || c.q || '').trim(),
        back: String(c.back || c.answer || c.definition || c.explanation || c.a || '').trim()
      }))
      .filter(c => c.front.length > 0 && c.back.length > 0);

    console.log(`[Flashcards] extractedList: ${extractedList.length}, generatedCards after filter: ${generatedCards.length}`)
    
    // 4. Delete existing flashcards for this lecture to allow regeneration
    await supabase.from('flashcards').delete().eq('lecture_id', lectureId).eq('user_id', req.user!.id);

    // 5. Generate embeddings and insert new flashcards into database
    if (generatedCards.length > 0) {
      const textsToEmbed = generatedCards.map(c => `Flashcard: Q: ${c.front} A: ${c.back}`);
      
      const embedReq: AIRequest = {
        task: 'embedding',
        feature: 'flashcard_embedding',
        payload: { texts: textsToEmbed },
        userId: req.user!.id,
        priority: 'medium'
      };
      
      const embedRes = await routeRequest(embedReq);
      const embeddings = embedRes.result || []; // Should be an array of vectors

      const cardsToInsert = generatedCards.map((c, i) => ({
        user_id: req.user!.id,
        lecture_id: lectureId,
        front: c.front,
        back: c.back,
        ease_factor: 2.5,
        interval_days: 0,
        repetitions: 0,
        next_review: new Date().toISOString(),
        embedding: embeddings[i] ? `[${embeddings[i].join(',')}]` : null // pgvector format
      }));

      const { error: insertError } = await supabase.from('flashcards').insert(cardsToInsert);
      if (insertError) throw insertError;
    }

    res.json({ success: true, count: generatedCards.length, data: generatedCards });
  } catch (err: any) {
    console.error('Flashcard generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const supabase = supabaseAsUser(req.user!.jwt);
    const lectureIdsParam = req.query.lectureIds as string;
    if (!lectureIdsParam) {
      return res.status(400).json({ error: 'lectureIds is required' });
    }
    const lectureIds = lectureIdsParam.split(',');
    
    const { data, error } = await supabase.from('flashcards').select('*').in('lecture_id', lectureIds);
    if (error) throw error;
    res.json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/review', async (req: Request, res: Response) => {
  const { cardId, rating, currentData } = req.body;
  const userId = req.user!.id;
  const supabase = supabaseAsUser(req.user!.jwt);

  try {
    const nextData = calculateNextReview(currentData, rating as Rating);

    const { error } = await supabase
      .from('flashcards')
      .update({
        ease_factor: nextData.ease_factor,
        interval_days: nextData.interval_days,
        repetitions: nextData.repetitions,
        next_review: nextData.next_review.toISOString(),
        last_rating: rating
      })
      .eq('id', cardId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating flashcard:', error);
      return res.status(500).json({ error: 'Failed to update flashcard' });
    }

    res.json({ success: true, nextData: {
      ease_factor: nextData.ease_factor,
      interval_days: nextData.interval_days,
      repetitions: nextData.repetitions,
      next_review: nextData.next_review.toISOString()
    }});
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
