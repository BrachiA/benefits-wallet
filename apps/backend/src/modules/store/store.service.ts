import { AppError } from '../../lib/AppError';
import { recordAudit } from '../../lib/auditLog';
import { storeRepository } from './store.repository';
import type { CreateStoreInput, ListStoresQuery, UpdateStoreInput } from './store.dto';

export const storeService = {
  async list(query: ListStoresQuery, page: number, pageSize: number) {
    const { items, total } = await storeRepository.findMany(query, (page - 1) * pageSize, pageSize);
    return { items, meta: { page, pageSize, total } };
  },

  async getById(id: string) {
    const store = await storeRepository.findById(id);
    if (!store) throw AppError.notFound('Store', id);
    return store;
  },

  async create(input: CreateStoreInput) {
    const { brandId, cityId, ...rest } = input;
    const store = await storeRepository.create({
      ...rest,
      brand: { connect: { id: brandId } },
      ...(cityId && { city: { connect: { id: cityId } } }),
    });
    await recordAudit({ entityType: 'Store', entityId: store.id, action: 'CREATE', changedFields: input });
    return store;
  },

  async update(id: string, input: UpdateStoreInput) {
    await this.getById(id);
    const { brandId, cityId, ...rest } = input;
    const store = await storeRepository.update(id, {
      ...rest,
      ...(brandId && { brand: { connect: { id: brandId } } }),
      ...(cityId !== undefined && { city: cityId ? { connect: { id: cityId } } : { disconnect: true } }),
    });
    await recordAudit({ entityType: 'Store', entityId: id, action: 'UPDATE', changedFields: input });
    return store;
  },

  async remove(id: string) {
    await this.getById(id);
    const result = await storeRepository.softDelete(id);
    await recordAudit({ entityType: 'Store', entityId: id, action: 'DELETE' });
    return result;
  },
};
