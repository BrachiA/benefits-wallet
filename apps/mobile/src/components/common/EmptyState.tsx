import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/theme';

export function LoadingSpinner() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={theme.colors.purple} />
    </View>
  );
}

type ErrorStateProps = {
  onRetry: () => void;
  hint?: string;
};

// שגיאת רשת/שרת — שונה במכוון מ-EmptyState: "יש בעיה, נסי שוב"
// ולא "אין תוצאות". בלי ההבחנה הזו, כשל תקשורת נראה למשתמשת בדיוק
// כמו "אין לך הטבות", וזה מטעה (אין לה דרך לדעת שכדאי לנסות שוב).
export function ErrorState({ onRetry, hint }: ErrorStateProps) {
  return (
    <View style={styles.center}>
      <Text style={{ fontSize: 40, marginBottom: theme.spacing.sm }}>📡</Text>
      <Text style={styles.title}>שגיאת תקשורת</Text>
      <Text style={styles.hint}>{hint ?? 'לא הצלחנו להביא נתונים כרגע. בדקי את החיבור לאינטרנט ונסי שוב'}</Text>
      <Pressable onPress={onRetry} style={styles.retryButton} accessibilityRole="button" accessibilityLabel="נסה שוב">
        <Text style={styles.retryButtonText}>נסי שוב</Text>
      </Pressable>
    </View>
  );
}

type EmptyStateProps = {
  icon?: string;
  title: string;
  hint?: string;
};

// אותו עיקרון כמו ב-Dashboard: ריקנות היא הזדמנות לכוון, לא רק
// "אין נתונים". title+hint הם חובה/אופציונלי שכל מסך קורא חייב
// לספק בעצמו לפי ההקשר שלו.
export function EmptyState({ icon = '📭', title, hint }: EmptyStateProps) {
  return (
    <View style={styles.center}>
      <Text style={{ fontSize: 40, marginBottom: theme.spacing.sm }}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  title: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  hint: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  retryButton: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.blueDark,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    minHeight: theme.minTouchTarget,
    justifyContent: 'center',
  },
  retryButtonText: { color: theme.colors.textOnPrimary, fontWeight: '700', fontSize: theme.fontSize.sm },
});
