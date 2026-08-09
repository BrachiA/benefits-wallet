import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  CORS_ORIGINS: z.string().default('*'), // comma-separated ברשימה אמיתית
});

// parse (לא safeParse) בכוונה: אם env לא תקין, האפליקציה חייבת
// לקרוס מיד בהפעלה עם הודעה ברורה — לא runtime error שקט אחרי שעה.
export const env = envSchema.parse(process.env);
