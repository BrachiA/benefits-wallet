import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiClient } from '../client';
import { userSelectionStorage } from '../../storage/userSelection';
import type { Benefit } from '../types';

type Brand = { id: string; name: string; category?: { name: string } };
type Program = { id: string; name: string; issuer?: { name: string } };
type Category = { id: string; name: string };
type Store = { id: string; name: string; brand?: { name: string }; city?: { name: string } };

export type SearchResults = {
  benefits: Benefit[];
  brands: Brand[];
  programs: Program[];
  categories: Category[];
  stores: Store[];
};

// מחובר ישירות ל-GET /api/v1/search (search.service.ts): שאילתה
// אחת מחזירה תוצאות מ-5 סוגי ישות במקביל, בדיוק לפי שלב 8 בתכנון
// (שם חנות, קטגוריה, מותג, כרטיס, מועדון, תגיות, מיקום).
//
// programIds נשלחים כדי שתוצאות ההטבות יסוננו לפי הזכאות של
// המשתמשת, כמו בכל שאר המסכים. קודם לכן החיפוש היה המסך היחיד
// שהחזיר גם הטבות שאינן מגיעות לה.
export function useSearch(query: string) {
  const [programIds, setProgramIds] = useState<string[] | null>(null);

  useEffect(() => {
    userSelectionStorage.get().then((s) => setProgramIds(s.programIds));
  }, []);

  return useQuery({
    queryKey: ['search', query, programIds],
    queryFn: () => {
      const params = new URLSearchParams({ q: query, limitPerType: '8' });
      if (programIds?.length) params.set('programIds', programIds.join(','));
      return apiClient.get<SearchResults>(`/search?${params.toString()}`);
    },
    // נמנע משליחת בקשה על כל תו בודד, וממתין לטעינת הבחירה מהאחסון
    // כדי שהתוצאה הראשונה לא תהיה רגעית לא-מסוננת.
    enabled: query.trim().length >= 2 && programIds !== null,
  });
}
