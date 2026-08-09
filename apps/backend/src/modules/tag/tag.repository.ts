import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { ListTagsQuery } from './tag.dto';

export const tagRepository = {
  async findMany(query: ListTagsQuery, skip: number, take: number) {
    const where: Prisma.TagWhereInput = {
      deletedAt: null,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    };
    const [items, total] = await Promise.all([
      prisma.tag.findMany({ where, orderBy: { sortOrder: 'asc' }, skip, take }),
      prisma.tag.count({ where }),
    ]);
    return { items, total };
  },

  async findById(id: string) {
    return prisma.tag.findFirst({ where: { id, deletedAt: null } });
  },

  async create(data: Prisma.TagCreateInput) {
    return prisma.tag.create({ data });
  },

  async update(id: string, data: Prisma.TagUpdateInput) {
    return prisma.tag.update({ where: { id }, data });
  },

  async softDelete(id: string) {
    return prisma.tag.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  },
};
