import { prisma } from '../../lib/prisma';
import { buildBenefitVisibilityWhere, type BenefitAudience } from '../benefit/benefitVisibility';
import { SIMILARITY_THRESHOLD, candidateLimit, sortByRank, type RankedId } from './fuzzyMatch';
import type { SearchQuery } from './search.dto';

const ALL_TYPES = ['benefit', 'brand', 'program', 'category', 'store'] as const;
type EntityType = (typeof ALL_TYPES)[number];

// מודול search לא מחזיק Repository משלו בכוונה: הוא מקבץ שאילתות
// קריאה-בלבד על פני מודולים קיימים (benefit/brand/program/...),
// ולא הבעלים של אף טבלה. גישה ישירה ל-prisma כאן נשארת קריאה
// בלבד ותמיד מסוננת ל-isActive/deletedAt כמו כל שאר המודולים.
//
// חיפוש חכם (שלב 6): כל סוג ישות משתמש באסטרטגיה זהה —
//   1. שאילתת SQL גולמית ש��חזירה מועמדים מדורגים (ILIKE substring
//      תמיד, GREATEST(similarity(...)) ל-typo-tolerance, על פני
//      השם וגם, כשרלוונטי, שם הקטגוריה — כדי ש"גלידה" ימצא גם
//      מותג ששייך לקטגוריית "גלידות" ולא רק מותג ששמו המדויק כך)
//   2. שליפת השורות המלאות דרך Prisma (מכבד isActive/deletedAt,
//      ו-להטבות — buildBenefitVisibilityWhere, מקור האמת מ-שלב 2)
//   3. מיון לפי הדירוג מה-SQL וחיתוך ל-take
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

  // הטבה: כותרת/תיאור/תגיות (כמו קודם) + שם הקטגוריה (חדש) + typo
  // tolerance על כותרת/תיאור/קטגוריה. תנאי הנראות מגיע מ-
  // benefitVisibility ולא נבנה כאן.
  async searchBenefits(q: string, take: number, audience?: BenefitAudience) {
    const candidates = await prisma.$queryRaw<RankedId[]>`
      SELECT id, MAX(rank) AS rank FROM (
        SELECT b.id,
          GREATEST(
            similarity(lower(b.title), lower(${q})),
            similarity(lower(b."shortDescription"), lower(${q})),
            similarity(lower(c.name), lower(${q})),
            similarity(lower(coalesce(c."nameEn", '')), lower(${q}))
          ) AS rank
        FROM benefits b
        JOIN categories c ON c.id = b."categoryId"
        WHERE
          lower(b.title) LIKE '%' || lower(${q}) || '%'
          OR lower(b."shortDescription") LIKE '%' || lower(${q}) || '%'
          OR lower(c.name) LIKE '%' || lower(${q}) || '%'
          OR similarity(lower(b.title), lower(${q})) > ${SIMILARITY_THRESHOLD}
          OR similarity(lower(b."shortDescription"), lower(${q})) > ${SIMILARITY_THRESHOLD}
          OR similarity(lower(c.name), lower(${q})) > ${SIMILARITY_THRESHOLD}
          OR EXISTS (
            SELECT 1 FROM benefit_tags bt JOIN tags t ON t.id = bt."tagId"
            WHERE bt."benefitId" = b.id AND lower(t.name) LIKE '%' || lower(${q}) || '%'
          )
      ) matched
      GROUP BY id
      ORDER BY rank DESC
      LIMIT ${candidateLimit(take)}
    `;
    if (candidates.length === 0) return [];

    const rows = await prisma.benefit.findMany({
      where: {
        AND: [buildBenefitVisibilityWhere({ audience }), { id: { in: candidates.map((c) => c.id) } }],
      },
      include: { category: true },
    });
    return sortByRank(rows, candidates, take);
  },

  // מותג: שם/searchKeywords/שם קטגוריה (חדש) + typo tolerance, וגם
  // מסונן ל"יש לו הטבה תקפה כרגע" (הוחלט במפורש בשלב 6) — לא כל
  // מותג בקטלוג, רק כאלה שיש להם למה לחפש אותם עכשיו. "יש הטבה"
  // מוגדר כשורת BenefitScope עם brandId=המותג הזה שמצביעה על הטבה
  // גלויה (buildBenefitVisibilityWhere) — לא הטבה גלובלית שסתם
  // כוללת אותו דרך brandId=null.
  async searchBrands(q: string, take: number) {
    const candidates = await prisma.$queryRaw<RankedId[]>`
      SELECT b.id, GREATEST(
        similarity(lower(b.name), lower(${q})),
        similarity(lower(coalesce(b."nameEn", '')), lower(${q})),
        similarity(lower(c.name), lower(${q})),
        similarity(lower(coalesce(c."nameEn", '')), lower(${q}))
      ) AS rank
      FROM brands b
      JOIN categories c ON c.id = b."categoryId"
      WHERE b."isActive" = true AND b."deletedAt" IS NULL
        AND (
          lower(b.name) LIKE '%' || lower(${q}) || '%'
          OR lower(coalesce(b."nameEn", '')) LIKE '%' || lower(${q}) || '%'
          OR EXISTS (SELECT 1 FROM unnest(b."searchKeywords") k WHERE lower(k) = lower(${q}))
          OR lower(c.name) LIKE '%' || lower(${q}) || '%'
          OR similarity(lower(b.name), lower(${q})) > ${SIMILARITY_THRESHOLD}
          OR similarity(lower(coalesce(b."nameEn", '')), lower(${q})) > ${SIMILARITY_THRESHOLD}
          OR similarity(lower(c.name), lower(${q})) > ${SIMILARITY_THRESHOLD}
        )
      ORDER BY rank DESC
      LIMIT ${candidateLimit(take)}
    `;
    if (candidates.length === 0) return [];

    const rows = await prisma.brand.findMany({
      where: {
        id: { in: candidates.map((c) => c.id) },
        isActive: true,
        deletedAt: null,
        benefitScopes: { some: { benefit: buildBenefitVisibilityWhere() } },
      },
      include: { category: true },
    });
    return sortByRank(rows, candidates, take);
  },

  // מועדון/כרטיס: שם + typo tolerance.
  async searchPrograms(q: string, take: number) {
    const candidates = await prisma.$queryRaw<RankedId[]>`
      SELECT id, similarity(lower(name), lower(${q})) AS rank
      FROM programs
      WHERE "isActive" = true AND "deletedAt" IS NULL
        AND (
          lower(name) LIKE '%' || lower(${q}) || '%'
          OR similarity(lower(name), lower(${q})) > ${SIMILARITY_THRESHOLD}
        )
      ORDER BY rank DESC
      LIMIT ${candidateLimit(take)}
    `;
    if (candidates.length === 0) return [];

    const rows = await prisma.program.findMany({
      where: { id: { in: candidates.map((c) => c.id) } },
      include: { issuer: true },
    });
    return sortByRank(rows, candidates, take);
  },

  // קטגוריה: שם עברי/אנגלי + typo tolerance.
  async searchCategories(q: string, take: number) {
    const candidates = await prisma.$queryRaw<RankedId[]>`
      SELECT id, GREATEST(
        similarity(lower(name), lower(${q})),
        similarity(lower(coalesce("nameEn", '')), lower(${q}))
      ) AS rank
      FROM categories
      WHERE "isActive" = true AND "deletedAt" IS NULL
        AND (
          lower(name) LIKE '%' || lower(${q}) || '%'
          OR lower(coalesce("nameEn", '')) LIKE '%' || lower(${q}) || '%'
          OR similarity(lower(name), lower(${q})) > ${SIMILARITY_THRESHOLD}
          OR similarity(lower(coalesce("nameEn", '')), lower(${q})) > ${SIMILARITY_THRESHOLD}
        )
      ORDER BY rank DESC
      LIMIT ${candidateLimit(take)}
    `;
    if (candidates.length === 0) return [];

    const rows = await prisma.category.findMany({ where: { id: { in: candidates.map((c) => c.id) } } });
    return sortByRank(rows, candidates, take);
  },

  // סניף: שם סניף + עיר + typo tolerance.
  async searchStores(q: string, take: number) {
    const candidates = await prisma.$queryRaw<RankedId[]>`
      SELECT s.id, GREATEST(
        similarity(lower(s.name), lower(${q})),
        similarity(lower(coalesce(ci.name, '')), lower(${q}))
      ) AS rank
      FROM stores s
      LEFT JOIN cities ci ON ci.id = s."cityId"
      WHERE s."isActive" = true AND s."deletedAt" IS NULL
        AND (
          lower(s.name) LIKE '%' || lower(${q}) || '%'
          OR lower(coalesce(ci.name, '')) LIKE '%' || lower(${q}) || '%'
          OR similarity(lower(s.name), lower(${q})) > ${SIMILARITY_THRESHOLD}
          OR similarity(lower(coalesce(ci.name, '')), lower(${q})) > ${SIMILARITY_THRESHOLD}
        )
      ORDER BY rank DESC
      LIMIT ${candidateLimit(take)}
    `;
    if (candidates.length === 0) return [];

    const rows = await prisma.store.findMany({
      where: { id: { in: candidates.map((c) => c.id) } },
      include: { brand: true, city: true },
    });
    return sortByRank(rows, candidates, take);
  },
};
