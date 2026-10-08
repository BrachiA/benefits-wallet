import { z } from 'zod';

// slug קבוע של עוגן ה-FK הטכני (ראו extensionIngest.service.ts).
// חי כאן, לא ב-service, כדי ש-scraper.repository.ts יוכל לייבא אותו
// בלי מעגל ייבוא (repository <- service <- repository).
export const EXTENSION_ANCHOR_SLUG = '__browser_extension_ingest__';

// DTO נפרד מ-scraper.dto.ts: זה לא עוד וריאציה של ScraperSource,
// זה נתיב קלט אחר (ראו extensionIngest.service.ts). items הם מה
// שה-content script של apps/admin-extension חילץ מה-DOM החי של
// עמוד יחיד, אחרי רינדור מלא.
const extensionRawItemSchema = z.object({
  // מזהה יציב בתוך הדף עצמו (data-id/href/hash) — ה-service מוסיף לו
  // קידומת domain כדי שלא יתנגש עם אותו מזהה מדף של אתר אחר.
  externalId: z.string().min(1),
  title: z.string().min(1),
  shortDescription: z.string().optional(),
  category: z.string().optional(),
  originalPrice: z.number().optional(),
  discountedPrice: z.number().optional(),
  discountValue: z.number().optional(),
  discountUnit: z.enum(['PERCENT', 'ILS']).optional(),
  imageUrl: z.string().url().optional(),
  termsAndConditions: z.string().optional(),
  validUntil: z.string().optional(),
  detailUrl: z.string().url().optional(),
});

export const ingestExtensionSchema = z.object({
  pageUrl: z.string().url(),
  pageTitle: z.string().optional(),
  // שיוך per-request, לא per-item: כל ריצה בודדת של התוסף היא כמעט
  // תמיד סריקה של עמוד ששייך למועדון/מותג אחד. אופציונלי — בלי
  // בחירה, ההתנהגות נשארת בדיוק כמו קודם (בלי שיוך). ראו
  // extensionIngest.service.ts.
  programId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  items: z.array(extensionRawItemSchema).min(1).max(300),
});

export type IngestExtensionInput = z.infer<typeof ingestExtensionSchema>;
export type ExtensionRawItem = z.infer<typeof extensionRawItemSchema>;
