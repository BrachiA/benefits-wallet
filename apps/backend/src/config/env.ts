import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  CORS_ORIGINS: z.string().default('*'), // comma-separated ברשימה אמיתית

  // התראות מייל (scraperAlerts). כולם אופציונליים בכוונה: בלעדיהם
  // המערכת ממשיכה לעבוד, רק שולחת ללוג במקום למייל — ראו lib/mailer.ts.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  ADMIN_ALERT_EMAIL: z.string().default('Baloo532004@gmail.com'),

  // הגנת סיסמה על הדשבורד (session cookie). אין ברירת מחדל
  // מכוונת ל-production: אם לא הוגדר, פותחים את השרת עם אזהרה
  // בלוג ולא עם דלת פתוחה לגמרי בלי לדעת.
  ADMIN_PASSWORD: z.string().optional(),
  SESSION_SECRET: z.string().default('dev-only-secret-change-me'),
});

// parse (לא safeParse) בכוונה: אם env לא תקין, האפליקציה חייבת
// לקרוס מיד בהפעלה עם הודעה ברורה — לא runtime error שקט אחרי שעה.
export const env = envSchema.parse(process.env);
