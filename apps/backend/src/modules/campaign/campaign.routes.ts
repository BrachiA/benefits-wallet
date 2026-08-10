import { Router } from 'express';
import { campaignController } from './campaign.controller';
import { validateRequest } from '../../middleware/validateRequest';
import { requireAdminAuth } from '../../middleware/requireAdminAuth';
import { createCampaignSchema, listCampaignsQuerySchema, updateCampaignSchema } from './campaign.dto';

export const campaignRouter = Router();

campaignRouter.get('/', validateRequest(listCampaignsQuerySchema, 'query'), campaignController.list);
campaignRouter.get('/:id', campaignController.getById);

campaignRouter.use(requireAdminAuth);

campaignRouter.post('/', validateRequest(createCampaignSchema), campaignController.create);
campaignRouter.patch('/:id', validateRequest(updateCampaignSchema), campaignController.update);
campaignRouter.delete('/:id', campaignController.remove);
