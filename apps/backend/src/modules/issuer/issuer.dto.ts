import { z } from 'zod';

export const createIssuerSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(100),
  nameEn: z.string().optional(),
  logoUrl: z.string().url().optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'must be a hex color')
    .optional(),
  websiteUrl: z.string().url().optional(),
  supportPhone: z.string().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const updateIssuerSchema = createIssuerSchema.partial();

export const listIssuersQuerySchema = z.object({
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export type CreateIssuerInput = z.infer<typeof createIssuerSchema>;
export type UpdateIssuerInput = z.infer<typeof updateIssuerSchema>;
export type ListIssuersQuery = z.infer<typeof listIssuersQuerySchema>;
