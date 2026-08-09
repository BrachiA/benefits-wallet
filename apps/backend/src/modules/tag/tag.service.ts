import { AppError } from '../../lib/AppError';
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
    return tagRepository.create(input);
  },

  async update(id: string, input: UpdateTagInput) {
    await this.getById(id);
    return tagRepository.update(id, input);
  },

  async remove(id: string) {
    await this.getById(id);
    return tagRepository.softDelete(id);
  },
};
