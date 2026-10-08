export type Brand = {
  id: string;
  slug: string;
  name: string;
  nameEn?: string;
  categoryId: string;
  category?: { name: string };
  parentBrandId?: string;
  parentBrand?: { id: string; name: string };
  hasOnlineStore: boolean;
  hasPhysicalStores: boolean;
  searchKeywords: string[];
  isActive: boolean;
  // ראו הערה מקבילה ב-types/program.ts.
  defaultLogoUrl?: string | null;
  logoMode: 'AUTO' | 'MANUAL';
};
