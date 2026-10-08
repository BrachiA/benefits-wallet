import { Router } from 'express';
import { aiEnrichmentController } from './aiEnrichment.controller';
import { requireAdminAuth } from '../../middleware/requireAdminAuth';

export const aiEnrichmentRouter = Router();

// מסך ניהול בלבד — כמו duplicateCleanup.routes.ts. תומך Bearer (לא
// רק cookie) כי כפתור הקטגוריזציה נקרא גם מתוסף ה-Chrome.
aiEnrichmentRouter.use(requireAdminAuth);

aiEnrichmentRouter.post('/categorize', aiEnrichmentController.runCategorization);
