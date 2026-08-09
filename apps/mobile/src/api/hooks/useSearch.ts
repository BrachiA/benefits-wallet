import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
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

// מחובר ישירות ל-GET /api/v1/search שנבנה בשלב 4 (search.service.ts):
// שאילתה אחת מחזירה תוצאות מ-5 סוגי ישות במקביל, בדיוק לפי שלב 8
// בתכנון (שם חנות, קטגוריה, מותג, כרטיס, מועדון, תגיות, מיקום).
export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => apiClient.get<SearchResults>(`/search?q=${encodeURIComponent(query)}&limitPerType=8`),
    enabled: query.trim().length >= 2, // נמנע משליחת בקשה על כל תו בודד
  });
}
