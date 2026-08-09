import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { AppError } from '../../src/lib/AppError';
import { benefitService } from '../../src/modules/benefit/benefit.service';
import { scraperService } from '../../src/modules/scraper/scraper.service';
import { couponService } from '../../src/modules/coupon/coupon.service';
import { createBenefit, createCategory, createRun, createScraperSource } from '../setup/factories';

// AppError.validation שומר את ההסבר ב-details ולא ב-message
// (ה-message קבוע: "Request validation failed"), ולכן בדיקת ההודעה
// נעשית שם. זו גם ההתנהגות ש-formatSaveError בדשבורד מסתמך עליה.
async function expectValidationDetail(promise: Promise<unknown>, pattern: RegExp) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e
  );
  expect(err, 'ציפינו לשגיאה אך הפעולה הצליחה').toBeInstanceOf(AppError);
  expect(String((err as AppError).details)).toMatch(pattern);
}

describe('ולידציית scope — cityId', () => {
  it('דוחה scope שמפנה לעיר שאינה קיימת', async () => {
    const category = await createCategory();

    await expectValidationDetail(
      benefitService.create({
        slug: 'bad-city-scope',
        title: 'הטבה',
        shortDescription: 'תיאור',
        categoryId: category.id,
        benefitType: 'DISCOUNT_PERCENT',
        requiresCoupon: false,
        channel: 'BOTH',
        isPopular: false,
        isFeatured: false,
        priority: 0,
        scopes: [{ cityId: '00000000-0000-0000-0000-000000000000' }],
      }),
      /cityId not found/i
    );

    expect(await prisma.benefit.count()).toBe(0);
  });

  it('מקבל scope עם עיר קיימת', async () => {
    const category = await createCategory();
    const city = await prisma.city.create({ data: { name: `עיר-${Date.now()}` } });

    const created = await benefitService.create({
      slug: 'good-city-scope',
      title: 'הטבה',
      shortDescription: 'תיאור',
      categoryId: category.id,
      benefitType: 'DISCOUNT_PERCENT',
      requiresCoupon: false,
      channel: 'BOTH',
      isPopular: false,
      isFeatured: false,
      priority: 0,
      scopes: [{ cityId: city.id }],
    });

    expect(created.id).toBeTruthy();
    const scopes = await prisma.benefitScope.findMany({ where: { benefitId: created.id } });
    expect(scopes[0].cityId).toBe(city.id);
  });
});

describe('valueScore מחושב מחדש גם בעדכון מהסורק', () => {
  it('עדכון אוטומטי של ערך ההנחה מעדכן את הציון', async () => {
    // הבאג: applyUpdate כתב ישירות ל-Prisma ודילג על חישוב הציון,
    // כך שהטבה שהשתפרה נשארה עם ציון ישן ושקעה במיון — במסלול
    // האוטומטי, בלי שאף אחד רואה.
    const category = await createCategory();
    const benefit = await createBenefit({
      title: 'הנחה על כל החנות',
      shortDescription: 'תיאור',
      categoryId: category.id,
      discountValue: 10,
    });
    await prisma.benefit.update({
      where: { id: benefit.id },
      data: { discountUnit: 'PERCENT', valueScore: 10 },
    });

    const source = await createScraperSource();
    const run = await createRun(source.id);
    const item = await prisma.scrapedItem.create({
      data: {
        sourceId: source.id,
        runId: run.id,
        externalId: 'ext-1',
        rawData: {} as never,
        confidenceScore: 100,
        status: 'AUTO_PUBLISHED',
        matchedBenefitId: benefit.id,
      },
    });

    await scraperService.applyUpdate(
      benefit.id,
      { title: 'הנחה על כל החנות', externalId: 'ext-1', discountValue: 45 },
      item.id
    );

    const updated = await prisma.benefit.findUniqueOrThrow({ where: { id: benefit.id } });
    expect(Number(updated.discountValue)).toBe(45);
    // DISCOUNT_PERCENT עם יחידת אחוזים: הציון הוא הערך עצמו
    expect(updated.valueScore).toBe(45);
  });

  it('עדכון שאינו נוגע בערך ההנחה אינו משנה את הציון', async () => {
    const benefit = await createBenefit({ discountValue: 10 });
    await prisma.benefit.update({ where: { id: benefit.id }, data: { valueScore: 33 } });

    const source = await createScraperSource();
    const run = await createRun(source.id);
    const item = await prisma.scrapedItem.create({
      data: {
        sourceId: source.id,
        runId: run.id,
        externalId: 'ext-2',
        rawData: {} as never,
        confidenceScore: 100,
        status: 'AUTO_PUBLISHED',
      },
    });

    await scraperService.applyUpdate(benefit.id, { title: 'כותרת חדשה', externalId: 'ext-2' }, item.id);

    const updated = await prisma.benefit.findUniqueOrThrow({ where: { id: benefit.id } });
    expect(updated.title).toBe('כותרת חדשה');
    expect(updated.valueScore).toBe(33);
  });
});

describe('מימוש קופון — אטומיות', () => {
  async function couponWithLimit(maxUses: number) {
    const benefit = await createBenefit();
    return prisma.coupon.create({
      data: { benefitId: benefit.id, code: `CODE-${Date.now()}-${Math.random()}`, maxUses, currentUses: 0 },
    });
  }

  it('בקשות מקבילות אינן חורגות מהמכסה', async () => {
    // הבאג: הבדיקה וההגדלה היו שתי פעולות נפרדות, ולכן שתי בקשות
    // מקבילות על הקופון האחרון יכלו שתיהן לעבור.
    const coupon = await couponWithLimit(3);

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => couponService.redeem(coupon.id))
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;

    expect(succeeded).toBe(3);
    const final = await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
    expect(final.currentUses).toBe(3);
  });

  it('קופון ללא מכסה אינו נחסם', async () => {
    const benefit = await createBenefit();
    const coupon = await prisma.coupon.create({
      data: { benefitId: benefit.id, code: `UNLIMITED-${Date.now()}`, maxUses: null },
    });

    await Promise.all([couponService.redeem(coupon.id), couponService.redeem(coupon.id)]);

    const final = await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
    expect(final.currentUses).toBe(2);
  });

  it('קופון שפג תוקפו נדחה עם הסבר', async () => {
    const benefit = await createBenefit();
    const coupon = await prisma.coupon.create({
      data: {
        benefitId: benefit.id,
        code: `EXPIRED-${Date.now()}`,
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    await expectValidationDetail(couponService.redeem(coupon.id), /expired/i);
    const final = await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
    expect(final.currentUses).toBe(0);
  });

  it('קופון כבוי נדחה עם הסבר', async () => {
    const benefit = await createBenefit();
    const coupon = await prisma.coupon.create({
      data: { benefitId: benefit.id, code: `INACTIVE-${Date.now()}`, isActive: false },
    });

    await expectValidationDetail(couponService.redeem(coupon.id), /not active/i);
  });

  it('קופון שהגיע למכסה נדחה עם הסבר', async () => {
    const coupon = await couponWithLimit(1);
    await couponService.redeem(coupon.id);

    await expectValidationDetail(couponService.redeem(coupon.id), /limit reached/i);
  });
});
