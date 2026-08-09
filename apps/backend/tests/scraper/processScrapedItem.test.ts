import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { scraperService } from '../../src/modules/scraper/scraper.service';
import type { RawScrapedFields } from '../../src/modules/scraper/matching.service';
import { createBenefit, createCategory, createRun, createScraperSource } from '../setup/factories';

function fields(overrides: Partial<RawScrapedFields> = {}): RawScrapedFields {
  return {
    title: 'הנחה על כל החנות',
    shortDescription: 'הנחה קבועה לחברי מועדון',
    discountValue: 10,
    externalId: 'ext-1',
    ...overrides,
  };
}

// מדמה ריצת סריקה: כל ריצה היא ScraperRun חדש שמעבד את אותם פריטים,
// בדיוק כפי ש-runSource עושה. מוחזרות התוצאות של כל פריט.
async function scrapeRun(sourceId: string, items: RawScrapedFields[]) {
  const run = await createRun(sourceId);
  const outcomes: string[] = [];
  for (const item of items) {
    outcomes.push(await scraperService.processScrapedItem(sourceId, run.id, item));
  }
  return outcomes;
}

const sightingsOf = (externalId: string) =>
  prisma.scrapedItem.findMany({ where: { externalId }, orderBy: { scrapedAt: 'asc' } });

describe('processScrapedItem — ריצות חוזרות על אותו מקור', () => {
  it('שתי ריצות רצופות על פריט חדש מצליחות, ולא מייצרות כפילות בתור', async () => {
    // הרגרסיה המרכזית: כל עוד היה @@unique([sourceId, externalId]),
    // הריצה השנייה קרסה ב-P2002 והפילה את שאר הפריטים באותה ריצה.
    const source = await createScraperSource();

    const first = await scrapeRun(source.id, [fields()]);
    const second = await scrapeRun(source.id, [fields()]);

    expect(first).toEqual(['FLAGGED']);
    expect(second).toEqual(['FLAGGED']);

    // היומן שומר את שני המופעים...
    const sightings = await sightingsOf('ext-1');
    expect(sightings).toHaveLength(2);

    // ...אבל רק האחרון ממתין להכרעה, כדי שהמנהל לא יראה את אותו
    // פריט פעמיים.
    expect(sightings.map((s) => s.status)).toEqual(['SUPERSEDED', 'PENDING_REVIEW']);
    const pending = await prisma.scrapedItem.count({ where: { status: 'PENDING_REVIEW' } });
    expect(pending).toBe(1);
  });

  it('שש ריצות רצופות אינן מצטברות בתור', async () => {
    const source = await createScraperSource();

    for (let i = 0; i < 6; i++) {
      const outcomes = await scrapeRun(source.id, [fields()]);
      expect(outcomes).toEqual(['FLAGGED']);
    }

    expect(await sightingsOf('ext-1')).toHaveLength(6);
    expect(await prisma.scrapedItem.count({ where: { status: 'PENDING_REVIEW' } })).toBe(1);
  });

  it('כשל בפריט אחד אינו מונע עיבוד של השאר', async () => {
    const source = await createScraperSource();

    const outcomes = await scrapeRun(source.id, [
      fields({ externalId: 'a' }),
      fields({ externalId: 'b', title: 'הטבה אחרת' }),
      fields({ externalId: 'c', title: 'הטבה שלישית' }),
    ]);

    expect(outcomes).toHaveLength(3);
    expect(await prisma.scrapedItem.count()).toBe(3);
  });
});

describe('processScrapedItem — סיווג התוצאה', () => {
  it('פריט שלא השתנה מזוהה כ-UNCHANGED ואינו נרשם ביומן', async () => {
    const source = await createScraperSource();
    const run = await createRun(source.id);
    const benefit = await createBenefit({
      title: 'הנחה על כל החנות',
      shortDescription: 'הנחה קבועה לחברי מועדון',
      discountValue: 10,
    });
    // מופע קודם שכבר מקושר להטבה
    await prisma.scrapedItem.create({
      data: {
        sourceId: source.id,
        runId: run.id,
        externalId: 'ext-1',
        rawData: fields() as never,
        confidenceScore: 100,
        status: 'AUTO_PUBLISHED',
        matchedBenefitId: benefit.id,
      },
    });

    const outcomes = await scrapeRun(source.id, [fields()]);

    expect(outcomes).toEqual(['SKIPPED']);
    // אין אירוע חדש לתעד — הפריט זהה למה שכבר ידוע.
    expect(await sightingsOf('ext-1')).toHaveLength(1);
  });

  it('פריט שהשתנה מזוהה כ-UPDATE ומעדכן את ההטבה בפועל', async () => {
    const source = await createScraperSource();
    const run = await createRun(source.id);
    const benefit = await createBenefit({
      title: 'הנחה על כל החנות',
      shortDescription: 'הנחה קבועה לחברי מועדון',
      discountValue: 10,
    });
    await prisma.scrapedItem.create({
      data: {
        sourceId: source.id,
        runId: run.id,
        externalId: 'ext-1',
        rawData: fields() as never,
        confidenceScore: 100,
        status: 'AUTO_PUBLISHED',
        matchedBenefitId: benefit.id,
      },
    });

    const outcomes = await scrapeRun(source.id, [fields({ discountValue: 15 })]);

    expect(outcomes).toEqual(['UPDATED']);
    const updated = await prisma.benefit.findUniqueOrThrow({ where: { id: benefit.id } });
    expect(Number(updated.discountValue)).toBe(15);
    // המופע החדש מתועד ומקושר להטבה
    const sightings = await sightingsOf('ext-1');
    expect(sightings).toHaveLength(2);
    expect(sightings[1].status).toBe('AUTO_PUBLISHED');
    expect(sightings[1].matchedBenefitId).toBe(benefit.id);
  });

  it('עדכון חוזר על אותו פריט עובד בכל ריצה', async () => {
    const source = await createScraperSource();
    const run = await createRun(source.id);
    const benefit = await createBenefit({
      title: 'הנחה על כל החנות',
      shortDescription: 'הנחה קבועה לחברי מועדון',
      discountValue: 10,
    });
    await prisma.scrapedItem.create({
      data: {
        sourceId: source.id,
        runId: run.id,
        externalId: 'ext-1',
        rawData: fields() as never,
        confidenceScore: 100,
        status: 'AUTO_PUBLISHED',
        matchedBenefitId: benefit.id,
      },
    });

    // ערך משתנה בכל ריצה — כל אחת חייבת להיות UPDATE מוצלח
    for (const value of [12, 14, 16]) {
      const outcomes = await scrapeRun(source.id, [fields({ discountValue: value })]);
      expect(outcomes).toEqual(['UPDATED']);
      const b = await prisma.benefit.findUniqueOrThrow({ where: { id: benefit.id } });
      expect(Number(b.discountValue)).toBe(value);
    }
  });

  it('הטבה חדשה לעולם אינה מתפרסמת אוטומטית, גם כשכל השדות מלאים', async () => {
    // כלל עסקי מפורש: אין "אוטומטי" להטבה שמעולם לא הייתה במערכת.
    const source = await createScraperSource();

    const outcomes = await scrapeRun(source.id, [fields()]);

    expect(outcomes).toEqual(['FLAGGED']);
    const [sighting] = await sightingsOf('ext-1');
    expect(sighting.status).toBe('PENDING_REVIEW');
    expect(sighting.confidenceReasons.join(' ')).toContain('הטבה חדשה');
    // ולא נוצרה הטבה מאחורי הגב
    expect(await prisma.benefit.count()).toBe(0);
  });

  // עוזר: מכין הטבה קיימת + מופע קודם מקושר אליה
  async function withExistingMatch(overrides: { title?: string; discountValue?: number } = {}) {
    const source = await createScraperSource();
    const run = await createRun(source.id);
    const benefit = await createBenefit({
      title: overrides.title ?? 'הנחה על כל החנות',
      shortDescription: 'הנחה קבועה לחברי מועדון',
      discountValue: overrides.discountValue ?? 10,
    });
    await prisma.scrapedItem.create({
      data: {
        sourceId: source.id,
        runId: run.id,
        externalId: 'ext-1',
        rawData: fields() as never,
        confidenceScore: 100,
        status: 'AUTO_PUBLISHED',
        matchedBenefitId: benefit.id,
      },
    });
    return { source, benefit };
  }

  it('שינוי ערך דרמטי עוצר פרסום אוטומטי ומעביר לבדיקה אנושית', async () => {
    // 10 -> 90 הוא קפיצה של פי 9. הניכוי היחסי מגיע לתקרה (60),
    // הציון יורד ל-40, והעדכון אינו נכנס בלי אישור.
    const { source, benefit } = await withExistingMatch();

    const outcomes = await scrapeRun(source.id, [fields({ discountValue: 90 })]);

    expect(outcomes).toEqual(['FLAGGED']);
    const latest = (await sightingsOf('ext-1')).at(-1)!;
    expect(latest.status).toBe('PENDING_REVIEW');
    expect(latest.confidenceScore).toBe(40);
    expect(latest.confidenceReasons.join(' ')).toContain('שינוי חד');
    // ההטבה עצמה לא נגעה
    const unchanged = await prisma.benefit.findUniqueOrThrow({ where: { id: benefit.id } });
    expect(Number(unchanged.discountValue)).toBe(10);
  });

  it('שינוי מתון חוצה-סף מנוכה בעדינות וממשיך להתפרסם אוטומטית', async () => {
    // 10 -> 15 חוצה את סף השגרה (יחס 1.5) אבל אינו חשוד: ניכוי 15,
    // ציון 85. הכלל אמור להבחין בין קפיצה לשינוי מחירים רגיל.
    const { source, benefit } = await withExistingMatch();

    const outcomes = await scrapeRun(source.id, [fields({ discountValue: 15 })]);

    expect(outcomes).toEqual(['UPDATED']);
    const latest = (await sightingsOf('ext-1')).at(-1)!;
    expect(latest.confidenceScore).toBe(85);
    const updated = await prisma.benefit.findUniqueOrThrow({ where: { id: benefit.id } });
    expect(Number(updated.discountValue)).toBe(15);
  });

  it('שינוי שגרתי מתחת לסף אינו מנוכה כלל', async () => {
    const { source } = await withExistingMatch();

    await scrapeRun(source.id, [fields({ discountValue: 12 })]); // יחס 1.2

    const latest = (await sightingsOf('ext-1')).at(-1)!;
    expect(latest.confidenceScore).toBe(100);
    expect(latest.confidenceReasons).toEqual([]);
  });

  it('הניכוי סימטרי — ירידה חדה נחשבת חשודה כמו עלייה חדה', async () => {
    const { source } = await withExistingMatch({ discountValue: 90 });
    // המופע הקודם נרשם עם 10; מיישרים אותו לערך ההתחלתי החדש
    await prisma.scrapedItem.updateMany({ data: { rawData: fields({ discountValue: 90 }) as never } });

    await scrapeRun(source.id, [fields({ discountValue: 10 })]); // ירידה פי 9

    const latest = (await sightingsOf('ext-1')).at(-1)!;
    expect(latest.confidenceScore).toBe(40);
    expect(latest.status).toBe('PENDING_REVIEW');
  });

  it('קו הגבול: ציון 70 בדיוק מתפרסם אוטומטית, 67 כבר לא', async () => {
    // הסף כולל (score >= 70), ולכן ציון על הגבול נחשב "מספיק בטוח".
    // נעול בבדיקה כדי שלא יהיה צריך להסיק את זה מקריאת הקוד.
    // 10→23 הוא יחס 2.3: round(25 × log2(2.3)) = 30, ולכן ציון 70.
    const onTheLine = await withExistingMatch();
    const onTheLineOutcome = await scrapeRun(onTheLine.source.id, [fields({ discountValue: 23 })]);
    const onTheLineItem = (await sightingsOf('ext-1')).at(-1)!;

    expect(onTheLineItem.confidenceScore).toBe(70);
    expect(onTheLineOutcome).toEqual(['UPDATED']);

    // מנקים כדי שהמקרה השני יתחיל ממצב זהה
    await prisma.benefit.updateMany({ data: { lastScrapedItemId: null } });
    await prisma.scrapedItem.deleteMany();

    // 10→25 הוא יחס 2.5: round(25 × log2(2.5)) = 33, ולכן ציון 67.
    const belowTheLine = await withExistingMatch();
    const belowOutcome = await scrapeRun(belowTheLine.source.id, [fields({ discountValue: 25 })]);
    const belowItem = (await sightingsOf('ext-1')).at(-1)!;

    expect(belowItem.confidenceScore).toBe(67);
    expect(belowOutcome).toEqual(['FLAGGED']);
  });

  it('שתי בעיות יחד מצטברות', async () => {
    // כותרת קצרה (-30) יחד עם שינוי דרמטי (-60) מגיעים ל-10.
    const { source } = await withExistingMatch();

    const outcomes = await scrapeRun(source.id, [fields({ title: 'א', discountValue: 90 })]);

    expect(outcomes).toEqual(['FLAGGED']);
    const latest = (await sightingsOf('ext-1')).at(-1)!;
    expect(latest.confidenceScore).toBe(10);
  });
});

describe('reviewItem — אישור ידני מקשר את הפריט להטבה', () => {
  it('אישור הטבה חדשה מציב matchedBenefitId, כך שהריצה הבאה מזהה עדכון ולא יוצרת כפילות', async () => {
    const source = await createScraperSource();
    const category = await createCategory();

    await scrapeRun(source.id, [fields()]);
    const pending = await prisma.scrapedItem.findFirstOrThrow({ where: { status: 'PENDING_REVIEW' } });

    await scraperService.reviewItem(pending.id, {
      decision: 'APPROVE',
      reviewedBy: 'בודקת',
      overrides: { title: 'הנחה על כל החנות', categoryId: category.id },
    });

    const reviewed = await prisma.scrapedItem.findUniqueOrThrow({ where: { id: pending.id } });
    expect(reviewed.status).toBe('APPROVED');
    // בלי הקישור הזה מנוע ההתאמה היה נופל לגיבוי לפי slug
    expect(reviewed.matchedBenefitId).not.toBeNull();

    // הריצה הבאה מזהה את הפריט כמוכר, ולא יוצרת הטבה שנייה
    const benefitsBefore = await prisma.benefit.count();
    await scrapeRun(source.id, [fields({ discountValue: 20 })]);
    expect(await prisma.benefit.count()).toBe(benefitsBefore);
  });

  it('דחייה מסמנת REJECTED ואינה נוגעת בהטבות', async () => {
    const source = await createScraperSource();
    await scrapeRun(source.id, [fields()]);
    const pending = await prisma.scrapedItem.findFirstOrThrow({ where: { status: 'PENDING_REVIEW' } });

    await scraperService.reviewItem(pending.id, { decision: 'REJECT', reviewedBy: 'בודקת' });

    const reviewed = await prisma.scrapedItem.findUniqueOrThrow({ where: { id: pending.id } });
    expect(reviewed.status).toBe('REJECTED');
    expect(reviewed.reviewedBy).toBe('בודקת');
    expect(await prisma.benefit.count()).toBe(0);
  });
});
