export type Program = {
  id: string;
  name: string;
  type: string;
  logoUrl?: string;
  color?: string;
  issuer?: { name: string; logoUrl?: string };
};

export type Benefit = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  fullDescription?: string;
  imageUrl?: string;
  discountValue?: number;
  discountUnit?: 'PERCENT' | 'ILS' | 'POINTS';
  channel: 'ONLINE' | 'IN_STORE' | 'BOTH';
  requiresCoupon: boolean;
  isPopular: boolean;
  endDate?: string;
  category?: { id: string; name: string; iconName?: string };
  tags?: { tag: { name: string } }[];
};

export type Category = {
  id: string;
  name: string;
  iconName?: string;
  parentId?: string;
};
