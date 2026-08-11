// ============================================================
// חיפוש חכם (שלב 6): עמידות לשגיאות כתיב באמצעות pg_trgm.
//
// SIMILARITY_THRESHOLD נקבע אמפירית מול ה-DB בפועל, לא ניחוש:
// similarity('גלידה', 'גלדיה') = 0.2 — סף ברירת המחדל של pg_trgm
// (0.3) היה מפספס בדיוק את הדוגמה שהתבקשה. 0.15 תופס שגיאות-כתיב
// חד-אותיות (הקלדה/סדר אותיות) בלי לפתוח את הסכר לגמרי. עם קטלוג
// גדול בהרבה מזה שנבדק כאן, ייתכן שיהיה צריך לכייל שוב.
export const SIMILARITY_THRESHOLD = 0.15;

export type RankedId = { id: string; rank: number };

// גודל כל "נגיסה" ממועמדי ה-SQL, ומספר הנגיסות המרבי לניסיון
// (batch × מגבלה = תקרת המועמדים הכוללת שנבדוק, כברירת מחדל 50×3=150).
// למה לא סתם LIMIT 150 בבת אחת: רוב החיפושים מסתפקים בנגיסה
// הראשונה (הרוב המכריע של השאילתות לא מסוננות לגמרי ע"י Prisma),
// כך שרק שאילתות שבאמת נתקלות ב"כל המועמדים נופלים בסינון" (למשל
// query כללי שרוב תוצאותיו פגות-תוקף) משלמות את המחיר של נגיסה
// נוספת — לא כל שאילתה משלמת מראש עלות של 150 שורות.
export function defaultBatchSize(take: number): number {
  return Math.min(take * 4, 50);
}
const MAX_BATCHES = 3;

// ממיין מערך שורות לפי סדר המזהים ב-rankedIds (החיפוש הפאזי כבר
// דירג אותם), וחותך ל-take. Prisma לא יודע להזמין by "IN (...)"
// לפי סדר רשימה, ולכן הסידור נעשה כאן אחרי השליפה.
export function sortByRank<T extends { id: string }>(rows: T[], rankedIds: RankedId[], take: number): T[] {
  const order = new Map(rankedIds.map((r, i) => [r.id, i]));
  return [...rows].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).slice(0, take);
}

// משלימה מועמדים בנגיסות נוספות כשהסינון ב-Prisma (נראות/סטטוס)
// מרוקן את הראשונה מתחת ל-take שהלקוח ביקש. בלי זה, חיפוש כללי
// שרוב הפגיעות שלו פגות-תוקף/לא-פעילות היה מחזיר פחות תוצאות
// ממה שבאמת קיים, רק בגלל שהמועמד ה-51 ואילך לא נבדק כלל.
//
// fetchCandidates(offset, limit) מריצה את שאילתת ה-SQL הגולמית עם
// עמוד ספציפי. fetchRows(ids) שולפת את השורות המלאות דרך Prisma
// (מכבדת נראות/סטטוס). עוצרת כשיש מספיק תוצאות, כשנגמרים המועמדים
// (נגיסה קטנה מ-batchSize = זו הייתה האחרונה), או אחרי MAX_BATCHES
// נגיסות — כדי שחיפוש שבאמת אין לו תוצאות לא ילולב לנצח.
export async function fetchWithBackfill<TRow extends { id: string }>(params: {
  take: number;
  fetchCandidates: (offset: number, limit: number) => Promise<RankedId[]>;
  fetchRows: (ids: string[]) => Promise<TRow[]>;
}): Promise<TRow[]> {
  const { take, fetchCandidates, fetchRows } = params;
  const batchSize = defaultBatchSize(take);

  const allCandidates: RankedId[] = [];
  const collected = new Map<string, TRow>();
  let offset = 0;

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const candidates = await fetchCandidates(offset, batchSize);
    if (candidates.length === 0) break; // אין עוד מועמדים בכלל — לא רק "לא עברו סינון"
    allCandidates.push(...candidates);
    offset += candidates.length;

    const newIds = candidates.map((c) => c.id).filter((id) => !collected.has(id));
    if (newIds.length > 0) {
      const rows = await fetchRows(newIds);
      for (const row of rows) collected.set(row.id, row);
    }

    if (collected.size >= take) break; // יש מספיק — לא צריך נגיסה נוספת
    if (candidates.length < batchSize) break; // זו הייתה הנגיסה האחרונה שקיימת ב-DB
  }

  return sortByRank([...collected.values()], allCandidates, take);
}
