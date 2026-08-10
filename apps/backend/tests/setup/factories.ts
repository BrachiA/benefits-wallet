import { prisma } from '../../src/lib/prisma';

// בוני ישויות לבדיקות. כל אחד מקבל override חלקי, כדי שמקרה בדיקה
// יציין רק את מה שרלוונטי לו ושאר השדות יהיו ברירת מחדל תקינה.
// זה שומר על הבדיקות קריאות: מה שכתוב בהן הוא מה שנבדק.

let counter = 0;
const uniq = (prefix: string) => `${prefix}-${++counter}`;

export async function createCategory(overrides: { slug?: string; name?: string; nameEn?: string } = {}) {
  const slug = overrides.slug ?? uniq('cat');
  return prisma.category.create({
    data: { slug, name: overrides.name ?? slug, nameEn: overrides.nameEn, path: slug },
  });
}

export async function createIssuer(overrides: { slug?: string; name?: string } = {}) {
  const slug = overrides.slug ?? uniq('issuer');
  return prisma.issuer.create({ data: { slug, name: overrides.name ?? slug } });
}

export async function createProgram(
  overrides: { slug?: string; name?: string; issuerId?: string; isActive?: boolean; deletedAt?: Date | null } = {}
) {
  const slug = overrides.slug ?? uniq('prog');
  const issuerId = overrides.issuerId ?? (await createIssuer()).id;
  return prisma.program.create({
    data: {
      slug,
      name: overrides.name ?? slug,
      path: slug,
      type: 'CREDIT_CARD',
      issuerId,
      isActive: overrides.isActive ?? true,
      deletedAt: overrides.deletedAt ?? null,
    },
  });
}

export async function createBrand(
  overrides: {
    slug?: string;
    name?: string;
    nameEn?: string;
    categoryId?: string;
    isActive?: boolean;
    deletedAt?: Date | null;
    searchKeywords?: string[];
  } = {}
) {
  const slug = overrides.slug ?? uniq('brand');
  const categoryId = overrides.categoryId ?? (await createCategory()).id;
  return prisma.brand.create({
    data: {
      slug,
      name: overrides.name ?? slug,
      nameEn: overrides.nameEn,
      categoryId,
      isActive: overrides.isActive ?? true,
      deletedAt: overrides.deletedAt ?? null,
      searchKeywords: overrides.searchKeywords ?? [],
    },
  });
}

type BenefitOverrides = {
  slug?: string;
  title?: string;
  shortDescription?: string;
  categoryId?: string;
  benefitType?: 'DISCOUNT_PERCENT' | 'FREE_SHIPPING' | 'OTHER';
  discountValue?: number | null;
  imageUrl?: string | null;
  isActive?: boolean;
  deletedAt?: Date | null;
  startDate?: Date | null;
  endDate?: Date | null;
  // כל אובייקט כאן הופך לשורת BenefitScope. מערך ריק = הטבה בלי
  // שיוך כלל, וזה מקרה בדיקה בפני עצמו.
  scopes?: { programId?: string; brandId?: string; storeId?: string; cityId?: string }[];
};

export async function createBenefit(overrides: BenefitOverrides = {}) {
  const slug = overrides.slug ?? uniq('benefit');
  const categoryId = overrides.categoryId ?? (await createCategory()).id;
  const benefit = await prisma.benefit.create({
    data: {
      slug,
      title: overrides.title ?? slug,
      shortDescription: overrides.shortDescription ?? 'תיאור בדיקה',
      categoryId,
      benefitType: overrides.benefitType ?? 'DISCOUNT_PERCENT',
      discountValue: overrides.discountValue ?? null,
      imageUrl: overrides.imageUrl ?? null,
      isActive: overrides.isActive ?? true,
      deletedAt: overrides.deletedAt ?? null,
      startDate: overrides.startDate ?? null,
      endDate: overrides.endDate ?? null,
    },
  });
  if (overrides.scopes?.length) {
    await prisma.benefitScope.createMany({
      data: overrides.scopes.map((s) => ({ ...s, benefitId: benefit.id })),
    });
  }
  return benefit;
}

export async function createScraperSource(
  overrides: {
    slug?: string;
    tosStatus?: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
    isActive?: boolean;
    // עוגן השיוך האוטומטי (שלב 5, א.2). ברירת המחדל היא ללא עוגן,
    // כי רוב מקרי הבדיקה עוסקים בהתנהגות "בלי אנשור" — הבדיקות
    // הספציפיות לפרסום אוטומטי מספקות אותו במפורש.
    defaultProgramId?: string;
    defaultBrandId?: string;
    defaultCategoryId?: string;
  } = {}
) {
  const slug = overrides.slug ?? uniq('source');
  return prisma.scraperSource.create({
    data: {
      slug,
      name: slug,
      sourceType: 'BRAND_SITE',
      baseUrl: 'http://localhost:1/',
      renderMode: 'HTTP',
      scrapeConfig: {
        listSelector: '.card',
        fields: { title: '.title', externalId: '@data-id' },
      },
      // ברירת המחדל היא מקור שכבר עבר את שני השערים, כי רוב מקרי
      // הבדיקה עוסקים במה שקורה *אחרי* שמותר להריץ.
      tosStatus: overrides.tosStatus ?? 'APPROVED',
      isActive: overrides.isActive ?? true,
      defaultProgramId: overrides.defaultProgramId,
      defaultBrandId: overrides.defaultBrandId,
      defaultCategoryId: overrides.defaultCategoryId,
    },
  });
}

export async function createRun(sourceId: string) {
  return prisma.scraperRun.create({ data: { sourceId, status: 'PARTIAL' } });
}
