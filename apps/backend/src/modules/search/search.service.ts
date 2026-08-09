import { prisma } from '../../lib/prisma';
import { buildBenefitVisibilityWhere, type BenefitAudience } from '../benefit/benefitVisibility';
import type { SearchQuery } from './search.dto';

const ALL_TYPES = ['benefit', 'brand', 'program', 'category', 'store'] as const;
type EntityType = (typeof ALL_TYPES)[number];

// מודול search לא מחזיק Repository משלו בכוונה: הוא מקבץ שאילתות
// קריאה-בלבד על פני מודולים קיימים (benefit/brand/program/...),
// ולא הבעלים של אף טבלה. גישה ישירה ל-prisma כאן נשארת קריאה
// בלבד ותמיד מסוננת ל-isActive/deletedAt כמו כל שאר המודולים.
export const searchService = {
  async searchAll(query: SearchQuery) {
    const types = (query.entityTypes ?? ALL_TYPES) as EntityType[];
    const take = query.limitPerType;
    // תוצאות ההטבות מסוננות לפי הזכאות של מי שמחפש, כמו בכל מסך
    // אחר באפליקציה. בלי זה החיפוש היה החור היחיד שדרכו הטבה
    // שאינה מגיעה למשתמשת הופיעה לה בכל זאת.
    const audience: BenefitAudience = { programIds: query.programIds };

    // כל סוג ישות נשלף במקביל, לא ברצף — חיפוש-על לא אמור להיות
    // איטי פי 5 מחיפוש בודד.
    const [benefits, brands, programs, categories, stores] = await Promise.all([
      types.includes('benefit') ? this.searchBenefits(query.q, take, audience) : [],
      types.includes('brand') ? this.searchBrands(query.q, take) : [],
      types.includes('program') ? this.searchPrograms(query.q, take) : [],
      types.includes('category') ? this.searchCategories(query.q, take) : [],
      types.includes('store') ? this.searchStores(query.q, take) : [],
    ]);

    return { benefits, brands, programs, categories, stores };
  },

  // שם הטבה + תגיות (שלב 8: "תגיות" ו"מילות מפתח").
  // תנאי הנראות מגיע מ-benefitVisibility ולא נבנה כאן — הגרסה
  // הקודמת בדקה isActive/deletedAt בלבד ולכן החזירה גם הטבות
  // שפג תוקפן.
  async searchBenefits(q: string, take: number, audience?: BenefitAudience) {
    return prisma.benefit.findMany({
      where: {
        AND: [
          buildBenefitVisibilityWhere({ audience }),
          {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { shortDescription: { contains: q, mode: 'insensitive' } },
              { tags: { some: { tag: { name: { contains: q, mode: 'insensitive' } } } } },
            ],
          },
        ],
      },
      take,
      orderBy: { priority: 'desc' },
      include: { category: true },
    });
  },

  // שם מותג + searchKeywords (שלב 8: "שם חנות", "מותג")
  async searchBrands(q: string, take: number) {
    return prisma.brand.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { searchKeywords: { has: q.toLowerCase() } },
        ],
      },
      take,
      include: { category: true },
    });
  },

  // שם מועדון/כרטיס (שלב 8: "כרטיס", "מועדון")
  async searchPrograms(q: string, take: number) {
    return prisma.program.findMany({
      where: { isActive: true, deletedAt: null, name: { contains: q, mode: 'insensitive' } },
      take,
      include: { issuer: true },
    });
  },

  // שלב 8: "קטגוריה"
  async searchCategories(q: string, take: number) {
    return prisma.category.findMany({
      where: { isActive: true, deletedAt: null, name: { contains: q, mode: 'insensitive' } },
      take,
    });
  },

  // שם סניף + עיר (שלב 8: "מיקום")
  async searchStores(q: string, take: number) {
    return prisma.store.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        OR: [{ name: { contains: q, mode: 'insensitive' } }, { city: { name: { contains: q, mode: 'insensitive' } } }],
      },
      take,
      include: { brand: true, city: true },
    });
  },
};
