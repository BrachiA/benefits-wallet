import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { searchService } from '../../src/modules/search/search.service';
import { defaultBatchSize } from '../../src/modules/search/fuzzyMatch';
import { createBenefit, createCategory } from '../setup/factories';

const DAY = 24 * 60 * 60 * 1000;

// הרגרסיה שנבדקת כאן: כשהעמוד הראשון של מועמדי ה-SQL מלא כמעט
// כולו בפריטים שנופלים בסינון ה-Prisma (למשל פגי-תוקף), fetchWithBackfill
// חייב למשוך עמוד נוסף במקום להסתפק בפחות תוצאות ממה שבאמת קיים.
describe('fetchWithBackfill — משיכת עמוד נוסף כשהראשון מסונן ברובו', () => {
  it('מוצא תוצאות שמעבר לעמוד הראשון של המועמדים', async () => {
    const take = 5;
    const batchSize = defaultBatchSize(take); // 20 (take*4)
    const category = await createCategory({ name: `ייחודי-באצ'-${Date.now()}` });

    // ממלאים את העמוד הראשון (סדר rank/id) בפריטים שפגי-תוקף —
    // הם עומדים בתנאי ה-fuzzy אבל ייפלו בסינון הנראות של Prisma.
    // הכותרת זהה כדי שכולם יקבלו את אותו rank (1.0), וה-tiebreak
    // הוא לפי id — ולכן קל להבטיח שהם *כולם* לפני התוצאה התקפה
    // רק ע"י כך שיש בדיוק batchSize מהם.
    const commonTitle = category.name!;
    const expiredBenefits = [];
    for (let i = 0; i < batchSize; i++) {
      expiredBenefits.push(
        await createBenefit({
          title: commonTitle,
          categoryId: category.id,
          endDate: new Date(Date.now() - DAY),
          scopes: [],
        })
      );
    }
    // תוצאה תקפה יחידה, עם ה-id הכי "גדול" כדי שתמיד תיפול אחרי
    // כל הפגות-תוקף בסדר ה-tiebreak (id ASC) — כלומר בעמוד השני.
    const validBenefit = await createBenefit({
      title: commonTitle,
      categoryId: category.id,
      scopes: [],
    });

    const results = await searchService.searchBenefits(commonTitle, take);

    expect(results.map((b) => b.id)).toContain(validBenefit.id);
    expect(expiredBenefits.some((e) => results.map((r) => r.id).includes(e.id))).toBe(false);
  });

  it('לא לולאה לנצח כשבאמת אין מספיק תוצאות — עוצר אחרי המועמדים הקיימים', async () => {
    const category = await createCategory({ name: `מעט-מועמדים-${Date.now()}` });
    // פריט תקף בודד, פחות מ-take
    const only = await createBenefit({ title: category.name!, categoryId: category.id, scopes: [] });

    const results = await searchService.searchBenefits(category.name!, 10);

    expect(results.map((b) => b.id)).toEqual([only.id]);
  });

  it('לא לולאה לנצח כשאין אף מועמד', async () => {
    const results = await searchService.searchBenefits('שאילתה-שלא-קיימת-לגמרי-XYZ123', 10);
    expect(results).toEqual([]);
  });
});

describe('fuzzy match על תגיות (searchBenefits)', () => {
  it('שגיאת כתיב בשם תגית עדיין מוצאת את ההטבה', async () => {
    const category = await createCategory();
    const benefit = await createBenefit({ categoryId: category.id, scopes: [] });
    const tag = await prisma.tag.create({ data: { slug: `tag-${Date.now()}`, name: 'קפואים' } });
    await prisma.benefitTag.create({ data: { benefitId: benefit.id, tagId: tag.id } });

    const results = await searchService.searchBenefits('קפואם', 10); // שגיאת כתיב מכוונת (חסרה י')

    expect(results.map((b) => b.id)).toContain(benefit.id);
  });
});

describe('fuzzy match על searchKeywords (searchBrands)', () => {
  it('שגיאת כתיב במילת מפתח עדיין מוצאת את המותג', async () => {
    const category = await createCategory();
    const brand = await prisma.brand.create({
      data: {
        slug: `brand-${Date.now()}`,
        name: 'שם כלשהו',
        categoryId: category.id,
        searchKeywords: ['telecom'],
      },
    });
    const benefit = await createBenefit({ categoryId: category.id, scopes: [] });
    await prisma.benefitScope.create({ data: { brandId: brand.id, benefitId: benefit.id } });

    const results = await searchService.searchBrands('telekom', 10); // שגיאת כתיב מכוונת

    expect(results.map((b) => b.id)).toContain(brand.id);
  });
});
