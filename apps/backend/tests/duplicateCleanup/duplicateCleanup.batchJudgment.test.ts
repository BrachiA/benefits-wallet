import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { createRun, createScraperSource } from '../setup/factories';

// מוקאים רק את judgeDuplicateBatch (גבול הקריאה ל-Gemini עצמו) —
// כמו runSource.test.ts שממקק את scraperService.fetchRawItems ולא
// בונה DOM אמיתי. DUPLICATE_BATCH_SIZE ושאר היצוא נשארים אמיתיים,
// כדי שגודל ה-batch בטסט יתאים בדיוק למה שהשירות משתמש בו בפועל.
vi.mock('../../src/lib/gemini', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/gemini')>();
  return { ...actual, judgeDuplicateBatch: vi.fn() };
});

import { judgeDuplicateBatch, DUPLICATE_BATCH_SIZE } from '../../src/lib/gemini';
import { duplicateCleanupService } from '../../src/modules/duplicateCleanup/duplicateCleanup.service';

const mockedJudge = vi.mocked(judgeDuplicateBatch);

// תבניות במתכוון שונות זו מזו לגמרי בנושא/מבנה (דמיון bigram חוצה
// קבוצות < 0.33, נמדד בנפרד) — כדי שרק הזוג בתוך כל קבוצה (מקור
// מול "עודכן") יעבור את סף הדמיון המקדים (0.5) וייכנס למועמדים,
// ואף זוג בין קבוצות לא ייכנס בטעות. דמיון בתוך קבוצה נמדד ~0.85.
const TEMPLATES: Array<(variant: string) => string> = [
  (v) => `הנחה על קפה בבוקר${v}`,
  (v) => `כרטיס טיסה מוזל לחוץ לארץ${v}`,
  (v) => `מבצע נעליים לספורט${v}`,
  (v) => `חבילת אינטרנט לנייד בזול${v}`,
  (v) => `כניסה חינם לפארק שעשועים${v}`,
  (v) => `שובר לארוחה זוגית במסעדה${v}`,
  (v) => `מנוי חודשי לחדר כושר${v}`,
  (v) => `הטבה על ביטוח רכב שנתי${v}`,
  (v) => `זיכוי על קניית ריהוט לבית${v}`,
  (v) => `כרטיס לסרט בקולנוע בזול${v}`,
  (v) => `הנחה על תיקון מחשב נייד${v}`,
  (v) => `מבצע על מכשיר סלולרי חדש${v}`,
  (v) => `שדרוג חינם למלון בחופשה${v}`,
];

let externalIdCounter = 0;

async function createItem(
  sourceId: string,
  runId: string,
  overrides: { title: string; status?: 'PENDING_REVIEW' | 'APPROVED' | 'AUTO_PUBLISHED'; scrapedAt: Date }
) {
  return prisma.scrapedItem.create({
    data: {
      sourceId,
      runId,
      externalId: `ext-${++externalIdCounter}`,
      rawData: { title: overrides.title } as never,
      confidenceScore: 60,
      status: overrides.status ?? 'PENDING_REVIEW',
      scrapedAt: overrides.scrapedAt,
    },
  });
}

// יוצר מקור עם N "קבוצות" מועמדים לכפילות — כל קבוצה תורמת בדיוק
// זוג אחד שעובר את הסינון המקדים (item ב"ריצה א" מול item ב"ריצה
// ב" עם אותה תבנית). older (item ב"ריצה א") נוצר תמיד עם scrapedAt
// מוקדם יותר, כדי לשלוט בוודאות מי "older"/"newer" בלי תלות בטיימינג.
async function createSourceWithGroups(
  count: number,
  overrides: { statusA?: 'PENDING_REVIEW' | 'APPROVED' | 'AUTO_PUBLISHED'; statusB?: 'PENDING_REVIEW' | 'APPROVED' | 'AUTO_PUBLISHED' } = {}
) {
  if (count > TEMPLATES.length) throw new Error(`רק ${TEMPLATES.length} תבניות זמינות, ביקשו ${count}`);
  const source = await createScraperSource();
  const runA = await createRun(source.id);
  const runB = await createRun(source.id);
  let t = Date.now();
  const groups: Array<{ older: Awaited<ReturnType<typeof createItem>>; newer: Awaited<ReturnType<typeof createItem>> }> = [];
  for (let i = 0; i < count; i++) {
    const older = await createItem(source.id, runA.id, { title: TEMPLATES[i](''), status: overrides.statusA, scrapedAt: new Date(t) });
    t += 1000;
    const newer = await createItem(source.id, runB.id, { title: TEMPLATES[i](' עודכן'), status: overrides.statusB, scrapedAt: new Date(t) });
    t += 1000;
    groups.push({ older, newer });
  }
  return { source, groups };
}

function judgment(overrides: Partial<{ isDuplicate: boolean; confidence: number; reason: string }> = {}) {
  return { isDuplicate: false, confidence: 0.5, reason: 'בדיקה', ...overrides };
}

beforeEach(() => {
  mockedJudge.mockReset();
});

describe('duplicateCleanupService — שיפוט בקבוצות (batch)', () => {
  it('קורא ל-Gemini פעם אחת לכל הקבוצה, לא פעם לכל זוג', async () => {
    const { groups } = await createSourceWithGroups(3);
    mockedJudge.mockResolvedValue({ outcome: 'judged', judgments: groups.map(() => judgment()) });

    await duplicateCleanupService.runCleanupSweep('manual');

    expect(mockedJudge).toHaveBeenCalledTimes(1);
    expect(mockedJudge.mock.calls[0][0]).toHaveLength(3);
  });

  it('זוג "כפילות ודאית" וזוג "לא-כפול ודאי" באמצע קבוצה — שניהם משתבצים נכון על פי המיקום (pairIndex)', async () => {
    const { groups } = await createSourceWithGroups(5);
    // הזוג באינדקס 2 (מתוך 5, "באמצע") הוא הכפילות הוודאית; שאר הזוגות לא-כפולים בביטחון גבוה.
    const judgments = groups.map((_, idx) =>
      idx === 2 ? judgment({ isDuplicate: true, confidence: 0.97, reason: 'אותה הטבה בדיוק' }) : judgment({ isDuplicate: false, confidence: 0.95, reason: 'הטבות שונות' })
    );
    mockedJudge.mockResolvedValue({ outcome: 'judged', judgments });

    const summary = await duplicateCleanupService.runCleanupSweep('manual');

    expect(summary.pairsSupersededAsDuplicates).toBe(1);
    expect(summary.pairsJudged).toBe(5);

    for (let i = 0; i < groups.length; i++) {
      const older = await prisma.scrapedItem.findUniqueOrThrow({ where: { id: groups[i].older.id } });
      const newer = await prisma.scrapedItem.findUniqueOrThrow({ where: { id: groups[i].newer.id } });
      if (i === 2) {
        expect(older.status).toBe('SUPERSEDED');
        expect(newer.status).toBe('PENDING_REVIEW');
      } else {
        expect(older.status).toBe('PENDING_REVIEW');
        expect(newer.status).toBe('PENDING_REVIEW');
      }
    }
  });

  it('ביטחון מתחת לסף (0.75) — לא הופך ל-SUPERSEDED גם אם isDuplicate=true', async () => {
    const { groups } = await createSourceWithGroups(1);
    mockedJudge.mockResolvedValue({ outcome: 'judged', judgments: [judgment({ isDuplicate: true, confidence: 0.6, reason: 'אולי אותו דבר' })] });

    const summary = await duplicateCleanupService.runCleanupSweep('manual');

    expect(summary.pairsSupersededAsDuplicates).toBe(0);
    const older = await prisma.scrapedItem.findUniqueOrThrow({ where: { id: groups[0].older.id } });
    expect(older.status).toBe('PENDING_REVIEW');
  });

  it('פריט שכבר אושר ידנית (APPROVED) — כפילות ודאית מסמנת לבדיקה ידנית, לא הופכת אוטומטית ל-SUPERSEDED', async () => {
    const { groups } = await createSourceWithGroups(1, { statusA: 'APPROVED' });
    mockedJudge.mockResolvedValue({ outcome: 'judged', judgments: [judgment({ isDuplicate: true, confidence: 0.9, reason: 'אותה הטבה' })] });

    const summary = await duplicateCleanupService.runCleanupSweep('manual');

    expect(summary.pairsSupersededAsDuplicates).toBe(0);
    expect(summary.pairsFlaggedForReview).toBe(1);
    const older = await prisma.scrapedItem.findUniqueOrThrow({ where: { id: groups[0].older.id } });
    expect(older.status).toBe('APPROVED'); // לא נגעו בו

    const log = await prisma.auditLog.findMany({ where: { entityType: 'DuplicateCleanupAction', entityId: groups[0].older.id } });
    expect(log).toHaveLength(1);
    expect((log[0].changedFields as { flaggedForManualReview?: boolean }).flaggedForManualReview).toBe(true);
  });

  it('כשל טכני על batch שלם: כל הזוגות בקבוצה נשארים PENDING_REVIEW ומקבלים שורת AuditLog נפרדת שמציינת שהיו חלק מ-batch שנכשל', async () => {
    const { groups } = await createSourceWithGroups(4);
    mockedJudge.mockResolvedValue({ outcome: 'error', isRateLimit: false, message: 'תקלת רשת מדומה' });

    const summary = await duplicateCleanupService.runCleanupSweep('manual');

    expect(summary.geminiCallsFailed).toBe(1);
    expect(summary.pairsSkippedDueToError).toBe(4);
    expect(summary.pairsSupersededAsDuplicates).toBe(0);

    for (const { older, newer } of groups) {
      const refreshed = await prisma.scrapedItem.findUniqueOrThrow({ where: { id: older.id } });
      expect(refreshed.status).toBe('PENDING_REVIEW'); // לא נעלם בשקט — עדיין ממתין

      const log = await prisma.auditLog.findMany({ where: { entityType: 'DuplicateCleanupAction', entityId: older.id } });
      expect(log).toHaveLength(1);
      const fields = log[0].changedFields as { cleanupType?: string; pairedItemId?: string; reason?: string };
      expect(fields.cleanupType).toBe('judgment_failed');
      expect(fields.pairedItemId).toBe(newer.id);
      expect(fields.reason).toContain('4 זוגות'); // מציין את גודל ה-batch שנכשל יחד
    }
  });

  it('חריגת מכסה (rate limit) בקבוצה הראשונה עוצרת את הסבב — הקבוצה השנייה כלל לא מנוסה', async () => {
    // DUPLICATE_BATCH_SIZE+1 קבוצות → קבוצת batch ראשונה בגודל מלא,
    // ועוד קבוצה אחת שנשארת לסבב הבא בלי להיגע בה כלל.
    const total = DUPLICATE_BATCH_SIZE + 1;
    const { groups } = await createSourceWithGroups(total);
    mockedJudge.mockResolvedValueOnce({ outcome: 'error', isRateLimit: true, message: 'Too Many Requests' });

    const summary = await duplicateCleanupService.runCleanupSweep('manual');

    expect(mockedJudge).toHaveBeenCalledTimes(1); // ה-batch השני לא נוסה בכלל
    expect(summary.rateLimitHit).toBe(true);
    expect(summary.pairsSkippedDueToError).toBe(DUPLICATE_BATCH_SIZE);

    // הזוג האחרון (מעבר לגודל ה-batch הראשון) לא נבדק וגם לא נרשם ביומן בכלל
    const lastPair = groups[total - 1];
    const log = await prisma.auditLog.findMany({ where: { entityType: 'DuplicateCleanupAction', entityId: lastPair.older.id } });
    expect(log).toHaveLength(0);
    const refreshed = await prisma.scrapedItem.findUniqueOrThrow({ where: { id: lastPair.older.id } });
    expect(refreshed.status).toBe('PENDING_REVIEW');
  });
});
