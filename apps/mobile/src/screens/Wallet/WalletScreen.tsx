import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/theme';
import { usePrograms } from '../../api/hooks/usePrograms';
import { useUserSelection } from '../../storage/useUserSelection';
import { LoadingSpinner, EmptyState } from '../../components/common/EmptyState';
import type { Program } from '../../api/types';

type Props = {
  onOpenProgram: (program: Program) => void;
  onGoToOnboarding: () => void;
};

// "ארנק ההטבות" כשמו כן הוא: מציג את הכרטיסים עצמם (לא את
// ההטבות ישירות) — לחיצה על כרטיס פותחת את ההטבות שתקפות דרכו
// בלבד, ממש כמו לפתוח תא בארנק פיזי.
export function WalletScreen({ onOpenProgram, onGoToOnboarding }: Props) {
  const { data: allPrograms, isLoading } = usePrograms();
  const { selection } = useUserSelection();

  if (isLoading || !selection) return <LoadingSpinner />;

  const myPrograms = (allPrograms ?? []).filter((p) => selection.programIds.includes(p.id));

  if (myPrograms.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <EmptyState icon="👛" title="הארנק שלך ריק" hint="הוסיפי כרטיסים ומועדונים כדי להתחיל לראות הטבות" />
        <Pressable onPress={onGoToOnboarding} style={styles.addButton}>
          <Text style={styles.addButtonText}>הוסף כרטיסים</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={myPrograms}
      keyExtractor={(p) => p.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>הארנק שלי</Text>
          <Pressable onPress={onGoToOnboarding} hitSlop={12}>
            <Text style={styles.editLink}>ערוך</Text>
          </Pressable>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onOpenProgram(item)}
          style={[styles.card, { borderColor: item.color ?? theme.colors.border }]}
        >
          <View style={styles.cardContent}>
            <Text style={styles.cardName}>{item.name}</Text>
            {item.issuer?.name && <Text style={styles.cardIssuer}>{item.issuer.name}</Text>}
          </View>
          <View style={[styles.cardAccent, { backgroundColor: item.color ?? theme.colors.purple }]} />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: theme.spacing.lg, backgroundColor: theme.colors.background, flexGrow: 1 },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  title: { fontSize: theme.fontSize.xl, fontWeight: '700', color: theme.colors.textPrimary },
  editLink: { fontSize: theme.fontSize.sm, color: theme.colors.purple, fontWeight: '600' },
  card: {
    flexDirection: 'row-reverse',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
    minHeight: 72,
  },
  cardContent: { flex: 1, padding: theme.spacing.md, justifyContent: 'center' },
  cardName: { fontSize: theme.fontSize.md, fontWeight: '600', color: theme.colors.textPrimary, textAlign: 'right' },
  cardIssuer: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, textAlign: 'right', marginTop: 2 },
  cardAccent: { width: 6 },
  addButton: {
    margin: theme.spacing.lg,
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    minHeight: theme.minTouchTarget,
    justifyContent: 'center',
  },
  // ראו הערת textOnAccent ב-theme.ts — לבן על purple נכשל ב-AA.
  addButtonText: { color: theme.colors.textOnAccent, fontWeight: '700', fontSize: theme.fontSize.md },
});
