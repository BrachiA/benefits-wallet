import { Prisma } from '@prisma/client';

// ============================================================
// מקור האמת היחיד לשאלה "האם ההטבה תקפה עכשיו, ולמי".
//
// לפני הקובץ הזה הסמנטיקה הזו הייתה משוכפלת בשלושה מקומות
// (benefit.repository, recommendation.service, search.service),
// וכל עותק שכח משהו אחר: search לא בדק תפוגה כלל, recommendation
// השווה מול תאריך שהוקפא בזמן טעינת המודול, ו-benefit.repository
// איבד את תנאי התפוגה ברגע שהתווסף search (התנגשות מפתח OR
// ב-spread — המפתח האחרון דרס את הקודם בשקט).
//
// כל צרכן חדש חייב לעבור דרך כאן ולא לבנות where משלו.
// ============================================================

// ציר השיוך שהלקוח מבקש עבורו הטבות. כל שדה שלא סופק פשוט לא
// מסונן — לא "לא תואם".
export type BenefitAudience = {
  programIds?: string[];
  brandId?: string;
  storeId?: string;
  cityId?: string;
};

export type BenefitVisibilityOptions = {
  audience?: BenefitAudience;
  // תצוגת ניהול. הדשבורד חייב לראות גם הטבות שפג תוקפן או שכובו
  // כדי שיהיה אפשר לערוך אותן (למשל להאריך תוקף) — בלי זה הן
  // כלואות ב-DB בלי דרך להגיע אליהן. ברירת המחדל היא הצד הבטוח.
  includeInactive?: boolean;
};

// ישות שהטבה משויכת אליה חייבת להיות חיה בעצמה. בלי הבדיקה הזו,
// מחיקה רכה של מועדון משאירה את ההטבות שלו גלויות לנצח: שורת
// ה-scope ממשיכה להצביע עליו, והשאילתה בדקה רק את deletedAt של
// ההטבה עצמה.
const LIVE_ENTITY = { deletedAt: null, isActive: true } as const;

// שורת scope נחשבת תקפה רק אם כל הישויות שהיא מפנה אליהן חיות.
// null בשדה = "כל הערכים" (הסמנטיקה המתועדת בסכמה), ולכן null
// עובר תמיד. City מוחרגת — אין לה isActive/deletedAt.
const SCOPE_TARGETS_ARE_LIVE: Prisma.BenefitScopeWhereInput = {
  AND: [
    { OR: [{ programId: null }, { program: LIVE_ENTITY }] },
    { OR: [{ brandId: null }, { brand: LIVE_ENTITY }] },
    { OR: [{ storeId: null }, { store: LIVE_ENTITY }] },
  ],
};

// בונה את תנאי ההתאמה על שורת scope בודדת. בכל ציר: או שהערך
// תואם למה שהלקוח ביקש, או שהוא null — כלומר ההטבה תקפה לכל
// הערכים בציר הזה.
function buildScopeMatch(audience: BenefitAudience): Prisma.BenefitScopeWhereInput | null {
  const conditions: Prisma.BenefitScopeWhereInput[] = [];

  if (audience.programIds?.length) {
    conditions.push({ OR: [{ programId: { in: audience.programIds } }, { programId: null }] });
  }
  if (audience.brandId) {
    conditions.push({ OR: [{ brandId: audience.brandId }, { brandId: null }] });
  }
  if (audience.storeId) {
    conditions.push({ OR: [{ storeId: audience.storeId }, { storeId: null }] });
  }
  // cityId נאכף רק כשהלקוח באמת סיפק עיר. כל עוד לאפליקציה אין
  // מנגנון מיקום, אכיפה גורפת הייתה מעלימה הטבות לגיטימיות מכולם
  // במקום להגביל אותן גיאוגרפית.
  if (audience.cityId) {
    conditions.push({ OR: [{ cityId: audience.cityId }, { cityId: null }] });
  }

  if (conditions.length === 0) return null;
  return { AND: [SCOPE_TARGETS_ARE_LIVE, ...conditions] };
}

export function buildBenefitVisibilityWhere(
  options: BenefitVisibilityOptions = {}
): Prisma.BenefitWhereInput {
  const { audience, includeInactive = false } = options;

  // מחושב בכל קריאה ולא נשמר בקבוע ברמת מודול. הגרסה הקודמת
  // הקפיאה את הזמן ברגע טעינת הקובץ, כך שבשרת שרץ ברציפות
  // הטבות שפג תוקפן המשיכו להופיע. בפיתוח זה היה בלתי נראה,
  // כי ts-node-dev מטעין מחדש בכל שינוי.
  const now = new Date();

  const conditions: Prisma.BenefitWhereInput[] = [{ deletedAt: null }];

  if (!includeInactive) {
    conditions.push(
      { isActive: true },
      // הטבה שטרם נכנסה לתוקף אינה תקפה לאף אחד. האינדקס בסכמה
      // הוא [isActive, startDate, endDate] — שלושתם נועדו להיבדק יחד.
      { OR: [{ startDate: null }, { startDate: { lte: now } }] },
      { OR: [{ endDate: null }, { endDate: { gt: now } }] }
    );
  }

  if (audience) {
    const scopeMatch = buildScopeMatch(audience);
    if (scopeMatch) conditions.push({ scopes: { some: scopeMatch } });
  }

  // AND מפורש ולא spread: כמה מהתנאים משתמשים ב-OR ברמה העליונה,
  // ו-spread היה גורם להם לדרוס זה את זה בשקט — בדיוק הבאג שהקובץ
  // הזה נועד למנוע.
  return { AND: conditions };
}
