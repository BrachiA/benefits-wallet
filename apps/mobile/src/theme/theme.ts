// עקבי ל-BP brand identity מה-Dashboard, אך מותאם למובייל: פחות
// ניואנסים, יותר קונטרסט (מסך קטן, תאורת שמש, שימוש חד-יד).
export const theme = {
  colors: {
    lilac: '#C9B8F0',
    purple: '#7F77DD',
    purpleDark: '#3C3489',
    blueLight: '#85B7EB',
    blue: '#378ADD',
    blueDark: '#185FA5',

    background: '#F7F7FB',
    surface: '#FFFFFF',
    surfaceAlt: '#F0EEFC',

    textPrimary: '#1C1B29',
    textSecondary: '#5C5A6E',
    textMuted: '#9896A8',
    textOnPrimary: '#FFFFFF',

    border: '#E4E2EE',

    success: '#1E7A3D',
    successBg: '#E6F4EA',
    warning: '#92610F',
    warningBg: '#FDF0DC',
    danger: '#B32424',
    dangerBg: '#FBE7E7',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: { sm: 8, md: 14, lg: 20, pill: 999 },
  fontSize: { xs: 12, sm: 14, md: 16, lg: 20, xl: 26 },
  // גובה מגע מינימלי מומלץ (iOS HIG / Material) — כל אלמנט לחיץ
  // באפליקציה עומד בזה, לא רק כפתורים "רשמיים".
  minTouchTarget: 44,
};

export type Theme = typeof theme;
