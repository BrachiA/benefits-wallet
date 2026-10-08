import { logger } from '../../lib/logger';
import { recordAudit } from '../../lib/auditLog';
import { findOfficialLogo, throttleGeminiCall } from '../../lib/gemini';
import { downloadAndUploadImage } from '../../lib/r2Storage';
import { logoSearchRepository } from './logoSearch.repository';

// ============================================================
// חלק ג' של משימת אחסון התמונות: לוגו ברירת מחדל אוטומטי לכל
// מועדון/מותג, ע"י Gemini + Grounding with Google Search
// (lib/gemini.findOfficialLogo). רץ באותו cron שעתי כמו
// modules/duplicateCleanup/aiEnrichment (ראו duplicateCleanup.scheduler.ts),
// לא job נפרד — ומשתף את אותו throttleGeminiCall כדי לא לחרוג
// מהמכסה המשותפת לכל צרכני lib/gemini.
//
// ⚠ לא נבדק מול תוצאה אמיתית: Grounding with Google Search דורש
// Cloud Billing מקושר לפרויקט (ראו lib/gemini.ts, אומת 17.8.2026) —
// המפתח הנוכחי מחזיר 429 RESOURCE_EXHAUSTED על כל קריאה עם
// tools:[{googleSearch}]. הקוד כאן מטפל בכשל הזה בדיוק כמו rate
// limit רגיל (עוצר את הסבב מוקדם, לא מנסה את כל השאר) — ברגע
// שה-billing יופעל, אין צורך בשינוי קוד נוסף.
// ============================================================

export type LogoSearchTrigger = 'cron' | 'manual';

// עקבי עם aiEnrichment.MAX_ITEMS_PER_TYPE_PER_SWEEP — תקרת בטיחות
// פר-סוג-ישות פר-סבב, כדי שריצה בודדת לא תכלה חלק גדול מהמכסה
// החודשית (5,000) אם יש הרבה מועדונים/מותגים בלי לוגו בבת אחת.
const MAX_ENTITIES_PER_TYPE_PER_SWEEP = 20;

// רץ ב-cron בלבד (לא חוסם בקשת משתמש כמו downloadItemImage ב-
// scraper.service) — מותר timeout ארוך יותר מ-5 השניות של הורדת
// תמונת פריט בזמן קליטה.
const LOGO_DOWNLOAD_TIMEOUT_MS = 8000;

function performedByLabel(trigger: LogoSearchTrigger): string {
  return trigger === 'cron' ? 'AI חיפוש לוגו (ריצה תקופתית)' : 'AI חיפוש לוגו (הפעלה ידנית)';
}

type SearchOutcome = { kind: 'found' | 'not_found' | 'error' | 'skipped'; isRateLimit?: boolean };

async function searchLogoForEntity(
  entityType: 'Program' | 'Brand',
  entity: { id: string; name: string },
  trigger: LogoSearchTrigger,
  markResolved: (id: string, defaultLogoUrl: string | null) => Promise<unknown>
): Promise<SearchOutcome> {
  await throttleGeminiCall();
  const result = await findOfficialLogo(entity.name);

  if (result.outcome === 'skipped') return { kind: 'skipped' };

  if (result.outcome === 'error') {
    // לא מסמנים logoSearchedAt — כשל טכני (כולל, בפועל היום, "אין
    // Cloud Billing מקושר") ינוסה שוב בסבב הבא, לא נחשב "נבדק ולא
    // נמצא". עקבי עם judgment_failed ב-duplicateCleanup.service.
    await recordAudit({
      entityType: 'DuplicateCleanupAction',
      entityId: entity.id,
      action: 'UPDATE',
      performedBy: performedByLabel(trigger),
      changedFields: {
        cleanupType: 'logo_search',
        logoEntityType: entityType,
        entityName: entity.name,
        isRateLimit: result.isRateLimit,
        reason: `חיפוש הלוגו נכשל מסיבה טכנית: ${result.message}. ינוסה שוב בסבב הבא.`,
        triggeredBy: trigger,
      },
    });
    return { kind: 'error', isRateLimit: result.isRateLimit };
  }

  if (result.outcome === 'not_found') {
    await markResolved(entity.id, null);
    await recordAudit({
      entityType: 'DuplicateCleanupAction',
      entityId: entity.id,
      action: 'UPDATE',
      performedBy: performedByLabel(trigger),
      changedFields: {
        cleanupType: 'logo_search',
        logoEntityType: entityType,
        entityName: entity.name,
        reason: 'לא נמצא לוגו רשמי בביטחון סביר בחיפוש Google — נשאר ריק.',
        triggeredBy: trigger,
      },
    });
    return { kind: 'not_found' };
  }

  // found: ה-imageUri שחזר מ-Grounding הוא קישור חיצוני (תוצאת
  // חיפוש בפועל, לא המצאה של המודל) — עדיין צריך להוריד ולהעלות
  // ל-R2 בעצמנו, כמו כל תמונה חיצונית אחרת (חלק ב').
  const upload = await downloadAndUploadImage(
    result.imageUrl,
    `logos/${entityType.toLowerCase()}/${entity.id}`,
    LOGO_DOWNLOAD_TIMEOUT_MS
  );

  if (upload.outcome !== 'uploaded') {
    await markResolved(entity.id, null);
    await recordAudit({
      entityType: 'DuplicateCleanupAction',
      entityId: entity.id,
      action: 'UPDATE',
      performedBy: performedByLabel(trigger),
      changedFields: {
        cleanupType: 'logo_search',
        logoEntityType: entityType,
        entityName: entity.name,
        reason: `נמצא קישור ללוגו (${result.sourceDomain ?? result.imageUrl}) אך הורדתו נכשלה: ${upload.reason}. נשאר ריק.`,
        triggeredBy: trigger,
      },
    });
    return { kind: 'not_found' };
  }

  await markResolved(entity.id, upload.publicUrl);
  await recordAudit({
    entityType: 'DuplicateCleanupAction',
    entityId: entity.id,
    action: 'UPDATE',
    performedBy: performedByLabel(trigger),
    changedFields: {
      cleanupType: 'logo_search',
      logoEntityType: entityType,
      entityName: entity.name,
      imageUrl: upload.publicUrl,
      sourceDomain: result.sourceDomain,
      reason: `נמצא ועודכן לוגו רשמי, מקור: ${result.sourceTitle ?? result.sourceDomain ?? 'חיפוש Google'}.`,
      triggeredBy: trigger,
    },
  });
  return { kind: 'found' };
}

export const logoSearchService = {
  async runLogoSearchSweep(trigger: LogoSearchTrigger) {
    const programs = await logoSearchRepository.findProgramsNeedingLogo(MAX_ENTITIES_PER_TYPE_PER_SWEEP);
    const brands = await logoSearchRepository.findBrandsNeedingLogo(MAX_ENTITIES_PER_TYPE_PER_SWEEP);

    let found = 0;
    let notFound = 0;
    let errors = 0;
    let stoppedEarly = false;

    entityLoop: for (const [entityType, entities, markResolved] of [
      ['Program', programs, logoSearchRepository.markProgramLogoResolved],
      ['Brand', brands, logoSearchRepository.markBrandLogoResolved],
    ] as const) {
      for (const entity of entities) {
        const outcome = await searchLogoForEntity(entityType, entity, trigger, markResolved);
        if (outcome.kind === 'skipped') break entityLoop; // אין client Gemini מוגדר בכלל
        if (outcome.kind === 'found') found++;
        else if (outcome.kind === 'not_found') notFound++;
        else {
          errors++;
          if (outcome.isRateLimit) {
            // עוצרים את כל הסבב, לא רק את הישות הזו — נמנע מלנסות
            // (ולכשל) על כל מועדון/מותג נוסף באותה ריצה, בדיוק כמו
            // rateLimitHit ב-duplicateCleanup.cleanupDuplicates.
            logger.warn({ entityType, entityId: entity.id }, 'Logo search rate limit/quota hit — stopping sweep early');
            stoppedEarly = true;
            break entityLoop;
          }
        }
      }
    }

    const summary = {
      trigger,
      programsChecked: programs.length,
      brandsChecked: brands.length,
      logosFound: found,
      logosNotFound: notFound,
      logoSearchErrors: errors,
      stoppedEarly,
    };
    logger.info(summary, 'Logo search sweep finished');
    return summary;
  },
};
