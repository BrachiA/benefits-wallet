import { Router } from 'express';
import { duplicateCleanupController } from './duplicateCleanup.controller';
import { requireAdminAuth } from '../../middleware/requireAdminAuth';

export const duplicateCleanupRouter = Router();

// מסך ניהול בלבד — כמו מודול הסורק וההגדרות. תומך Bearer (לא רק
// cookie) כי כפתור ההפעלה הידנית נקרא גם מתוסף ה-Chrome.
duplicateCleanupRouter.use(requireAdminAuth);

duplicateCleanupRouter.post('/run', duplicateCleanupController.run);
duplicateCleanupRouter.get('/log', duplicateCleanupController.listLog);
