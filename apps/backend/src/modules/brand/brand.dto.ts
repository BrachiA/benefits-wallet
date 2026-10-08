import { z } from 'zod';

export const logoModeEnum = z.enum(['AUTO', 'MANUAL']);

export const createBrandSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(150),
  nameEn: z.string().optional(),
  parentBrandId: z.string().uuid().optional(),
  categoryId: z.string().uuid(),
  logoUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
  websiteUrl: z.string().url().optional(),
  onlineShopUrl: z.string().url().optional(),
  description: z.string().optional(),
  hasOnlineStore: z.boolean().default(false),
  hasPhysicalStores: z.boolean().default(false),
  searchKeywords: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  // ראו הערה מקבילה ב-program.dto.ts — אותה זרימת toggle אוטומטי/ידני.
  logoMode: logoModeEnum.optional(),
});

export const updateBrandSchema = createBrandSchema.partial();

export const listBrandsQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  parentBrandId: z.string().uuid().optional(),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
export type ListBrandsQuery = z.infer<typeof listBrandsQuerySchema>;
