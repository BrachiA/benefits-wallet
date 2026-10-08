import { useState } from 'react';
import { Image, StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';
import { theme } from '../../theme/theme';
import { CategoryIllustration, tileColorFor } from '../illustrations/CategoryIllustration';

type Props = {
  uri?: string;
  label: string;
  // ה-slug של קטגוריית ההטבה. מזין את ה-placeholder: הטבה בלי
  // תמונה מקבלת את איור הקטגוריה שלה, לא ריבוע אנונימי.
  categorySlug?: string;
  style?: StyleProp<ImageStyle>;
  borderRadius?: number;
  // גודל האיור ב-placeholder. הקורא יודע כמה גדול הכרטיס שלו —
  // כרטיס ראשי (160px) רוצה איור גדול, שורת "חדש" (92px) קטן.
  illustrationSize?: number;
};

const PLACEHOLDER_TILES = Object.values(theme.tiles);

// גיבוב יציב לגוון אריח כשאין קטגוריה כלל — אותה הטבה תמיד מקבלת
// אותו גוון, לא צבע מתחלף בכל רינדור.
function fallbackTile(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return PLACEHOLDER_TILES[hash % PLACEHOLDER_TILES.length];
}

// ============================================================
// תמונת הטבה עם fallback ממותג.
//
// זה לא מקרה קצה נדיר אלא מצב ברירת המחדל: רוב ההטבות במערכת
// מגיעות בלי imageUrl (וגם אחרי חיבור R2, הטבה שלא נסרקה עם
// תמונה נשארת בלי). לכן ה-placeholder חייב להיראות *מעוצב*, לא
// כמו תמונה שבורה.
//
// הגרסה הקודמת הציגה אות ענקית אחת על ריבוע צבע שטוח — בבדיקה
// ויזואלית זה נראה כמו מצב debug, ומכיוון שהוא כיסה 160px בכל
// כרטיס ראשי, הוא היה בפועל *המראה* של האפליקציה. במקומו: איור
// הקטגוריה של ההטבה על אריח הצבע שלה, עם הילה עדינה מאחוריו —
// גם יפה וגם אינפורמטיבי (העין מזהה "אוכל" / "אופנה" מיד, בלי
// לקרוא).
// ============================================================
export function BenefitImage({
  uri,
  label,
  categorySlug,
  style,
  borderRadius = theme.radius.md,
  illustrationSize = 64,
}: Props) {
  const [failedToLoad, setFailedToLoad] = useState(false);
  const showPlaceholder = !uri || failedToLoad;

  if (showPlaceholder) {
    const background = categorySlug ? tileColorFor(categorySlug) : fallbackTile(label);
    return (
      <View style={[styles.placeholder, { backgroundColor: background, borderRadius }, style]}>
        {/* הילה: עיגול בהיר-שקוף שמרים את האיור מהרקע ומונע ממנו
            להיראות "צף" על שטח ריק. */}
        <View style={[styles.halo, { width: illustrationSize * 1.5, height: illustrationSize * 1.5, borderRadius: illustrationSize }]} />
        <CategoryIllustration slug={categorySlug} size={illustrationSize} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={[styles.image, { borderRadius }, style]}
      onError={() => setFailedToLoad(true)}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: theme.colors.surfaceAlt },
  placeholder: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  halo: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.05)' },
});
