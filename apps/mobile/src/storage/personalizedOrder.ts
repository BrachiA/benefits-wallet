import type { CategoryInterest } from './userSelection';

// ============================================================
// "סדר רנדומלי עם העדפה לסוג הדברים שהמשתמשת מחפשת/צופה יותר"
// (שלב 6). מבוסס על weighted random sampling: לכל פריט מוגרל מפתח
// אקראי בטווח (0,1) בחזקת 1/משקל, וממיינים לפי המפתח (יורד). זו
// שיטה סטנדרטית ל"ערבוב משוקלל" — משקל גבוה יותר מטה סטטיסטית
// לדירוג גבוה יותר, בלי לקבוע סדר קשיח (המפתח עדיין אקראי).
//
// המשקל הוא לוגריתמי מהמונה (1 + log2(1+count)), לא המונה עצמו:
// קטגוריה שנצפתה 50 פעם לא אמורה לדחוק לגמרי קטגוריה שנצפתה
// פעם אחת — "שמור על גיוון" מהספק. ההבדל בין 0 ל-1 צפיות
// משמעותי יותר מההבדל בין 40 ל-50.
// ============================================================

function weightFor(categoryId: string | undefined, interest: CategoryInterest): number {
  if (!categoryId) return 1;
  const count = interest[categoryId] ?? 0;
  return 1 + Math.log2(1 + count);
}

export function personalizedOrder<T>(
  items: T[],
  getCategoryId: (item: T) => string | undefined,
  interest: CategoryInterest
): T[] {
  return items
    .map((item) => {
      const weight = weightFor(getCategoryId(item), interest);
      // Math.random() ב-(0,1) פתוח: מונע 0**(1/weight)=0 שהיה תוקע
      // פריט בתחתית באופן דטרמיניסטי.
      const key = Math.pow(Math.random() || Number.EPSILON, 1 / weight);
      return { item, key };
    })
    .sort((a, b) => b.key - a.key)
    .map(({ item }) => item);
}
