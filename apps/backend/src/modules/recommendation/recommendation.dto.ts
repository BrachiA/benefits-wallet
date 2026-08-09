import { z } from 'zod';

// שאילתת ה"פוקס" מהדיון: brandId הוא העוגן העיקרי (המקרה שתואר —
// "משתמש כותב פוקס, המערכת מעלה קבוצות"), אך גם programId/
// categoryId נתמכים לגמישות עתידית (למשל "כל ההנחות שלי מ-MAX").
// isNewOnly ממש את פילטר ה"חדש" שהוסכם — לא סדר מיון, סינון נפרד.
export const groupedRecommendationsQuerySchema = z.object({
  brandId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  programIds: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : v.split(',')))
    .optional(),
  isNewOnly: z.coerce.boolean().optional(),
  limitPerGroup: z.coerce.number().int().positive().max(50).default(10),
});

export type GroupedRecommendationsQuery = z.infer<typeof groupedRecommendationsQuerySchema>;
