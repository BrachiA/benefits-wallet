import type { NextFunction, Request, Response } from 'express';
import { sendSuccess, sendPaginated, parsePagination } from '../../lib/apiResponse';
import { duplicateCleanupService } from './duplicateCleanup.service';

export const duplicateCleanupController = {
  // הפעלה ידנית (לצד ה-Cron השעתי) — מ-endpoint זה קורא גם כפתור
  // "הפעילי ניקוי כפילויות עכשיו" בפופאפ התוסף.
  async run(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await duplicateCleanupService.runCleanupSweep('manual'));
    } catch (err) {
      next(err);
    }
  },

  async listLog(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, pageSize } = parsePagination(req.query as Record<string, unknown>);
      const { items, meta } = await duplicateCleanupService.getCleanupLog(page, pageSize);
      return sendPaginated(res, items, meta);
    } catch (err) {
      next(err);
    }
  },
};
