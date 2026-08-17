import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { Resend } from 'resend';

const router = Router();
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Vercel cron triggers this every day at 7am Ghana time
router.get('/daily-brief', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    
    // Always require a configured secret — never fall back to a weak default
    if (!cronSecret || cronSecret === 'test_secret' || cronSecret === 'dev_cron_secret') {
      console.error('CRON_SECRET is not configured or is using a weak default value');
      return res.status(500).json({ error: 'Cron not configured' });
    }
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!resend) {
      return res.status(500).json({ error: 'Resend API key not configured' });
    }

    // 1. Get users (in a real scenario, batched to avoid huge memory spikes)
    const { data: users, error: userErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email');
      
    if (userErr) throw userErr;

    // 2. For each user, fetch their data and generate a brief
    for (const user of users || []) {
      if (!user.email) continue;
      
      const { data: upcomingExams } = await supabaseAdmin
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'exam')
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .limit(3);

      const tasks = [];
      let totalTime = 0;

      if (upcomingExams && upcomingExams.length > 0) {
        tasks.push(`Review for upcoming exam: ${upcomingExams[0].title}`);
        totalTime += 60;
      }
      tasks.push('Complete daily flashcard review');
      totalTime += 15;
      tasks.push('Review weak topics from recent quizzes');
      totalTime += 45;

      const motivationalLine = `You've got this, ${user.full_name?.split(' ')[0] || 'student'}! Small, consistent steps build massive momentum.`;

      const htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #2563eb;">Your Daily Study Brief</h2>
          <p>Good morning!</p>
          <p>Here are your study tasks for today:</p>
          <ul>
            ${tasks.map(t => `<li style="margin-bottom: 8px;">${t}</li>`).join('')}
          </ul>
          <p><strong>Total estimated time:</strong> ${totalTime} minutes</p>
          <hr style="border: none; border-top: 1px solid #eaeaea; margin: 24px 0;" />
          <p style="font-style: italic; color: #666;">"${motivationalLine}"</p>
        </div>
      `;

      await resend.emails.send({
        from: 'Unistudy AI <briefs@unistudy.ai>', // Assuming verified domain
        to: user.email,
        subject: 'Your Daily Study Brief 📚',
        html: htmlContent
      });
    }

    res.json({ success: true, processed: users?.length });
  } catch (err: any) {
    console.error('Cron Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
