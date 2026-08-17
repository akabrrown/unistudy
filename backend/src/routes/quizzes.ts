import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { withAIQuota } from '../middleware/quotaGuard';
import { routeRequest, AIRequest } from '../lib/ai/router';
import { consumeUserQuota } from '../lib/ai/quota';
import { supabaseAsUser } from '../lib/supabase';

const router = Router();
router.use(authenticateUser);

// Generate quiz using AI
router.post('/generate', withAIQuota('quiz_generation'), async (req: Request, res: Response) => {
  const { lectureId, imageBase64Array, questionCount, difficulty } = req.body;

  const aiReq: AIRequest = {
    task: 'batch_text',
    feature: 'quiz_generation',
    payload: { imageBase64Array, questionCount, difficulty },
    userId: req.user!.id,
    priority: 'high',
    identifiers: [lectureId, String(questionCount), difficulty] 
  };

  try {
    const response = await routeRequest(aiReq);
    consumeUserQuota(aiReq.userId, aiReq.feature, req.body?.model_tier || req.headers?.['x-model-tier'] || 'default').catch(console.error);
    
    let questionsData = response.result;
    if (questionsData && typeof questionsData === 'object' && !Array.isArray(questionsData) && Array.isArray(questionsData.questions)) {
      questionsData = questionsData.questions;
    } else if (questionsData && typeof questionsData === 'object' && !Array.isArray(questionsData) && Array.isArray(questionsData.quiz)) {
      questionsData = questionsData.quiz;
    }

    if (Array.isArray(questionsData)) {
      const toInsert = questionsData.map((q: any) => ({
        lecture_id: lectureId,
        question: q.question,
        options: q.options || [],
        correct_option: q.correct_option || '',
        explanation: q.explanation || '',
        difficulty: difficulty === 'hard' ? 5 : difficulty === 'medium' ? 3 : 1,
        type: q.type || 'mcq'
      }));
      
      const { error: insertErr } = await supabaseAsUser(req.user!.jwt).from('quiz_questions').insert(toInsert);
      if (insertErr) {
        console.error('Failed to insert quiz questions:', insertErr);
        if (insertErr.code === '23503') {
          return res.status(400).json({ error: 'Cannot generate a quiz for a placeholder lecture. Please upload slides first.' });
        }
        return res.status(500).json({ error: 'Failed to save generated quiz questions to the database.' });
      }
    }
    
    res.json(questionsData);
  } catch (err: any) {
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
    
    const { data, error } = await supabase.from('quiz_questions').select('*').in('lecture_id', lectureIds);
    if (error) throw error;
    res.json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/attempt', async (req: Request, res: Response) => {
  const { lectureId, score, total, timeTaken } = req.body;
  const userId = req.user!.id;

  try {
    const { error: insertError } = await supabaseAsUser(req.user!.jwt).from('quiz_attempts').insert({
      user_id: userId,
      lecture_id: lectureId,
      score,
      total,
      time_taken: timeTaken
    });

    if (insertError) {
      console.error('Failed to insert quiz attempt:', insertError);
      return res.status(500).json({ error: 'Failed to record attempt.' });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
