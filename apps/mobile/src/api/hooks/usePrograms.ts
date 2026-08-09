import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { Program } from '../types';

export function usePrograms() {
  return useQuery({
    queryKey: ['programs'],
    queryFn: () => apiClient.get<Program[]>('/programs?pageSize=200&isActive=true'),
    // מועדונים כמעט לא משתנים — עקבי עם ההחלטה ב-backend/lib/cache.ts
    // ש-Program הוא מועמד ראשון ל-cache. staleTime ארוך חוסך קריאות
    // מיותרות בכל פתיחת אפליקציה.
    staleTime: 1000 * 60 * 30,
  });
}
