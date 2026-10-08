import { Router } from 'express';
import { settingsController } from './settings.controller';
import { validateRequest } from '../../middleware/validateRequest';
import { requireAdminAuth } from '../../middleware/requireAdminAuth';
import { updateAlertSettingsSchema } from './settings.dto';

export const settingsRouter = Router();

// מסך ניהול בלבד — אין צריכה מהאפליקציה, כמו מודול הסורק.
settingsRouter.use(requireAdminAuth);

settingsRouter.get('/alerts', settingsController.getAlertSettings);
settingsRouter.patch('/alerts', validateRequest(updateAlertSettingsSchema), settingsController.updateAlertSettings);
