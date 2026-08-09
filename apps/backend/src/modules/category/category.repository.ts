import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { ListCategoriesQuery } from './category.dto';

export const categoryRepository = {
  async findMany(query: ListCategoriesQuery, skip: number, take: number) {
    const where: Prisma.CategoryWhereInput = {
      deletedAt: null,
      ...(query.parentId !== undefined && { parentId: query.parentId }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    };
    const [items, total] = await Promise.all([
      prisma.category.findMany({ where, orderBy: { sortOrder: 'asc' }, skip, take }),
      prisma.category.count({ where }),
    ]);
    return { items, total };
  },

  async findById(id: string) {
    return prisma.category.findFirst({
      where: { id, deletedAt: null },
      include: { parent: true, children: true },
    });
  },

  async findByIdRaw(id: string) {
    return prisma.category.findUnique({ where: { id } });
  },

  async create(data: Prisma.CategoryCreateInput) {
    return prisma.category.create({ data });
  },

  async update(id: string, data: Prisma.CategoryUpdateInput) {
    return prisma.category.update({ where: { id }, data });
  },

  async softDelete(id: string) {
    return prisma.category.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  },
};
