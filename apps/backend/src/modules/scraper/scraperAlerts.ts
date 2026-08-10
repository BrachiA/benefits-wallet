import { sendMail } from '../../lib/mailer';

// ============================================================
// נקודת האמת היחידה ל"מה נחשב בעיה שדורשת התראה למנהל". שלוש
// הסיבות אושרו במפורש (שלב 5, א.2):
//   1. פריט נכנס לתור הבדיקה (לא פורסם/עודכן אוטומטית)
//   2. ריצת סריקה נכשלה (חריגה)
//   3. ה-selectors כנראה נשברו (כל הכרטיסים בדף דולגו)
// כל התראה כוללת הסבר קצר של *מה* הבעיה, לא רק "יש פריט ממתין" —
// כדי שהמנהל ידע כמה דחוף לטפל בלי לפתוח את הדשבורד קודם.
// ============================================================

function wrap(title: string, bodyHtml: string): string {
  return `<div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6;">
    <h2>${title}</h2>
    ${bodyHtml}
    <p style="color:#888; font-size: 12px; margin-top: 24px;">התראה אוטומטית מארנק ההטבות.</p>
  </div>`;
}

export const scraperAlerts = {
  // סיבה 1: פריט הועבר לתור הבדיקה במקום להתפרסם/להתעדכן אוטומטית.
  async itemFlagged(params: {
    sourceName: string;
    title: string;
    confidenceScore: number;
    confidenceReasons: string[];
    scrapedItemId: string;
  }) {
    const reasonsList = params.confidenceReasons.length
      ? `<ul>${params.confidenceReasons.map((r) => `<li>${r}</li>`).join('')}</ul>`
      : '<p>לא צוינה סיבה ספציפית.</p>';
    await sendMail(
      `⚠️ פריט ממתין לבדיקה: ${params.title}`,
      wrap(
        `פריט מהמקור "${params.sourceName}" ממתין לבדיקה`,
        `<p><strong>${params.title}</strong> — ציון ביטחון: ${params.confidenceScore}/100</p>
         <p>למה זה בתור:</p>
         ${reasonsList}
         <p>מזהה פריט: ${params.scrapedItemId}</p>`
      )
    );
  },

  // סיבה 2: ריצת סריקה נכשלה עם חריגה (כשל רשת, שגיאת DB וכו').
  async runFailed(params: { sourceName: string; errorMessage: string; runId: string }) {
    await sendMail(
      `🔴 סריקה נכשלה: ${params.sourceName}`,
      wrap(
        `הסריקה של "${params.sourceName}" נכשלה`,
        `<p><strong>מה קרה:</strong> ${params.errorMessage}</p>
         <p>מזהה ריצה: ${params.runId}</p>
         <p>כדאי לבדוק שהאתר עדיין זמין ושהגדרות הסריקה עדיין תואמות לו.</p>`
      )
    );
  },

  // סיבה 3: כל הכרטיסים שנמצאו בדף דולגו — החתימה של selector
  // שנשבר. נבדל במכוון מ-runFailed: זו לא חריגה, זו ריצה "תקינה"
  // שלא הפיקה שום דבר שימושי.
  async selectorsLikelyBroken(params: { sourceName: string; itemsSkipped: number; runId: string }) {
    await sendMail(
      `🟠 ייתכן שהסריקה שבורה: ${params.sourceName}`,
      wrap(
        `כל הכרטיסים שנמצאו במקור "${params.sourceName}" דולגו`,
        `<p>נמצאו ${params.itemsSkipped} כרטיסים בדף, אך אף אחד מהם לא הכיל כותרת ומזהה תקינים.</p>
         <p>הסיבה הסבירה ביותר: האתר שינה את מבנה הדף וה-selectors שהוגדרו במקור כבר לא תואמים.</p>
         <p>מומלץ לבדוק את הגדרות הסריקה של המקור בדשבורד.</p>
         <p>מזהה ריצה: ${params.runId}</p>`
      )
    );
  },
};
