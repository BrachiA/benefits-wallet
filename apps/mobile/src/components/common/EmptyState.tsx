import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/theme';

export function LoadingSpinner() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={theme.colors.purple} />
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
});
