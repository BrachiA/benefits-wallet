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
  ADMIN_ALERT_EMAIL: z.string().default('admin@example.com'),

  // הגנת סיסמה על הדשבורד (session cookie). אין ברירת מחדל
  // מכוונת ל-production: אם לא הוגדר, פותחים את השרת עם אזהרה
  // בלוג ולא עם דלת פתוחה לגמרי בלי לדעת.
  ADMIN_PASSWORD: z.string().optional(),
  SESSION_SECRET: z.string().default('dev-only-secret-change-me'),

  // ניקוי כפילויות/יתומים ע"י AI (modules/duplicateCleanup). אופציונלי
  // בכוונה: בלעדיו רק שלב שיפוט הכפילויות הסמנטיות מדלג (מתועד בלוג) —
  // ראו lib/gemini.ts. ניקוי הריצות היתומות דטרמיניסטי ולא תלוי בזה.
  GEMINI_API_KEY: z.string().optional(),

  // אחסון תמונות ב-Cloudflare R2 (lib/r2Storage.ts). בשונה מ-GEMINI_API_KEY,
  // כולם חובה ולא אופציונליים: בלי R2 אין למה להוריד תמונות בזרימת
  // הקליטה (modules/scraper) בכלל — אין מצב תקין "בלי R2" כמו שיש
  // "בלי Gemini". R2_ENDPOINT הוא https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  // בלבד (בלי שם ה-bucket בסוף — הוא מועבר בנפרד כפרמטר Bucket בכל
  // קריאה, לא חלק מה-URL של ה-endpoint; אומת מול developers.cloudflare.com/r2
  // ב-17.8.2026).
  R2_ACCOUNT_ID: z.string().min(1, 'R2_ACCOUNT_ID is required'),
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2_ACCESS_KEY_ID is required'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2_SECRET_ACCESS_KEY is required'),
  R2_BUCKET_NAME: z.string().min(1, 'R2_BUCKET_NAME is required'),
  R2_ENDPOINT: z.string().min(1, 'R2_ENDPOINT is required'),
  // דומיין ציבורי להצגת תמונות (R2.dev subdomain או custom domain
  // מחובר ל-bucket). ה-S3 endpoint עצמו אינו נגיש בקריאת GET ציבורית —
  // חובה בנפרד, לא ניתן לגזור מ-R2_ENDPOINT/R2_ACCOUNT_ID.
  R2_PUBLIC_URL: z.string().min(1, 'R2_PUBLIC_URL is required'),
});

// parse (לא safeParse) בכוונה: אם env לא תקין, האפליקציה חייבת
// לקרוס מיד בהפעלה עם הודעה ברורה — לא runtime error שקט אחרי שעה.
export const env = envSchema.parse(process.env);
