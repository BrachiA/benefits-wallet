import axios from 'axios';
import { logger } from '../../lib/logger';
import { recordAudit } from '../../lib/auditLog';
import { verifyImageMatch, suggestCategory, summarizeHebrew, throttleGeminiCall } from '../../lib/gemini';
import { aiEnrichmentRepository } from './aiEnrichment.repository';

// ============================================================
// שלושה שימושי AI נוספים על אותה תשתית בדיוק כמו modules/duplicateCleanup
// (client, throttle, AuditLog) — לא תשתית AI נפרדת. כל אחד פר-פריט
// בודד ב-PENDING_REVIEW (לא זוגות כמו כפילויות):
//
// 1. אימות תמונה (מולטימודלי): מזהה תמונה שבורה/placeholder/לא-קשורה.
//    לעולם לא נוגע בפריט עצמו — רק מתריע ב-AuditLog בביטחון גבוה
//    שאין התאמה. תמונה שלא נטענת כלל מזוהה דטרמיניסטית (לפני Gemini).
// 2. הצעת קטגוריה: רק לפריטי הטבה-חדשה בלי קטגוריה זמינה מהמקור
//    (matchedBenefitId=null, source.defaultCategoryId=null). בביטחון
//    גבוה כן ממלא את הפריט עצמו (aiSuggestedCategoryId) + AuditLog —
//    זה שינוי אמיתי בפריט, בשונה מאימות תמונה.
// 3. סיכום עברי: aiSummary נוסף ליד rawData, לעולם לא דורס אותו.
//
// entityType='DuplicateCleanupAction' משותף בכוונה עם duplicateCleanup
// (לא entityType חדש) — כך שהשאילתה הקיימת של יומן ה"התרעות AI"
// בדשבורד (duplicateCleanup.repository.findCleanupLog) מביאה את כל
// הסוגים בלי UNION, ראו duplicateCleanup.service.getCleanupLog.
// ============================================================

export type EnrichmentTrigger = 'cron' | 'manual';

// תקרת בטיחות פר-סוג-בדיקה, פר-סבב — מונע ריצה בודדת שמכלה חלק
// גדול מהמכסה היומית (1,500) אם יש backlog גדול; מה שנשאר ממתין
// לסבב הבא (שעה אחר כך, או הפעלה ידנית).
const MAX_ITEMS_PER_TYPE_PER_SWEEP = 20;

const CATEGORY_CONFIDENCE_THRESHOLD = 0.75; // עקבי עם DUPLICATE_CONFIDENCE_THRESHOLD
// "סיכון גבוה" = Gemini גם קובע שאין התאמה וגם די בטוח בכך. המטרה
// היא מקרים ברורים (הנחיית המשימה), לא ביקורת אמנותית עדינה — סף
// נמוך יותר מ-CATEGORY/DUPLICATE (0.6 ולא 0.75) כי המחיר של החמצת
// תמונה שבורה גבוה יותר ממחיר של התרעת-שווא בודדת שמנהלת בודקת.
const IMAGE_MISMATCH_CONFIDENCE_THRESHOLD = 0.6;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function performedByLabel(trigger: EnrichmentTrigger, feature: string): string {
  return trigger === 'cron' ? `AI ${feature} (ריצה תקופתית)` : `AI ${feature} (הפעלה ידנית)`;
}

// rawData הוא Json ללא טיפוס מובנה (ראה גם duplicateCleanup.service) —
// category הוא טקסט חופשי כפי שהופיע באתר המקור/בתוסף (extensionIngest.dto),
// לא categoryId מאומת.
function extractFields(rawData: unknown): { title: string; shortDescription?: string; imageUrl?: string; category?: string } {
  const raw = (rawData ?? {}) as Record<string, unknown>;
  return {
    title: typeof raw.title === 'string' ? raw.title : '',
    shortDescription: typeof raw.shortDescription === 'string' ? raw.shortDescription : undefined,
    imageUrl: typeof raw.imageUrl === 'string' ? raw.imageUrl : undefined,
    category: typeof raw.category === 'string' ? raw.category : undefined,
  };
}

function guessImageMimeType(url: string, contentType?: string): string {
  if (contentType?.startsWith('image/')) return contentType.split(';')[0].trim();
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

// ---------- 1. אימות תמונה ----------

async function verifyImages(trigger: EnrichmentTrigger) {
  const items = await aiEnrichmentRepository.findItemsNeedingImageCheck(MAX_ITEMS_PER_TYPE_PER_SWEEP);
  let checked = 0;
  let skippedNoImage = 0;
  let alertsRaised = 0;
  let errors = 0;

  for (const item of items) {
    const fields = extractFields(item.rawData);
    if (!fields.imageUrl) {
      await aiEnrichmentRepository.markImageChecked(item.id);
      skippedNoImage++;
      continue;
    }

    let imageBase64: string;
    let mimeType: string;
    try {
      const response = await axios.get<ArrayBuffer>(fields.imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        maxContentLength: MAX_IMAGE_BYTES,
        headers: { 'User-Agent': 'BenefitsWalletBot/1.0 (+scraper)' },
      });
      const contentType = response.headers['content-type'] as string | undefined;
      if (contentType && !contentType.startsWith('image/')) {
        throw new Error(`Content-Type אינו תמונה: ${contentType}`);
      }
      mimeType = guessImageMimeType(fields.imageUrl, contentType);
      imageBase64 = Buffer.from(response.data).toString('base64');
    } catch (err) {
      // תמונה שלא נטענת בכלל היא מקרה ברור וודאי של "שבורה" —
      // מזוהה דטרמיניסטית, בלי לבזבז קריאת Gemini על מה שממילא לא קיים.
      await aiEnrichmentRepository.markImageChecked(item.id);
      checked++;
      alertsRaised++;
      await recordAudit({
        entityType: 'DuplicateCleanupAction',
        entityId: item.id,
        action: 'UPDATE',
        performedBy: performedByLabel(trigger, 'אימות תמונה'),
        changedFields: {
          cleanupType: 'image_verification',
          imageUrl: fields.imageUrl,
          reason: `התמונה לא נטענה בהצלחה (${err instanceof Error ? err.message : 'שגיאה לא ידועה'}) — כנראה קישור שבור או תמונה לא זמינה.`,
          triggeredBy: trigger,
        },
      });
      continue;
    }

    await throttleGeminiCall();
    const result = await verifyImageMatch({ title: fields.title, shortDescription: fields.shortDescription }, imageBase64, mimeType);

    if (result.outcome === 'skipped') break; // אין client מוגדר בכלל — אין טעם להמשיך
    if (result.outcome === 'error') {
      errors++; // לא מסמנים aiImageCheckedAt — ינוסה שוב בסבב הבא
      continue;
    }

    await aiEnrichmentRepository.markImageChecked(item.id);
    checked++;
    if (!result.matches && result.confidence >= IMAGE_MISMATCH_CONFIDENCE_THRESHOLD) {
      alertsRaised++;
      await recordAudit({
        entityType: 'DuplicateCleanupAction',
        entityId: item.id,
        action: 'UPDATE',
        performedBy: performedByLabel(trigger, 'אימות תמונה'),
        changedFields: {
          cleanupType: 'image_verification',
          imageUrl: fields.imageUrl,
          confidence: result.confidence,
          reason: result.reason,
          triggeredBy: trigger,
        },
      });
    }
  }

  return { imagesChecked: checked, imagesSkippedNoUrl: skippedNoImage, imageAlertsRaised: alertsRaised, imageCheckErrors: errors };
}

// ---------- 2. הצעת קטגוריה ----------

async function suggestCategories(trigger: EnrichmentTrigger) {
  const items = await aiEnrichmentRepository.findItemsNeedingCategory(MAX_ITEMS_PER_TYPE_PER_SWEEP);
  const categories = await aiEnrichmentRepository.findActiveCategories();

  let suggested = 0;
  let skippedLowConfidence = 0;
  let errors = 0;

  for (const item of items) {
    if (categories.length === 0) break; // שום קטגוריה זמינה להציע — אין טעם לקרוא ל-AI

    const fields = extractFields(item.rawData);
    if (!fields.title) {
      await aiEnrichmentRepository.markCategorySuggested(item.id, null);
      continue;
    }

    await throttleGeminiCall();
    const result = await suggestCategory(
      { title: fields.title, shortDescription: fields.shortDescription, rawCategoryHint: fields.category },
      categories.map((c) => ({ slug: c.slug, name: c.name }))
    );

    if (result.outcome === 'skipped') break;
    if (result.outcome === 'error') {
      errors++; // לא מסמנים aiCategorySuggestedAt — כשל טכני, ינוסה שוב, בשונה מ"AI לא בטוח"
      continue;
    }

    const matched = result.categorySlug ? categories.find((c) => c.slug === result.categorySlug) : undefined;
    if (matched && result.confidence >= CATEGORY_CONFIDENCE_THRESHOLD) {
      await aiEnrichmentRepository.markCategorySuggested(item.id, matched.id);
      suggested++;
      await recordAudit({
        entityType: 'DuplicateCleanupAction',
        entityId: item.id,
        action: 'UPDATE',
        performedBy: performedByLabel(trigger, 'הצעת קטגוריה'),
        changedFields: {
          cleanupType: 'category_suggestion',
          categorySlug: matched.slug,
          categoryName: matched.name,
          confidence: result.confidence,
          reason: result.reason,
          triggeredBy: trigger,
        },
      });
    } else {
      // ביטחון נמוך/לא בטוח — נשאר ריק בכוונה, לא ממציאים תשובה גרועה.
      await aiEnrichmentRepository.markCategorySuggested(item.id, null);
      skippedLowConfidence++;
    }
  }

  return { categoriesSuggested: suggested, categoriesSkippedLowConfidence: skippedLowConfidence, categorySuggestionErrors: errors };
}

// ---------- 3. סיכום עברי ----------

async function summarizeItems(trigger: EnrichmentTrigger) {
  const items = await aiEnrichmentRepository.findItemsNeedingSummary(MAX_ITEMS_PER_TYPE_PER_SWEEP);

  let summarized = 0;
  let skippedNoDescription = 0;
  let errors = 0;

  for (const item of items) {
    const fields = extractFields(item.rawData);
    if (!fields.shortDescription?.trim()) {
      // אין מה לסכם — מסמנים aiSummaryGeneratedAt כדי שהפריט לא יחסום
      // מקום ל-MAX_ITEMS_PER_TYPE_PER_SWEEP בסבבים הבאים; aiSummary עצמו נשאר null.
      await aiEnrichmentRepository.saveSummary(item.id, null);
      skippedNoDescription++;
      continue;
    }

    await throttleGeminiCall();
    const result = await summarizeHebrew({ title: fields.title, shortDescription: fields.shortDescription });

    if (result.outcome === 'skipped') break;
    if (result.outcome === 'error') {
      errors++; // לא מסמנים — כשל טכני, ינוסה שוב
      continue;
    }

    await aiEnrichmentRepository.saveSummary(item.id, result.summary);
    summarized++;
  }

  return { itemsSummarized: summarized, summariesSkippedNoDescription: skippedNoDescription, summaryErrors: errors };
}

export const aiEnrichmentService = {
  async runEnrichmentSweep(trigger: EnrichmentTrigger) {
    const imageResult = await verifyImages(trigger);
    const categoryResult = await suggestCategories(trigger);
    const summaryResult = await summarizeItems(trigger);
    const summary = { trigger, ...imageResult, ...categoryResult, ...summaryResult };
    logger.info(summary, 'AI enrichment sweep finished');
    return summary;
  },

  // הפעלה ממוקדת בקטגוריזציה בלבד — זה מה שכפתור "הפעילי קטגוריזציה
  // עכשיו" בתוסף קורא (מיד אחרי סיום סריקה), לא סבב מלא עם תמונה/סיכום
  // שאינם רלוונטיים לרגע הזה ורק היו מאריכים את ההמתנה.
  async runCategorizationOnly(trigger: EnrichmentTrigger) {
    const result = await suggestCategories(trigger);
    const summary = { trigger, ...result };
    logger.info(summary, 'AI categorization-only run finished');
    return summary;
  },
};
