import { logger } from '../../lib/logger';
import { recordAudit } from '../../lib/auditLog';
import { judgeDuplicateBatch, throttleGeminiCall, DUPLICATE_BATCH_SIZE, type DuplicateJudgmentCandidate } from '../../lib/gemini';
import { duplicateCleanupRepository } from './duplicateCleanup.repository';

// ============================================================
// ניקוי בדיעבד בבקאנד בלבד — לא נוגע בזרימת הסריקה/תוסף עצמה, לא
// חוסם/משנה אותה. שני מנגנונים נפרדים:
//
// 1. ריצות יתומות (דטרמיניסטי, בלי AI): ScraperRun שהתחיל ואף פעם
//    לא הסתיים (finishedAt ריק) — למשל תהליך השרת קרס באמצע לולאת
//    עיבוד. פריטי PENDING_REVIEW שלו (לא נגעה בהם יד אדם) עוברים
//    SUPERSEDED.
//
// 2. כפילויות סמנטיות (AI, Gemini): אותו מקור, שני פריטים מריצות
//    שונות שנראים כמו אותה הטבה אמיתית בניסוח מעט שונה — בדיוק
//    התרחיש שתיקון pickBestGroup בתוסף (איחוד קבוצות DOM) עלול
//    להגביר. סינון מקדים זול (דמיון כותרות) לפני קריאה בתשלום ל-Gemini,
//    ואז שיפוט בקבוצות (batches) של עד DUPLICATE_BATCH_SIZE זוגות
//    בקריאה אחת — לא קריאה-לקריאה (איטי מדי, ~5 שניות throttle לזוג),
//    ולא כל הזוגות בקריאה ענקית אחת ("lost in the middle" פוגע
//    בדיוק). ראו judgeDuplicateBatch ב-lib/gemini.ts.
//
// "מחיקה" = עדכון סטטוס ל-SUPERSEDED (קיים כבר במודל בדיוק לתרחיש
// הזה) — לעולם לא DELETE אמיתי מה-DB. כל פעולה נרשמת ל-AuditLog
// עם נימוק; מקרה גבולי (פריט כבר נסקר/אושר ידנית) לעולם לא נמחק
// אוטומטית — רק מסומן לבדיקה ידנית.
// ============================================================

export type CleanupTrigger = 'cron' | 'manual';

const ORPHAN_STALE_HOURS = 2; // ריצות אמיתיות נגמרות בשניות-דקות; סף בטוח
const DUPLICATE_LOOKBACK_DAYS = 7; // גבול עלות/רעש — פריט ישן מזה כבר נסקר או לא רלוונטי
const TITLE_SIMILARITY_THRESHOLD = 0.5; // סינון מקדים זול לפני קריאה בתשלום ל-Gemini
const DUPLICATE_CONFIDENCE_THRESHOLD = 0.75; // סף לפעולה אוטומטית (SUPERSEDED); מתחת לזה - בכלל לא פועלים

// תקרת בטיחות למקרה של הרבה מועמדים שעוברים את הסינון המקדים —
// נשמר בכוונה כתקרת *זוגות* (200, כמו לפני המעבר ל-batch), לא
// תקרת קריאות. אם הופכים אותה לתקרת קריאות batch באותו ערך, היקף
// הכיסוי בפועל היה גדל פי DUPLICATE_BATCH_SIZE בלי שהתבקש שינוי
// כזה — שינוי היקף שקט שלא רצינו.
const MAX_DUPLICATE_PAIRS_PER_SWEEP = 200;

function performedByLabel(trigger: CleanupTrigger): string {
  return trigger === 'cron' ? 'AI ניקוי כפילויות (ריצה תקופתית)' : 'AI ניקוי כפילויות (הפעלה ידנית)';
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Dice coefficient על bigrams של תווים — זול, עובד גם על עברית
// (בניגוד לגישות מבוססות-מילים שרגישות לניקוד/צורת כתיב), מספיק
// כדי לסנן זוגות רחוקים לגמרי לפני ששולחים ל-Gemini.
function titleSimilarity(a: string, b: string): number {
  const bigramsOf = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const setA = bigramsOf(normalizeTitle(a));
  const setB = bigramsOf(normalizeTitle(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let overlap = 0;
  for (const bigram of setA) if (setB.has(bigram)) overlap++;
  return (2 * overlap) / (setA.size + setB.size);
}

// rawData הוא Json (ראה extensionIngest.service.ts / matching.service.ts)
// — אין טיפוס מובנה, רק השדות שאנחנו יודעים שקיימים בפועל.
function extractCandidateFields(rawData: unknown): DuplicateJudgmentCandidate {
  const raw = (rawData ?? {}) as Record<string, unknown>;
  return {
    title: typeof raw.title === 'string' ? raw.title : '',
    shortDescription: typeof raw.shortDescription === 'string' ? raw.shortDescription : undefined,
    discountValue: typeof raw.discountValue === 'number' ? raw.discountValue : undefined,
    discountUnit: typeof raw.discountUnit === 'string' ? raw.discountUnit : undefined,
  };
}

async function cleanupOrphanedRuns(trigger: CleanupTrigger) {
  const staleSince = new Date(Date.now() - ORPHAN_STALE_HOURS * 60 * 60 * 1000);
  const staleRuns = await duplicateCleanupRepository.findStaleOpenRuns(staleSince);

  let itemsSuperseded = 0;
  for (const run of staleRuns) {
    const items = await duplicateCleanupRepository.findPendingItemsByRun(run.id);
    for (const item of items) {
      await duplicateCleanupRepository.markSuperseded(item.id);
      itemsSuperseded++;
      await recordAudit({
        entityType: 'DuplicateCleanupAction',
        entityId: item.id,
        action: 'UPDATE',
        performedBy: performedByLabel(trigger),
        changedFields: {
          cleanupType: 'orphaned_run',
          previousStatus: 'PENDING_REVIEW',
          newStatus: 'SUPERSEDED',
          runId: run.id,
          reason: `הריצה התחילה ב-${run.startedAt.toISOString()} ולא הסתיימה מעולם (finishedAt ריק) — זוהתה כיתומה בבדיקה מ-${new Date().toISOString()}, מעל ${ORPHAN_STALE_HOURS} שעות אחרי תחילתה.`,
          triggeredBy: trigger,
        },
      });
    }
  }
  return { runsCheckedForOrphans: staleRuns.length, itemsSupersededAsOrphans: itemsSuperseded };
}

// throttleGeminiCall משותף (lib/gemini.ts) — modules/aiEnrichment גם
// קורא ל-Gemini באותו tick של ה-cron, וחייב לחלוק את אותו מונה
// שמירת-מרווח כדי לא לחרוג מ-15 בקשות/דקה על פני שני השלבים יחד.

type CandidateItem = Awaited<ReturnType<typeof duplicateCleanupRepository.findDuplicateCandidatesBySource>>[number];
type PendingPair = { older: CandidateItem; newer: CandidateItem };

// אוסף את כל זוגות המועמדים (אחרי הסינון המקדים הזול) על פני כל
// המקורות, עד תקרת הבטיחות — בלי לקרוא ל-Gemini בשלב הזה בכלל.
// ה-batching עצמו קורה אחר כך על הרשימה השטוחה, כך שסדר הזוגות
// שנבדקים זהה לסדר שהיה בלולאה המקורית (per-source, ואז i/j).
async function collectPendingPairs(sourceIds: string[], scrapedAfter: Date): Promise<PendingPair[]> {
  const pendingPairs: PendingPair[] = [];

  sourceLoop: for (const sourceId of sourceIds) {
    const candidates = await duplicateCleanupRepository.findDuplicateCandidatesBySource(sourceId, scrapedAfter);

    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const itemA = candidates[i];
        const itemB = candidates[j];
        if (itemA.runId === itemB.runId) continue; // רק בין ריצות שונות — בתוך אותה ריצה זה כבר תפקיד matching.service

        const fieldsA = extractCandidateFields(itemA.rawData);
        const fieldsB = extractCandidateFields(itemB.rawData);
        if (!fieldsA.title || !fieldsB.title) continue;
        if (titleSimilarity(fieldsA.title, fieldsB.title) < TITLE_SIMILARITY_THRESHOLD) continue;

        const older = itemA.scrapedAt <= itemB.scrapedAt ? itemA : itemB;
        const newer = older === itemA ? itemB : itemA;

        pendingPairs.push({ older, newer });
        if (pendingPairs.length >= MAX_DUPLICATE_PAIRS_PER_SWEEP) {
          logger.warn({ sourceId, pairsCollected: pendingPairs.length }, 'Duplicate cleanup sweep hit candidate pair cap, stopping early');
          break sourceLoop;
        }
      }
    }
  }

  return pendingPairs;
}

async function cleanupDuplicates(trigger: CleanupTrigger) {
  const scrapedAfter = new Date(Date.now() - DUPLICATE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const sourceIds = await duplicateCleanupRepository.findSourceIdsWithOpenItems(scrapedAfter);
  const pendingPairs = await collectPendingPairs(sourceIds, scrapedAfter);

  let pairsSuperseded = 0;
  let pairsFlagged = 0;
  let pairsJudged = 0;
  let pairsSkippedDueToError = 0;
  let geminiCallsAttempted = 0;
  let geminiCallsSucceeded = 0;
  let geminiCallsFailed = 0;
  let rateLimitHit = false;

  batchLoop: for (let start = 0; start < pendingPairs.length; start += DUPLICATE_BATCH_SIZE) {
    const batch = pendingPairs.slice(start, start + DUPLICATE_BATCH_SIZE);

    await throttleGeminiCall();
    geminiCallsAttempted++;
    const result = await judgeDuplicateBatch(
      batch.map((pair) => ({
        itemA: extractCandidateFields(pair.older.rawData),
        itemB: extractCandidateFields(pair.newer.rawData),
      }))
    );

    if (result.outcome === 'skipped') {
      // אין client מוגדר בכלל (בלי מפתח/סביבת טסט) — אין טעם
      // להמשיך לנסות batches נוספים באותו סבב.
      break batchLoop;
    }

    if (result.outcome === 'error') {
      // מרכזי: כשל טכני *לא* מטופל כמו "Gemini קבע שזה לא כפול" —
      // נרשם ל-AuditLog בנפרד (cleanupType ייעודי) כדי שהדשבורד
      // יראה "לא נבדק בפועל", לא ישתוק. שורה אחת לכל זוג בקבוצה
      // שנכשלה (לא שורה מרוכזת ל-batch כולו) — כך תצוגת הלוג הקיימת
      // בדשבורד (entityId+pairedItemId בודדים לשורה) לא דורשת שינוי,
      // והנימוק של כל שורה מציין שהזוג היה חלק מ-batch גדול יותר
      // שנכשל יחד. הזוגות נשארים PENDING_REVIEW כרגיל וייבדקו שוב בסבב הבא.
      geminiCallsFailed++;
      pairsSkippedDueToError += batch.length;
      for (const pair of batch) {
        await recordAudit({
          entityType: 'DuplicateCleanupAction',
          entityId: pair.older.id,
          action: 'UPDATE',
          performedBy: performedByLabel(trigger),
          changedFields: {
            cleanupType: 'judgment_failed',
            pairedItemId: pair.newer.id,
            isRateLimit: result.isRateLimit,
            reason: result.isRateLimit
              ? `בדיקת AI נכשלה — חריגה ממכסת הבקשות ל-Gemini (rate limit). הזוג היה חלק מקבוצה של ${batch.length} זוגות שנשלחו ונכשלו יחד. ינוסה שוב בריצת הניקוי הבאה.`
              : `בדיקת AI נכשלה מסיבה טכנית: ${result.message}. הזוג היה חלק מקבוצה של ${batch.length} זוגות שנשלחו ונכשלו יחד. ינוסה שוב בריצת הניקוי הבאה.`,
            triggeredBy: trigger,
          },
        });
      }
      if (result.isRateLimit) {
        rateLimitHit = true;
        logger.warn({ batchSize: batch.length }, 'Gemini rate limit hit during duplicate cleanup sweep — stopping early');
        break batchLoop;
      }
      continue;
    }

    geminiCallsSucceeded++;
    pairsJudged += batch.length;

    for (let k = 0; k < batch.length; k++) {
      const { older, newer } = batch[k];
      const judgment = result.judgments[k];
      if (!judgment.isDuplicate || judgment.confidence < DUPLICATE_CONFIDENCE_THRESHOLD) continue;

      const bothUntouched = older.status === 'PENDING_REVIEW' && newer.status === 'PENDING_REVIEW';

      const baseChangedFields = {
        cleanupType: 'duplicate_candidate' as const,
        pairedItemId: newer.id,
        confidence: judgment.confidence,
        reason: judgment.reason,
        triggeredBy: trigger,
      };

      if (bothUntouched) {
        await duplicateCleanupRepository.markSuperseded(older.id);
        pairsSuperseded++;
        await recordAudit({
          entityType: 'DuplicateCleanupAction',
          entityId: older.id,
          action: 'UPDATE',
          performedBy: performedByLabel(trigger),
          changedFields: { ...baseChangedFields, previousStatus: 'PENDING_REVIEW', newStatus: 'SUPERSEDED' },
        });
      } else {
        // עקרון בטיחות: אחד מהפריטים כבר נגעה בו יד אדם (נסקר/אושר/פורסם) —
        // לעולם לא נוגעים אוטומטית, רק מסמנים לבדיקה ידנית בדשבורד.
        pairsFlagged++;
        await recordAudit({
          entityType: 'DuplicateCleanupAction',
          entityId: older.id,
          action: 'UPDATE',
          performedBy: performedByLabel(trigger),
          changedFields: { ...baseChangedFields, flaggedForManualReview: true },
        });
      }
    }
  }

  return {
    pairsSupersededAsDuplicates: pairsSuperseded,
    pairsFlaggedForReview: pairsFlagged,
    pairsJudged,
    pairsSkippedDueToError,
    geminiCallsAttempted,
    geminiCallsSucceeded,
    geminiCallsFailed,
    rateLimitHit,
  };
}

export const duplicateCleanupService = {
  async runCleanupSweep(trigger: CleanupTrigger) {
    const orphanResult = await cleanupOrphanedRuns(trigger);
    const duplicateResult = await cleanupDuplicates(trigger);
    const summary = { trigger, ...orphanResult, ...duplicateResult };
    logger.info(summary, 'Duplicate cleanup sweep finished');
    return summary;
  },

  // מעשיר כל שורת AuditLog בכותרות שני הפריטים המעורבים (לא רק
  // ה-ID הגולמי) — כדי שהדשבורד יוכל להציג "הוחלף: X ← הושאר: Y"
  // בלי לדרוש מהמנהלת לחפור ב-DB. entityId קיים תמיד; pairedItemId
  // קיים רק בשורות duplicate_candidate (ראו cleanupDuplicates למעלה).
  //
  // logo_search (modules/logoSearch) הוא היוצא מן הכלל: entityId שלו
  // מצביע על Program/Brand, לא ScrapedItem — findItemTitlesByIds לא
  // יודע לפתור אותו. הכותרת (entityName) כבר נשמרת בתוך changedFields
  // עצמו בזמן היצירה (logoSearch.service), אז אין צורך ב-lookup נוסף.
  async getCleanupLog(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const { items, total } = await duplicateCleanupRepository.findCleanupLog(skip, pageSize);

    const idsNeeded = new Set<string>();
    for (const entry of items) {
      const changedFields = entry.changedFields as { cleanupType?: string; pairedItemId?: string } | null;
      if (changedFields?.cleanupType === 'logo_search') continue;
      idsNeeded.add(entry.entityId);
      if (changedFields?.pairedItemId) idsNeeded.add(changedFields.pairedItemId);
    }
    const titleById = await duplicateCleanupRepository.findItemTitlesByIds([...idsNeeded]);

    const enrichedItems = items.map((entry) => {
      const changedFields = entry.changedFields as { cleanupType?: string; pairedItemId?: string; entityName?: string } | null;
      if (changedFields?.cleanupType === 'logo_search') {
        return { ...entry, entityTitle: changedFields.entityName ?? null, pairedItemTitle: null };
      }
      const pairedItemId = changedFields?.pairedItemId;
      return {
        ...entry,
        entityTitle: titleById.get(entry.entityId) ?? null,
        pairedItemTitle: pairedItemId ? (titleById.get(pairedItemId) ?? null) : null,
      };
    });

    return { items: enrichedItems, meta: { page, pageSize, total } };
  },
};
