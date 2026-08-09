import { z } from 'zod';

export const scraperSourceTypeEnum = z.enum(['ISSUER_SITE', 'BRAND_SITE', 'AGGREGATOR_SITE']);
export const scraperRenderModeEnum = z.enum(['HTTP', 'HEADLESS_BROWSER']);
export const tosReviewStatusEnum = z.enum(['PENDING_REVIEW', 'APPROVED', 'REJECTED']);

// מבנה scrapeConfig: data-driven לחלוטין. הרנר קורא selectors ומיפוי
// שדות מכאן — הוספת מקור חדש לא נוגעת בקוד הרנר בכלל.
const scrapeConfigSchema = z.object({
  listSelector: z.string().min(1), // selector לכל "כרטיס הטבה" בדף
  paginationParam: z.string().optional(),
  maxPages: z.number().int().positive().default(1),
  fields: z.object({
    title: z.string().min(1),
    shortDescription: z.string().optional(),
    discountValue: z.string().optional(),
    imageUrl: z.string().optional(),
    externalId: z.string().min(1), // selector/attribute שמזהה את הפריט ייחודית
    detailUrl: z.string().optional(),
  }),
});

export const createScraperSourceSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(150),
  sourceType: scraperSourceTypeEnum,
  baseUrl: z.string().url(),
  renderMode: scraperRenderModeEnum.default('HTTP'),
  scrapeConfig: scrapeConfigSchema,
  defaultProgramId: z.string().uuid().optional(),
  defaultBrandId: z.string().uuid().optional(),
  requestDelayMs: z.number().int().positive().default(1000),
  scheduleCron: z.string().default('0 3 * * *'),
  // isActive במכוון לא נכלל כאן: מקור חדש נוצר תמיד לא-פעיל, מופעל
  // רק דרך endpoint ייעודי אחרי אישור ToS. ראו scraper.service.activate.
});

export const updateScraperSourceSchema = createScraperSourceSchema.partial();

// endpoint נפרד ומכוון: אישור ToS הוא פעולה שצריכה תיעוד מפורש (מי
// ומתי), לא סתם עדכון שדה בתוך PATCH כללי.
export const reviewTosSchema = z.object({
  status: tosReviewStatusEnum,
  reviewedBy: z.string().min(1),
  notes: z.string().optional(),
});

export const listScraperSourcesQuerySchema = z.object({
  isActive: z.coerce.boolean().optional(),
  tosStatus: tosReviewStatusEnum.optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const listScrapedItemsQuerySchema = z.object({
  sourceId: z.string().uuid().optional(),
  status: z.enum(['AUTO_PUBLISHED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED']).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

// אישור/דחייה ידניים של פריט בתור הבדיקה
export const reviewScrapedItemSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  reviewedBy: z.string().min(1),
  // בעת אישור הטבה חדשה, המנהל יכול לתקן שדות לפני הפרסום —
  // rawData היא הצעה, לא אמת מוחלטת.
  overrides: z
    .object({
      title: z.string().optional(),
      shortDescription: z.string().optional(),
      categoryId: z.string().uuid().optional(),
      discountValue: z.number().optional(),
    })
    .optional(),
});

export type CreateScraperSourceInput = z.infer<typeof createScraperSourceSchema>;
export type UpdateScraperSourceInput = z.infer<typeof updateScraperSourceSchema>;
export type ReviewTosInput = z.infer<typeof reviewTosSchema>;
export type ListScraperSourcesQuery = z.infer<typeof listScraperSourcesQuerySchema>;
export type ListScrapedItemsQuery = z.infer<typeof listScrapedItemsQuerySchema>;
export type ReviewScrapedItemInput = z.infer<typeof reviewScrapedItemSchema>;
