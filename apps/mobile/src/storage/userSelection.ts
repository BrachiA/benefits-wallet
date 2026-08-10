import AsyncStorage from '@react-native-async-storage/async-storage';

// טיפוס זה מוגדר גם ב-packages/shared/src/types (כפי שתוכנן בשלב
// 2) — כאן מוצג עם ההערה המקורית מהתכנון: כל עוד אין Authentication,
// זו אמת המידע היחידה על המשתמש, ונשמרת מקומית בלבד.
// מונה עניין לפי קטגוריה (שלב 6, "העדפה אישית"): כמה פעמים המשתמשת
// צפתה/עיינה בהטבות מהקטגוריה הזו. נשמר מקומית בלבד — בכוונה אין
// מודל משתמש בשרת ואין מזהה שמזוהה מחוצה למכשיר. אינדוקס לפי
// categoryId, לא שם, כדי לשרוד שינוי שם קטגוריה.
export type CategoryInterest = Record<string, number>;

export type UserSelection = {
  programIds: string[];
  favoriteBenefitIds: string[];
  dismissedBenefitIds: string[];
  categoryInterest: CategoryInterest;
  updatedAt: string; // ISO
  schemaVersion: number;
};

const STORAGE_KEY = 'benefits-wallet:user-selection';
const CURRENT_SCHEMA_VERSION = 2;

// מונע שמשתמשת ותיקה עם היסטוריית שימוש ארוכה "תיתקע" על קטגוריה
// אחת: כשהמונה הגבוה ביותר חוצה את הרף, כל המונים מוכפלים ב-0.5
// (יורדים בשווה, לא מתאפסים) — שומר על יחסי-הגודל בין קטגוריות
// אבל מונע צבירה בלתי-חסומה שהייתה הופכת עם הזמן להעדפה נוקשה
// מדי במקום "רמז עדין".
const INTEREST_DECAY_THRESHOLD = 200;
const INTEREST_DECAY_FACTOR = 0.5;

function emptySelection(): UserSelection {
  return {
    programIds: [],
    favoriteBenefitIds: [],
    dismissedBenefitIds: [],
    categoryInterest: {},
    updatedAt: new Date().toISOString(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

// נקודת המיגרציה היחידה: כשה-schema ישתנה בעתיד (למשל בהוספת שדה
// חדש, או בסנכרון מול שרת אחרי שתתווסף הרשמה), הלוגיקה חיה כאן -
// לא מפוזרת בכל מקום שקורא ל-storage.
function migrate(raw: UserSelection): UserSelection {
  if (raw.schemaVersion === CURRENT_SCHEMA_VERSION) return raw;
  // גרסה 1 -> 2: הוספת categoryInterest. משתמשת קיימת פשוט מתחילה
  // בלי היסטוריית עניין — אין מה "לשחזר", רק לא לקרוס על שדה חסר.
  return { ...raw, categoryInterest: raw.categoryInterest ?? {}, schemaVersion: CURRENT_SCHEMA_VERSION };
}

export const userSelectionStorage = {
  async get(): Promise<UserSelection> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return emptySelection();
    try {
      const parsed = JSON.parse(raw) as UserSelection;
      return migrate(parsed);
    } catch {
      // JSON פגום (למשל אחרי crash באמצע כתיבה) — עדיף לאבד את
      // הבחירה ולהתחיל מחדש מאשר לקרוס את כל האפליקציה בכל טעינה.
      return emptySelection();
    }
  },

  async set(selection: UserSelection): Promise<void> {
    const withTimestamp = { ...selection, updatedAt: new Date().toISOString() };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(withTimestamp));
  },

  async toggleProgram(programId: string): Promise<UserSelection> {
    const current = await this.get();
    const programIds = current.programIds.includes(programId)
      ? current.programIds.filter((id) => id !== programId)
      : [...current.programIds, programId];
    const next = { ...current, programIds };
    await this.set(next);
    return next;
  },

  async toggleFavorite(benefitId: string): Promise<UserSelection> {
    const current = await this.get();
    const favoriteBenefitIds = current.favoriteBenefitIds.includes(benefitId)
      ? current.favoriteBenefitIds.filter((id) => id !== benefitId)
      : [...current.favoriteBenefitIds, benefitId];
    const next = { ...current, favoriteBenefitIds };
    await this.set(next);
    return next;
  },

  // נקרא בכל צפייה בהטבה או עיון בקטגוריה ספציפית. לא await-חוסם
  // בכוונה מצד הקוראים (fire-and-forget) — זה איתות עדין לסידור
  // תצוגה, לא פעולה שהמסך צריך לחכות לה.
  async recordCategoryInterest(categoryId: string): Promise<UserSelection> {
    const current = await this.get();
    const nextCount = (current.categoryInterest[categoryId] ?? 0) + 1;
    let categoryInterest = { ...current.categoryInterest, [categoryId]: nextCount };

    if (nextCount > INTEREST_DECAY_THRESHOLD) {
      categoryInterest = Object.fromEntries(
        Object.entries(categoryInterest).map(([id, count]) => [id, count * INTEREST_DECAY_FACTOR])
      );
    }

    const next = { ...current, categoryInterest };
    await this.set(next);
    return next;
  },

  async hasCompletedOnboarding(): Promise<boolean> {
    const selection = await this.get();
    return selection.programIds.length > 0;
  },
};
