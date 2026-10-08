import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { duplicateCleanupService } from '../../src/modules/duplicateCleanup/duplicateCleanup.service';
import { createRun, createScraperSource } from '../setup/factories';

// אין כאן שום vi.mock — הקובץ הזה בודק את הנתיב האמיתי, הלא-ממוקק:
// NODE_ENV==='test' (vitest.config.ts) חוסם client אמיתי ב-lib/gemini.ts
// תמיד, בדיוק כמו בפרודקשן בלי GEMINI_API_KEY. המטרה כאן היא לוודא
// שהריפקטור לקיבוץ ל-batches לא שבר את הנתיב הזה: הסינון המקדים
// (דמיון כותרות, אותה ריצה) והריצה היתומה עדיין עובדים כרגיל, וסבב
// הניקוי מסתיים בשקט בלי לקרוס כשאין client בכלל.
describe('duplicateCleanupService — בלי Gemini client מוגדר (סביבת טסט)', () => {
  it('סבב ניקוי מסתיים בלי לקרוס, לא שופט אף זוג, ולא נוגע בפריטים', async () => {
    const source = await createScraperSource();
    const runA = await createRun(source.id);
    const runB = await createRun(source.id);
    const older = await prisma.scrapedItem.create({
      data: {
        sourceId: source.id,
        runId: runA.id,
        externalId: 'ext-a',
        rawData: { title: 'הנחה על קפה בבוקר' } as never,
        confidenceScore: 60,
        status: 'PENDING_REVIEW',
        scrapedAt: new Date(Date.now() - 2000),
      },
    });
    await prisma.scrapedItem.create({
      data: {
        sourceId: source.id,
        runId: runB.id,
        externalId: 'ext-b',
        rawData: { title: 'הנחה על קפה בבוקר עודכן' } as never,
        confidenceScore: 60,
        status: 'PENDING_REVIEW',
      },
    });

    const summary = await duplicateCleanupService.runCleanupSweep('manual');

    expect(summary.pairsJudged).toBe(0);
    expect(summary.pairsSupersededAsDuplicates).toBe(0);
    expect(summary.pairsFlaggedForReview).toBe(0);
    expect(summary.geminiCallsSucceeded).toBe(0);

    const refreshed = await prisma.scrapedItem.findUniqueOrThrow({ where: { id: older.id } });
    expect(refreshed.status).toBe('PENDING_REVIEW');
  });

  it('ריצה יתומה עדיין מטופלת דטרמיניסטית, בלי תלות ב-Gemini בכלל', async () => {
    const source = await createScraperSource();
    const staleRun = await prisma.scraperRun.create({
      data: { sourceId: source.id, status: 'PARTIAL', startedAt: new Date(Date.now() - 3 * 60 * 60 * 1000) },
    });
    const orphanItem = await prisma.scrapedItem.create({
      data: {
        sourceId: source.id,
        runId: staleRun.id,
        externalId: 'ext-orphan',
        rawData: { title: 'פריט מריצה שקרסה' } as never,
        confidenceScore: 60,
        status: 'PENDING_REVIEW',
      },
    });

    const summary = await duplicateCleanupService.runCleanupSweep('manual');

    expect(summary.itemsSupersededAsOrphans).toBe(1);
    const refreshed = await prisma.scrapedItem.findUniqueOrThrow({ where: { id: orphanItem.id } });
    expect(refreshed.status).toBe('SUPERSEDED');
  });
});
