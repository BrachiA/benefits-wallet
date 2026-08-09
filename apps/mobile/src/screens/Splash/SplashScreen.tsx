import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/theme';
import { userSelectionStorage } from '../../storage/userSelection';

type Props = { onReady: (hasCompletedOnboarding: boolean) => void };

// המסך הראשון שנטען: בודק אם יש כבר בחירת מועדונים ב-storage
// המקומי (שלב 7 בתכנון) ומחליט האם לשלוח למסך Onboarding או ישר
// ל-Home. זו נקודת ההחלטה היחידה במערכת בין "משתמש חדש" ל"חוזר".
export function SplashScreen({ onReady }: Props) {
  useEffect(() => {
    userSelectionStorage.hasCompletedOnboarding().then(onReady);
  }, [onReady]);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>
        <Text style={{ color: theme.colors.lilac }}>B</Text>
        <Text style={{ color: theme.colors.purple }}>P</Text>
      </Text>
      <Text style={styles.appName}>Benefits Wallet</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
  logo: { fontSize: 56, fontWeight: '700' },
  appName: { fontSize: theme.fontSize.md, color: theme.colors.textMuted, marginTop: theme.spacing.sm },
});
