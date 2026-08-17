import { Router, Request, Response } from 'express';
import { authenticateUser } from '../middleware/auth';
import { supabaseAsUser } from '../lib/supabase';

const router = Router();

// Public route: Daily Quote (no auth required)
router.get('/daily-quote', (req: Request, res: Response) => {
  const quotes = [
    { quote: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
    { quote: "The mind is not a vessel to be filled, but a fire to be kindled.", author: "Plutarch" },
    { quote: "Develop a passion for learning. If you do, you will never cease to grow.", author: "Anthony J. D'Angelo" },
    { quote: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
    { quote: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
    { quote: "The expert in anything was once a beginner.", author: "Helen Hayes" },
    { quote: "Learning never exhausts the mind.", author: "Leonardo da Vinci" },
    { quote: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
    { quote: "There are no shortcuts to any place worth going.", author: "Beverly Sills" },
    { quote: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
    { quote: "The only place where success comes before work is in the dictionary.", author: "Vidal Sassoon" },
    { quote: "Strive for progress, not perfection.", author: "Unknown" },
    { quote: "I find that the harder I work, the more luck I seem to have.", author: "Thomas Jefferson" },
    { quote: "Don't let what you cannot do interfere with what you can do.", author: "John Wooden" },
  ];
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  const dailyQuote = quotes[dayOfYear % quotes.length];
  res.json(dailyQuote);
});
router.use(authenticateUser);

// GET /api/settings/accessibility
router.get('/accessibility', async (req: Request, res: Response) => {
  try {
    const supabase = supabaseAsUser(req.user!.jwt);
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', req.user!.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching settings:', error);
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      // Create default settings if not exists (should be handled by trigger, but as fallback)
      const { data: newData, error: insertError } = await supabase
        .from('user_settings')
        .insert({ user_id: req.user!.id })
        .select('*')
        .single();
        
      if (insertError) {
        return res.status(500).json({ error: insertError.message });
      }
      return res.json({ settings: newData });
    }

    res.json({ settings: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/settings/accessibility
router.patch('/accessibility', async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    
    // Ensure we don't update user_id or other protected fields
    delete updates.user_id;
    delete updates.created_at;
    delete updates.id;
    delete updates.updated_at;

    const supabase = supabaseAsUser(req.user!.jwt);
    const { data, error } = await supabase
      .from('user_settings')
      .update(updates)
      .eq('user_id', req.user!.id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating settings:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ settings: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
