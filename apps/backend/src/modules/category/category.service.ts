import { AppError } from '../../lib/AppError';
import { cache } from '../../lib/cache';
import { recordAudit } from '../../lib/auditLog';
import { categoryRepository } from './category.repository';
import type { CreateCategoryInput, ListCategoriesQuery, UpdateCategoryInput } from './category.dto';

const CACHE_KEY = 'categories:all';

export const categoryService = {
  async list(query: ListCategoriesQuery, page: number, pageSize: number) {
    const { items, total } = await categoryRepository.findMany(query, (page - 1) * pageSize, pageSize);
    return { items, meta: { page, pageSize, total } };
  },

  async getById(id: string) {
    const category = await categoryRepository.findById(id);
    if (!category) throw AppError.notFound('Category', id);
    return category;
  },

  async create(input: CreateCategoryInput) {
    const path = await this.resolvePath(input.slug, input.parentId);
    const { parentId, ...rest } = input;
    const category = await categoryRepository.create({
      ...rest,
      path,
      ...(parentId && { parent: { connect: { id: parentId } } }),
    });
    await cache.del(CACHE_KEY);
    await recordAudit({ entityType: 'Category', entityId: category.id, action: 'CREATE', changedFields: input });
    return category;
  },

  async update(id: string, input: UpdateCategoryInput) {
    const existing = await this.getById(id);
    let path: string | undefined;
    if (input.slug || input.parentId !== undefined) {
      path = await this.resolvePath(
        input.slug ?? existing.slug,
        input.parentId !== undefined ? input.parentId : (existing.parentId ?? undefined)
      );
    }
    const { parentId, ...rest } = input;
    const category = await categoryRepository.update(id, {
      ...rest,
      ...(path && { path }),
      ...(parentId !== undefined && {
        parent: parentId ? { connect: { id: parentId } } : { disconnect: true },
      }),
    });
    await cache.del(CACHE_KEY);
    await recordAudit({ entityType: 'Category', entityId: id, action: 'UPDATE', changedFields: input });
    return category;
  },

  async remove(id: string) {
    await this.getById(id);
    const result = await categoryRepository.softDelete(id);
    await cache.del(CACHE_KEY);
    await recordAudit({ entityType: 'Category', entityId: id, action: 'DELETE' });
    return result;
  },

  async resolvePath(slug: string, parentId?: string): Promise<string> {
    if (!parentId) return slug;
    const parent = await categoryRepository.findByIdRaw(parentId);
    if (!parent) throw AppError.validation(`parentId ${parentId} not found`);
    return `${parent.path}/${slug}`;
  },
};
