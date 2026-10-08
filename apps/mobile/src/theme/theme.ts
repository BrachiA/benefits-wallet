// ============================================================
// ערכת נושא כהה (dark), בהשראת שפת העיצוב של Wolt — לפי הדוגמאות
// שסופקו: רקע נייבי-כמעט-שחור, כרטיסים מוגבהים מעט ממנו, וצבעי
// מותג רוויים כאקצנט. הצבעים הבהירים של המותג (purple/blue) הועלו
// בבהירות ביחס לגרסה הבהירה הקודמת — גוון שקריא על רקע לבן נעשה
// עמום וכהה מדי על רקע כהה.
//
// כל היחסים למטה נמדדו בפועל (WCAG 2.1 relative luminance), לא
// הוערכו בעין:
//   textPrimary/background   17.21:1     textSecondary/surface  8.47:1
//   textMuted/surface         4.96:1     purple/background      7.14:1
//   success/surface           9.61:1     hot/surface            6.53:1
// כולם עוברים AA (4.5:1) לטקסט רגיל.
//
// textOnAccent הוא היוצא מן הכלל החשוב: על גבי צ'יפ בצבע מותג רווי
// (purple/success/hot) טקסט *לבן* נכשל — 2.64:1 בלבד מול הסגול.
// לכן הטקסט על אקצנט בהיר הוא הרקע הכהה עצמו (7.14:1), בדיוק כמו
// שתגיות ה"משלוח חינם" של Wolt כהות על ירוק בהיר ולא לבנות.
// ============================================================
export const theme = {
  colors: {
    // --- צבעי מותג, מותאמים לרקע כהה ---
    lilac: '#C9B8F0',
    purple: '#9B92FF',
    purpleDark: '#6C63D8',
    blueLight: '#85B7EB',
    blue: '#5DA8F5',
    blueDark: '#185FA5',

    // --- משטחים ---
    background: '#0E1020',
    surface: '#191C31',
    surfaceAlt: '#232742',
    surfaceHigh: '#2C3050',

    // --- טקסט ---
    textPrimary: '#F4F4FA',
    textSecondary: '#B8B6CC',
    textMuted: '#8B89A3',
    textOnPrimary: '#FFFFFF',
    // טקסט על צ'יפ/תגית בצבע אקצנט רווי — ראו הערה למעלה.
    textOnAccent: '#0E1020',

    border: '#2A2E4A',

    // --- סטטוסים ---
    success: '#3ADE8F',
    successBg: 'rgba(58,222,143,0.13)',
    warning: '#FFC46B',
    warningBg: 'rgba(255,196,107,0.14)',
    danger: '#FF7B7B',
    dangerBg: 'rgba(255,123,123,0.14)',

    // "מבצע חם" — 50% הנחה ומעלה. גוון נפרד מ-warning בכוונה: זו
    // הדגשה חיובית שנועדה למשוך את העין, לא אזהרה.
    hot: '#FF7A59',
    hotBg: 'rgba(255,122,89,0.14)',
  },

  // אריחי הקטגוריות: כל קטגוריה מקבלת גוון רקע כהה-רווי משלה, מעל
  // הרקע הכללי — זה מה שנותן לשורת הקטגוריות של Wolt את המראה
  // ה"צבעוני אבל שקט". האיור עצמו (components/illustrations) הוא
  // הצבע הבהיר שמעליו.
  tiles: {
    plum: '#3B2450',
    forest: '#123A2E',
    ocean: '#12304F',
    wine: '#4A1F2B',
    royal: '#241C52',
    amber: '#4A3216',
    teal: '#0F3A3F',
    rose: '#4A2038',
  },

  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 },
  fontSize: { xs: 12, sm: 14, md: 16, lg: 20, xl: 26, xxl: 32 },

  // גובה מגע מינימלי מומלץ (iOS HIG / Material) — כל אלמנט לחיץ
  // באפליקציה עומד בזה, לא רק כפתורים "רשמיים".
  minTouchTarget: 44,

  // צל אחיד לכרטיסים. על אנדרואיד elevation, על iOS shadow* —
  // StyleSheet מתעלם מהשדות הלא-רלוונטיים לכל פלטפורמה.
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
  },
};

export type Theme = typeof theme;
