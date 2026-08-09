import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/theme';
import type { Benefit } from '../../api/types';

type BenefitCardProps = {
  benefit: Benefit;
  onPress: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
};

function formatDiscount(benefit: Benefit): string | null {
  if (benefit.discountValue == null) return null;
  if (benefit.discountUnit === 'PERCENT') return `${benefit.discountValue}%`;
  if (benefit.discountUnit === 'ILS') return `₪${benefit.discountValue}`;
  if (benefit.discountUnit === 'POINTS') return `${benefit.discountValue} נק'`;
  return null;
}

// ה-signature element של האפליקציה: מבנה קבוע וניתן-לזיהוי-מיידי
// שחוזר בכל מסך. עין שסורקת רשימה ארוכה של הטבות תמיד יודעת איפה
// למצוא את ערך ההנחה (פינה, בולט, גדול) ואת שם המותג (כותרת ראשית).
export function BenefitCard({ benefit, onPress, isFavorite, onToggleFavorite }: BenefitCardProps) {
  const discount = formatDiscount(benefit);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={benefit.title}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>
            {benefit.title}
          </Text>
          {onToggleFavorite && (
            <Pressable
              onPress={onToggleFavorite}
              hitSlop={12}
              style={styles.favoriteButton}
              accessibilityLabel={isFavorite ? 'הסר ממועדפים' : 'הוסף למועדפים'}
            >
              <Text style={{ fontSize: 20, color: isFavorite ? theme.colors.purple : theme.colors.textMuted }}>
                {isFavorite ? '★' : '☆'}
              </Text>
            </Pressable>
          )}
        </View>

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

      {discount && (
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>{discount}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  cardPressed: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  content: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    flex: 1,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  favoriteButton: {
    minWidth: theme.minTouchTarget,
    minHeight: theme.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
    marginLeft: -8,
  },
  description: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row-reverse',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  categoryBadge: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  categoryText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.purpleDark,
    fontWeight: '500',
  },
  discountBadge: {
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 54,
    alignItems: 'center',
  },
  discountText: {
    color: theme.colors.textOnPrimary,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
  },
});
