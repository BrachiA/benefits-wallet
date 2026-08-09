import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { Benefit } from '../types';

export type BenefitGroupKey = 'PERCENT' | 'NONCASH' | 'POINTS' | 'OTHER';

export type GroupedBenefit = Benefit & { isNew: boolean };

export type BenefitGroup = {
  group: BenefitGroupKey;
  label: string;
  benefits: GroupedBenefit[];
};

type Options = { brandId?: string; categoryId?: string; isNewOnly?: boolean };

// מחובר ל-GET /api/v1/recommendations/grouped שנבנה כרגע ב-backend.
// זהו המימוש בפועל של שלב 9: התוצאה כבר מגיעה מקובצת וממוינת
// לפי הסדר שהוסכם (אחוזים -> מבצעים -> נקודות -> אחר) — הקליינט
// לא מיישם שום לוגיקת מיון/קיבוץ בעצמו, רק מרנדר את מה שחוזר.
export function useGroupedRecommendations(options: Options) {
  const hasAnchor = Boolean(options.brandId || options.categoryId);

  return useQuery({
    queryKey: ['recommendations-grouped', options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options.brandId) params.set('brandId', options.brandId);
      if (options.categoryId) params.set('categoryId', options.categoryId);
      if (options.isNewOnly) params.set('isNewOnly', 'true');
      const result = await apiClient.get<{ groups: BenefitGroup[] }>(`/recommendations/grouped?${params.toString()}`);
      return result.groups;
    },
    // בלי brandId או categoryId השרת מחזיר groups: [] ממילא (ראו
    // recommendation.service.ts) — enabled חוסך את קריאת הרשת המיותרת.
    enabled: hasAnchor,
  });
}
