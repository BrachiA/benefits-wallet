import type { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  meta: { page: number; pageSize: number; total: number }
) {
  return res.status(200).json({ success: true, data, meta });
}

// פרסור אחיד של pagination query params, עם ברירות מחדל וגבולות
// הגנה (מונע ?pageSize=99999 שמעמיס את ה-DB).
export function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
