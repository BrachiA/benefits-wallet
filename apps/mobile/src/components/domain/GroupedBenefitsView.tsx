import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/theme';
import { BenefitCard } from './BenefitCard';
import type { BenefitGroup, GroupedBenefit } from '../../api/hooks/useGroupedRecommendations';
import type { Benefit } from '../../api/types';

type Props = {
  groups: BenefitGroup[];
  onOpenBenefit: (benefit: Benefit) => void;
  onOpenGroup: (group: BenefitGroup) => void; // כותרת קבוצה לחיצה -> "כל ה-X"
  onToggleNewOnly?: () => void;
  isNewOnly?: boolean;
};

// מימוש התרחיש מהדיון: משתמשת מחפשת "פוקס" ורואה קבוצות בסדר
// קבוע (אחוזים -> מבצעים -> נקודות), כל קבוצה עם עד 3 הטבות
// לתצוגה מקדימה + כותרת לחיצה שפותחת את כל ההטבות מאותו סוג.
// לא בונה כרטיס חדש — עוטף את BenefitCard הקיים, כי זה כבר
// ה-signature element של האפליקציה ולא צריך גרסה שנייה שלו.
const PREVIEW_COUNT = 3;

export function GroupedBenefitsView({ groups, onOpenBenefit, onOpenGroup, onToggleNewOnly, isNewOnly }: Props) {
  if (groups.length === 0) return null;

  return (
    <View>
      {onToggleNewOnly && (
        <Pressable onPress={onToggleNewOnly} style={[styles.newFilterChip, isNewOnly && styles.newFilterChipActive]}>
          <Text style={[styles.newFilterText, isNewOnly && styles.newFilterTextActive]}>
            {isNewOnly ? '✓ מציג רק חדשות' : '🆕 הצג רק הטבות חדשות'}
          </Text>
        </Pressable>
      )}

      {groups.map((group) => (
        <View key={group.group} style={styles.section}>
          <Pressable onPress={() => onOpenGroup(group)} style={styles.sectionHeader}>
            <Text style={styles.sectionArrow}>›</Text>
            <Text style={styles.sectionTitle}>{group.label}</Text>
          </Pressable>

          {group.benefits.slice(0, PREVIEW_COUNT).map((benefit) => (
            <BenefitCardWithNewBadge key={benefit.id} benefit={benefit} onPress={() => onOpenBenefit(benefit)} />
          ))}

          {group.benefits.length > PREVIEW_COUNT && (
            <Pressable onPress={() => onOpenGroup(group)} style={styles.seeAllRow}>
              <Text style={styles.seeAllText}>
                הצג עוד {group.benefits.length - PREVIEW_COUNT} הטבות ב{group.label}
              </Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

// עוטפת BenefitCard עם badge "חדש" בפינה — לא שינוי ב-BenefitCard
// עצמו, כי isNew רלוונטי רק בהקשר הזה (תצוגת המלצות), לא בכל
// מקום שבו BenefitCard מוצג (Wallet/Search/Favorites הרגילים).
function BenefitCardWithNewBadge({ benefit, onPress }: { benefit: GroupedBenefit; onPress: () => void }) {
  return (
    <View>
      {benefit.isNew && (
        <View style={styles.newBadge}>
          <Text style={styles.newBadgeText}>חדש</Text>
        </View>
      )}
      <BenefitCard benefit={benefit} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  newFilterChip: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    minHeight: theme.minTouchTarget,
    justifyContent: 'center',
  },
  newFilterChipActive: { backgroundColor: theme.colors.purple, borderColor: theme.colors.purple },
  newFilterText: { fontSize: theme.fontSize.sm, color: theme.colors.textPrimary, fontWeight: '500' },
  // רקע הצ'יפ הפעיל הוא purple הבהיר — טקסט לבן עליו נותן 2.64:1
  // ונכשל ב-AA. ראו הערת textOnAccent ב-theme.ts.
  newFilterTextActive: { color: theme.colors.textOnAccent },
  section: { marginBottom: theme.spacing.lg },
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    minHeight: theme.minTouchTarget,
  },
  sectionTitle: { fontSize: theme.fontSize.lg, fontWeight: '700', color: theme.colors.textPrimary, textAlign: 'right' },
  sectionArrow: { fontSize: theme.fontSize.lg, color: theme.colors.textMuted, marginLeft: 4 },
  seeAllRow: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    minHeight: theme.minTouchTarget,
    justifyContent: 'center',
  },
  seeAllText: { fontSize: theme.fontSize.sm, color: theme.colors.purple, fontWeight: '600' },
  newBadge: {
    position: 'absolute',
    top: -6,
    right: theme.spacing.md,
    zIndex: 1,
    backgroundColor: theme.colors.blueDark,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  newBadgeText: { color: theme.colors.textOnPrimary, fontSize: 10, fontWeight: '700' },
});
