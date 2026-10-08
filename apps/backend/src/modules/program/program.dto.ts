import { z } from 'zod';

export const programTypeEnum = z.enum(['CREDIT_CARD', 'CUSTOMER_CLUB', 'EMPLOYEE_CLUB', 'RETAILER_CLUB', 'OTHER']);
export const logoModeEnum = z.enum(['AUTO', 'MANUAL']);

export const createProgramSchema = z.object({
  issuerId: z.string().uuid(),
  parentProgramId: z.string().uuid().optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(150),
  shortName: z.string().optional(),
  type: programTypeEnum,
  logoUrl: z.string().url().optional(),
  cardImageUrl: z.string().url().optional(),
  color: z.string().optional(),
  description: z.string().optional(),
  joinUrl: z.string().url().optional(),
  termsUrl: z.string().url().optional(),
  annualFee: z.number().nonnegative().optional(),
  metadata: z.record(z.unknown()).optional(),
  isActive: z.boolean().default(true),
  isPopular: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  // ה-toggle "לוגו אוטומטי/ידני" (חלק ד' של משימת אחסון התמונות).
  // defaultLogoUrl עצמו *לא* נחשף כאן בכוונה — הוא מוגדר רק דרך
  // סבב החיפוש האוטומטי (modules/logoSearch) או POST /:id/logo
  // (העלאה ידנית, program.controller.uploadLogo), לא כטקסט חופשי
  // ב-PATCH רגיל.
  logoMode: logoModeEnum.optional(),
});

export const updateProgramSchema = createProgramSchema.partial();

export const listProgramsQuerySchema = z.object({
  issuerId: z.string().uuid().optional(),
  type: programTypeEnum.optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export type CreateProgramInput = z.infer<typeof createProgramSchema>;
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;
export type ListProgramsQuery = z.infer<typeof listProgramsQuerySchema>;
