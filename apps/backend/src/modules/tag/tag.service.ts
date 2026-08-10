import { AppError } from '../../lib/AppError';
import { recordAudit } from '../../lib/auditLog';
import { tagRepository } from './tag.repository';
import type { CreateTagInput, ListTagsQuery, UpdateTagInput } from './tag.dto';

export const tagService = {
  async list(query: ListTagsQuery, page: number, pageSize: number) {
    const { items, total } = await tagRepository.findMany(query, (page - 1) * pageSize, pageSize);
    return { items, meta: { page, pageSize, total } };
  },

  async getById(id: string) {
    const tag = await tagRepository.findById(id);
    if (!tag) throw AppError.notFound('Tag', id);
    return tag;
  },

  async create(input: CreateTagInput) {
    const tag = await tagRepository.create(input);
    await recordAudit({ entityType: 'Tag', entityId: tag.id, action: 'CREATE', changedFields: input });
    return tag;
  },

  async update(id: string, input: UpdateTagInput) {
    await this.getById(id);
    const tag = await tagRepository.update(id, input);
    await recordAudit({ entityType: 'Tag', entityId: id, action: 'UPDATE', changedFields: input });
    return tag;
  },

  async remove(id: string) {
    await this.getById(id);
    const result = await tagRepository.softDelete(id);
    await recordAudit({ entityType: 'Tag', entityId: id, action: 'DELETE' });
    return result;
  },
};
