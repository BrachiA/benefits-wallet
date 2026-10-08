export type Program = {
  id: string;
  name: string;
  type: string;
  logoUrl?: string;
  color?: string;
  issuer?: { name: string; logoUrl?: string };
  // לוגו ברירת המחדל שנשמר ב-Cloudflare R2 (נמצא אוטומטית ע"י AI
  // או הועלה ידנית בדשבורד) — ראו backend/src/lib/r2Storage.ts.
  // מועדף על logoUrl כי הוא מאוחסן אצלנו ולא קישור חיצוני שעלול
  // להישבר.
  defaultLogoUrl?: string | null;
};

export type Brand = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  defaultLogoUrl?: string | null;
};

// שורת שיוך: למי ההטבה תקפה. מגיעה מה-API עם brand/program מלאים
// (ראו backend/src/modules/benefit/benefit.repository.ts — include
// scopes.brand/program), ולכן אפשר לגזור ממנה את "החנויות שיש בהן
// הנחות" בלי קריאת רשת נוספת.
export type BenefitScope = {
  id: string;
  brand?: Brand | null;
  program?: Program | null;
};

export type Benefit = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  fullDescription?: string;
  imageUrl?: string;
  // עותק התמונה שמאוחסן אצלנו ב-R2 (או לוגו ברירת המחדל של
  // המועדון/מותג כשלהטבה עצמה אין תמונה). מועדף על imageUrl.
  r2ImageUrl?: string | null;
  discountValue?: number;
  discountUnit?: 'PERCENT' | 'ILS' | 'POINTS';
  benefitType?:
    | 'DISCOUNT_PERCENT'
    | 'DISCOUNT_FIXED'
    | 'CASHBACK'
    | 'POINTS'
    | 'GIFT'
    | 'TWO_FOR_ONE'
    | 'FREE_SHIPPING'
    | 'OTHER';
  channel: 'ONLINE' | 'IN_STORE' | 'BOTH';
  requiresCoupon: boolean;
  isPopular: boolean;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  category?: { id: string; name: string; iconName?: string; slug?: string };
  tags?: { tag: { name: string } }[];
  scopes?: BenefitScope[];
};

export type Category = {
  id: string;
  name: string;
  // ה-slug הוא המפתח למיפוי האיור (components/illustrations) — שם
  // עברי עלול להשתנות בדשבורד, slug הוא מזהה יציב.
  slug?: string;
  iconName?: string;
  parentId?: string;
};
