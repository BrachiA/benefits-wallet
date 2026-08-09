import { AppError } from '../../lib/AppError';
import { cache } from '../../lib/cache';
import { issuerRepository } from './issuer.repository';
import type { CreateIssuerInput, ListIssuersQuery, UpdateIssuerInput } from './issuer.dto';

const CACHE_KEY = 'issuers:active';
const CACHE_TTL_SECONDS = 300; // 5 דקות — מנפיקים כמעט לא משתנים

export const issuerService = {
  async list(query: ListIssuersQuery, page: number, pageSize: number) {
    const { items, total } = await issuerRepository.findMany(query, (page - 1) * pageSize, pageSize);
    return { items, meta: { page, pageSize, total } };
  },

  async getById(id: string) {
    const issuer = await issuerRepository.findById(id);
    if (!issuer) throw AppError.notFound('Issuer', id);
    return issuer;
  },

  async create(input: CreateIssuerInput) {
    const issuer = await issuerRepository.create(input);
    await cache.del(CACHE_KEY); // invalidation — נתון בסיסי השתנה
    return issuer;
  },

  async update(id: string, input: UpdateIssuerInput) {
    await this.getById(id);
    const issuer = await issuerRepository.update(id, input);
    await cache.del(CACHE_KEY);
    return issuer;
  },

  async remove(id: string) {
    await this.getById(id);
    const result = await issuerRepository.softDelete(id);
    await cache.del(CACHE_KEY);
    return result;
  },
};
