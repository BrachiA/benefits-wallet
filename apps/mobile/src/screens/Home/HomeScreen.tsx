import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/theme';
import { useBenefits } from '../../api/hooks/useBenefits';
import { useCategories } from '../../api/hooks/useCategories';
import { useUserSelection } from '../../storage/useUserSelection';
import { personalizedOrder } from '../../storage/personalizedOrder';
import { BenefitCard } from '../../components/domain/BenefitCard';
import { EmptyState, LoadingSpinner } from '../../components/common/EmptyState';
import type { Benefit } from '../../api/types';

type Props = {
  onOpenBenefit: (benefit: Benefit) => void;
  onOpenCategory: (categoryId: string, categoryName: string) => void;
};

// מסך הבית: לא עוד רשימה שטוחה של כל ההטבות (זה תפקיד מסך
// Benefits/Wallet) — כאן המטרה היא "מה הכי משתלם לי עכשיו", לכן
// isPopular:true ממוקד, פלוס שורת קטגוריות לניווט מהיר.
export function HomeScreen({ onOpenBenefit, onOpenCategory }: Props) {
  const { data: popularBenefits, isLoading: isLoadingBenefits } = useBenefits({ isPopular: true });
  const { data: categories, isLoading: isLoadingCategories } = useCategories();
  const { isFavorite, toggleFavorite, selection } = useUserSelection();

  const topLevelCategories = categories?.filter((c) => !c.parentId) ?? [];

  // סדר רנדומלי עם העדפה לקטגוריות שהמשתמשת צופה/מעיינת בהן יותר
  // (שלב 6). מחושב מחדש רק כשרשימת ההטבות או ההעדפה משתנות, לא
  // בכל render — אחרת הרשימה הייתה "מתערבבת מחדש" תוך כדי גלילה.
  const personalizedBenefits = useMemo(
    () => personalizedOrder(popularBenefits ?? [], (b) => b.category?.id, selection?.categoryInterest ?? {}),
    [popularBenefits, selection?.categoryInterest]
  );

  if (isLoadingBenefits) return <LoadingSpinner />;

  return (
    <FlatList
      data={personalizedBenefits}
      keyExtractor={(b) => b.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <>
          <Text style={styles.greeting}>ההטבות שלך</Text>

          {!isLoadingCategories && topLevelCategories.length > 0 && (
            <FlatList
              horizontal
              inverted // RTL: הגלילה האופקית מתחילה מימין
              data={topLevelCategories}
              keyExtractor={(c) => c.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}
              renderItem={({ item }) => (
                <Pressable onPress={() => onOpenCategory(item.id, item.name)} style={styles.categoryChip}>
                  <Text style={styles.categoryChipText}>{item.name}</Text>
                </Pressable>
              )}
            />
          )}

          <Text style={styles.sectionTitle}>הטבות פופולריות</Text>
        </>
      }
      renderItem={({ item }) => (
        <BenefitCard
          benefit={item}
          onPress={() => onOpenBenefit(item)}
          isFavorite={isFavorite(item.id)}
          onToggleFavorite={() => toggleFavorite(item.id)}
        />
      )}
      ListEmptyComponent={
        <EmptyState
          icon="🎁"
          title="אין עדיין הטבות פופולריות עבורך"
          hint="ייתכן שהמועדונים שבחרת עדיין לא כוללים הטבות פעילות — נסי לעבור על כל ההטבות בארנק"
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: theme.spacing.lg, backgroundColor: theme.colors.background, flexGrow: 1 },
  greeting: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'right',
    marginBottom: theme.spacing.md,
  },
  categoryRow: { gap: theme.spacing.xs, paddingBottom: theme.spacing.md },
  categoryChip: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minHeight: theme.minTouchTarget,
    justifyContent: 'center',
  },
  categoryChipText: { fontSize: theme.fontSize.sm, color: theme.colors.textPrimary, fontWeight: '500' },
  sectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'right',
    marginBottom: theme.spacing.sm,
  },
});
