import type { MatchResult, RawScrapedFields } from './matching.service';

export type ConfidenceResult = { score: number; reasons: string[] };

// סף פרסום אוטומטי: מתחת לזה, הפריט חייב לעבור דרך תור בדיקה למנהל.
// קבוע יחיד ומרוכז — קל לכייל בלי לחפש בקוד.
export const AUTO_PUBLISH_THRESHOLD = 70;

// ---- ניכוי על שינוי בערך ההנחה ----
//
// שינוי מתחת ליחס הזה נחשב עדכון שגרתי ואינו מנוכה כלל. יחס 1.5
// שקול לשינוי של 50% מהערך הקודם — אותו סף שהיה כאן קודם.
const ROUTINE_CHANGE_RATIO = 1.5;
// מקדם הניכוי הלוגריתמי. נבחר כך ששינוי של פי ~2.3 ומעלה כבר מוריד
// את הציון מתחת לסף הפרסום האוטומטי.
const VALUE_CHANGE_WEIGHT = 25;
const MIN_VALUE_CHANGE_DEDUCTION = 10;
const MAX_VALUE_CHANGE_DEDUCTION = 60;

// הניכוי יחסי לגודל השינוי ולא קבוע. הגרסה הקודמת ניכתה 25 נקודות
// על כל שינוי מעל 50%, כך ש-10→15 ו-10→90 קיבלו בדיוק אותו טיפול,
// ושתיהן נשארו על 75 — מעל סף הפרסום האוטומטי. כלומר שינוי של פי 9
// התפרסם בלי אדם בלולאה, בניגוד לכוונת הכלל.
//
// לוגריתמי ולא ליניארי: מה שמעניין הוא סדר הגודל של הקפיצה (פי 2,
// פי 4, פי 9) ולא ההפרש המוחלט, וכך הכלל מתנהג זהה על הנחות של 10%
// ושל 1000 ש"ח. סימטרי בכוונה — ירידה חדה חשודה כמו עלייה חדה.
function valueChangeDeduction(previous: number, next: number): number {
  if (previous === next) return 0;

  // מעבר אל/מ-אפס אינו ניתן לביטוי כיחס, והוא תמיד קפיצה מהותית.
  if (previous === 0 || next === 0) return MAX_VALUE_CHANGE_DEDUCTION;

  const ratio = Math.max(previous / next, next / previous);
  if (ratio < ROUTINE_CHANGE_RATIO) return 0;

  const raw = Math.round(VALUE_CHANGE_WEIGHT * Math.log2(ratio));
  return Math.max(MIN_VALUE_CHANGE_DEDUCTION, Math.min(MAX_VALUE_CHANGE_DEDUCTION, raw));
}

export const confidenceService = {
  // מחשב ציון 0-100 + נימוקים קריאים לאדם (מוצגים בדשבורד תחת "why
  // flagged"). כל כלל מנוקד בנפרד ומצטבר כניכוי מ-100, כדי שאפשר
  // יהיה להבין בדיוק למה פריט ספציפי סומן.
  calculate(matchResult: MatchResult, fields: RawScrapedFields, previousValue?: number): ConfidenceResult {
    const reasons: string[] = [];
    let score = 100;

    // כלל 1: הטבה חדשה לגמרי. שלב 5 (א.2) פתח את הדלת לפרסום
    // אוטומטי של הטבה חדשה כשיש למקור עוגן שיוך תקין (defaultProgramId/
    // defaultBrandId + defaultCategoryId) — לכן הניכוי ירד מ-40 ל-20,
    // כדי שהטבה מושלמת (100) תוכל לעבור את סף ה-70 (100-20=80).
    // הטבה עם עוד בעיה (למשל ערך הנחה חסר, 65) עדיין נופלת לתור.
    if (matchResult.kind === 'NEW') {
      reasons.push('הטבה חדשה שלא זוהתה במערכת — דורשת שיוך תקין כדי להתפרסם אוטומטית');
      score -= 20;
    }

    // כלל 2: שדה קריטי חסר (כותרת ריקה, אין שום ערך כספי/נקודות)
    if (!fields.title || fields.title.trim().length < 3) {
      reasons.push('כותרת חסרה או קצרה מדי');
      score -= 30;
    }
    if (fields.discountValue === undefined) {
      reasons.push('לא נמצא ערך הנחה בדף המקור');
      score -= 15;
    }

    // כלל 3: שינוי ערך חד מהערך הקודם — עלול להעיד על טעות סריקה
    // (למשל: פרסר תפס "50" מתוך "1 מתוך 50 קופונים" ולא את ה-10%
    // האמיתיים) ולא על מבצע אמיתי. הניכוי גדל עם סדר הגודל של
    // השינוי, ראו valueChangeDeduction.
    if (matchResult.kind === 'UPDATE' && previousValue !== undefined && fields.discountValue !== undefined) {
      const deduction = valueChangeDeduction(previousValue, fields.discountValue);
      if (deduction > 0) {
        const changePercent =
          previousValue === 0 ? 100 : (Math.abs(fields.discountValue - previousValue) / previousValue) * 100;
        reasons.push(`שינוי חד בערך ההנחה: ${previousValue} -> ${fields.discountValue} (${changePercent.toFixed(0)}%)`);
        score -= deduction;
      }
    }

    // כלל 4: externalId חסר או לא יציב (חשוד כ-selector שנשבר)
    if (!fields.externalId) {
      reasons.push('לא נמצא מזהה יציב לפריט');
      score -= 20;
    }

    score = Math.max(0, Math.min(100, score));
    return { score, reasons };
  },

  // hasAutoScopeAnchor: האם למקור יש עוגן שיוך תקין (defaultProgramId
  // או defaultBrandId, וגם defaultCategoryId). הטבה *חדשה* דורשת אותו
  // כדי להתפרסם אוטומטית — בלעדיו אין למי לשייך אותה ואין לה קטגוריה,
  // ושני אלה חובה על Benefit. עדכון להטבה קיימת אינו תלוי בעוגן,
  // כי היא כבר משויכת.
  shouldAutoPublish(confidence: ConfidenceResult, matchResult: MatchResult, hasAutoScopeAnchor: boolean): boolean {
    if (matchResult.kind === 'UNCHANGED') return true; // אין שינוי בפועל, אין מה לאשר
    if (matchResult.kind === 'NEW' && !hasAutoScopeAnchor) return false;
    return confidence.score >= AUTO_PUBLISH_THRESHOLD;
  },
};
