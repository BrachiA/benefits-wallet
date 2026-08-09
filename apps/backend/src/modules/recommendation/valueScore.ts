// מחשב valueScore (0-100) עבור הטבה בודדת. זהו המימוש בפועל של
// השדה שהוגדר ריק ב-schema.prisma משלב 3 עם ההערה "מחושב בשכבת
// ה-Service, לא מוזן ידנית". נקרא מ-benefit.service בכל create/update.
//
// עיקרון מרכזי (הוסכם בדיון): רק DISCOUNT_PERCENT/DISCOUNT_FIXED/
// CASHBACK מקבלים ציון "אמיתי" שמבטא אחוז חיסכון משוער. כל שאר
// הסוגים (GIFT/TWO_FOR_ONE/FREE_SHIPPING/POINTS/OTHER) אינם
// מתומחרים כלל — הם ממוינים בנפרד לגמרי דרך benefitGroup.ts,
// ו-valueScore שלהם הוא 0 ולא נצרך בקיבוץ הלא-כספי.

// ערך קנייה משוער לפי קטגוריה, לשימוש רק כשל-Benefit אין
// minPurchaseAmount משלה. מספרים אלו הם הערכה שרירותית מוצהרת,
// לא מדידה — קיימים כדי לתת בסיס-נרמול סביר, לא כאמת מוחלטת.
// ניתן לכייל בעתיד לפי קטגוריה אמיתית מה-DB.
const DEFAULT_BASE_AMOUNT_BY_CATEGORY_SLUG: Record<string, number> = {
  fashion: 150,
  'fashion-shoes': 150,
  food: 300,
  electronics: 800,
  dining: 100,
};
const FALLBACK_BASE_AMOUNT = 200;

type ValueScoreInput = {
  benefitType: string;
  discountValue: number | null | undefined;
  discountUnit: 'PERCENT' | 'ILS' | 'POINTS' | null | undefined;
  minPurchaseAmount: number | null | undefined;
  categorySlug?: string | null;
};

export function calculateValueScore(input: ValueScoreInput): number {
  const { benefitType, discountValue, discountUnit } = input;

  // רק שלושת הסוגים הכספיים מתומחרים. כל השאר (כולל POINTS,
  // ששער ההמרה שלו תלוי-תוכנית ולא ידוע ל-DB) מקבלים 0 במכוון —
  // הם לא משתתפים בהשוואה הזו כלל, ראו benefitGroup.ts.
  const isCashType = benefitType === 'DISCOUNT_PERCENT' || benefitType === 'DISCOUNT_FIXED' || benefitType === 'CASHBACK';
  if (!isCashType || discountValue === null || discountValue === undefined) return 0;

  // הנחה שכבר מבוטאת כאחוז: הציון הוא הערך עצמו, אין נרמול נדרש.
  if (discountUnit === 'PERCENT') {
    return clamp(discountValue);
  }

  // הנחה/קאשבק בסכום קבוע (₪): ממירים ל"אחוז חיסכון משוער" לפי
  // בסיס קנייה. minPurchaseAmount של ההטבה עצמה עדיף תמיד — הוא
  // נתון אמיתי, לא ניחוש. רק בהיעדרו נופלים לברירת מחדל לפי קטגוריה.
  const baseAmount =
    input.minPurchaseAmount ??
    (input.categorySlug ? DEFAULT_BASE_AMOUNT_BY_CATEGORY_SLUG[input.categorySlug] : undefined) ??
    FALLBACK_BASE_AMOUNT;

  const estimatedPercent = (discountValue / baseAmount) * 100;
  return clamp(estimatedPercent);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
