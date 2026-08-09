import AsyncStorage from '@react-native-async-storage/async-storage';

// טיפוס זה מוגדר גם ב-packages/shared/src/types (כפי שתוכנן בשלב
// 2) — כאן מוצג עם ההערה המקורית מהתכנון: כל עוד אין Authentication,
// זו אמת המידע היחידה על המשתמש, ונשמרת מקומית בלבד.
export type UserSelection = {
  programIds: string[];
  favoriteBenefitIds: string[];
  dismissedBenefitIds: string[];
  updatedAt: string; // ISO
  schemaVersion: number;
};

const STORAGE_KEY = 'benefits-wallet:user-selection';
const CURRENT_SCHEMA_VERSION = 1;

function emptySelection(): UserSelection {
  return {
    programIds: [],
    favoriteBenefitIds: [],
    dismissedBenefitIds: [],
    updatedAt: new Date().toISOString(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

// נקודת המיגרציה היחידה: כשה-schema ישתנה בעתיד (למשל בהוספת שדה
// חדש, או בסנכרון מול שרת אחרי שתתווסף הרשמה), הלוגיקה חיה כאן -
// לא מפוזרת בכל מקום שקורא ל-storage.
function migrate(raw: UserSelection): UserSelection {
  if (raw.schemaVersion === CURRENT_SCHEMA_VERSION) return raw;
  // אין עדיין גרסאות קודמות לטפל בהן — placeholder לעתיד.
  return { ...raw, schemaVersion: CURRENT_SCHEMA_VERSION };
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

  async hasCompletedOnboarding(): Promise<boolean> {
    const selection = await this.get();
    return selection.programIds.length > 0;
  },
};
