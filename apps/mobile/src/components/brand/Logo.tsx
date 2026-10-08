import Svg, { Defs, Filter, FeDropShadow, G, Rect } from 'react-native-svg';

type LogoProps = { size?: number };

// שני נתיבים גיאומטרים נפרדים, לא הקטנה של אותה צורה: מ-56px ומעלה
// (Full) יש סיבוב עדין, פס לילך על הכרטיס וצל רך. מתחת ל-56px
// (Micro) — צורה ישרה בלי סיבוב ובלי פרטים דקים, וטבעת החיתוך
// (ה"מרווח השלילי" בין הכרטיס לכיס) עבה יחסית לגודל כדי שתישרוד
// רשת פיקסלים דחוסה (favicon/אייקון). שתיהן נבנות משלוש שכבות צבע
// אחיד בלבד — הפרדה ע"י חיתוך צורה (keyline), לא ע"י blur.
const FULL_VARIANT_MIN_SIZE = 56;

function LogoFull({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <Filter id="cardShadow" x="-30%" y="-30%" width="160%" height="160%">
          <FeDropShadow dx="0" dy="2" stdDeviation="2.2" floodColor="#12294a" floodOpacity={0.35} />
        </Filter>
      </Defs>
      <Rect x="4" y="4" width="92" height="92" rx="24" fill="#185FA5" />
      <Rect x="14" y="42" width="72" height="44" rx="14" fill="#378ADD" />
      <G rotation={-8} originX={52} originY={34}>
        <Rect x="23" y="14" width="58" height="40" rx="10" fill="#185FA5" />
      </G>
      <G rotation={-8} originX={52} originY={34} filter="url(#cardShadow)">
        <Rect x="27" y="18" width="50" height="32" rx="8" fill="#7F77DD" />
        <Rect x="31" y="22" width="42" height="7" rx="3.5" fill="#C9B8F0" />
      </G>
    </Svg>
  );
}

function LogoMicro({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Rect x="4" y="4" width="92" height="92" rx="20" fill="#185FA5" />
      <Rect x="13" y="48" width="74" height="40" rx="12" fill="#378ADD" />
      <Rect x="22" y="10" width="56" height="48" rx="12" fill="#185FA5" />
      <Rect x="30" y="18" width="40" height="32" rx="8" fill="#7F77DD" />
    </Svg>
  );
}

// לוגו Benefits Wallet: כרטיס נשלף מכיס ארנק. size קובע גם את
// הגודל בפועל וגם איזו משתי הגרסאות תרונדר — הקורא לא צריך לבחור
// בין Full ל-Micro בעצמו.
export function Logo({ size = 40 }: LogoProps) {
  return size >= FULL_VARIANT_MIN_SIZE ? <LogoFull size={size} /> : <LogoMicro size={size} />;
}
