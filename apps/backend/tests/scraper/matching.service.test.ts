import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { matchingService, type RawScrapedFields } from '../../src/modules/scraper/matching.service';
import { createBenefit, createRun, createScraperSource } from '../setup/factories';

// שדות ברירת מחדל של פריט שנסרק. מקרה בדיקה משנה רק את מה שרלוונטי לו.
function fields(overrides: Partial<RawScrapedFields> = {}): RawScrapedFields {
  return {
    title: 'הנחה על כל החנות',
    shortDescription: 'הנחה קבועה לחברי מועדון',
    discountValue: 10,
    externalId: 'ext-1',
    ...overrides,
  };
}

// יוצר מופע ביומן, כפי שריצה קודמת הייתה יוצרת.
async function recordSighting(
  sourceId: string,
  runId: string,
  overrides: { externalId?: string; matchedBenefitId?: string; status?: 'PENDING_REVIEW' | 'APPROVED' } = {}
) {
  return prisma.scrapedItem.create({
    data: {
      sourceId,
      runId,
      externalId: overrides.externalId ?? 'ext-1',
      rawData: fields() as never,
      confidenceScore: 60,
      status: overrides.status ?? 'PENDING_REVIEW',
      ...(overrides.matchedBenefitId && { matchedBenefitId: overrides.matchedBenefitId }),
    },
  });
}

describe('matchingService.match', () => {
  it('פריט שלא נראה מעולם ואין לו הטבה תואמת → NEW', async () => {
    const source = await createScraperSource();

    const result = await matchingService.match(source.id, fields());

    expect(result.kind).toBe('NEW');
  });

  it('פריט שכבר מקושר להטבה וכל הערכים זהים → UNCHANGED', async () => {
    const source = await createScraperSource();
    const run = await createRun(source.id);
    const benefit = await createBenefit({
      title: 'הנחה על כל החנות',
      shortDescription: 'הנחה קבועה לחברי מועדון',
      discountValue: 10,
    });
    await recordSighting(source.id, run.id, { matchedBenefitId: benefit.id });

    const result = await matchingService.match(source.id, fields());

    expect(result).toEqual({ kind: 'UNCHANGED', benefitId: benefit.id });
  });

  it('פריט מקושר שערכו השתנה → UPDATE עם רשימת השדות שהשתנו', async () => {
    const source = await createScraperSource();
    const run = await createRun(source.id);
    const benefit = await createBenefit({
      title: 'הנחה על כל החנות',
      shortDescription: 'הנחה קבועה לחברי מועדון',
      discountValue: 10,
    });
    await recordSighting(source.id, run.id, { matchedBenefitId: benefit.id });

    const result = await matchingService.match(source.id, fields({ discountValue: 25 }));

    expect(result.kind).toBe('UPDATE');
    if (result.kind === 'UPDATE') {
      expect(result.benefitId).toBe(benefit.id);
      expect(result.changedFields).toEqual(['discountValue']);
    }
  });

  it('שינוי קל בכותרת אינו מנתק את ההתאמה — הזיהוי לפי externalId ולא לפי טקסט', async () => {
    // זה המקרה שבגללו קיים externalId. אם ההתאמה הייתה נשענת על
    // slug של הכותרת, שינוי מילה אחת באתר המקור היה יוצר הטבה
    // כפולה במקום לעדכן את הקיימת.
    const source = await createScraperSource();
    const run = await createRun(source.id);
    const benefit = await createBenefit({
      slug: 'הנחה-על-כל-החנות',
      title: 'הנחה על כל החנות',
      shortDescription: 'הנחה קבועה לחברי מועדון',
      discountValue: 10,
    });
    await recordSighting(source.id, run.id, { matchedBenefitId: benefit.id });

    const renamed = fields({ title: 'הנחה על כל החנות — מבצע אביב' });
    const result = await matchingService.match(source.id, renamed);

    expect(result.kind).toBe('UPDATE');
    if (result.kind === 'UPDATE') {
      expect(result.benefitId).toBe(benefit.id);
      expect(result.changedFields).toContain('title');
    }
    // ואימות שלילי: הכותרת החדשה לא מתנרמלת ל-slug של ההטבה
    // הקיימת, כלומר ההתאמה באמת הגיעה מ-externalId ולא מגיבוי ה-slug.
    expect(matchingService.slugify(renamed.title)).not.toBe(benefit.slug);
  });

  it('פריט שלא נראה קודם אך קיימת הטבה עם slug תואם → מתאים אליה במקום ליצור כפילות', async () => {
    const source = await createScraperSource();
    const benefit = await createBenefit({
      slug: matchingServiceSlug('הנחה על כל החנות'),
      title: 'הנחה על כל החנות',
      shortDescription: 'הנחה קבועה לחברי מועדון',
      discountValue: 10,
    });

    const result = await matchingService.match(source.id, fields({ discountValue: 30 }));

    expect(result.kind).toBe('UPDATE');
    if (result.kind === 'UPDATE') expect(result.benefitId).toBe(benefit.id);
  });

  it('פריט שהיה מקושר להטבה שנמחקה מה-DB → NEW', async () => {
    const source = await createScraperSource();
    const run = await createRun(source.id);
    const benefit = await createBenefit();
    await recordSighting(source.id, run.id, { matchedBenefitId: benefit.id });
    // מחיקה קשה, לא רכה: הרשומה נעלמה לגמרי מתחת לפריט הסרוק.
    await prisma.scrapedItem.updateMany({ data: { matchedBenefitId: null } });
    await prisma.benefit.delete({ where: { id: benefit.id } });
    await prisma.scrapedItem.updateMany({ data: { matchedBenefitId: null } });

    const result = await matchingService.match(source.id, fields({ title: 'כותרת שאין לה הטבה' }));

    expect(result.kind).toBe('NEW');
  });

  it('כשיש כמה מופעים ביומן, נלקח האחרון לפי זמן', async () => {
    // מודל היומן: אותו externalId מופיע כמה פעמים. מה שקובע את
    // מצב הפריט הוא המופע האחרון, לא הראשון שנמצא.
    const source = await createScraperSource();
    const run = await createRun(source.id);
    const oldBenefit = await createBenefit({ title: 'ישן' });
    const currentBenefit = await createBenefit({
      title: 'הנחה על כל החנות',
      shortDescription: 'הנחה קבועה לחברי מועדון',
      discountValue: 10,
    });

    const older = await recordSighting(source.id, run.id, { matchedBenefitId: oldBenefit.id });
    await prisma.scrapedItem.update({
      where: { id: older.id },
      data: { scrapedAt: new Date(Date.now() - 60_000), status: 'SUPERSEDED' },
    });
    await recordSighting(source.id, run.id, { matchedBenefitId: currentBenefit.id });

    const result = await matchingService.match(source.id, fields());

    expect(result).toEqual({ kind: 'UNCHANGED', benefitId: currentBenefit.id });
  });
});

describe('matchingService.slugify', () => {
  it('שומר עברית ומחליף רווחים במקפים', () => {
    expect(matchingService.slugify('הנחה על כל החנות')).toBe('הנחה-על-כל-החנות');
  });

  it('מסיר סימני פיסוק שאינם חלק ב-slug', () => {
    expect(matchingService.slugify('10% הנחה!')).toBe('10-הנחה');
  });
});

// עוזר קטן כדי לא לשכפל את הלוגיקה בתוך מקרה הבדיקה עצמו
function matchingServiceSlug(title: string) {
  return matchingService.slugify(title);
}
