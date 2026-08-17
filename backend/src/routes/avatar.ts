import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { authenticateUser as requireAuth } from '../middleware/auth';
import { supabaseAdmin, supabaseAsUser } from '../lib/supabase';
import { env } from '../config/env';
import rateLimit from 'express-rate-limit';
import fs from 'fs';

const router = Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME || 'dzglt3j2n',
  // Not strictly needing api_key/api_secret if we use unsigned uploads, but setting it if available
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET
});

const upload = multer({ 
  dest: '/tmp/uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png' || file.mimetype === 'image/webp') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
});

const avatarRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many avatar uploads, please try again later.'
});

router.post('/avatar', requireAuth, avatarRateLimit, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Upload to Cloudinary using unsigned preset
    const uploadResult = await cloudinary.uploader.unsigned_upload(file.path, 'unistudy_ai', {
      folder: 'avatars',
      public_id: `${userId}_${Date.now()}`
    });

    // Remove temp file
    fs.unlinkSync(file.path);

    const avatarUrl = uploadResult.secure_url;

    // Update profile in Supabase
    const { error: dbError } = await supabaseAdmin
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId);

    if (dbError) throw dbError;

    res.json({ success: true, avatar_url: avatarUrl });
  } catch (error: any) {
    console.error('Avatar upload error:', error);
    // Cleanup if exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

export default router;
