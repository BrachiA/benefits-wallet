import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { Category } from '../types';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.get<Category[]>('/categories?pageSize=200&isActive=true'),
    staleTime: 1000 * 60 * 30,
  });
}
