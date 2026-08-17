import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { supabaseAsUser } from '../lib/supabase';

const router = Router();
router.use(authenticateUser);

router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { course_id, duration_minutes, status } = req.body;
    const supabase = supabaseAsUser(req.user!.jwt);
    
    const { data, error } = await supabase
      .from('study_sessions')
      .insert({
        user_id: req.user!.id,
        course_id: course_id || null,
        duration_minutes: duration_minutes || 25,
        status: status || 'completed',
        end_time: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/anxiety', async (req: Request, res: Response) => {
  try {
    const { event_id, feeling, ai_suggestion } = req.body;
    const supabase = supabaseAsUser(req.user!.jwt);
    
    const { data, error } = await supabase
      .from('anxiety_check_ins')
      .insert({
        user_id: req.user!.id,
        event_id,
        feeling,
        ai_suggestion
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/break-rating', async (req: Request, res: Response) => {
  try {
    const { suggestion, rating } = req.body;
    const supabase = supabaseAsUser(req.user!.jwt);
    
    const { data, error } = await supabase
      .from('study_break_preferences')
      .insert({
        user_id: req.user!.id,
        suggestion,
        rating
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/badges', async (req: Request, res: Response) => {
  try {
    const supabase = supabaseAsUser(req.user!.jwt);
    // Get last 7 days of sessions
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('study_sessions')
      .select('duration_minutes, status, created_at')
      .eq('user_id', req.user!.id)
      .eq('status', 'completed')
      .gte('created_at', sevenDaysAgo.toISOString());

    if (error) throw error;

    const totalMinutes = data?.reduce((acc: any, curr: any) => acc + (curr.duration_minutes || 0), 0) || 0;
    const sessionCount = data?.length || 0;

    let badge = 'Just Starting';
    let aiMessage = "Every master was once a beginner. Keep showing up!";
    
    if (totalMinutes > 600) { // 10 hours
      badge = 'High Effort';
      aiMessage = "Outstanding effort! Your dedication this week is remarkable. Don't forget to rest.";
    } else if (sessionCount >= 5) {
      badge = 'Consistent';
      aiMessage = "Consistency is the key to mastery. You're building an amazing habit!";
    } else if (totalMinutes > 150) {
      badge = 'Improving';
      aiMessage = "You're steadily building momentum. Keep pushing forward!";
    }

    res.json({ badge, totalMinutes, sessionCount, aiMessage });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
