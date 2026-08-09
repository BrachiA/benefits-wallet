import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/theme';
import { userSelectionStorage } from '../../storage/userSelection';

type Props = {
  onEditPrograms: () => void;
  onOpenAbout: () => void;
};

// עיקרון פרטיות מוצג כאן במפורש (לא רק כטקסט משפטי נסתר): "לא
// מתחבר לבנק, לא שומר מספרי כרטיסים" — בדיוק כפי שהוגדר בתחילת
// כל התכנון כעיקרון-על של המוצר. משתמשת צריכה לראות את זה, לא
// רק שהצוות ידע את זה.
export function SettingsScreen({ onEditPrograms, onOpenAbout }: Props) {
  function handleResetSelection() {
    Alert.alert('איפוס בחירת כרטיסים', 'הבחירה תימחק ותצטרכי לבחור מחדש. הטבות מועדפות יישמרו.', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'איפוס',
        style: 'destructive',
        onPress: async () => {
          const current = await userSelectionStorage.get();
          await userSelectionStorage.set({ ...current, programIds: [] });
          onEditPrograms();
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>הגדרות</Text>

      <View style={styles.section}>
        <SettingsRow label="ערוך כרטיסים ומועדונים" onPress={onEditPrograms} />
        <SettingsRow label="איפוס בחירת כרטיסים" onPress={handleResetSelection} destructive />
      </View>

      <View style={styles.section}>
        <SettingsRow label="אודות" onPress={onOpenAbout} />
      </View>

      <Text style={styles.privacyNote}>
        Benefits Wallet לא מתחבר לחשבון הבנק שלך, לא מתחבר לחברות האשראי, ולא שומר מספרי כרטיסים. הבחירה
        שלך נשמרת רק על המכשיר הזה.
      </Text>
    </ScrollView>
  );
}

function SettingsRow({ label, onPress, destructive }: { label: string; onPress: () => void; destructive?: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={styles.rowArrow}>‹</Text>
      <Text style={[styles.rowLabel, destructive && { color: theme.colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'right',
    marginBottom: theme.spacing.lg,
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    minHeight: theme.minTouchTarget,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowLabel: { fontSize: theme.fontSize.md, color: theme.colors.textPrimary, textAlign: 'right' },
  rowArrow: { fontSize: theme.fontSize.md, color: theme.colors.textMuted },
  privacyNote: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textAlign: 'right',
    lineHeight: 18,
    marginTop: theme.spacing.md,
  },
});
