import { Router } from 'express';
import { scraperController } from './scraper.controller';
import { validateRequest } from '../../middleware/validateRequest';
import { requireAdminAuth } from '../../middleware/requireAdminAuth';
import {
  createScraperSourceSchema,
  listScrapedItemsQuerySchema,
  listScraperSourcesQuerySchema,
  reviewScrapedItemSchema,
  reviewTosSchema,
  updateScraperSourceSchema,
} from './scraper.dto';
import { ingestExtensionSchema } from './extensionIngest.dto';

export const scraperRouter = Router();

// כל מודול הסורק הוא דשבורד-בלבד — האפליקציה לא קוראת שום נתיב
// כאן, אפילו לא לקריאה. לכן, בשונה משאר המודולים, כל הראוטר מוגן,
// כולל ה-GETs.
scraperRouter.use(requireAdminAuth);

// ScraperSource CRUD
scraperRouter.get('/sources', validateRequest(listScraperSourcesQuerySchema, 'query'), scraperController.listSources);
scraperRouter.get('/sources/:id', scraperController.getSourceById);
scraperRouter.post('/sources', validateRequest(createScraperSourceSchema), scraperController.createSource);
scraperRouter.patch('/sources/:id', validateRequest(updateScraperSourceSchema), scraperController.updateSource);
scraperRouter.delete('/sources/:id', scraperController.removeSource);

// שער חוקי-אתי ופעילות — נתיבים נפרדים ומכוונים, לא חלק מ-PATCH כללי
scraperRouter.post('/sources/:id/review-tos', validateRequest(reviewTosSchema), scraperController.reviewTos);
scraperRouter.post('/sources/:id/activate', scraperController.activate);
scraperRouter.post('/sources/:id/deactivate', scraperController.deactivate);
scraperRouter.post('/sources/:id/run', scraperController.runSource);

// תור בדיקה — ScrapedItem
scraperRouter.get('/items', validateRequest(listScrapedItemsQuerySchema, 'query'), scraperController.listItems);
scraperRouter.get('/items/:id', scraperController.getItemById);
scraperRouter.post('/items/:id/review', validateRequest(reviewScrapedItemSchema), scraperController.reviewItem);

// תוסף Chrome לניהול (apps/admin-extension): נתיב ומזהה מקור נפרדים
// מ-ScraperSource הרגיל — לא "עוד sourceType", ראו extensionIngest.service.ts.
// מוגן ע"י requireAdminAuth למעלה, אותו מנגנון בדיוק (cookie או
// Authorization: Bearer <token> — ראו requireAdminAuth.extractToken).
scraperRouter.post('/ingest-extension', validateRequest(ingestExtensionSchema), scraperController.ingestExtension);
