import { FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../../theme/theme';
import { useCategories } from '../../api/hooks/useCategories';
import { LoadingSpinner, EmptyState } from '../../components/common/EmptyState';

type Props = { onOpenCategory: (categoryId: string, categoryName: string) => void };

// מציג רק קטגוריות-על (parentId ריק) — לחיצה על אחת פותחת את
// BenefitsListScreen מסוננת אליה. תת-קטגוריות (כמו "הנעלה" תחת
// "אופנה") נגישות דרך אותו מסך פרטים, לא כאן — מסך הקטגוריות
// הוא רק כניסה מהירה, לא עץ ניווט מלא.
export function CategoriesScreen({ onOpenCategory }: Props) {
  const { data: categories, isLoading } = useCategories();

  if (isLoading) return <LoadingSpinner />;

  const topLevel = (categories ?? []).filter((c) => !c.parentId);

  if (topLevel.length === 0) {
    return <EmptyState icon="🗂️" title="עדיין אין קטגוריות" />;
  }

  return (
    <FlatList
      data={topLevel}
      keyExtractor={(c) => c.id}
      numColumns={2}
      contentContainerStyle={styles.list}
      columnWrapperStyle={styles.row}
      ListHeaderComponent={<Text style={styles.title}>קטגוריות</Text>}
      renderItem={({ item }) => (
        <Pressable onPress={() => onOpenCategory(item.id, item.name)} style={styles.tile}>
          <Text style={styles.tileText}>{item.name}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: theme.spacing.lg, backgroundColor: theme.colors.background, flexGrow: 1 },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'right',
    marginBottom: theme.spacing.md,
  },
  row: { gap: theme.spacing.sm },
  tile: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: { fontSize: theme.fontSize.md, fontWeight: '600', color: theme.colors.textPrimary, textAlign: 'center' },
});
