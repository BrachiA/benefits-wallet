// ============================================================
// חיפוש חכם (שלב 6): עמידות לשגיאות כתיב באמצעות pg_trgm.
//
// SIMILARITY_THRESHOLD נקבע אמפירית מול ה-DB בפועל, לא ניחוש:
// similarity('גלידה', 'גלדיה') = 0.2 — סף ברירת המחדל של pg_trgm
// (0.3) היה מפספס בדיוק את הדוגמה שהתבקשה. 0.15 תופס שגיאות-כתיב
// חד-אותיות (הקלדה/סדר אותיות) בלי לפתוח את הסכר לגמרי. עם קטלוג
// גדול בהרבה מזה שנבדק כאן, ייתכן שיהיה צריך לכייל שוב.
export const SIMILARITY_THRESHOLD = 0.15;

// כמה מועמדים לשלוף בשאילתת ה-fuzzy לפני שמסננים לפי נראות/סטטוס
// ב-Prisma וחותכים ל-take בפועל. מרווח כדי שסינון נוסף (למשל "יש
// הטבה פעילה") לא ישאיר פחות תוצאות מהמבוקש כשהוא בר-ביצוע.
export function candidateLimit(take: number): number {
  return Math.min(take * 4, 50);
}

export type RankedId = { id: string; rank: number };

// ממיין מערך שורות לפי סדר המזהים ב-rankedIds (החיפוש הפאזי כבר
// דירג אותם), וחותך ל-take. Prisma לא יודע להזמין by "IN (...)"
// לפי סדר רשימה, ולכן הסידור נעשה כאן אחרי השליפה.
export function sortByRank<T extends { id: string }>(rows: T[], rankedIds: RankedId[], take: number): T[] {
  const order = new Map(rankedIds.map((r, i) => [r.id, i]));
  return [...rows].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).slice(0, take);
}
