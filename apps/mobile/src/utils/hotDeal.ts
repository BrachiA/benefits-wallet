import type { Benefit } from '../api/types';

// ============================================================
// "מבצע חם" = הטבה שמגיעה ל-50% הנחה ומעלה, **בכל וריאציה שהיא**
// (הנחיית המוצר). לכן זו לא בדיקה אחת על discountValue אלא רשימת
// מסלולים שקולים:
//
//   1. הנחה באחוזים   — discountUnit=PERCENT, ערך >= 50
//   2. קאשבק באחוזים  — אותו סף; 50% חזרה שקול ל-50% הנחה בפועל
//   3. 1+1            — benefitType=TWO_FOR_ONE הוא 50% מהותית,
//                       גם כשאין לו discountValue מספרי בכלל
//
// מה שבמכוון *לא* נכנס: הנחה בשקלים (ILS) ונקודות. "₪100 הנחה"
// אינו 50% בלי לדעת את מחיר הבסיס — וזה שדה שלא קיים על Benefit.
// ניחוש כאן היה מסמן מבצע בינוני כ"חם" ושוחק את אמון המשתמשת
// בשורה כולה, שכל הערך שלה הוא שהיא באמת חריגה.
// ============================================================

export const HOT_DEAL_THRESHOLD_PERCENT = 50;

export function isHotDeal(benefit: Benefit): boolean {
  if (benefit.benefitType === 'TWO_FOR_ONE') return true;

  const isPercentBased =
    benefit.discountUnit === 'PERCENT' ||
    (benefit.benefitType === 'CASHBACK' && benefit.discountUnit !== 'ILS' && benefit.discountUnit !== 'POINTS');

  return isPercentBased && (benefit.discountValue ?? 0) >= HOT_DEAL_THRESHOLD_PERCENT;
}

// התווית שמוצגת על התג האדום בכרטיס החם. TWO_FOR_ONE מקבל ניסוח
// משלו ולא "50%", כי זה מה שכתוב בפועל על ההטבה בחנות.
export function hotDealLabel(benefit: Benefit): string {
  if (benefit.benefitType === 'TWO_FOR_ONE') return '1+1';
  if (benefit.discountValue != null) return `${benefit.discountValue}%`;
  return 'מבצע חם';
}
