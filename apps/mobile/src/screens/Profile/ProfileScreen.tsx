import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/theme';
import { useUserSelection } from '../../storage/useUserSelection';
import { usePrograms } from '../../api/hooks/usePrograms';
import { LoadingSpinner } from '../../components/common/EmptyState';

// אין Authentication בשלב 1 (הוחלט מפורשות בתכנון), כך שאין "פרופיל
// משתמש" במובן הרגיל — שם, תמונה, התחברות. המסך הזה מציג במקום
// זאת סיכום שימוש מקומי: כמה כרטיסים, כמה מועדפים. זה כן אמיתי
// ושימושי גם בלי הרשמה, ומכין קרקע למסך פרופיל מלא כשתתווסף.
export function ProfileScreen() {
  const { selection, isLoading: isLoadingSelection } = useUserSelection();
  const { data: programs, isLoading: isLoadingPrograms } = usePrograms();

  if (isLoadingSelection || isLoadingPrograms || !selection) return <LoadingSpinner />;

  const myProgramNames = (programs ?? [])
    .filter((p) => selection.programIds.includes(p.id))
    .map((p) => p.name);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>שלי</Text>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{selection.programIds.length}</Text>
          <Text style={styles.statLabel}>כרטיסים בארנק</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{selection.favoriteBenefitIds.length}</Text>
          <Text style={styles.statLabel}>הטבות מועדפות</Text>
        </View>
      </View>

      {myProgramNames.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>הכרטיסים שלי</Text>
          {myProgramNames.map((name) => (
            <Text key={name} style={styles.programRow}>
              {name}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.lg },
  title: { fontSize: theme.fontSize.xl, fontWeight: '700', color: theme.colors.textPrimary, textAlign: 'right', marginBottom: theme.spacing.lg },
  statsRow: { flexDirection: 'row-reverse', gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  statNumber: { fontSize: theme.fontSize.xl, fontWeight: '700', color: theme.colors.purple },
  statLabel: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 4 },
  section: { marginTop: theme.spacing.md },
  sectionTitle: { fontSize: theme.fontSize.sm, fontWeight: '600', color: theme.colors.textMuted, textAlign: 'right', marginBottom: theme.spacing.xs },
  programRow: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textPrimary,
    textAlign: 'right',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
});
