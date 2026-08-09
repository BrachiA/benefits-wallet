import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { ListIssuersQuery } from './issuer.dto';

export const issuerRepository = {
  async findMany(query: ListIssuersQuery, skip: number, take: number) {
    const where: Prisma.IssuerWhereInput = {
      deletedAt: null,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    };
    const [items, total] = await Promise.all([
      prisma.issuer.findMany({ where, orderBy: { sortOrder: 'asc' }, skip, take }),
      prisma.issuer.count({ where }),
    ]);
    return { items, total };
  },

  async findById(id: string) {
    return prisma.issuer.findFirst({ where: { id, deletedAt: null }, include: { programs: true } });
  },

  async create(data: Prisma.IssuerCreateInput) {
    return prisma.issuer.create({ data });
  },

  async update(id: string, data: Prisma.IssuerUpdateInput) {
    return prisma.issuer.update({ where: { id }, data });
  },

  // Soft delete בלבד: מנפיק לא נמחק אף פעם, מועדונים תלויים בו.
  async softDelete(id: string) {
    return prisma.issuer.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  },
};
