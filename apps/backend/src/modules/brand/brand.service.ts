import { AppError } from '../../lib/AppError';
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
    return brandRepository.create({
      ...rest,
      category: { connect: { id: categoryId } },
      ...(parentBrandId && { parentBrand: { connect: { id: parentBrandId } } }),
    });
  },

  async update(id: string, input: UpdateBrandInput) {
    await this.getById(id);
    const { categoryId, parentBrandId, ...rest } = input;
    return brandRepository.update(id, {
      ...rest,
      ...(categoryId && { category: { connect: { id: categoryId } } }),
      ...(parentBrandId !== undefined && {
        parentBrand: parentBrandId ? { connect: { id: parentBrandId } } : { disconnect: true },
      }),
    });
  },

  async remove(id: string) {
    await this.getById(id);
    return brandRepository.softDelete(id);
  },
};
