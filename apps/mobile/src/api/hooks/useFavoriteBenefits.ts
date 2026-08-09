import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiClient } from '../client';
import { userSelectionStorage } from '../../storage/userSelection';
import type { Benefit } from '../types';

// שונה מ-useBenefits: לא מסנן לפי programIds (Scope-matching), אלא
// שולף הטבות ספציפיות לפי ID. הטבה יכולה להישאר במועדפים גם אם
// המשתמש כבר לא מחזיק בכרטיס שנתן לה גישה — ההצגה כאן היא "מה
// סימנתי", לא "מה תקף לי עכשיו".
export function useFavoriteBenefits() {
  const [favoriteIds, setFavoriteIds] = useState<string[] | null>(null);

  useEffect(() => {
    userSelectionStorage.get().then((s) => setFavoriteIds(s.favoriteBenefitIds));
  }, []);

  return useQuery({
    queryKey: ['favorite-benefits', favoriteIds],
    queryFn: async () => {
      if (!favoriteIds || favoriteIds.length === 0) return [] as Benefit[];
      // אין endpoint ל"שלוף לפי רשימת IDs" בשלב 4 — פותרים עם
      // בקשות מקבילות בודדות. אם רשימת המועדפים תגדל משמעותית,
      // זו נקודת שדרוג טבעית ל-endpoint /benefits?ids=... בעתיד.
      const results = await Promise.all(
        favoriteIds.map((id) => apiClient.get<Benefit>(`/benefits/${id}`).catch(() => null))
      );
      return results.filter((b): b is Benefit => b !== null);
    },
    enabled: favoriteIds !== null,
  });
}
