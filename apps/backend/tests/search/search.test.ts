import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { searchService } from '../../src/modules/search/search.service';
import {
  createBenefit,
  createBrand,
  createCategory,
  createIssuer,
  createProgram,
} from '../setup/factories';

const DAY = 24 * 60 * 60 * 1000;

async function scopeBrandToBenefit(brandId: string, benefitId: string) {
  await prisma.benefitScope.create({ data: { brandId, benefitId } });
}

describe('searchBrands — חיפוש חכם', () => {
  it('שגיאת כתיב בקטגוריה מוצאת מותג ששייך אליה, לא רק התאמה מדויקת בשם', async () => {
    // התרחיש המדויק מהספק: מי שכותבת "גלדיה" (שגיאת כתיב) אמורה
    // למצוא מותג ששייך לקטגוריית "גלידה", גם אם שם המותג עצמו
    // לא מכיל את המילה כלל.
    const category = await createCategory({ name: 'גלידה' });
    const brand = await createBrand({ name: 'ונילה איטלקית', categoryId: category.id });
    const benefit = await createBenefit({ categoryId: category.id });
    await scopeBrandToBenefit(brand.id, benefit.id);

    const results = await searchService.searchBrands('גלדיה', 10); // שגיאת כתיב מכוונת

    expect(results.map((b) => b.id)).toContain(brand.id);
  });

  it('התאמה דו-לשונית: שם אנגלי (nameEn) נמצא גם כשמחפשים באנגלית', async () => {
    const brand = await createBrand({ name: 'זארה', nameEn: 'Zara' });
    const benefit = await createBenefit({ categoryId: brand.categoryId });
    await scopeBrandToBenefit(brand.id, benefit.id);

    const results = await searchService.searchBrands('zara', 10);

    expect(results.map((b) => b.id)).toContain(brand.id);
  });

  it('searchKeywords עדיין עובד, לא-תלוי-רישיות', async () => {
    const brand = await createBrand({ name: 'משהו', searchKeywords: ['zara'] });
    const benefit = await createBenefit({ categoryId: brand.categoryId });
    await scopeBrandToBenefit(brand.id, benefit.id);

    const results = await searchService.searchBrands('ZARA', 10);

    expect(results.map((b) => b.id)).toContain(brand.id);
  });

  it('מותג בלי הטבה פעילה לא מופיע בתוצאות (הוחלט במפורש בשלב 6)', async () => {
    const brand = await createBrand({ name: 'קרח קפוא' });
    // אין קריאה ל-scopeBrandToBenefit — במכוון, זה בדיוק המקרה שנבדק

    const results = await searchService.searchBrands('קרח קפוא', 10);

    expect(results.map((b) => b.id)).not.toContain(brand.id);
  });

  it('מותג עם הטבה שפג תוקפה נחשב כאילו אין לו הטבה', async () => {
    const brand = await createBrand({ name: 'ישן וקפוא' });
    const expiredBenefit = await createBenefit({ categoryId: brand.categoryId, endDate: new Date(Date.now() - DAY) });
    await scopeBrandToBenefit(brand.id, expiredBenefit.id);

    const results = await searchService.searchBrands('ישן וקפוא', 10);

    expect(results.map((b) => b.id)).not.toContain(brand.id);
  });

  it('מותג כבוי או מחוק לא מופיע גם אם יש לו הטבה תואמת', async () => {
    const inactive = await createBrand({ name: 'מותג מושבת', isActive: false });
    const benefit = await createBenefit({ categoryId: inactive.categoryId });
    await scopeBrandToBenefit(inactive.id, benefit.id);

    const results = await searchService.searchBrands('מותג מושבת', 10);

    expect(results.map((b) => b.id)).not.toContain(inactive.id);
  });
});

describe('searchCategories — חיפוש חכם', () => {
  it('שגיאת כתיב מוצאת קטגוריה', async () => {
    const category = await createCategory({ name: 'גלידה' });

    const results = await searchService.searchCategories('גלדיה', 10);

    expect(results.map((c) => c.id)).toContain(category.id);
  });

  it('שם אנגלי (nameEn) נמצא', async () => {
    const category = await createCategory({ name: 'אופנה', nameEn: 'Fashion' });

    const results = await searchService.searchCategories('fashion', 10);

    expect(results.map((c) => c.id)).toContain(category.id);
  });
});

describe('searchPrograms — חיפוש חכם', () => {
  it('שגיאת כתיב מוצאת מועדון', async () => {
    const issuer = await createIssuer({ name: 'מקס' });
    const program = await createProgram({ name: 'מקס פלטינום', issuerId: issuer.id });

    const results = await searchService.searchPrograms('מקס פלטינם', 10); // חסרה ו'

    expect(results.map((p) => p.id)).toContain(program.id);
  });
});

describe('searchBenefits — חיפוש חכם + נראות (מקור האמת משלב 2)', () => {
  it('שגיאת כתיב בשם הקטגוריה מוצאת הטבה ששייכת אליה', async () => {
    const category = await createCategory({ name: 'קינוחים קפואים' });
    const benefit = await createBenefit({ title: 'הנחה על כל התפריט', categoryId: category.id, scopes: [] });

    const results = await searchService.searchBenefits('קינוח קפוא', 10);

    expect(results.map((b) => b.id)).toContain(benefit.id);
  });

  it('הטבה שפג תוקפה לא מוחזרת בחיפוש, גם עם fuzzy match', async () => {
    const category = await createCategory({ name: 'ייחודי-לבדיקה' });
    const expired = await createBenefit({
      title: 'מבצע ייחודי לבדיקה',
      categoryId: category.id,
      endDate: new Date(Date.now() - DAY),
    });

    const results = await searchService.searchBenefits('מבצע ייחודי לבדיקה', 10);

    expect(results.map((b) => b.id)).not.toContain(expired.id);
  });

  it('הטבה משויכת-מועדון מוצגת רק למי שהמועדון שלה תואם, גם עם שגיאת כתיב', async () => {
    const issuer = await createIssuer();
    const programA = await createProgram({ issuerId: issuer.id });
    const programB = await createProgram({ issuerId: issuer.id });
    const category = await createCategory({ name: 'ייחודי-שיוך' });
    const scoped = await createBenefit({
      title: 'הטבת קינוח קפוא בלעדית',
      categoryId: category.id,
      scopes: [{ programId: programA.id }],
    });

    const asA = await searchService.searchBenefits('קינוך קפוא', 10, { programIds: [programA.id] }); // שגיאת כתיב
    const asB = await searchService.searchBenefits('קינוך קפוא', 10, { programIds: [programB.id] });

    expect(asA.map((b) => b.id)).toContain(scoped.id);
    expect(asB.map((b) => b.id)).not.toContain(scoped.id);
  });

  it('תגית עדיין נמצאת בהתאמה מדויקת (התנהגות קיימת, לא נשברה)', async () => {
    const category = await createCategory();
    const benefit = await createBenefit({ categoryId: category.id, scopes: [] });
    const tag = await prisma.tag.create({ data: { slug: `tag-${Date.now()}`, name: 'תגית-ייחודית-לבדיקה' } });
    await prisma.benefitTag.create({ data: { benefitId: benefit.id, tagId: tag.id } });

    const results = await searchService.searchBenefits('תגית-ייחודית-לבדיקה', 10);

    expect(results.map((b) => b.id)).toContain(benefit.id);
  });
});

describe('searchAll — לא שובר כשאין תוצאות', () => {
  it('שאילתה שלא מוצאת כלום מחזירה מבנה תקין וריק', async () => {
    const results = await searchService.searchAll({
      q: 'שאילתה-שבטוח-לא-קיימת-בשום-מקום-XYZ',
      limitPerType: 5,
    } as Parameters<typeof searchService.searchAll>[0]);

    expect(results).toEqual({ benefits: [], brands: [], programs: [], categories: [], stores: [] });
  });
});
