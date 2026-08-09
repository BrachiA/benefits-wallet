import { z } from 'zod';

export const createCampaignSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  bannerImageUrl: z.string().url().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  // רשימת הטבות + סדר תצוגה בתוך הקמפיין — נכתבת יחד עם היצירה,
  // בדיוק כמו scopes ב-Benefit.
  benefitIds: z.array(z.string().uuid()).default([]),
}).refine((data) => data.endDate > data.startDate, {
  message: 'endDate must be after startDate',
  path: ['endDate'],
});

export const updateCampaignSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  bannerImageUrl: z.string().url().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  benefitIds: z.array(z.string().uuid()).optional(),
});

export const listCampaignsQuerySchema = z.object({
  isActive: z.coerce.boolean().optional(),
  activeNow: z.coerce.boolean().optional(), // startDate <= now <= endDate
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type ListCampaignsQuery = z.infer<typeof listCampaignsQuerySchema>;
