import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/theme';
import { userSelectionStorage } from '../../storage/userSelection';
import { Logo } from '../../components/brand/Logo';
import { FadeIn, TypewriterText } from '../../components/common/motion';

type Props = { onReady: (hasCompletedOnboarding: boolean) => void };

// מינימום זמן שהייה במסך הפתיחה. בלעדיו, במכשיר מהיר עם storage
// חם, הבדיקה מסתיימת תוך ~20ms והלוגו מהבהב לרגע ונעלם — הבהוב
// שנקרא כתקלה, לא כמעבר. חצי שנייה מספיקה כדי שההקלדה תתחיל
// ותיראה מכוונת.
const MIN_SPLASH_MS = 1500;

// המסך הראשון שנטען: בודק אם יש כבר בחירת מועדונים ב-storage
// המקומי ומחליט האם לשלוח למסך Onboarding או ישר ל-Home. זו
// נקודת ההחלטה היחידה במערכת בין "משתמש חדש" ל"חוזר".
//
// שם האפליקציה "נכתב" בהנפשת מכונת כתיבה (הנחיית המוצר). המעבר
// הלאה לא ממתין לסיום ההקלדה אלא ל-MIN_SPLASH_MS — כך משתמשת
// שהגדירה "הפחתת תנועה" (שאצלה הטקסט מופיע מיד) לא נתקעת פחות
// זמן ולא יותר זמן מכולם.
export function SplashScreen({ onReady }: Props) {
  const [hasCompleted, setHasCompleted] = useState<boolean | null>(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    userSelectionStorage.hasCompletedOnboarding().then(setHasCompleted);
  }, []);

  useEffect(() => {
    if (hasCompleted === null) return;
    const elapsed = Date.now() - startedAt.current;
    const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
    const timer = setTimeout(() => onReady(hasCompleted), remaining);
    return () => clearTimeout(timer);
  }, [hasCompleted, onReady]);

  const noop = useCallback(() => {}, []);

  return (
    <View style={styles.container}>
      <FadeIn>
        <View style={styles.logoWrap}>
          <Logo size={96} />
        </View>
      </FadeIn>

      <View style={styles.nameRow}>
        <TypewriterText text="Benefits Wallet" style={styles.appName} onDone={noop} />
      </View>

      <FadeIn delayMs={900}>
        <Text style={styles.tagline}>כל ההטבות שלך במקום אחד</Text>
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: { alignItems: 'center' },
  nameRow: { marginTop: theme.spacing.lg, minHeight: 34, justifyContent: 'center' },
  appName: {
    fontSize: theme.fontSize.xl,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    letterSpacing: 0.3,
  },
  tagline: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
});
