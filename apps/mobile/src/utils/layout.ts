import { useWindowDimensions } from 'react-native';

// ============================================================
// האפליקציה רצה בעיקר בטלפון, אבל אותו קוד נטען גם ב-Expo Web על
// מסך רחב. בלי הטיפול כאן, כרטיס שנראה נכון ב-390px נמתח ל-1900px
// ונהיה סרט דק ובלתי-קריא.
//
// הפתרון: רוחב תוכן מקסימלי + ריבוי עמודות, לא "עיצוב דסקטופ
// נפרד". התוצאה בטלפון זהה לחלוטין למה שהיה (עמודה אחת, בלי
// הגבלת רוחב אפקטיבית) — הענפים הרחבים פשוט לא מתקיימים שם.
// ============================================================

// 720 = הרוחב שמעליו עמודה בודדת כבר נמתחת יותר מדי לקריאה נוחה.
const TWO_COLUMN_MIN_WIDTH = 720;
const THREE_COLUMN_MIN_WIDTH = 1100;

// גבול הקריאוּת הקלאסי: מעבר לזה העין צריכה "לקפוץ" רחוק מדי בין
// סוף שורה לתחילת הבאה.
const CONTENT_MAX_WIDTH = 1180;

export type ResponsiveLayout = {
  width: number;
  isPhone: boolean;
  /** מספר העמודות ברשימת ההטבות הראשית */
  columns: number;
  /** רוחב מקסימלי לתוכן; המסך ממורכז סביבו במסכים רחבים */
  contentMaxWidth: number;
  /** רוחב כרטיס בגלילה אופקית — גדל מעט במסך רחב */
  horizontalCardWidth: number;
};

export function useResponsiveLayout(): ResponsiveLayout {
  const { width } = useWindowDimensions();

  const columns = width >= THREE_COLUMN_MIN_WIDTH ? 3 : width >= TWO_COLUMN_MIN_WIDTH ? 2 : 1;

  return {
    width,
    isPhone: width < TWO_COLUMN_MIN_WIDTH,
    columns,
    contentMaxWidth: CONTENT_MAX_WIDTH,
    horizontalCardWidth: width < TWO_COLUMN_MIN_WIDTH ? 168 : 208,
  };
}
