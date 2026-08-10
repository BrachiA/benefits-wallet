import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '../../middleware/validateRequest';
import { requireAdminAuth } from '../../middleware/requireAdminAuth';
import { SESSION_COOKIE_NAME, createSessionToken, passwordMatches, verifySessionToken } from './session';

export const authRouter = Router();

const loginSchema = z.object({ password: z.string().min(1) });

// שבוע, תואם ל-TTL בפועל ב-session.ts. cookie לא ניתן לקריאה
// מ-JS (httpOnly) — מגן מפני XSS שגונב את העוגייה.
const COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

authRouter.post('/login', validateRequest(loginSchema), (req, res) => {
  const { password } = req.body as { password: string };

  if (!passwordMatches(password)) {
    // הודעה בעברית מפורשת — הדשבורד מציג אותה ישירות, בלי לתרגם
    // קוד שגיאה טכני. אין רמז אם הבעיה "סיסמה שגויה" מול "אין
    // חשבון כזה" כי יש רק סיסמה אחת ואין שם משתמש בכלל.
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_PASSWORD', message: 'הסיסמה שגויה. נסי שוב.' },
    });
    return;
  }

  res.cookie(SESSION_COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE_MS,
  });
  res.json({ success: true, data: { authenticated: true } });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME);
  res.json({ success: true, data: { authenticated: false } });
});

// נקרא בטעינת הדשבורד כדי להחליט אם להציג את מסך הכניסה או את
// האפליקציה עצמה. לא עובר דרך requireAdminAuth כי 401 כאן הוא
// תשובה תקינה ("לא מחוברת"), לא שגיאה שצריכה להיזרק.
authRouter.get('/me', (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  res.json({ success: true, data: { authenticated: verifySessionToken(token) } });
});

// endpoint פנימי שהדשבורד לא קורא לו ישירות, אבל שימושי כדי לוודא
// שההגנה בכלל פעילה (ADMIN_PASSWORD מוגדר) — נבדק ב-requireAdminAuth.
authRouter.get('/status', requireAdminAuth, (_req, res) => {
  res.json({ success: true, data: { authenticated: true } });
});
