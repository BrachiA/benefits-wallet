// טיפוסים תואמים במדויק לפורמט התגובה שהוגדר ב-backend/src/lib/apiResponse.ts
// כפילות מכוונת ומתועדת: ברגע שיועבר DTOs ל-packages/shared (כפי
// שתוכנן בשלב 2), הטיפוסים האלה יומרו לייבוא מהחבילה המשותפת
// במקום הגדרה מקומית.

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
  meta?: { page: number; pageSize: number; total: number };
};

export type ApiErrorResponse = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

type ZodFlattenedError = { formErrors: string[]; fieldErrors: Record<string, string[]> };

// הודעות הבדיקה הגולמיות של Zod הן באנגלית טכנית ("Expected number,
// received string") — לא ברור למנהלת מה לתקן. ממפה את התבניות
// הנפוצות שחוזרות בסכמות שלנו לניסוח קריא; אם תבנית לא מוכרת,
// מציגה את ההודעה המקורית של Zod במקום שום דבר.
function translateFieldMessage(message: string): string {
  if (message === 'Required') return 'שדה חובה';
  if (message === 'Invalid url') return 'כתובת אינטרנט לא תקינה';
  if (message === 'Invalid uuid') return 'ערך לא תקין';
  if (message === 'Invalid') return 'פורמט לא תקין (למשל: מזהה URL מותר רק באותיות אנגליות קטנות, ספרות ומקפים)';
  if (/^Expected \w+, received/.test(message)) return 'סוג הערך שגוי';
  if (/^String must contain at least \d+ character/.test(message)) return 'שדה חובה — לא ניתן להשאיר ריק';
  if (/^Number must be greater than/.test(message)) return 'הערך נמוך מדי';
  return message;
}

// שגיאות ולידציה עסקית (לא Zod) נזרקות ב-backend דרך AppError.validation(string) —
// אותו code בדיוק כמו Zod ('VALIDATION_ERROR'), אבל details הוא מחרוזת חופשית ולא
// {fieldErrors}. בלי הטיפול הזה, ה-message הגנרי "Request validation failed" מוצג
// למרות שהסיבה האמיתית והברורה כבר קיימת ב-details.
function translateBusinessMessage(message: string): string {
  if (message.startsWith('Each scope must reference at least one entity')) {
    return 'כל שורת התאמה חייבת להיות משויכת למועדון, מותג, סניף או עיר ספציפיים — לא ניתן להשאיר שורה ריקה לגמרי';
  }
  return message;
}

// הופך שגיאת ולידציה מהשרת (fieldErrors, מ-Zod flatten(), או מחרוזת
// עסקית מ-AppError.validation) להודעה שמפרטת בדיוק מה בעייתי ולמה,
// במקום ה-message הגנרי "Request validation failed". fieldLabels ממפה
// שם שדה מה-DTO לתווית העברית שמוצגת לצידו באותו טופס.
export function formatSaveError(err: unknown, fieldLabels: Record<string, string> = {}): string {
  // כשל ריצת סורק מגיע עם code ייעודי ו-details מובנה. בלי הטיפול
  // כאן הייתה מוצגת הודעת השרת באנגלית.
  if (err instanceof ApiError && err.code === 'SCRAPER_RUN_FAILED') {
    const details = err.details as { errorMessage?: string; itemsSkipped?: number } | undefined;
    const reason = details?.errorMessage ? ` (${details.errorMessage})` : '';
    return `הסריקה נכשלה${reason}. המקור לא עודכן — אפשר לנסות שוב, ואם זה חוזר כדאי לבדוק שהאתר עדיין זמין ושהגדרות הסריקה מתאימות לו.`;
  }

  if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
    if (typeof err.details === 'string') {
      return translateBusinessMessage(err.details);
    }
    const fieldErrors = (err.details as ZodFlattenedError | undefined)?.fieldErrors ?? {};
    const entries = Object.entries(fieldErrors);
    if (entries.length > 0) {
      return entries
        .map(([field, messages]) => `שדה "${fieldLabels[field] ?? field}": ${messages.map(translateFieldMessage).join(', ')}`)
        .join('; ');
    }
  }
  return err instanceof Error ? err.message : 'השמירה נכשלה';
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });

  // 204 No Content (מחיקות) — אין גוף לפרסר
  if (response.status === 204) return undefined as T;

  const body = (await response.json()) as ApiSuccessResponse<T> | ApiErrorResponse;

  if (!body.success) {
    throw new ApiError(body.error.code, body.error.message, body.error.details);
  }
  return body.data;
}

// גרסה שמחזירה גם meta (pagination) — לרשימות
async function requestPaginated<T>(
  path: string,
  options?: RequestInit
): Promise<{ data: T; meta: { page: number; pageSize: number; total: number } }> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const body = (await response.json()) as ApiSuccessResponse<T> | ApiErrorResponse;
  if (!body.success) throw new ApiError(body.error.code, body.error.message, body.error.details);
  return { data: body.data, meta: body.meta ?? { page: 1, pageSize: body.data instanceof Array ? body.data.length : 1, total: 0 } };
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  getPaginated: <T>(path: string) => requestPaginated<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
};
