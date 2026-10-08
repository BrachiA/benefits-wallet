import { randomUUID } from 'crypto';
import { AppError } from '../../lib/AppError';
import { recordAudit } from '../../lib/auditLog';
import { uploadImageBuffer } from '../../lib/r2Storage';
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
    const existing = await this.getById(id);
    const { categoryId, parentBrandId, ...rest } = input;
    const brand = await brandRepository.update(id, {
      ...rest,
      ...(categoryId && { category: { connect: { id: categoryId } } }),
      ...(parentBrandId !== undefined && {
        parentBrand: parentBrandId ? { connect: { id: parentBrandId } } : { disconnect: true },
      }),
      // ראו הערה מקבילה ב-program.service.update — אותה זרימת חזרה
      // ל-AUTO מאפסת defaultLogoUrl/logoSearchedAt לחיפוש מחדש.
      ...(input.logoMode === 'AUTO' && existing.logoMode !== 'AUTO' && { defaultLogoUrl: null, logoSearchedAt: null }),
    });
    await recordAudit({ entityType: 'Brand', entityId: id, action: 'UPDATE', changedFields: input });
    return brand;
  },

  // ראו הערה מקבילה ב-program.service.uploadManualLogo.
  async uploadManualLogo(id: string, buffer: Buffer, mimeType: string) {
    await this.getById(id);
    const publicUrl = await uploadImageBuffer(buffer, `logos/brand/manual/${id}-${randomUUID()}`, mimeType);
    const brand = await brandRepository.update(id, {
      defaultLogoUrl: publicUrl,
      logoMode: 'MANUAL',
      logoSearchedAt: new Date(),
    });
    await recordAudit({
      entityType: 'Brand',
      entityId: id,
      action: 'UPDATE',
      changedFields: { defaultLogoUrl: publicUrl, logoMode: 'MANUAL', uploadedManually: true },
    });
    return brand;
  },

  async remove(id: string) {
    await this.getById(id);
    const result = await brandRepository.softDelete(id);
    await recordAudit({ entityType: 'Brand', entityId: id, action: 'DELETE' });
    return result;
  },
};
