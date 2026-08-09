import { z } from 'zod';

export const createCouponSchema = z.object({
  benefitId: z.string().uuid(),
  code: z.string().min(1).max(50),
  type: z.enum(['SINGLE_USE_SHARED', 'UNIQUE_PER_USER']).default('SINGLE_USE_SHARED'),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.coerce.date().optional(),
  isActive: z.boolean().default(true),
});

export const updateCouponSchema = createCouponSchema.partial().omit({ benefitId: true });

export const listCouponsQuerySchema = z.object({
  benefitId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
export type ListCouponsQuery = z.infer<typeof listCouponsQuerySchema>;
