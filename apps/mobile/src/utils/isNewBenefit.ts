// מראה בדיוק את benefitGroup.ts::isNewBenefit ב-backend: "חדש" הוא
// startDate בשבעת הימים האחרונים, ו-createdAt הוא הגיבוי היחיד
// כש-startDate חסר. אין packages/shared בפרויקט הזה (ראו
// PROJECT_MAP.md), אז ההגדרה כפולה במכוון — לא ניתנת לייבוא ישיר.
const NEW_THRESHOLD_DAYS = 7;

export function isNewBenefit(startDate: string | undefined, createdAt: string): boolean {
  const cutoff = Date.now() - NEW_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  const effectiveDate = new Date(startDate ?? createdAt).getTime();
  return effectiveDate >= cutoff;
}
