import { prisma } from '../../lib/prisma';
import { buildBenefitVisibilityWhere, type BenefitAudience } from '../benefit/benefitVisibility';
import { SIMILARITY_THRESHOLD, fetchWithBackfill, type RankedId } from './fuzzyMatch';
import type { SearchQuery } from './search.dto';

const ALL_TYPES = ['benefit', 'brand', 'program', 'category', 'store'] as const;
type EntityType = (typeof ALL_TYPES)[number];

// מודול search לא מחזיק Repository משלו בכוונה: הוא מקבץ שאילתות
// קריאה-בלבד על פני מודולים קיימים (benefit/brand/program/...),
// ולא הבעלים של אף טבלה. גישה ישירה ל-prisma כאן נשארת קריאה
// בלבד ותמיד מסוננת ל-isActive/deletedAt כמו כל שאר המודולים.
//
// חיפוש חכם (שלב 6): כל סוג ישות משתמש באסטרטגיה זהה —
//   1. שאילתת SQL גולמית שמחזירה מועמדים מדורגים לפי עמוד
//      (offset/limit) — ILIKE substring תמיד, GREATEST(similarity(...))
//      ל-typo-tolerance על פני השם וגם, כשרלוונטי, שם הקטגוריה/
//      תגיות/מילות-מפתח — כדי ש"גלידה" ימצא גם מותג ששייך
//      לקטגוריית "גלידות" ולא רק מותג ששמו המדויק כך
//   2. שליפת השורות המלאות דרך Prisma (מכבד isActive/deletedAt,
//      ו-להטבות — buildBenefitVisibilityWhere, מקור האמת מ-שלב 2)
//   3. fetchWithBackfill: אם הסינון ב-Prisma הותיר פחות מ-take
//      תוצאות (למשל רוב המועמדים בעמוד הראשון פגי-תוקף), נשלף עמוד
//      נוסף של מועמדים במקום להסתפק בפחות תוצאות ממה שבאמת קיים
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

  // הטבה: כותרת/תיאור/תגיות (כולל fuzzy על תגית, לא רק substring) +
  // שם הקטגוריה + typo tolerance. תנאי הנראות מגיע מ-benefitVisibility
  // ולא נבנה כאן.
  async searchBenefits(q: string, take: number, audience?: BenefitAudience) {
    return fetchWithBackfill({
      take,
      fetchCandidates: (offset, limit) => searchBenefitCandidates(q, offset, limit),
      fetchRows: async (ids) =>
        prisma.benefit.findMany({
          where: { AND: [buildBenefitVisibilityWhere({ audience }), { id: { in: ids } }] },
          include: { category: true },
        }),
    });
  },

  // מותג: שם/searchKeywords (כולל fuzzy, לא רק שוויון מדויק)/שם
  // קטגוריה + typo tolerance, וגם מסונן ל"יש לו הטבה תקפה כרגע"
  // (הוחלט במפורש בשלב 6) — לא כל מותג בקטלוג, רק כאלה שיש להם
  // למה לחפש אותם עכשיו. "יש הטבה" מוגדר כשורת BenefitScope עם
  // brandId=המותג הזה שמצביעה על הטבה גלויה (buildBenefitVisibilityWhere)
  // — לא הטבה גלובלית שסתם כוללת אותו דרך brandId=null.
  async searchBrands(q: string, take: number) {
    return fetchWithBackfill({
      take,
      fetchCandidates: (offset, limit) => searchBrandCandidates(q, offset, limit),
      fetchRows: async (ids) =>
        prisma.brand.findMany({
          where: {
            id: { in: ids },
            isActive: true,
            deletedAt: null,
            benefitScopes: { some: { benefit: buildBenefitVisibilityWhere() } },
          },
          include: { category: true },
        }),
    });
  },

  // מועדון/כרטיס: שם + typo tolerance.
  async searchPrograms(q: string, take: number) {
    return fetchWithBackfill({
      take,
      fetchCandidates: (offset, limit) => searchProgramCandidates(q, offset, limit),
      fetchRows: async (ids) => prisma.program.findMany({ where: { id: { in: ids } }, include: { issuer: true } }),
    });
  },

  // קטגוריה: שם עברי/אנגלי + typo tolerance.
  async searchCategories(q: string, take: number) {
    return fetchWithBackfill({
      take,
      fetchCandidates: (offset, limit) => searchCategoryCandidates(q, offset, limit),
      fetchRows: async (ids) => prisma.category.findMany({ where: { id: { in: ids } } }),
    });
  },

  // סניף: שם סניף + עיר + typo tolerance.
  async searchStores(q: string, take: number) {
    return fetchWithBackfill({
      take,
      fetchCandidates: (offset, limit) => searchStoreCandidates(q, offset, limit),
      fetchRows: async (ids) => prisma.store.findMany({ where: { id: { in: ids } }, include: { brand: true, city: true } }),
    });
  },
};

// ---------- שאילתות מועמדים גולמיות, כל אחת עם offset/limit ----------

function searchBenefitCandidates(q: string, offset: number, limit: number): Promise<RankedId[]> {
  return prisma.$queryRaw<RankedId[]>`
    SELECT id, MAX(rank) AS rank FROM (
      SELECT b.id,
        GREATEST(
          similarity(lower(b.title), lower(${q})),
          similarity(lower(b."shortDescription"), lower(${q})),
          similarity(lower(c.name), lower(${q})),
          similarity(lower(coalesce(c."nameEn", '')), lower(${q})),
          (
            SELECT COALESCE(MAX(similarity(lower(t.name), lower(${q}))), 0)
            FROM benefit_tags bt JOIN tags t ON t.id = bt."tagId"
            WHERE bt."benefitId" = b.id
          )
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
          WHERE bt."benefitId" = b.id
            AND (
              lower(t.name) LIKE '%' || lower(${q}) || '%'
              OR similarity(lower(t.name), lower(${q})) > ${SIMILARITY_THRESHOLD}
            )
        )
    ) matched
    GROUP BY id
    ORDER BY rank DESC, id ASC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

function searchBrandCandidates(q: string, offset: number, limit: number): Promise<RankedId[]> {
  return prisma.$queryRaw<RankedId[]>`
    SELECT b.id, GREATEST(
      similarity(lower(b.name), lower(${q})),
      similarity(lower(coalesce(b."nameEn", '')), lower(${q})),
      similarity(lower(c.name), lower(${q})),
      similarity(lower(coalesce(c."nameEn", '')), lower(${q})),
      (
        SELECT COALESCE(MAX(similarity(lower(k), lower(${q}))), 0)
        FROM unnest(b."searchKeywords") k
      )
    ) AS rank
    FROM brands b
    JOIN categories c ON c.id = b."categoryId"
    WHERE b."isActive" = true AND b."deletedAt" IS NULL
      AND (
        lower(b.name) LIKE '%' || lower(${q}) || '%'
        OR lower(coalesce(b."nameEn", '')) LIKE '%' || lower(${q}) || '%'
        OR lower(c.name) LIKE '%' || lower(${q}) || '%'
        OR similarity(lower(b.name), lower(${q})) > ${SIMILARITY_THRESHOLD}
        OR similarity(lower(coalesce(b."nameEn", '')), lower(${q})) > ${SIMILARITY_THRESHOLD}
        OR similarity(lower(c.name), lower(${q})) > ${SIMILARITY_THRESHOLD}
        OR EXISTS (
          SELECT 1 FROM unnest(b."searchKeywords") k
          WHERE lower(k) = lower(${q}) OR similarity(lower(k), lower(${q})) > ${SIMILARITY_THRESHOLD}
        )
      )
    ORDER BY rank DESC, id ASC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

function searchProgramCandidates(q: string, offset: number, limit: number): Promise<RankedId[]> {
  return prisma.$queryRaw<RankedId[]>`
    SELECT id, similarity(lower(name), lower(${q})) AS rank
    FROM programs
    WHERE "isActive" = true AND "deletedAt" IS NULL
      AND (
        lower(name) LIKE '%' || lower(${q}) || '%'
        OR similarity(lower(name), lower(${q})) > ${SIMILARITY_THRESHOLD}
      )
    ORDER BY rank DESC, id ASC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

function searchCategoryCandidates(q: string, offset: number, limit: number): Promise<RankedId[]> {
  return prisma.$queryRaw<RankedId[]>`
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
    ORDER BY rank DESC, id ASC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

function searchStoreCandidates(q: string, offset: number, limit: number): Promise<RankedId[]> {
  return prisma.$queryRaw<RankedId[]>`
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
    ORDER BY rank DESC, id ASC
    LIMIT ${limit} OFFSET ${offset}
  `;
}
