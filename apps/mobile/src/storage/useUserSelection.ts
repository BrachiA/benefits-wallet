import { useCallback, useEffect, useState } from 'react';
import { userSelectionStorage, type UserSelection } from './userSelection';

// עטיפה ריאקטיבית מעל userSelectionStorage: רכיבים שקוראים ל-hook
// הזה מתעדכנים אוטומטית אחרי toggle, בלי שכל מסך יצטרך לנהל state
// משלו ולסנכרן ידנית מול ה-storage.
export function useUserSelection() {
  const [selection, setSelection] = useState<UserSelection | null>(null);

  useEffect(() => {
    userSelectionStorage.get().then(setSelection);
  }, []);

  const toggleProgram = useCallback(async (programId: string) => {
    const next = await userSelectionStorage.toggleProgram(programId);
    setSelection(next);
  }, []);

  const toggleFavorite = useCallback(async (benefitId: string) => {
    const next = await userSelectionStorage.toggleFavorite(benefitId);
    setSelection(next);
  }, []);

  // fire-and-forget במכוון: מסך שצופה בהטבה לא צריך לחכות לכתיבת
  // AsyncStorage כדי לרנדר, וגם לא צריך להריץ מחדש בגלל זה — זה
  // מעדכן state עבור הפעם הבאה שהמסך הראשי (Home) ייבנה, לא עבור
  // המסך הנוכחי.
  const recordCategoryInterest = useCallback((categoryId: string | undefined) => {
    if (!categoryId) return;
    userSelectionStorage.recordCategoryInterest(categoryId).then(setSelection);
  }, []);

  return {
    selection,
    isLoading: selection === null,
    toggleProgram,
    toggleFavorite,
    recordCategoryInterest,
    isProgramSelected: (id: string) => selection?.programIds.includes(id) ?? false,
    isFavorite: (id: string) => selection?.favoriteBenefitIds.includes(id) ?? false,
  };
}
