export type Brand = { id: string; name: string };
export type City = { id: string; name: string };

export type Store = {
  id: string;
  name: string;
  address?: string;
  brandId: string;
  brand?: Brand;
  cityId?: string;
  city?: City;
  phone?: string;
  isActive: boolean;
};
