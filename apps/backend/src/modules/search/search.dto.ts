import { z } from 'zod';

// חיפוש חוצה-ישויות: q הוא חובה, entityTypes מסנן אילו סוגי תוצאה
// להחזיר (ברירת מחדל: הכול). לא כולל pagination מלא בכוונה — תוצאת
// חיפוש-על היא top-N לכל סוג ישות, לא רשימה ממוספרת ארוכה.
export const searchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  entityTypes: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : v.split(',')))
    .pipe(z.array(z.enum(['benefit', 'brand', 'program', 'category', 'store'])))
    .optional(),
  limitPerType: z.coerce.number().int().positive().max(20).default(5),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
