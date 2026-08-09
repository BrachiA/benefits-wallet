import { FlatList, StyleSheet, Text } from 'react-native';
import { theme } from '../../theme/theme';
import { useFavoriteBenefits } from '../../api/hooks/useFavoriteBenefits';
import { useUserSelection } from '../../storage/useUserSelection';
import { BenefitCard } from '../../components/domain/BenefitCard';
import { EmptyState, LoadingSpinner } from '../../components/common/EmptyState';
import type { Benefit } from '../../api/types';

type Props = { onOpenBenefit: (benefit: Benefit) => void };

export function FavoritesScreen({ onOpenBenefit }: Props) {
  const { data: favorites, isLoading } = useFavoriteBenefits();
  const { toggleFavorite } = useUserSelection();

  if (isLoading) return <LoadingSpinner />;

  return (
    <FlatList
      data={favorites ?? []}
      keyExtractor={(b) => b.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<Text style={styles.title}>מועדפים</Text>}
      renderItem={({ item }) => (
        <BenefitCard benefit={item} onPress={() => onOpenBenefit(item)} isFavorite onToggleFavorite={() => toggleFavorite(item.id)} />
      )}
      ListEmptyComponent={
        <EmptyState icon="⭐" title="עדיין לא סימנת הטבות מועדפות" hint="הקישי על הכוכב בכל הטבה כדי לשמור אותה כאן" />
      }
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
});
