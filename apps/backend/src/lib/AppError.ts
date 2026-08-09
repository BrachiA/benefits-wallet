// מחלקת שגיאה אחידה — כל שכבת Service זורקת AppError, ה-errorHandler
// היחיד תופס הכול וממפה לפורמט ApiErrorResponse (מוגדר ב-shared).
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }

  static notFound(entity: string, id: string): AppError {
    return new AppError(`${entity.toUpperCase()}_NOT_FOUND`, `${entity} with id ${id} not found`, 404);
  }

  static validation(details: unknown): AppError {
    return new AppError('VALIDATION_ERROR', 'Request validation failed', 422, details);
  }
}
