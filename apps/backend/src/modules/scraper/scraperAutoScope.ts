// עוגן השיוך האוטומטי של מקור סריקה: מגדיר האם ולמי הטבה חדשה
// שמגיעה ממנו יכולה להשתייך בלי אדם בלולאה. עד כה defaultProgramId/
// defaultBrandId/defaultCategoryId נשמרו על ScraperSource ואף פעם
// לא נקראו — זה הקובץ שסוגר את זה (שלב 5, א.2).

export type ScraperSourceAnchor = {
  defaultProgramId: string | null;
  defaultBrandId: string | null;
  defaultCategoryId: string | null;
};

// דרוש עוגן שיוך (מועדון או מותג — לפחות אחד) *וגם* קטגוריה, כי
// Benefit.categoryId הוא שדה חובה שהסורק אינו יכול לגזור מהדף.
export function hasAutoScopeAnchor(source: ScraperSourceAnchor): boolean {
  return Boolean((source.defaultProgramId || source.defaultBrandId) && source.defaultCategoryId);
}

// שורת ה-BenefitScope שתיווצר להטבה חדשה מהמקור הזה. אחד מהם
// יהיה מוגדר בהכרח (hasAutoScopeAnchor נבדק לפני קריאה לזה).
export function buildAutoScopeRow(source: ScraperSourceAnchor): { programId?: string; brandId?: string } {
  const row: { programId?: string; brandId?: string } = {};
  if (source.defaultProgramId) row.programId = source.defaultProgramId;
  if (source.defaultBrandId) row.brandId = source.defaultBrandId;
  return row;
}
