import { sendMail } from '../../lib/mailer';
import { logger } from '../../lib/logger';
import { settingsService } from '../settings/settings.service';

// ============================================================
// נקודת האמת היחידה ל"מה נחשב בעיה שדורשת התראה למנהל". שלוש
// הסיבות אושרו במפורש (שלב 5, א.2):
//   1. פריט נכנס לתור הבדיקה (לא פורסם/עודכן אוטומטית)
//   2. ריצת סריקה נכשלה (חריגה)
//   3. ה-selectors כנראה נשברו (כל הכרטיסים בדף דולגו)
// כל התראה כוללת הסבר קצר של *מה* הבעיה, לא רק "יש פריט ממתין" —
// כדי שהמנהל ידע כמה דחוף לטפל בלי לפתוח את הדשבורד קודם.
//
// שלוש הסיבות האלה לא זזות. מה שכן: מתג גלובלי (AlertSettings,
// מסך "מקורות סריקה" בדשבורד) קובע אם המייל *נשלח בפועל* — כשכבוי,
// הפריט/ריצה עדיין נכנסים לתור/מתועדים כרגיל, רק המייל לא יוצא.
// נבדק כאן, במקום היחיד שכל שלוש ההתראות עוברות דרכו, כדי שלא
// יהיה סיכוי שסוג התראה אחד "ישכח" לכבד את המתג.
// ============================================================

async function sendIfEnabled(subject: string, html: string): Promise<void> {
  const enabled = await settingsService.isEmailAlertsEnabled();
  if (!enabled) {
    logger.info({ subject }, 'Email alerts are globally disabled — skipping send');
    return;
  }
  await sendMail(subject, html);
}

function wrap(title: string, bodyHtml: string): string {
  return `<div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6;">
    <h2>${title}</h2>
    ${bodyHtml}
    <p style="color:#888; font-size: 12px; margin-top: 24px;">התראה אוטומטית מארנק ההטבות.</p>
  </div>`;
}

type FlaggedEntry = { title: string; confidenceScore: number; confidenceReasons: string[]; scrapedItemId: string };

// ============================================================
// ריכוז "פריט ממתין לבדיקה" (סיבה 1): ריצה בודדת יכולה לייצר עשרות
// פריטים מסומנים (למשל 94 פריטים מריצה אחת דרך תוסף Chrome) —
// מייל נפרד לכל אחד מציף את התיבה. itemFlagged (למטה) לא שולחת
// יותר בעצמה; היא רק צוברת ל-buffer לפי runId. flushFlaggedBatch
// היא זו ששולחת מייל אחד מרוכז לכל הריצה, ונקראת פעם אחת בסוף
// runSource/extensionIngest.ingest (גם בנתיב הצלחה וגם בנתיב כשל —
// אחרת buffer שלא רוקן היה נשאר תקוע בזיכרון לצמיתות).
// runFailed ו-selectorsLikelyBroken (סיבות 2-3) כבר היום פעם אחת
// לריצה — לא נזקקות לריכוז נוסף.
// ============================================================
const flaggedBuffer = new Map<string, FlaggedEntry[]>();

export const scraperAlerts = {
  // סיבה 1: פריט הועבר לתור הבדיקה במקום להתפרסם/להתעדכן אוטומטית.
  // לא שולחת מייל בעצמה — צוברת, ראו flushFlaggedBatch.
  async itemFlagged(params: {
    sourceName: string;
    title: string;
    confidenceScore: number;
    confidenceReasons: string[];
    scrapedItemId: string;
    runId: string;
  }) {
    const list = flaggedBuffer.get(params.runId) ?? [];
    list.push({
      title: params.title,
      confidenceScore: params.confidenceScore,
      confidenceReasons: params.confidenceReasons,
      scrapedItemId: params.scrapedItemId,
    });
    flaggedBuffer.set(params.runId, list);
  },

  // שולחת מייל אחד מרוכז על כל הפריטים שנצברו ב-itemFlagged עבור
  // runId נתון, ומנקה את ה-buffer שלו. חייבת להיקרא בדיוק פעם אחת
  // לכל ריצה, גם אם הריצה נכשלה — קריאה שלא מגיעה משאירה buffer
  // יתום בזיכרון (memory leak), ולכן שני קוראיה (runSource,
  // extensionIngest.ingest) קוראים לה מנתיב הצלחה *וגם* נתיב כשל.
  async flushFlaggedBatch(params: { runId: string; sourceName: string }): Promise<void> {
    const items = flaggedBuffer.get(params.runId);
    flaggedBuffer.delete(params.runId);
    if (!items || items.length === 0) return;

    const itemHtml = (item: FlaggedEntry) => {
      const reasonsList = item.confidenceReasons.length
        ? `<ul>${item.confidenceReasons.map((r) => `<li>${r}</li>`).join('')}</ul>`
        : '<p>לא צוינה סיבה ספציפית.</p>';
      return `<li style="margin-bottom: 12px;">
        <strong>${item.title}</strong> — ציון ביטחון: ${item.confidenceScore}/100
        ${reasonsList}
        <div style="color:#888; font-size: 11px;">מזהה פריט: ${item.scrapedItemId}</div>
      </li>`;
    };

    const subject =
      items.length === 1
        ? `⚠️ פריט ממתין לבדיקה: ${items[0].title}`
        : `⚠️ ${items.length} פריטים ממתינים לבדיקה: ${params.sourceName}`;
    const title =
      items.length === 1
        ? `פריט מהמקור "${params.sourceName}" ממתין לבדיקה`
        : `${items.length} פריטים מהמקור "${params.sourceName}" ממתינים לבדיקה`;

    await sendIfEnabled(subject, wrap(title, `<ul style="padding-inline-start: 20px;">${items.map(itemHtml).join('')}</ul>`));
  },

  // סיבה 2: ריצת סריקה נכשלה עם חריגה (כשל רשת, שגיאת DB וכו').
  async runFailed(params: { sourceName: string; errorMessage: string; runId: string }) {
    await sendIfEnabled(
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
    await sendIfEnabled(
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
