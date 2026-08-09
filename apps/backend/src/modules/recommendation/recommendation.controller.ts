import type { NextFunction, Request, Response } from 'express';
import { recommendationService } from './recommendation.service';
import { sendSuccess } from '../../lib/apiResponse';
import type { GroupedRecommendationsQuery } from './recommendation.dto';

export const recommendationController = {
  async getGrouped(req: Request, res: Response, next: NextFunction) {
    try {
      const query = req.query as unknown as GroupedRecommendationsQuery;
      return sendSuccess(res, await recommendationService.getGrouped(query));
    } catch (err) {
      next(err);
    }
  },
};
