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

  return {
    selection,
    isLoading: selection === null,
    toggleProgram,
    toggleFavorite,
    isProgramSelected: (id: string) => selection?.programIds.includes(id) ?? false,
    isFavorite: (id: string) => selection?.favoriteBenefitIds.includes(id) ?? false,
  };
}
