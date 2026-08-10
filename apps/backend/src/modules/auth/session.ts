import crypto from 'crypto';
import { env } from '../../config/env';

// ============================================================
// session פשוט מבוסס cookie חתום, ללא DB וללא ריבוי משתמשים —
// בכוונה (שלב 5, א.3): יש סיסמה אחת שנקבעת מראש בסביבה, אין
// הרשמה ואין "שכחתי סיסמה". זה לא JWT (מיותר כאן) — רק timestamp
// תפוגה + חתימת HMAC כדי שאי אפשר יהיה לזייף/להאריך עוגייה בלי
// לדעת את SESSION_SECRET.
// ============================================================

export const SESSION_COOKIE_NAME = 'bw_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // שבוע

function sign(value: string): string {
  return crypto.createHmac('sha256', env.SESSION_SECRET).update(value).digest('hex');
}

export function createSessionToken(): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expected = sign(payload);
  // אורך שונה = תוקף שגוי מיד; timingSafeEqual דורש buffers באותו
  // אורך, אחרת הוא זורק. ההשוואה עצמה חייבת להיות בזמן קבוע כדי
  // לא לחשוף את החתימה הנכונה דרך הבדל בזמן תגובה.
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false;

  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

// השוואת סיסמה בזמן קבוע — מונע תזמון-התקפה שמנחש תווים אחד-אחד
// לפי כמה זמן לוקח לבדיקה להיכשל.
export function passwordMatches(candidate: string): boolean {
  if (!env.ADMIN_PASSWORD) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(env.ADMIN_PASSWORD);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
