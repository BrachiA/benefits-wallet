import { AppError } from '../../lib/AppError';
import { recordAudit } from '../../lib/auditLog';
import { brandRepository } from './brand.repository';
import type { CreateBrandInput, ListBrandsQuery, UpdateBrandInput } from './brand.dto';

export const brandService = {
  async list(query: ListBrandsQuery, page: number, pageSize: number) {
    const { items, total } = await brandRepository.findMany(query, (page - 1) * pageSize, pageSize);
    return { items, meta: { page, pageSize, total } };
  },

  async getById(id: string) {
    const brand = await brandRepository.findById(id);
    if (!brand) throw AppError.notFound('Brand', id);
    return brand;
  },

  async create(input: CreateBrandInput) {
    const { categoryId, parentBrandId, ...rest } = input;
    const brand = await brandRepository.create({
      ...rest,
      category: { connect: { id: categoryId } },
      ...(parentBrandId && { parentBrand: { connect: { id: parentBrandId } } }),
    });
    await recordAudit({ entityType: 'Brand', entityId: brand.id, action: 'CREATE', changedFields: input });
    return brand;
  },

  async update(id: string, input: UpdateBrandInput) {
    await this.getById(id);
    const { categoryId, parentBrandId, ...rest } = input;
    const brand = await brandRepository.update(id, {
      ...rest,
      ...(categoryId && { category: { connect: { id: categoryId } } }),
      ...(parentBrandId !== undefined && {
        parentBrand: parentBrandId ? { connect: { id: parentBrandId } } : { disconnect: true },
      }),
    });
    await recordAudit({ entityType: 'Brand', entityId: id, action: 'UPDATE', changedFields: input });
    return brand;
  },

  async remove(id: string) {
    await this.getById(id);
    const result = await brandRepository.softDelete(id);
    await recordAudit({ entityType: 'Brand', entityId: id, action: 'DELETE' });
    return result;
  },
};
