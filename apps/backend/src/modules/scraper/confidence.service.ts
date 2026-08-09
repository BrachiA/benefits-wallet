import type { MatchResult, RawScrapedFields } from './matching.service';

export type ConfidenceResult = { score: number; reasons: string[] };

// סף פרסום אוטומטי: מתחת לזה, הפריט חייב לעבור דרך תור בדיקה למנהל.
// קבוע יחיד ומרוכז — קל לכייל בלי לחפש בקוד.
export const AUTO_PUBLISH_THRESHOLD = 70;

// אחוז שינוי בערך הנחה שנחשב "חשוד" ולא רק "עדכון שגרתי" (למשל
// אתר עדכן טעות דפוס קטנה מול שינוי שמרמז על שגיאת סריקה).
const SUSPICIOUS_VALUE_CHANGE_PERCENT = 50;

export const confidenceService = {
  // מחשב ציון 0-100 + נימוקים קריאים לאדם (מוצגים בדשבורד תחת "why
  // flagged"). כל כלל מנוקד בנפרד ומצטבר כניכוי מ-100, כדי שאפשר
  // יהיה להבין בדיוק למה פריט ספציפי סומן.
  calculate(matchResult: MatchResult, fields: RawScrapedFields, previousValue?: number): ConfidenceResult {
    const reasons: string[] = [];
    let score = 100;

    // כלל 1: הטבה חדשה לגמרי — תמיד דורשת בדיקה אנושית, ללא יוצא
    // מן הכלל. אין "אוטומטי" להטבה שמעולם לא הייתה במערכת.
    if (matchResult.kind === 'NEW') {
      reasons.push('הטבה חדשה שלא זוהתה במערכת — דורשת אישור ידני');
      score -= 40;
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
    // האמיתיים) ולא על מבצע אמיתי.
    if (matchResult.kind === 'UPDATE' && previousValue !== undefined && fields.discountValue !== undefined) {
      const changePercent = previousValue === 0 ? 100 : (Math.abs(fields.discountValue - previousValue) / previousValue) * 100;
      if (changePercent > SUSPICIOUS_VALUE_CHANGE_PERCENT) {
        reasons.push(`שינוי חד בערך ההנחה: ${previousValue} -> ${fields.discountValue} (${changePercent.toFixed(0)}%)`);
        score -= 25;
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

  shouldAutoPublish(confidence: ConfidenceResult, matchResult: MatchResult): boolean {
    // הטבה חדשה לעולם לא מתפרסמת אוטומטית, גם אם הציון גבוה במקרה
    // (למשל matchResult.kind==='NEW' אבל שאר השדות מלאים) — זו
    // החלטה עסקית מפורשת, לא רק תוצאה של החשבון.
    if (matchResult.kind === 'NEW') return false;
    if (matchResult.kind === 'UNCHANGED') return true; // אין שינוי בפועל, אין מה לאשר
    return confidence.score >= AUTO_PUBLISH_THRESHOLD;
  },
};
