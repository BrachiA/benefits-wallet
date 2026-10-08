// מימוש שלב 9 בתכנון: "אם יש שתי הטבות דומות, הצג השוואה" —
// מתפרש (לפי הדיון) כתצוגה מקובצת לפי סוג-על, כל קבוצה ממוינת
// בנפרד, ולא כניקוד יחיד שמשווה אחוזים למתנות. זה נמנע מהבעיה
// המהותית (תמחור כוזב של הטבות לא-כספיות) בכך שהוא פשוט לא
// משווה ביניהן.

export type BenefitGroupKey = 'PERCENT' | 'NONCASH' | 'POINTS' | 'OTHER';

// סדר הקבוצות עצמן: קבוע ומוצהר, לא נגזר מתוכן. הוסכם במפורש:
// אחוזים -> לא-כספי -> נקודות -> אחר.
export const GROUP_DISPLAY_ORDER: BenefitGroupKey[] = ['PERCENT', 'NONCASH', 'POINTS', 'OTHER'];

export const GROUP_LABELS: Record<BenefitGroupKey, string> = {
  PERCENT: 'הנחות',
  NONCASH: 'מבצעים',
  POINTS: 'נקודות',
  OTHER: 'אחר',
};

export function resolveBenefitGroup(benefitType: string): BenefitGroupKey {
  if (benefitType === 'DISCOUNT_PERCENT' || benefitType === 'DISCOUNT_FIXED' || benefitType === 'CASHBACK') {
    return 'PERCENT';
  }
  if (benefitType === 'TWO_FOR_ONE' || benefitType === 'FREE_SHIPPING' || benefitType === 'GIFT') {
    return 'NONCASH';
  }
  if (benefitType === 'POINTS') return 'POINTS';
  return 'OTHER';
}

// עדיפות-פנימית בתוך קבוצת NONCASH בלבד: הוסכם במפורש
// 1+1 -> משלוח חינם -> מתנה. מספר נמוך יותר = עדיפות גבוהה יותר.
const NONCASH_TYPE_PRIORITY: Record<string, number> = {
  TWO_FOR_ONE: 1,
  FREE_SHIPPING: 2,
  GIFT: 3,
};

// "חדש" הוא badge חוצה-קבוצות, לא סדר מיון: הטבה שנכנסה לתוקף
// (startDate) בשבוע האחרון — לא הטבה שרק נוצרה/עודכנה במערכת.
// startDate הוא אופציונלי (הטבה יכולה להיות תקפה בלי תאריך התחלה
// מפורש), ואז createdAt הוא הגיבוי היחיד שיש לנו ל"מתי היא בעצם
// הופיעה". הפילטר לפי "חדש" מופעל בנפרד ע"י הקליינט (isNewOnly),
// לא משנה את סדר ברירת המחדל כאן.
const NEW_THRESHOLD_DAYS = 7;

export function isNewBenefit(startDate: Date | null, createdAt: Date): boolean {
  const cutoff = Date.now() - NEW_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  const effectiveDate = startDate ?? createdAt;
  return effectiveDate.getTime() >= cutoff;
}

type SortableBenefit = {
  benefitType: string;
  valueScore: number;
  priority: number;
};

// ממיין הטבות בתוך קבוצה בודדת. PERCENT לפי valueScore (חישוב
// כספי אמיתי). NONCASH לפי עדיפות-הסוג הקבועה, ואז priority
// ידני כ-tiebreaker. POINTS/OTHER לפי priority בלבד — אין להם
// שום בסיס לתמחור אוטומטי, כפי שהוסכם.
//
// גנרית ב-T (ולא רק SortableBenefit): כך אובייקט Benefit מלא
// מ-Prisma (עם id/title/category/וכו') שומר את כל שדותיו אחרי
// המיון, ולא מצטמצם בטעות לטיפוס המצומצם ברמת ה-type system.
export function sortWithinGroup<T extends SortableBenefit>(benefits: T[], group: BenefitGroupKey): T[] {
  const sorted = [...benefits];

  if (group === 'PERCENT') {
    return sorted.sort((a, b) => b.valueScore - a.valueScore);
  }

  if (group === 'NONCASH') {
    return sorted.sort((a, b) => {
      const priorityA = NONCASH_TYPE_PRIORITY[a.benefitType] ?? 99;
      const priorityB = NONCASH_TYPE_PRIORITY[b.benefitType] ?? 99;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return b.priority - a.priority;
    });
  }

  return sorted.sort((a, b) => b.priority - a.priority);
}
