import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { recordAudit } from '../../lib/auditLog';
import { scraperRepository } from './scraper.repository';
import { scraperService } from './scraper.service';
import { scraperAlerts } from './scraperAlerts';
import type { RawScrapedFields } from './matching.service';
import { EXTENSION_ANCHOR_SLUG } from './extensionIngest.dto';
import type { ExtensionRawItem, IngestExtensionInput } from './extensionIngest.dto';

// ============================================================
// נתיב קלט נפרד לגמרי ממנגנון ה-ScraperSource הרגיל (משימת "תוסף
// Chrome לניהול", מנוסחת בכוונה). ScraperSource.tosStatus/isActive/
// scheduleCron הם שער אמיתי שקובע אם ריצה *אוטומטית מהשרת* מותרת —
// כאן אין הרצה אוטומטית בכלל. כל קריאה יזומה בלחיצת מנהלת בתוסף
// Chrome, בדפדפן שלה, כשהיא מחוברת. אין scheduleCron על העוגן,
// אף קוד לא קורא לו דרך findRunnableSources, ואין שום נתיב מהשרת
// שמפעיל את זה.
//
// מה כן משותף, במכוון: processScrapedItem (matching + confidence +
// PENDING_REVIEW/AUTO_PUBLISHED + alerts) — בלי שום שינוי. הפריטים
// עוברים בדיוק את אותה שרשרת החלטה כמו כל פריט סרוק אחר. אין
// "פרסום ישיר" רק כי המקור שונה.
//
// למה בכל זאת קיים ScraperSource ברקע: ScrapedItem/ScraperRun הם FK
// אל ScraperSource בסכמה (אילוץ טכני של המודל הקיים, לא נבחר כאן).
// שורה טכנית אחת (ANCHOR) משמשת עוגן FK בלבד — לא נגיש/ניתן להפעלה
// דרך אף endpoint של ScraperSource (reviewTos/activate/run), ומוסתרת
// מרשימת "מקורות סריקה" בדשבורד (ראו הסינון ב-scraper.repository.
// findSources). defaultProgramId/defaultBrandId/defaultCategoryId
// נשארים ריקים לצמיתות — המשמעות (hasAutoScopeAnchor.ts): הטבה
// *חדשה* דרך התוסף לעולם לא יכולה להתפרסם אוטומטית, רק לעבור
// PENDING_REVIEW. עדכון להטבה קיימת כן יכול להתפרסם אוטומטית אם
// הביטחון גבוה — זו ההתנהגות הרגילה של processScrapedItem למקור בלי
// עוגן שיוך, לא מקרה מיוחד שנוסף כאן.
// ============================================================

async function getOrCreateAnchorSource() {
  const existing = await prisma.scraperSource.findUnique({ where: { slug: EXTENSION_ANCHOR_SLUG } });
  if (existing) return existing;

  return prisma.scraperSource.create({
    data: {
      slug: EXTENSION_ANCHOR_SLUG,
      name: '🧩 תוסף Chrome — הזנה ידנית (עוגן טכני, לא לעריכה)',
      sourceType: 'AGGREGATOR_SITE',
      baseUrl: 'internal://admin-extension',
      renderMode: 'HTTP',
      // לא נקרא אף פעם בפועל: fetchRawItems לא מופעל בנתיב הזה
      // (הפריטים כבר מגיעים מחולצים מהתוסף), ה-scrapeConfig קיים
      // רק כי העמודה חובה בסכמה.
      scrapeConfig: { listSelector: 'n/a', fields: { title: 'n/a', externalId: 'n/a' } },
      isActive: false,
      tosStatus: 'PENDING_REVIEW',
    },
  });
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown-host';
  }
}

// RawScrapedFields (matching.service) הוא הטיפוס שה-pipeline הקיים
// קורא ממנו בפועל. שדות נוספים שהתוסף חילץ (category/originalPrice/
// discountedPrice/discountUnit/termsAndConditions/validUntil/
// sourceUrl) לא נקראים על ידי matching/confidence/applyUpdate, אבל
// עוברים כמו שהם ל-rawData (Json) כי fields כולו נשמר שם ב-createItem
// הקיים — המנהלת רואה אותם במסך בדיקת הפריט. הם לא נכתבים היום על
// ה-Benefit עצמו (termsAndConditions/externalUrl/endDate), כי
// processScrapedItem המשותף לא כותב אותם היום לאף מקור שהוא, לא רק
// לתוסף — ראו הערה בדוח הסיום.
function toRawScrapedFields(
  pageUrl: string,
  item: ExtensionRawItem,
  anchor: { programId?: string; brandId?: string }
): RawScrapedFields & Record<string, unknown> {
  return {
    title: item.title,
    shortDescription: item.shortDescription,
    discountValue: item.discountValue,
    imageUrl: item.imageUrl,
    externalId: `${hostnameOf(pageUrl)}::${item.externalId}`,
    detailUrl: item.detailUrl ?? pageUrl,
    category: item.category,
    originalPrice: item.originalPrice,
    discountedPrice: item.discountedPrice,
    discountUnit: item.discountUnit,
    termsAndConditions: item.termsAndConditions,
    validUntil: item.validUntil,
    sourceUrl: pageUrl,
    // שיוך שנבחר בפופאפ עבור הריצה כולה (ראו ingest למטה). נשמר כאן,
    // ב-rawData של כל פריט, כדי ש-reviewItem (scraper.service.ts)
    // יוכל לשחזר אותו בזמן אישור ידני — המקור הטכני המשותף
    // (__browser_extension_ingest__) עצמו נשאר בלי defaultProgramId/
    // defaultBrandId קבועים, כי השיוך הוא per-request ולא per-source.
    programId: anchor.programId,
    brandId: anchor.brandId,
  };
}

export type ExtensionIngestReport = {
  runId: string;
  pageUrl: string;
  totalItems: number;
  created: number;
  updated: number;
  flagged: number;
  skipped: number;
  errors: Array<{ externalId: string; title: string; message: string }>;
};

export const extensionIngestService = {
  async ingest(input: IngestExtensionInput): Promise<ExtensionIngestReport> {
    const source = await getOrCreateAnchorSource();
    const run = await scraperRepository.createRun(source.id);

    // עוגן אפקטיבי לריצה הזו בלבד: אותו מקור טכני (id/name זהים,
    // ה-FK על ScrapedItem/ScraperRun לא זז), אבל defaultProgramId/
    // defaultBrandId מוחלפים בבחירה מהפופאפ אם יש — לא נשמר בחזרה
    // על שורת ScraperSource המשותפת (זו הייתה הופכת בחירה של ריצה
    // אחת לברירת מחדל קבועה לכל ריצה עתידית, כולל מדומיינים אחרים).
    // עדיין לא כולל defaultCategoryId — קטגוריה תלויה בתוכן הפרטני
    // ולא ניתנת לניחוש מהמועדון/מותג, ולכן hasAutoScopeAnchor נשאר
    // false והפריטים החדשים עדיין יורדים ל-PENDING_REVIEW ברובם.
    const effectiveSource = {
      ...source,
      defaultProgramId: input.programId ?? source.defaultProgramId,
      defaultBrandId: input.brandId ?? source.defaultBrandId,
    };

    let created = 0;
    let updated = 0;
    let flagged = 0;
    let skipped = 0;
    const errors: ExtensionIngestReport['errors'] = [];

    for (const item of input.items) {
      try {
        const fields = toRawScrapedFields(input.pageUrl, item, { programId: input.programId, brandId: input.brandId });
        // אותו processScrapedItem בדיוק כמו כל מקור אחר — matching,
        // confidence, PENDING_REVIEW/AUTO_PUBLISHED, alerts. שום שלב
        // לא מדולג.
        const outcome = await scraperService.processScrapedItem(effectiveSource, run.id, fields);
        if (outcome === 'CREATED') created++;
        else if (outcome === 'UPDATED') updated++;
        else if (outcome === 'FLAGGED') flagged++;
        else skipped++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error({ pageUrl: input.pageUrl, externalId: item.externalId, err }, 'Extension ingest: item failed');
        errors.push({ externalId: item.externalId, title: item.title, message });
      }
    }

    // מייל מרוכז אחד לכל הפריטים שסומנו בריצה הזו (ראו processScrapedItem
    // -> scraperAlerts.itemFlagged) — בדיוק הבעיה שדווחה בפועל: 94
    // פריטים מריצה אחת דרך התוסף לא אמורים להיות 94 מיילים נפרדים.
    await scraperAlerts.flushFlaggedBatch({ runId: run.id, sourceName: source.name });

    const processedOk = created + updated + flagged + skipped;
    const status = errors.length === 0 ? 'SUCCESS' : processedOk === 0 ? 'FAILED' : 'PARTIAL';

    const finished = await scraperRepository.finishRun(run.id, {
      status,
      itemsFound: input.items.length,
      itemsCreated: created,
      itemsUpdated: updated,
      itemsFlagged: flagged,
      itemsSkipped: skipped + errors.length,
      ...(errors.length > 0 && { errorMessage: `${errors.length} מתוך ${input.items.length} פריטים נכשלו בעיבוד` }),
    });
    await scraperRepository.updateSource(source.id, { lastRunAt: new Date(), lastRunStatus: status });

    await recordAudit({
      entityType: 'ScraperRun',
      entityId: finished.id,
      action: 'CREATE',
      changedFields: {
        pageUrl: input.pageUrl,
        totalItems: input.items.length,
        created,
        updated,
        flagged,
        skipped,
        errors: errors.length,
      },
    });

    return {
      runId: finished.id,
      pageUrl: input.pageUrl,
      totalItems: input.items.length,
      created,
      updated,
      flagged,
      skipped,
      errors,
    };
  },
};
