import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/theme';

type Props = { onBack: () => void };

export function AboutScreen({ onBack }: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backButton} hitSlop={12}>
        <Text style={styles.backText}>‹ חזרה</Text>
      </Pressable>

      <Text style={styles.logo}>
        <Text style={{ color: theme.colors.lilac }}>B</Text>
        <Text style={{ color: theme.colors.purple }}>P</Text>
      </Text>
      <Text style={styles.appName}>Benefits Wallet</Text>
      <Text style={styles.tagline}>כל ההטבות שלך, במקום אחד</Text>

      <View style={styles.section}>
        <Text style={styles.sectionText}>
          Benefits Wallet מרכזת את כל ההטבות של כרטיסי האשראי ומועדוני הלקוחות שלך במקום אחד. פשוט
          מסמנים אילו מועדונים וכרטיסים יש לך, והאפליקציה מציגה רק את ההטבות הרלוונטיות.
        </Text>
      </View>

      <View style={styles.privacyBox}>
        <Text style={styles.privacyTitle}>הפרטיות שלך</Text>
        <Text style={styles.privacyText}>לא מתחברים לחשבון הבנק שלך.</Text>
        <Text style={styles.privacyText}>לא מתחברים לחברות האשראי.</Text>
        <Text style={styles.privacyText}>לא שומרים מספרי כרטיסים.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, alignItems: 'center' },
  backButton: { alignSelf: 'flex-start', minHeight: theme.minTouchTarget, justifyContent: 'center' },
  backText: { fontSize: theme.fontSize.md, color: theme.colors.purple, fontWeight: '600' },
  logo: { fontSize: 40, fontWeight: '700', marginTop: theme.spacing.lg },
  appName: { fontSize: theme.fontSize.lg, fontWeight: '700', color: theme.colors.textPrimary, marginTop: theme.spacing.xs },
  tagline: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, marginTop: 4 },
  section: { marginTop: theme.spacing.xl },
  sectionText: { fontSize: theme.fontSize.md, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  privacyBox: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.xl,
    width: '100%',
  },
  privacyTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.lilac,
    textAlign: 'right',
    marginBottom: theme.spacing.xs,
  },
  privacyText: { fontSize: theme.fontSize.sm, color: theme.colors.lilac, textAlign: 'right', marginTop: 4 },
});
