import { z } from 'zod';

const openingHoursSchema = z.record(
  z.object({ open: z.string(), close: z.string(), closed: z.boolean().optional() })
);

export const createStoreSchema = z.object({
  brandId: z.string().uuid(),
  name: z.string().min(1).max(150),
  address: z.string().optional(),
  cityId: z.string().uuid().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  phone: z.string().optional(),
  openingHours: openingHoursSchema.optional(),
  isActive: z.boolean().default(true),
});

export const updateStoreSchema = createStoreSchema.partial();

// bounding box search: "קרוב אליי" עם ריבוע פשוט מסביב לנקודה,
// כפי שהוחלט בשלב 1 — PostGIS רק אם יידרש בעתיד בהיקף גדול.
export const listStoresQuerySchema = z.object({
  brandId: z.string().uuid().optional(),
  cityId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
  minLat: z.coerce.number().optional(),
  maxLat: z.coerce.number().optional(),
  minLng: z.coerce.number().optional(),
  maxLng: z.coerce.number().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;
export type ListStoresQuery = z.infer<typeof listStoresQuerySchema>;
