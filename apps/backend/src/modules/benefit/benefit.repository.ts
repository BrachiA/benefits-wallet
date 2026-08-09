import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { ListBenefitsQuery } from './benefit.dto';

// שכבת בידוד מ-Prisma: אם אי-פעם יוחלט לעבור ל-Drizzle או ל-raw SQL
// בשאילתה הזו במיוחד (המועמדת הראשונה, כי היא הכי כבדה במערכת),
// משנים קובץ זה בלבד.

const activeNotExpiredWhere: Prisma.BenefitWhereInput = {
  isActive: true,
  deletedAt: null,
  OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
};

export const benefitRepository = {
  // שאילתת ה-Scope-matching: הלב של המערכת. הופכת בחירת מועדונים
  // של המשתמש לרשימת הטבות תקפות, דרך OR על שורות BenefitScope.
  async findMatchingBenefits(query: ListBenefitsQuery, skip: number, take: number) {
    const where: Prisma.BenefitWhereInput = {
      ...activeNotExpiredWhere,
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.isPopular !== undefined && { isPopular: query.isPopular }),
      ...(query.search && {
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { shortDescription: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
      ...((query.programIds?.length || query.brandId) && {
        scopes: {
          some: {
            ...(query.programIds?.length && {
              OR: [{ programId: { in: query.programIds } }, { programId: null }],
            }),
            ...(query.brandId && { brandId: query.brandId }),
          },
        },
      }),
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

  async replaceScopes(benefitId: string, scopes: Prisma.BenefitScopeCreateManyInput[]) {
    return prisma.$transaction([
      prisma.benefitScope.deleteMany({ where: { benefitId } }),
      prisma.benefitScope.createMany({
        data: scopes.map((s) => ({ ...s, benefitId })),
      }),
    ]);
  },
};
