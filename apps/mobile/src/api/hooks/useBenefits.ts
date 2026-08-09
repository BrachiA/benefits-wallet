import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiClient } from '../client';
import { userSelectionStorage } from '../../storage/userSelection';
import type { Benefit } from '../types';

type UseBenefitsOptions = {
  categoryId?: string;
  isPopular?: boolean;
  search?: string;
  // מצמצם לכרטיס/מועדון בודד — משמש כשמגיעים מ-WalletScreen ("מה
  // מגיע לי עם הכרטיס הזה"), בשונה מהסינון הרגיל שמבוסס על כל
  // הבחירה השמורה ב-storage.
  singleProgramId?: string;
  // מבטל את ה-hook לגמרי (גם קריאת storage וגם קריאת רשת) — משמש
  // כש-BenefitsListScreen מציג staticBenefits שכבר סופקו מבחוץ
  // (למשל מ-useGroupedRecommendations), כדי לא לטעון פעמיים.
  skip?: boolean;
};

// זו הקריאה המרכזית באפליקציה: שולפת programIds מה-Local Storage
// ומעבירה אותם ל-GET /benefits, שמפעיל את שאילתת ה-Scope-matching
// שנבנתה ב-backend (BenefitScope OR-matching, כולל תמיכה בהטבות
// "גלובליות" עם programId=null). האפליקציה עצמה לא מיישמת שום
// לוגיקת התאמה — היא רק שולחת את הבחירה ומציגה את מה שחוזר.
export function useBenefits(options: UseBenefitsOptions = {}) {
  const [storedProgramIds, setStoredProgramIds] = useState<string[] | null>(null);

  useEffect(() => {
    if (options.skip) return;
    // אם הגיע singleProgramId (מסך Wallet), לא צריך לקרוא ל-storage
    // בכלל — הסינון כבר ידוע וממוקד לכרטיס אחד.
    if (options.singleProgramId) {
      setStoredProgramIds([options.singleProgramId]);
      return;
    }
    userSelectionStorage.get().then((s) => setStoredProgramIds(s.programIds));
  }, [options.singleProgramId, options.skip]);

  return useQuery({
    queryKey: ['benefits', storedProgramIds, options.categoryId, options.isPopular, options.search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (storedProgramIds?.length) params.set('programIds', storedProgramIds.join(','));
      if (options.categoryId) params.set('categoryId', options.categoryId);
      if (options.isPopular !== undefined) params.set('isPopular', String(options.isPopular));
      if (options.search) params.set('search', options.search);
      params.set('pageSize', '50');
      return apiClient.get<Benefit[]>(`/benefits?${params.toString()}`);
    },
    // מחכה עד ש-storedProgramIds נטען (מ-storage או מ-singleProgramId)
    // לפני שהשאילתה רצה — אחרת הטעינה הראשונה הייתה שולחת בקשה בלי
    // סינון ומציגה רגעית את כל ההטבות במערכת. skip מבטל לגמרי.
    enabled: !options.skip && storedProgramIds !== null,
  });
}
