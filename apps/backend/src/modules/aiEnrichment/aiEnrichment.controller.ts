import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../lib/apiResponse';
import { aiEnrichmentService } from './aiEnrichment.service';

export const aiEnrichmentController = {
  // הפעלה ידנית, קטגוריזציה בלבד — נקרא מכפתור "הפעילי קטגוריזציה
  // עכשיו" בפופאפ התוסף, מיד אחרי סיום סריקה, כדי שקטגוריה תתמלא
  // בלי לחכות ל-cron השעתי. לא מריץ אימות תמונה/סיכום — אלה ממשיכים
  // לרוץ רק ב-cron (ראו aiEnrichment.service.runCategorizationOnly).
  async runCategorization(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await aiEnrichmentService.runCategorizationOnly('manual'));
    } catch (err) {
      next(err);
    }
  },
};
