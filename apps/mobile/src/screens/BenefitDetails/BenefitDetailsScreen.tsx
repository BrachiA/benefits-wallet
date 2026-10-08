import { useEffect } from 'react';
import { ScrollView, Share, StyleSheet, Text, View, Pressable } from 'react-native';
import { theme } from '../../theme/theme';
import { useUserSelection } from '../../storage/useUserSelection';
import type { Benefit } from '../../api/types';

type Props = { benefit: Benefit; onBack: () => void };

function formatDiscount(benefit: Benefit): string | null {
  if (benefit.discountValue == null) return null;
  if (benefit.discountUnit === 'PERCENT') return `${benefit.discountValue}% הנחה`;
  if (benefit.discountUnit === 'ILS') return `₪${benefit.discountValue} הנחה`;
  if (benefit.discountUnit === 'POINTS') return `${benefit.discountValue} נקודות`;
  return null;
}

function formatEndDate(endDate?: string): string | null {
  if (!endDate) return null;
  const date = new Date(endDate);
  const daysLeft = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 0) return null;
  if (daysLeft <= 7) return `נגמר בעוד ${daysLeft} ימים`;
  return `בתוקף עד ${date.toLocaleDateString('he-IL')}`;
}

const channelLabels: Record<Benefit['channel'], string> = {
  ONLINE: 'אונליין בלבד',
  IN_STORE: 'בסניפים בלבד',
  BOTH: 'אונליין ובסניפים',
};

export function BenefitDetailsScreen({ benefit, onBack }: Props) {
  const { isFavorite, toggleFavorite, recordCategoryInterest } = useUserSelection();
  const discount = formatDiscount(benefit);
  const endDateLabel = formatEndDate(benefit.endDate);

  // צפייה בפרטי הטבה היא אות עניין בקטגוריה שלה — משמש לסידור
  // האישי במסך הבית (ראו personalizedOrder.ts). נרשם פעם אחת לכל
  // כניסה למסך, לא בכל render.
  useEffect(() => {
    recordCategoryInterest(benefit.category?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benefit.id]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backButton} hitSlop={12}>
        <Text style={styles.backText}>‹ חזרה</Text>
      </Pressable>

      <View style={styles.headerRow}>
        <Pressable onPress={() => toggleFavorite(benefit.id)} hitSlop={12} style={styles.favoriteButton}>
          <Text style={{ fontSize: 26, color: isFavorite(benefit.id) ? theme.colors.purple : theme.colors.textMuted }}>
            {isFavorite(benefit.id) ? '★' : '☆'}
          </Text>
        </Pressable>
        <Text style={styles.title}>{benefit.title}</Text>
      </View>

      {discount && (
        <View style={styles.discountBanner}>
          <Text style={styles.discountBannerText}>{discount}</Text>
        </View>
      )}

      {endDateLabel && (
        <View style={styles.urgencyBadge}>
          <Text style={styles.urgencyText}>{endDateLabel}</Text>
        </View>
      )}

      <Text style={styles.description}>{benefit.fullDescription ?? benefit.shortDescription}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>איפה תקף</Text>
        <Text style={styles.metaValue}>{channelLabels[benefit.channel]}</Text>
      </View>

      {benefit.requiresCoupon && (
        <View style={styles.couponNotice}>
          <Text style={styles.couponNoticeText}>
            ההטבה הזו דורשת קוד קופון במימוש — הקוד יוצג בשלב הבא (בקרוב)
          </Text>
        </View>
      )}

      {benefit.tags && benefit.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {benefit.tags.map((t, i) => (
            <View key={i} style={styles.tag}>
              <Text style={styles.tagText}>{t.tag.name}</Text>
            </View>
          ))}
        </View>
      )}

      <Pressable
        onPress={() => Share.share({ message: `${benefit.title} — ${benefit.shortDescription}` })}
        style={styles.shareButton}
      >
        <Text style={styles.shareButtonText}>שתפי הטבה זו</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  backButton: { marginBottom: theme.spacing.md, minHeight: theme.minTouchTarget, justifyContent: 'center' },
  backText: { fontSize: theme.fontSize.md, color: theme.colors.purple, fontWeight: '600' },
  headerRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: theme.spacing.sm },
  favoriteButton: {
    minWidth: theme.minTouchTarget,
    minHeight: theme.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: theme.fontSize.xl, fontWeight: '700', color: theme.colors.textPrimary, textAlign: 'right' },
  discountBanner: {
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  // באנר ההנחה על רקע purple בהיר — ראו הערת textOnAccent ב-theme.ts.
  discountBannerText: { color: theme.colors.textOnAccent, fontSize: theme.fontSize.lg, fontWeight: '800' },
  urgencyBadge: {
    backgroundColor: theme.colors.warningBg,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    alignSelf: 'flex-end',
    marginTop: theme.spacing.sm,
  },
  urgencyText: { color: theme.colors.warning, fontSize: theme.fontSize.xs, fontWeight: '600' },
  description: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    lineHeight: 22,
    marginTop: theme.spacing.lg,
  },
  metaRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  metaLabel: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted },
  metaValue: { fontSize: theme.fontSize.sm, color: theme.colors.textPrimary, fontWeight: '600' },
  couponNotice: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  couponNoticeText: { fontSize: theme.fontSize.sm, color: theme.colors.lilac, textAlign: 'right' },
  tagsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: theme.spacing.xs, marginTop: theme.spacing.md },
  tag: { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary },
  shareButton: {
    marginTop: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    minHeight: theme.minTouchTarget,
    justifyContent: 'center',
  },
  shareButtonText: { fontSize: theme.fontSize.md, color: theme.colors.textPrimary, fontWeight: '600' },
});
