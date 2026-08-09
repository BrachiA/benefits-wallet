import type { NextFunction, Request, Response } from 'express';
import { benefitService } from './benefit.service';
import { sendPaginated, sendSuccess, parsePagination } from '../../lib/apiResponse';
import type { CreateBenefitInput, ListBenefitsQuery, UpdateBenefitInput } from './benefit.dto';

// Controller נשאר "טיפש" בכוונה: רק ממיר HTTP <-> קריאת Service.
// כל החלטה עסקית (מה זה "תקף", איך ממיינים) חיה ב-Service, כדי
// שאפשר יהיה לבדוק אותה ב-unit test בלי Express בכלל.

export const benefitController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query as unknown as ListBenefitsQuery;
      const { page, pageSize } = parsePagination(req.query as Record<string, unknown>);
      const { items, meta } = await benefitService.list(query, page, pageSize);
      return sendPaginated(res, items, meta);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const benefit = await benefitService.getById(req.params.id);
      return sendSuccess(res, benefit);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const input = req.body as CreateBenefitInput;
      const benefit = await benefitService.create(input);
      return sendSuccess(res, benefit, 201);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const input = req.body as UpdateBenefitInput;
      const benefit = await benefitService.update(req.params.id, input);
      return sendSuccess(res, benefit);
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await benefitService.remove(req.params.id);
      return res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
