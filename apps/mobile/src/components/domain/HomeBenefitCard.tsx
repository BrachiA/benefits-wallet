import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/theme';
import { BenefitImage } from '../common/BenefitImage';
import { formatDiscount } from './BenefitCard';
import { benefitImageUri } from '../../utils/imageUri';
import { isHotDeal, hotDealLabel } from '../../utils/hotDeal';
import type { Benefit } from '../../api/types';

type HomeBenefitCardProps = {
  benefit: Benefit;
  onPress: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
};

// כרטיס "עשיר" בהשראת Wolt, למסך הבית בלבד: תמונה גדולה למעלה,
// מידע דחוס מתחתיה. זו לא תחליף ל-BenefitCard הרגיל (הקומפקטי) —
// Wallet/Search/Favorites/BenefitsListScreen ממשיכים להשתמש בו
// כרגיל, כי שלב 7 מוגדר במפורש כעיצוב מסך הבית בלבד.
export function HomeBenefitCard({ benefit, onPress, isFavorite, onToggleFavorite }: HomeBenefitCardProps) {
  const discount = formatDiscount(benefit);
  const hot = isHotDeal(benefit);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, hot && styles.cardHot, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={hot ? `${benefit.title}, מבצע חם` : benefit.title}
    >
      <View style={styles.imageWrap}>
        {/* r2ImageUrl מועדף על imageUrl — עותק מאוחסן אצלנו שלא
            נשבר כשאתר המקור מסיר את התמונה. ראו utils/imageUri. */}
        <BenefitImage
          uri={benefitImageUri(benefit)}
          label={benefit.title}
          categorySlug={benefit.category?.slug}
          style={styles.image}
          borderRadius={0}
          illustrationSize={72}
        />

        {hot && (
          <View style={styles.hotFlag}>
            <Text style={styles.hotFlagText}>🔥 {hotDealLabel(benefit)}</Text>
          </View>
        )}

        {discount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{discount}</Text>
          </View>
        )}

        {onToggleFavorite && (
          // כפתור השמירה כחול תמיד — לא תלוי במצב "שמור/לא שמור",
          // כדי שהצבע יישאר עקבי עם הדרישה. המצב עצמו מתבטא בצורת הלב.
          <Pressable
            onPress={onToggleFavorite}
            hitSlop={8}
            style={styles.saveButton}
            accessibilityLabel={isFavorite ? 'הסר ממועדפים' : 'הוסף למועדפים'}
          >
            <Text style={styles.saveButtonIcon}>{isFavorite ? '♥' : '♡'}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {benefit.title}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {benefit.shortDescription}
        </Text>

        <View style={styles.footer}>
          {benefit.category?.name && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{benefit.category.name}</Text>
            </View>
          )}
          {benefit.requiresCoupon && (
            <View style={[styles.categoryBadge, { backgroundColor: theme.colors.warningBg }]}>
              <Text style={[styles.categoryText, { color: theme.colors.warning }]}>דורש קופון</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  // מבצע חם מסומן במסגרת כתומה גם ברשימה הראשית, לא רק בשורה
  // הייעודית — כך הוא נשאר מזוהה גם כשגוללים רחוק מהשורה ההיא.
  cardHot: { borderColor: theme.colors.hot },
  cardPressed: { opacity: 0.85 },
  imageWrap: { width: '100%', height: 150 },
  image: { width: '100%', height: '100%' },

  hotFlag: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    backgroundColor: theme.colors.hot,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  hotFlagText: { fontSize: theme.fontSize.xs, fontWeight: '800', color: theme.colors.textOnAccent },

  // כחול — עומד בדרישה המפורשת שכפתור השמירה יהיה כחול, לא סגול
  // כמו הכוכב ב-BenefitCard הרגיל. רקע לבן-שקוף מאחורי הלב עצמו
  // כדי שיישאר קריא מעל כל תמונה, גם בהירה.
  saveButton: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    width: theme.minTouchTarget,
    height: theme.minTouchTarget,
    borderRadius: theme.minTouchTarget / 2,
    backgroundColor: theme.colors.blueDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonIcon: { color: theme.colors.textOnPrimary, fontSize: 20 },

  discountBadge: {
    position: 'absolute',
    bottom: theme.spacing.sm,
    right: theme.spacing.sm,
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  // ראו הערת textOnAccent ב-theme.ts — לבן על הסגול הזה נכשל ב-AA.
  discountText: { color: theme.colors.textOnAccent, fontWeight: '800', fontSize: theme.fontSize.sm },

  body: { padding: theme.spacing.md },
  title: { fontSize: theme.fontSize.md, fontWeight: '700', color: theme.colors.textPrimary, textAlign: 'right' },
  description: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    marginTop: 2,
  },
  footer: { flexDirection: 'row-reverse', gap: theme.spacing.xs, marginTop: theme.spacing.sm },
  categoryBadge: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  categoryText: { fontSize: theme.fontSize.xs, color: theme.colors.lilac, fontWeight: '500' },
});
