import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/theme';
import { usePrograms } from '../../api/hooks/usePrograms';
import { useUserSelection } from '../../storage/useUserSelection';
import { LoadingSpinner } from '../../components/common/EmptyState';
import type { Program } from '../../api/types';

type Props = { onDone: () => void };

// שלב 7 בתכנון: "בפעם הראשונה המשתמש בוחר אילו מועדונים יש לו.
// הבחירה נשמרת מקומית. כל האפליקציה מסתננת לפי הבחירה."
export function OnboardingScreen({ onDone }: Props) {
  const { data: programs, isLoading } = usePrograms();
  const { selection, isProgramSelected, toggleProgram } = useUserSelection();

  // מקבצת לפי מנפיק כדי שהרשימה (שיכולה להגיע לעשרות פריטים ברגע
  // שיתווספו מועדונים דרך הדשבורד) תישאר סרוקה בקלות, לא גוש אחד.
  const groupedByIssuer = useMemo(() => {
    if (!programs) return [];
    const groups = new Map<string, Program[]>();
    for (const p of programs) {
      const issuerName = p.issuer?.name ?? 'אחר';
      if (!groups.has(issuerName)) groups.set(issuerName, []);
      groups.get(issuerName)!.push(p);
    }
    return Array.from(groups.entries());
  }, [programs]);

  if (isLoading || !selection) return <LoadingSpinner />;

  const selectedCount = selection.programIds.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>אילו כרטיסים ומועדונים יש לך?</Text>
        <Text style={styles.subtitle}>נציג רק את ההטבות הרלוונטיות עבורך. תמיד אפשר לשנות בהגדרות.</Text>
      </View>

      <FlatList
        data={groupedByIssuer}
        keyExtractor={([issuerName]) => issuerName}
        contentContainerStyle={styles.list}
        renderItem={({ item: [issuerName, issuerPrograms] }) => (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>{issuerName}</Text>
            {issuerPrograms.map((program) => {
              const selected = isProgramSelected(program.id);
              return (
                <Pressable
                  key={program.id}
                  onPress={() => toggleProgram(program.id)}
                  style={[styles.row, selected && styles.rowSelected]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                >
                  <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
                    {selected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.rowLabel}>{program.name}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      />

      <View style={styles.footer}>
        <Pressable
          onPress={onDone}
          disabled={selectedCount === 0}
          style={[styles.doneButton, selectedCount === 0 && styles.doneButtonDisabled]}
        >
          <Text style={styles.doneButtonText}>
            {selectedCount > 0 ? `המשך עם ${selectedCount} נבחרים` : 'בחרי לפחות אחד כדי להמשיך'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { padding: theme.spacing.lg, paddingBottom: theme.spacing.md },
  title: { fontSize: theme.fontSize.xl, fontWeight: '700', color: theme.colors.textPrimary, textAlign: 'right' },
  subtitle: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, textAlign: 'right', marginTop: theme.spacing.xs },
  list: { paddingHorizontal: theme.spacing.lg, paddingBottom: 100 },
  group: { marginBottom: theme.spacing.md },
  groupTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textAlign: 'right',
    marginBottom: theme.spacing.xs,
  },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: theme.minTouchTarget,
  },
  rowSelected: { borderColor: theme.colors.purple, backgroundColor: theme.colors.surfaceAlt },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.sm,
  },
  checkboxChecked: { borderColor: theme.colors.purple, backgroundColor: theme.colors.purple },
  checkmark: { color: theme.colors.textOnAccent, fontSize: 14, fontWeight: '800' },
  rowLabel: { fontSize: theme.fontSize.md, color: theme.colors.textPrimary, flex: 1, textAlign: 'right' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  doneButton: {
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    minHeight: theme.minTouchTarget,
    justifyContent: 'center',
  },
  doneButtonDisabled: { backgroundColor: theme.colors.border },
  // ראו הערת textOnAccent ב-theme.ts — לבן על purple נכשל ב-AA.
  doneButtonText: { color: theme.colors.textOnAccent, fontSize: theme.fontSize.md, fontWeight: '700' },
});
