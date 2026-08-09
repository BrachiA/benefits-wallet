import { z } from 'zod';

// הערה: בפרויקט מלא, ה-Zod schemas האלה חיים ב-@benefits-wallet/shared
// (כפי שתוכנן בשלב 2) כדי שהדשבורד ישתמש באותם schemas לולידציית
// form. כאן, בתוך תיקיית ה-backend, לצורך המשכיות העצירה — אך
// יש להעביר קובץ זה ל-packages/shared/src/schemas בפועל.

export const benefitTypeEnum = z.enum([
  'DISCOUNT_PERCENT',
  'DISCOUNT_FIXED',
  'CASHBACK',
  'POINTS',
  'GIFT',
  'TWO_FOR_ONE',
  'FREE_SHIPPING',
  'OTHER',
]);

export const createBenefitSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'slug must be kebab-case'),
  title: z.string().min(1).max(200),
  shortDescription: z.string().min(1).max(300),
  fullDescription: z.string().optional(),
  categoryId: z.string().uuid(),
  benefitType: benefitTypeEnum,
  discountValue: z.number().positive().optional(),
  discountUnit: z.enum(['PERCENT', 'ILS', 'POINTS']).optional(),
  minPurchaseAmount: z.number().positive().optional(),
  maxDiscountAmount: z.number().positive().optional(),
  requiresCoupon: z.boolean().default(false),
  channel: z.enum(['ONLINE', 'IN_STORE', 'BOTH']).default('BOTH'),
  termsAndConditions: z.string().optional(),
  externalUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isPopular: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  priority: z.number().int().default(0),
  // Scope-ים נוצרים יחד עם ההטבה: כל אובייקט הוא צירוף AND,
  // מערך האובייקטים הוא OR ביניהם (בדיוק כפי שהוגדר בשלב 1).
  scopes: z
    .array(
      z.object({
        programId: z.string().uuid().optional(),
        brandId: z.string().uuid().optional(),
        storeId: z.string().uuid().optional(),
        cityId: z.string().uuid().optional(),
      })
    )
    .min(1, 'Benefit must have at least one scope'),
});

export const updateBenefitSchema = createBenefitSchema.partial().omit({ scopes: true });

export const listBenefitsQuerySchema = z.object({
  programIds: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : v.split(',')))
    .optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  isPopular: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
  sortBy: z.enum(['priority', 'valueScore', 'createdAt']).default('priority'),
});

export type CreateBenefitInput = z.infer<typeof createBenefitSchema>;
export type UpdateBenefitInput = z.infer<typeof updateBenefitSchema>;
export type ListBenefitsQuery = z.infer<typeof listBenefitsQuerySchema>;
