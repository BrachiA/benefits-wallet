import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { SESSION_COOKIE_NAME, verifySessionToken } from '../modules/auth/session';

// שער ההגנה על הדשבורד (שלב 5, א.3). מוחל על כל endpoint שמשמש
// רק את הדשבורד — כתיבות בקטלוג, וכל מודול הסורק. קריאות GET
// ציבוריות (שהאפליקציה צורכת) נשארות בלי הגנה, ראו כל *.routes.ts.
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  if (!env.ADMIN_PASSWORD) {
    // אין דלת פתוחה בלי לדעת: אם לא הוגדרה סיסמה, כל בקשת ניהול
    // נחסמת במפורש במקום להיפתח בשקט. ה-log מסביר איך לתקן.
    res.status(503).json({
      success: false,
      error: { code: 'ADMIN_AUTH_NOT_CONFIGURED', message: 'ADMIN_PASSWORD is not set on the server' },
    });
    return;
  }

  const token = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  if (!verifySessionToken(token)) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'Login required' },
    });
    return;
  }

  next();
}
