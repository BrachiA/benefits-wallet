import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { theme } from '../../theme/theme';

// ============================================================
// איורי הקטגוריות — הלב הוויזואלי של שורת הקטגוריות במסך הבית
// (בהשראת האריחים המאוירים של Wolt). כל איור נבנה משכבות צורה
// שטוחות ולא מ-gradient: צורת בסיס, שכבה כהה יותר מתחתיה לעומק,
// והדגש בהיר + נקודת ברק קטנה למעלה. זה נותן תחושת נפח בלי לשלם
// בביצועים על gradients/filters שמתרנדרים מחדש בכל גלילה אופקית.
//
// המיפוי הוא לפי slug של הקטגוריות שקיימות בפועל ב-DB (אומת מול
// טבלת categories, 12 קטגוריות ראשיות) ולא לפי שם חופשי — שם
// עברי עלול להשתנות בדשבורד, slug לא. קטגוריה לא-מוכרת (נוספה
// אחרי כתיבת הקובץ) נופלת ל-DefaultIllustration ולא לריק.
// ============================================================

type IllustrationProps = { size?: number };

const SIZE = 100; // viewBox אחיד לכל האיורים

// גוון האריח שמאחורי כל איור. נבחר כך שיהיה ניגוד נעים מול צבעי
// האיור עצמו, ושהשורה כולה תיראה מגוונת אך לא רועשת.
export const CATEGORY_TILE_COLORS: Record<string, string> = {
  fashion: theme.tiles.plum,
  'fashion-shoes': theme.tiles.plum,
  food: theme.tiles.forest,
  electronics: theme.tiles.ocean,
  dining: theme.tiles.amber,
  'health-pharm': theme.tiles.teal,
  'travel-leisure': theme.tiles.ocean,
  attractions: theme.tiles.rose,
  'culture-shows': theme.tiles.royal,
  cinema: theme.tiles.wine,
  education: theme.tiles.royal,
  'gift-cards': theme.tiles.wine,
  'digital-subscriptions': theme.tiles.plum,
};

export function tileColorFor(slug: string | undefined): string {
  if (slug && CATEGORY_TILE_COLORS[slug]) return CATEGORY_TILE_COLORS[slug];
  // גיבוב יציב לגוון קבוע — קטגוריה חדשה תמיד תקבל את אותו אריח,
  // לא צבע מתחלף בכל רינדור.
  const palette = Object.values(theme.tiles);
  let hash = 0;
  const key = slug ?? '';
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

// ---------- אופנה: חולצת טי על קולב ----------
// גרסה קודמת (קולב + חצאית משולשת) נקראה בבדיקה ויזואלית כמנורת
// שולחן, לא כבגד. חולצת טי עם שרוולים וצווארון היא הצללית הכי
// חד-משמעית ל"אופנה" בגודל קטן.
function Fashion() {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Path d="M56 10c-5 0-8 3-8 7 0 3 2 5 4 6" stroke="#C9B8F0" strokeWidth={3.5} fill="none" strokeLinecap="round" />
      <Path
        d="M39 26 24 33 17 48l14 6v29c0 3 2 5 5 5h28c3 0 5-2 5-5V54l14-6-7-15-15-7c-3 6-8 9-11 9s-8-3-11-9z"
        fill="#6C63D8"
      />
      <Path d="M39 26 24 33 17 48l14 6V38l8-12z" fill="#9B92FF" />
      <Path d="M39 26c3 6 8 9 11 9s8-3 11-9" stroke="#C9B8F0" strokeWidth={3} fill="none" strokeLinecap="round" />
      <Rect x="41" y="58" width="18" height="13" rx="3" fill="#9B92FF" />
      <Rect x="44" y="62" width="12" height="2.5" rx="1.25" fill="#C9B8F0" />
    </Svg>
  );
}

// ---------- מזון וסופרמרקט: שקית עם מצרכים ----------
function Food() {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Path d="M26 40h48l-5 44c-.4 4-3.6 7-7.6 7H38.6c-4 0-7.2-3-7.6-7L26 40z" fill="#2E9E6B" />
      <Path d="M26 40h48l-1.5 13h-45L26 40z" fill="#3ADE8F" />
      <Path d="M38 40V29c0-6.6 5.4-12 12-12s12 5.4 12 12v11" stroke="#C9B8F0" strokeWidth={4.5} fill="none" strokeLinecap="round" />
      <Circle cx="40" cy="63" r="8" fill="#FF7A59" />
      <Circle cx="37.5" cy="60" r="2.5" fill="#FFD9CE" />
      <Circle cx="59" cy="66" r="10" fill="#FFC46B" />
      <Circle cx="56" cy="62.5" r="3" fill="#FFE9C4" />
      <Path d="M47 76c4-1 9-1 13 0" stroke="#1D7A52" strokeWidth={3} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

// ---------- אלקטרוניקה: אוזניות ----------
function Electronics() {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Path d="M24 62V50c0-14.4 11.6-26 26-26s26 11.6 26 26v12" stroke="#5DA8F5" strokeWidth={7} fill="none" strokeLinecap="round" />
      <Path d="M24 58V50c0-14.4 11.6-26 26-26" stroke="#9BD0FF" strokeWidth={7} fill="none" strokeLinecap="round" />
      <Rect x="14" y="56" width="19" height="30" rx="9.5" fill="#6C63D8" />
      <Rect x="14" y="56" width="19" height="13" rx="6.5" fill="#9B92FF" />
      <Rect x="67" y="56" width="19" height="30" rx="9.5" fill="#6C63D8" />
      <Rect x="67" y="56" width="19" height="13" rx="6.5" fill="#9B92FF" />
      <Circle cx="23.5" cy="63" r="2.5" fill="#E7E3FF" />
    </Svg>
  );
}

// ---------- מסעדות ובתי קפה: כוס קפה ----------
function Dining() {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Path d="M40 14c-3 4-3 7 0 11M50 12c-3 5-3 9 0 13M60 14c-3 4-3 7 0 11" stroke="#B8B6CC" strokeWidth={3.5} strokeLinecap="round" fill="none" />
      <Path d="M22 36h50v22c0 12.7-10.3 23-23 23h-4c-12.7 0-23-10.3-23-23V36z" fill="#C24E2C" />
      <Path d="M22 36h50v10H22V36z" fill="#FF7A59" />
      <Path d="M72 42h6c6 0 11 5 11 11s-5 11-11 11h-6" stroke="#FFC46B" strokeWidth={5} fill="none" strokeLinecap="round" />
      <Ellipse cx="47" cy="41" rx="19" ry="4" fill="#FFD9CE" opacity={0.6} />
      <Path d="M18 88h58" stroke="#8B89A3" strokeWidth={5} strokeLinecap="round" />
    </Svg>
  );
}

// ---------- בריאות ופארם: בקבוקון + צלב ----------
function HealthPharm() {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Rect x="30" y="14" width="34" height="12" rx="4" fill="#9BD0FF" />
      <Path d="M27 30h40c3.3 0 6 2.7 6 6v44c0 4.4-3.6 8-8 8H29c-4.4 0-8-3.6-8-8V36c0-3.3 2.7-6 6-6z" fill="#1FA3A3" />
      <Path d="M27 30h40c3.3 0 6 2.7 6 6v8H21v-8c0-3.3 2.7-6 6-6z" fill="#3ADE8F" />
      <Path d="M42 55h10v9h9v10h-9v9H42v-9h-9V64h9v-9z" fill="#EAFFF6" />
      <Circle cx="66" cy="37" r="2.5" fill="#EAFFF6" opacity={0.8} />
    </Svg>
  );
}

// ---------- תיירות ונופש: מזוודה + דקל ----------
function TravelLeisure() {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Path d="M38 30V22c0-3.3 2.7-6 6-6h12c3.3 0 6 2.7 6 6v8" stroke="#9BD0FF" strokeWidth={4.5} fill="none" strokeLinecap="round" />
      <Rect x="16" y="30" width="68" height="50" rx="10" fill="#2F6FB5" />
      <Rect x="16" y="30" width="68" height="12" rx="6" fill="#5DA8F5" />
      <Rect x="44" y="30" width="12" height="50" fill="#9BD0FF" opacity={0.55} />
      <Rect x="24" y="80" width="8" height="8" rx="3" fill="#1B4B7E" />
      <Rect x="68" y="80" width="8" height="8" rx="3" fill="#1B4B7E" />
      <Circle cx="70" cy="24" r="8" fill="#FFC46B" />
    </Svg>
  );
}

// ---------- אטרקציות: גלגל ענק ----------
function Attractions() {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Path d="M50 52 30 88h40L50 52z" fill="#8B5A9E" />
      <Circle cx="50" cy="42" r="30" fill="none" stroke="#FF6FA5" strokeWidth={5} />
      <Circle cx="50" cy="42" r="9" fill="#FFC46B" />
      <Path d="M50 12v60M20 42h60M29 21l42 42M71 21 29 63" stroke="#FF6FA5" strokeWidth={3.5} />
      <Circle cx="50" cy="12" r="5.5" fill="#3ADE8F" />
      <Circle cx="80" cy="42" r="5.5" fill="#5DA8F5" />
      <Circle cx="50" cy="72" r="5.5" fill="#FFC46B" />
      <Circle cx="20" cy="42" r="5.5" fill="#C9B8F0" />
      <Circle cx="50" cy="42" r="4" fill="#FFF3D6" />
    </Svg>
  );
}

// ---------- תרבות ומופעים: מיקרופון ----------
function CultureShows() {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Rect x="38" y="10" width="24" height="44" rx="12" fill="#6C63D8" />
      <Rect x="38" y="10" width="11" height="44" rx="5.5" fill="#9B92FF" />
      <Path d="M26 44c0 13.3 10.7 24 24 24s24-10.7 24-24" stroke="#C9B8F0" strokeWidth={5} fill="none" strokeLinecap="round" />
      <Path d="M50 68v14" stroke="#C9B8F0" strokeWidth={5} strokeLinecap="round" />
      <Path d="M34 88h32" stroke="#FF6FA5" strokeWidth={6} strokeLinecap="round" />
      <Circle cx="44" cy="20" r="2.5" fill="#E7E3FF" />
    </Svg>
  );
}

// ---------- קולנוע: פופקורן ----------
function Cinema() {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Circle cx="35" cy="34" r="11" fill="#FFE9C4" />
      <Circle cx="52" cy="26" r="12" fill="#FFF6E3" />
      <Circle cx="67" cy="35" r="10" fill="#FFE9C4" />
      <Circle cx="44" cy="40" r="9" fill="#FFF6E3" />
      <Circle cx="60" cy="41" r="8" fill="#FFE9C4" />
      <Path d="M26 44h48l-5 40c-.4 3.4-3.3 6-6.7 6H37.7c-3.4 0-6.3-2.6-6.7-6l-5-40z" fill="#C0392B" />
      <Path d="M36 44h9l3 46h-6l-6-46zM55 44h9l-6 46h-6l3-46z" fill="#FFF6E3" opacity={0.9} />
    </Svg>
  );
}

// ---------- חינוך וקורסים: כובע סיום + ספר ----------
function Education() {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Path d="M50 16 12 34l38 18 38-18-38-18z" fill="#9B92FF" />
      <Path d="M50 34 12 34l38 18 38-18-38 0z" fill="#6C63D8" />
      <Path d="M30 44v18c0 6 9 11 20 11s20-5 20-11V44" fill="#5B54BF" />
      <Path d="M84 40v20" stroke="#FFC46B" strokeWidth={4} strokeLinecap="round" />
      <Circle cx="84" cy="64" r="5" fill="#FFC46B" />
      <Path d="M24 78h52c2.2 0 4 1.8 4 4v4c0 2.2-1.8 4-4 4H24c-2.2 0-4-1.8-4-4v-4c0-2.2 1.8-4 4-4z" fill="#3ADE8F" />
    </Svg>
  );
}

// ---------- תווי קנייה: כרטיס מתנה עם סרט ----------
function GiftCards() {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Rect x="12" y="30" width="76" height="52" rx="10" fill="#B03A5B" />
      <Rect x="12" y="30" width="76" height="14" rx="7" fill="#FF6FA5" />
      <Rect x="44" y="30" width="12" height="52" fill="#FFC46B" />
      <Rect x="12" y="52" width="76" height="10" fill="#FFC46B" />
      <Path d="M50 30c-7-10-20-8-20 0 0 5 8 6 20 0zM50 30c7-10 20-8 20 0 0 5-8 6-20 0z" fill="#FFD9CE" />
      <Circle cx="50" cy="30" r="5" fill="#FFF3D6" />
      <Rect x="22" y="68" width="14" height="4" rx="2" fill="#FFD9CE" opacity={0.7} />
    </Svg>
  );
}

// ---------- מנויי תוכן דיגיטלי: מסך + כפתור play ----------
function DigitalSubscriptions() {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Rect x="12" y="20" width="76" height="52" rx="9" fill="#3B2450" />
      <Rect x="12" y="20" width="76" height="52" rx="9" fill="none" stroke="#9B92FF" strokeWidth={4} />
      <Path d="M43 36l20 10-20 10V36z" fill="#3ADE8F" />
      <Path d="M36 84h28" stroke="#C9B8F0" strokeWidth={5} strokeLinecap="round" />
      <Path d="M50 72v12" stroke="#C9B8F0" strokeWidth={5} strokeLinecap="round" />
      <Circle cx="76" cy="30" r="3" fill="#FFC46B" />
    </Svg>
  );
}

// ---------- ברירת מחדל: תג הנחה ----------
function DefaultIllustration() {
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Path d="M52 14H26c-6.6 0-12 5.4-12 12v26c0 3.2 1.3 6.2 3.5 8.5l30 30c4.7 4.7 12.3 4.7 17 0l22-22c4.7-4.7 4.7-12.3 0-17l-30-30C54.2 15.3 51.2 14 48 14z" fill="#6C63D8" />
      <Path d="M52 14H26c-6.6 0-12 5.4-12 12v10h44L52 14z" fill="#9B92FF" opacity={0.6} />
      <Circle cx="34" cy="34" r="8" fill="#FFF3D6" />
      <Path d="M46 62l20-20" stroke="#FFC46B" strokeWidth={6} strokeLinecap="round" />
      <Circle cx="45" cy="63" r="4.5" fill="#FFC46B" />
      <Circle cx="67" cy="41" r="4.5" fill="#FFC46B" />
    </Svg>
  );
}

const ILLUSTRATIONS: Record<string, () => React.ReactElement> = {
  fashion: Fashion,
  'fashion-shoes': Fashion,
  food: Food,
  electronics: Electronics,
  dining: Dining,
  'health-pharm': HealthPharm,
  'travel-leisure': TravelLeisure,
  attractions: Attractions,
  'culture-shows': CultureShows,
  cinema: Cinema,
  education: Education,
  'gift-cards': GiftCards,
  'digital-subscriptions': DigitalSubscriptions,
};

export function CategoryIllustration({ slug, size = 56 }: IllustrationProps & { slug?: string }) {
  const Component = (slug && ILLUSTRATIONS[slug]) || DefaultIllustration;
  return (
    <View style={{ width: size, height: size }}>
      <Component />
    </View>
  );
}
