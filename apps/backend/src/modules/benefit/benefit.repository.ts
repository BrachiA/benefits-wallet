import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { buildBenefitVisibilityWhere } from './benefitVisibility';
import type { ListBenefitsQuery } from './benefit.dto';

// שכבת בידוד מ-Prisma: אם אי-פעם יוחלט לעבור ל-Drizzle או ל-raw SQL
// בשאילתה הזו במיוחד (המועמדת הראשונה, כי היא הכי כבדה במערכת),
// משנים קובץ זה בלבד.

export const benefitRepository = {
  // שאילתת ה-Scope-matching: הלב של המערכת. הופכת בחירת מועדונים
  // של המשתמש לרשימת הטבות תקפות. תנאי הנראות עצמו חי ב-
  // benefitVisibility.ts ומשותף לכל הצרכנים.
  async findMatchingBenefits(query: ListBenefitsQuery, skip: number, take: number) {
    const where: Prisma.BenefitWhereInput = {
      AND: [
        buildBenefitVisibilityWhere({
          audience: { programIds: query.programIds, brandId: query.brandId },
          includeInactive: query.includeInactive,
        }),
        ...(query.categoryId ? [{ categoryId: query.categoryId }] : []),
        ...(query.isPopular !== undefined ? [{ isPopular: query.isPopular }] : []),
        ...(query.search
          ? [
              {
                OR: [
                  { title: { contains: query.search, mode: 'insensitive' as const } },
                  { shortDescription: { contains: query.search, mode: 'insensitive' as const } },
                ],
              },
            ]
          : []),
      ],
    };

    const orderBy: Prisma.BenefitOrderByWithRelationInput =
      query.sortBy === 'valueScore'
        ? { valueScore: 'desc' }
        : query.sortBy === 'createdAt'
          ? { createdAt: 'desc' }
          : { priority: 'desc' };

    const [items, total] = await Promise.all([
      prisma.benefit.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          category: true,
          scopes: { include: { program: true, brand: true, store: true } },
          tags: { include: { tag: true } },
        },
      }),
      prisma.benefit.count({ where }),
    ]);

    return { items, total };
  },

  async findById(id: string) {
    return prisma.benefit.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true,
        scopes: { include: { program: true, brand: true, store: true } },
        tags: { include: { tag: true } },
        coupons: { where: { isActive: true, deletedAt: null } },
      },
    });
  },

  async create(data: Prisma.BenefitCreateInput) {
    return prisma.benefit.create({ data, include: { scopes: true } });
  },

  async update(id: string, data: Prisma.BenefitUpdateInput) {
    return prisma.benefit.update({ where: { id }, data });
  },

  // Soft delete בלבד — Benefit היסטורית נשמרת לצורכי אנליטיקס
  async softDelete(id: string) {
    return prisma.benefit.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  },

  // scopes בלי benefitId בכוונה: הוא מתווסף כאן, לא נדרש מהקורא —
  // אותה צורה בדיוק שה-DTO מייצר (Omit<..., 'benefitId'>[]), כדי
  // שהחתימה תשקף מה שהפונקציה באמת צריכה ולא את טיפוס ה-Prisma
  // המלא שדורש שדה שהיא ממילא דורסת.
  async replaceScopes(benefitId: string, scopes: Omit<Prisma.BenefitScopeCreateManyInput, 'benefitId'>[]) {
    return prisma.$transaction([
      prisma.benefitScope.deleteMany({ where: { benefitId } }),
      prisma.benefitScope.createMany({
        data: scopes.map((s) => ({ ...s, benefitId })),
      }),
    ]);
  },
};
