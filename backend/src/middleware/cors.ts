import cors from 'cors';
import { env } from '../config/env';

const allowedOrigins = [
  env.FRONTEND_URL,
  'http://localhost:3000',
  'https://app.unistudy.ai',
  'https://unistudy.vercel.app',
].filter(Boolean);

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, webhooks)
    if (!origin) return callback(null, true);
    // Allow any localhost origin (dev environments) with strict protocol check
    if (origin.startsWith('http://localhost:') || origin === 'http://localhost') return callback(null, true);
    // Allow only known Vercel preview domains (not all *.vercel.app)
    if (origin === 'https://unistudy.vercel.app' || origin === 'https://app.unistudy.ai') return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'x-model-tier'],
  exposedHeaders: ['X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400 // cache preflight for 24 hours
});
