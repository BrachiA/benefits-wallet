import { Router } from 'express';
import { benefitController } from './benefit.controller';
import { validateRequest } from '../../middleware/validateRequest';
import { createBenefitSchema, listBenefitsQuerySchema, updateBenefitSchema } from './benefit.dto';

export const benefitRouter = Router();

benefitRouter.get('/', validateRequest(listBenefitsQuerySchema, 'query'), benefitController.list);
benefitRouter.get('/:id', benefitController.getById);
benefitRouter.post('/', validateRequest(createBenefitSchema), benefitController.create);
benefitRouter.patch('/:id', validateRequest(updateBenefitSchema), benefitController.update);
benefitRouter.delete('/:id', benefitController.remove);
