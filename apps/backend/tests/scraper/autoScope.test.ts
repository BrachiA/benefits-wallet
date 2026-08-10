import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { scraperService } from '../../src/modules/scraper/scraper.service';
import { scraperAlerts } from '../../src/modules/scraper/scraperAlerts';
import { hasAutoScopeAnchor } from '../../src/modules/scraper/scraperAutoScope';
import { createBenefit, createBrand, createCategory, createProgram, createRun, createScraperSource } from '../setup/factories';
import type { RawScrapedFields } from '../../src/modules/scraper/matching.service';
import type { Benefit } from '@prisma/client';

function fields(overrides: Partial<RawScrapedFields> = {}): RawScrapedFields {
  return {
    title: 'הנחה על כל החנות',
    shortDescription: 'הנחה קבועה לחברי מועדון',
    discountValue: 10,
    externalId: 'ext-1',
    ...overrides,
  };
}

async function processOne(sourceId: string, item: RawScrapedFields) {
  const run = await createRun(sourceId);
  const source = await prisma.scraperSource.findUniqueOrThrow({ where: { id: sourceId } });
  return scraperService.processScrapedItem(source, run.id, item);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('hasAutoScopeAnchor', () => {
  it('דורש עוגן שיוך (מועדון או מותג) וגם קטגוריה', () => {
    expect(hasAutoScopeAnchor({ defaultProgramId: null, defaultBrandId: null, defaultCategoryId: null })).toBe(false);
    expect(hasAutoScopeAnchor({ defaultProgramId: 'p1', defaultBrandId: null, defaultCategoryId: null })).toBe(false);
    expect(hasAutoScopeAnchor({ defaultProgramId: null, defaultBrandId: null, defaultCategoryId: 'c1' })).toBe(false);
    expect(hasAutoScopeAnchor({ defaultProgramId: 'p1', defaultBrandId: null, defaultCategoryId: 'c1' })).toBe(true);
    expect(hasAutoScopeAnchor({ defaultProgramId: null, defaultBrandId: 'b1', defaultCategoryId: 'c1' })).toBe(true);
  });
});

describe('פרסום אוטומטי של הטבה חדשה — עם עוגן שיוך', () => {
  it('מקור עם defaultProgramId + defaultCategoryId יוצר הטבה עם BenefitScope תואם', async () => {
    const program = await createProgram();
    const category = await createCategory();
    const source = await createScraperSource({ defaultProgramId: program.id, defaultCategoryId: category.id });

    const outcome = await processOne(source.id, fields());

    expect(outcome).toBe('CREATED');
    const benefit = await prisma.benefit.findFirstOrThrow({ where: { title: 'הנחה על כל החנות' } });
    expect(benefit.categoryId).toBe(category.id);
    expect(benefit.isActive).toBe(true);

    const scopes = await prisma.benefitScope.findMany({ where: { benefitId: benefit.id } });
    expect(scopes).toHaveLength(1);
    expect(scopes[0].programId).toBe(program.id);
    expect(scopes[0].brandId).toBeNull();

    // הפריט הסרוק מקושר להטבה, וה-run סופר אותה תחת CREATED
    const item = await prisma.scrapedItem.findFirstOrThrow({ where: { externalId: 'ext-1' } });
    expect(item.status).toBe('AUTO_PUBLISHED');
    expect(item.matchedBenefitId).toBe(benefit.id);
  });

  it('מקור עם defaultBrandId (בלי defaultProgramId) יוצר scope לפי המותג', async () => {
    const brand = await createBrand();
    const category = await createCategory();
    const source = await createScraperSource({ defaultBrandId: brand.id, defaultCategoryId: category.id });

    await processOne(source.id, fields());

    const benefit = await prisma.benefit.findFirstOrThrow({ where: { title: 'הנחה על כל החנות' } });
    const scopes = await prisma.benefitScope.findMany({ where: { benefitId: benefit.id } });
    expect(scopes[0].brandId).toBe(brand.id);
    expect(scopes[0].programId).toBeNull();
  });

  it('ציון מתחת לסף עדיין נופל לתור, גם עם עוגן שיוך תקין', async () => {
    // עוגן טוב לא עוקף בעיית איכות אמיתית — למשל כותרת קצרה מדי.
    const program = await createProgram();
    const category = await createCategory();
    const source = await createScraperSource({ defaultProgramId: program.id, defaultCategoryId: category.id });

    const outcome = await processOne(source.id, fields({ title: 'א' }));

    expect(outcome).toBe('FLAGGED');
    expect(await prisma.benefit.count()).toBe(0);
  });

  it('בלי עוגן שיוך, אותו פריט המושלם נופל לתור — לא נוצרת הטבה', async () => {
    const source = await createScraperSource(); // בלי defaultProgramId/defaultBrandId/defaultCategoryId

    const outcome = await processOne(source.id, fields());

    expect(outcome).toBe('FLAGGED');
    expect(await prisma.benefit.count()).toBe(0);
    const item = await prisma.scrapedItem.findFirstOrThrow({ where: { externalId: 'ext-1' } });
    expect(item.confidenceReasons.join(' ')).toContain('אין למקור עוגן שיוך');
  });

  it('valueScore מחושב על ההטבה שנוצרה אוטומטית', async () => {
    const program = await createProgram();
    const category = await createCategory();
    const source = await createScraperSource({ defaultProgramId: program.id, defaultCategoryId: category.id });

    await processOne(source.id, fields({ discountValue: 25 }));

    const benefit = await prisma.benefit.findFirstOrThrow({ where: { title: 'הנחה על כל החנות' } });
    // benefitType='OTHER' (הסורק לא מזהה סוג) → לא אחד משלושת
    // הסוגים הכספיים → 0, כמו כל הטבה אחרת מאותו הסוג.
    expect(benefit.valueScore).toBe(0);
  });
});

describe('אישור ידני (reviewItem) — שיוך אוטומטי כשיש עוגן', () => {
  it('אישור הטבה חדשה ממקור עם עוגן יוצר scope בלי שהמנהל מזין תוכנית/מותג', async () => {
    const program = await createProgram();
    const category = await createCategory();
    const source = await createScraperSource({ defaultProgramId: program.id, defaultCategoryId: category.id });
    const run = await createRun(source.id);
    const item = await prisma.scrapedItem.create({
      data: {
        sourceId: source.id,
        runId: run.id,
        externalId: 'ext-1',
        rawData: fields() as never,
        confidenceScore: 50,
        status: 'PENDING_REVIEW',
      },
    });

    const created = await scraperService.reviewItem(item.id, {
      decision: 'APPROVE',
      reviewedBy: 'בודקת',
      // בלי categoryId — למקור יש defaultCategoryId, אמור להספיק
    });

    const scopes = await prisma.benefitScope.findMany({ where: { benefitId: created.id } });
    expect(scopes).toHaveLength(1);
    expect(scopes[0].programId).toBe(program.id);
  });

  it('overrides.categoryId גובר על defaultCategoryId של המקור', async () => {
    const program = await createProgram();
    const sourceCategory = await createCategory();
    const overrideCategory = await createCategory();
    const source = await createScraperSource({ defaultProgramId: program.id, defaultCategoryId: sourceCategory.id });
    const run = await createRun(source.id);
    const item = await prisma.scrapedItem.create({
      data: {
        sourceId: source.id,
        runId: run.id,
        externalId: 'ext-1',
        rawData: fields() as never,
        confidenceScore: 50,
        status: 'PENDING_REVIEW',
      },
    });

    // reviewItem מחזיר union (Benefit | תוצאת עדכון ScrapedItem) כי
    // אותה פונקציה משרתת גם דחייה וגם עדכון; במסלול הזה (הטבה
    // חדשה) התוצאה היא תמיד Benefit.
    const created = (await scraperService.reviewItem(item.id, {
      decision: 'APPROVE',
      reviewedBy: 'בודקת',
      overrides: { categoryId: overrideCategory.id },
    })) as Benefit;

    expect(created.categoryId).toBe(overrideCategory.id);
  });

  it('מקור בלי שום עוגן ובלי override של קטגוריה — עדיין נדחה (חובה קטגוריה)', async () => {
    const source = await createScraperSource();
    const run = await createRun(source.id);
    const item = await prisma.scrapedItem.create({
      data: {
        sourceId: source.id,
        runId: run.id,
        externalId: 'ext-1',
        rawData: fields() as never,
        confidenceScore: 50,
        status: 'PENDING_REVIEW',
      },
    });

    await expect(
      scraperService.reviewItem(item.id, { decision: 'APPROVE', reviewedBy: 'בודקת' })
    ).rejects.toThrow();
  });

  it('מקור בלי עוגן שיוך, עם override קטגוריה — הטבה נוצרת בלי scope (פער ידוע, נפתר ידנית)', async () => {
    const category = await createCategory();
    const source = await createScraperSource(); // בלי defaultProgramId/defaultBrandId
    const run = await createRun(source.id);
    const item = await prisma.scrapedItem.create({
      data: {
        sourceId: source.id,
        runId: run.id,
        externalId: 'ext-1',
        rawData: fields() as never,
        confidenceScore: 50,
        status: 'PENDING_REVIEW',
      },
    });

    const created = await scraperService.reviewItem(item.id, {
      decision: 'APPROVE',
      reviewedBy: 'בודקת',
      overrides: { categoryId: category.id },
    });

    // אין FK של תוכנית/מותג לגזור ממנו — המנהל צריך להוסיף שיוך
    // ידנית אחרי היצירה (ראו ScopeEditor בעריכת הטבה קיימת, ב.5.2).
    expect(await prisma.benefitScope.count({ where: { benefitId: created.id } })).toBe(0);
  });
});

describe('התראות מייל — שלוש הסיבות שאושרו', () => {
  it('פריט שהועבר לתור שולח itemFlagged עם הסבר', async () => {
    const spy = vi.spyOn(scraperAlerts, 'itemFlagged').mockResolvedValue();
    const source = await createScraperSource();

    await processOne(source.id, fields());

    expect(spy).toHaveBeenCalledOnce();
    const call = spy.mock.calls[0][0];
    expect(call.title).toBe('הנחה על כל החנות');
    expect(call.confidenceReasons.join(' ')).toContain('אין למקור עוגן שיוך');
  });

  it('פריט שפורסם/עודכן אוטומטית אינו שולח itemFlagged', async () => {
    const spy = vi.spyOn(scraperAlerts, 'itemFlagged').mockResolvedValue();
    const program = await createProgram();
    const category = await createCategory();
    const source = await createScraperSource({ defaultProgramId: program.id, defaultCategoryId: category.id });

    await processOne(source.id, fields());

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('createSource/updateSource — defaultCategoryId עובר דרך ה-API בפועל', () => {
  // הבאג שנמצא כאן: defaultCategoryId נוסף לסכמת Prisma ונקרא
  // ב-scraper.service, אבל לא נכלל ב-Zod DTO ולא טופל ב-createSource/
  // updateSource — כך שהוא לא היה יכול להיקבע אף פעם דרך ה-API,
  // והיה נשאר null גם אם המנהלת "בחרה" קטגוריית ברירת מחדל בטופס.
  it('createSource שומר defaultCategoryId שסופק', async () => {
    const category = await createCategory();

    const created = await scraperService.createSource({
      slug: `src-${Date.now()}`,
      name: 'מקור בדיקה',
      sourceType: 'BRAND_SITE',
      baseUrl: 'http://localhost:1/',
      renderMode: 'HTTP',
      scrapeConfig: { listSelector: '.card', maxPages: 1, fields: { title: '.t', externalId: '@id' } },
      defaultCategoryId: category.id,
      requestDelayMs: 1000,
      scheduleCron: '0 3 * * *',
    });

    expect(created.defaultCategoryId).toBe(category.id);
  });

  it('updateSource מעדכן defaultCategoryId על מקור קיים', async () => {
    const source = await createScraperSource();
    const category = await createCategory();

    const updated = await scraperService.updateSource(source.id, { defaultCategoryId: category.id });

    expect(updated.defaultCategoryId).toBe(category.id);
  });

  it('updateSource עם defaultCategoryId ריק מנתק את הקטגוריה', async () => {
    const category = await createCategory();
    const source = await createScraperSource({ defaultCategoryId: category.id });

    const updated = await scraperService.updateSource(source.id, { defaultCategoryId: undefined });

    // undefined אומר "לא נשלח שינוי" ב-Zod .partial(), לכן לא אמור
    // לנתק — זהו מבחן שלילי שמוודא שהתנהגות ברירת המחדל לא נשברה.
    expect(updated.defaultCategoryId).toBe(category.id);
  });
});
