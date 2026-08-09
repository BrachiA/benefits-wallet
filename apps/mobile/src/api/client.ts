// זהה בעיקרון ל-apps/dashboard/src/api/client.ts — כפילות זמנית,
// מתועדת גם כאן: יומר לייבוא מ-packages/shared בסוף התכנון.

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
  meta?: { page: number; pageSize: number; total: number };
};

export type ApiErrorResponse = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};

// Expo חושף רק משתנים עם קידומת EXPO_PUBLIC_ לצד הלקוח.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const body = (await response.json()) as ApiSuccessResponse<T> | ApiErrorResponse;
  if (!body.success) throw new ApiError(body.error.code, body.error.message, body.error.details);
  return body.data;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
};
