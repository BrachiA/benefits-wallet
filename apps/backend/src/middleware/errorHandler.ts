import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../lib/AppError';
import { logger } from '../lib/logger';

// Express מזהה middleware של שגיאות לפי 4 הפרמטרים (כולל 'next' שלא
// בשימוש) — הסרתו הופכת את זה בטעות ל-middleware רגיל.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req as Request & { requestId?: string }).requestId;

  if (err instanceof AppError) {
    logger.warn({ requestId, code: err.code }, err.message);
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  if (err instanceof ZodError) {
    logger.warn({ requestId }, 'Validation error');
    return res.status(422).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: err.flatten() },
    });
  }

  // P2025 = Prisma "record not found" בפעולת update/delete
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Record not found' },
      });
    }
    if (err.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_ENTRY', message: 'A record with this value already exists', details: err.meta },
      });
    }
  }

  // שגיאה לא-צפויה: לוג ברמת error עם ה-stack המלא, אך תשובה גנרית
  // ללקוח — לא לחשוף פרטי מימוש פנימיים.
  logger.error({ requestId, err }, 'Unhandled error');
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  });
}
