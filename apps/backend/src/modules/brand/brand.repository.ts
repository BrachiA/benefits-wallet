import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { ListBrandsQuery } from './brand.dto';

export const brandRepository = {
  async findMany(query: ListBrandsQuery, skip: number, take: number) {
    const where: Prisma.BrandWhereInput = {
      deletedAt: null,
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.parentBrandId !== undefined && { parentBrandId: query.parentBrandId }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { searchKeywords: { has: query.search.toLowerCase() } },
        ],
      }),
    };
    const [items, total] = await Promise.all([
      prisma.brand.findMany({ where, orderBy: { sortOrder: 'asc' }, skip, take, include: { category: true } }),
      prisma.brand.count({ where }),
    ]);
    return { items, total };
  },

  async findById(id: string) {
    return prisma.brand.findFirst({
      where: { id, deletedAt: null },
      include: { category: true, parentBrand: true, childBrands: true, stores: true },
    });
  },

  async create(data: Prisma.BrandCreateInput) {
    return prisma.brand.create({ data });
  },

  async update(id: string, data: Prisma.BrandUpdateInput) {
    return prisma.brand.update({ where: { id }, data });
  },

  async softDelete(id: string) {
    return prisma.brand.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  },
};
