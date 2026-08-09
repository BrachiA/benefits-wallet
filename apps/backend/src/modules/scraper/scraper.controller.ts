import type { NextFunction, Request, Response } from 'express';
import { scraperService } from './scraper.service';
import { sendPaginated, sendSuccess, parsePagination } from '../../lib/apiResponse';
import type {
  CreateScraperSourceInput,
  ListScraperSourcesQuery,
  ListScrapedItemsQuery,
  ReviewScrapedItemInput,
  ReviewTosInput,
  UpdateScraperSourceInput,
} from './scraper.dto';

export const scraperController = {
  // ---------- ScraperSource ----------

  async listSources(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query as unknown as ListScraperSourcesQuery;
      const { page, pageSize } = parsePagination(req.query as Record<string, unknown>);
      const { items, meta } = await scraperService.listSources(query, page, pageSize);
      return sendPaginated(res, items, meta);
    } catch (err) {
      next(err);
    }
  },

  async getSourceById(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await scraperService.getSourceById(req.params.id));
    } catch (err) {
      next(err);
    }
  },

  async createSource(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await scraperService.createSource(req.body as CreateScraperSourceInput), 201);
    } catch (err) {
      next(err);
    }
  },

  async updateSource(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await scraperService.updateSource(req.params.id, req.body as UpdateScraperSourceInput));
    } catch (err) {
      next(err);
    }
  },

  async removeSource(req: Request, res: Response, next: NextFunction) {
    try {
      await scraperService.removeSource(req.params.id);
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  // endpoint נפרד ומכוון מ-update: אישור/דחיית ToS היא פעולה
  // שצריכה תיעוד מפורש (מי ומתי), לא סתם PATCH.
  async reviewTos(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await scraperService.reviewTos(req.params.id, req.body as ReviewTosInput));
    } catch (err) {
      next(err);
    }
  },

  async activate(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await scraperService.activate(req.params.id));
    } catch (err) {
      next(err);
    }
  },

  async deactivate(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await scraperService.deactivate(req.params.id));
    } catch (err) {
      next(err);
    }
  },

  // הרצה ידנית של מקור בודד (לצד ה-Cron היומי האוטומטי)
  async runSource(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await scraperService.runSource(req.params.id));
    } catch (err) {
      next(err);
    }
  },

  // ---------- ScrapedItem: תור בדיקה ----------

  async listItems(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query as unknown as ListScrapedItemsQuery;
      const { page, pageSize } = parsePagination(req.query as Record<string, unknown>);
      const { items, meta } = await scraperService.listItems(query, page, pageSize);
      return sendPaginated(res, items, meta);
    } catch (err) {
      next(err);
    }
  },

  async getItemById(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await scraperService.getItemById(req.params.id));
    } catch (err) {
      next(err);
    }
  },

  async reviewItem(req: Request, res: Response, next: NextFunction) {
    try {
      return sendSuccess(res, await scraperService.reviewItem(req.params.id, req.body as ReviewScrapedItemInput));
    } catch (err) {
      next(err);
    }
  },
};
