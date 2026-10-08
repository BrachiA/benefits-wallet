export type Category = { id: string; name: string };
export type Program = { id: string; name: string; issuer?: { name: string } };
export type Brand = { id: string; name: string };
export type Store = { id: string; name: string; brand?: { name: string } };

export type BenefitScope = {
  id?: string;
  programId?: string;
  brandId?: string;
  storeId?: string;
  cityId?: string;
};

export type Benefit = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  categoryId: string;
  category?: Category;
  benefitType: string;
  discountValue?: number;
  discountUnit?: 'PERCENT' | 'ILS' | 'POINTS';
  imageUrl?: string;
  isActive: boolean;
  isPopular: boolean;
  isFeatured: boolean;
  priority: number;
  // ISO. נדרשים כדי להסביר במסך הניהול *למה* הטבה אינה גלויה
  // כרגע — "פג תוקף" ו"טרם התחילה" הן סיבות שונות מ"כבויה".
  startDate?: string;
  endDate?: string;
  scopes: BenefitScope[];
};

export const benefitTypeLabels: Record<string, string> = {
  DISCOUNT_PERCENT: 'הנחה באחוזים',
  DISCOUNT_FIXED: 'הנחה בסכום קבוע',
  CASHBACK: 'קאשבק',
  POINTS: 'נקודות',
  GIFT: 'מתנה',
  TWO_FOR_ONE: '1+1',
  FREE_SHIPPING: 'משלוח חינם',
  OTHER: 'אחר',
};
