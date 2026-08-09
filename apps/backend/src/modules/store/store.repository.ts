import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { ListStoresQuery } from './store.dto';

export const storeRepository = {
  async findMany(query: ListStoresQuery, skip: number, take: number) {
    const where: Prisma.StoreWhereInput = {
      deletedAt: null,
      ...(query.brandId && { brandId: query.brandId }),
      ...(query.cityId && { cityId: query.cityId }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.minLat !== undefined && { lat: { gte: query.minLat, lte: query.maxLat } }),
      ...(query.minLng !== undefined && { lng: { gte: query.minLng, lte: query.maxLng } }),
    };
    const [items, total] = await Promise.all([
      prisma.store.findMany({ where, skip, take, include: { brand: true, city: true } }),
      prisma.store.count({ where }),
    ]);
    return { items, total };
  },

  async findById(id: string) {
    return prisma.store.findFirst({ where: { id, deletedAt: null }, include: { brand: true, city: true } });
  },

  async create(data: Prisma.StoreCreateInput) {
    return prisma.store.create({ data });
  },

  async update(id: string, data: Prisma.StoreUpdateInput) {
    return prisma.store.update({ where: { id }, data });
  },

  async softDelete(id: string) {
    return prisma.store.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  },
};
