import { Router } from 'express';
import { recommendationController } from './recommendation.controller';
import { validateRequest } from '../../middleware/validateRequest';
import { groupedRecommendationsQuerySchema } from './recommendation.dto';

export const recommendationRouter = Router();

recommendationRouter.get(
  '/grouped',
  validateRequest(groupedRecommendationsQuerySchema, 'query'),
  recommendationController.getGrouped
);
