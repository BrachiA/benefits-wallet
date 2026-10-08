import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View, type TextStyle, type StyleProp, type ViewStyle } from 'react-native';
import { theme } from '../../theme/theme';

// ============================================================
// שכבת ההנפשה של האפליקציה. משתמשת ב-Animated המובנה של React
// Native ולא ב-react-native-reanimated: התוסף הזה אינו מותקן
// בפרויקט, והוספתו דורשת בנייה נייטיבית מחדש (לא עובד ב-Expo Go
// בלי rebuild) — מחיר גבוה מדי עבור fade/translate פשוטים שה-API
// המובנה מריץ מצוין על ה-UI thread עם useNativeDriver.
//
// כל ההנפשות מכבדות "הפחתת תנועה" של מערכת ההפעלה
// (AccessibilityInfo.isReduceMotionEnabled): משתמשת שהגדירה זאת
// — בגלל מחלת תנועה, רגישות לוסטיבולרית או העדפה — מקבלת את
// התוכן מיד במצבו הסופי, בלי תזוזה. זו לא "נחמדות": הנחיית
// WCAG 2.1 (2.3.3 Animation from Interactions) מתייחסת לזה
// במפורש.
// ============================================================

function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  return reduceMotion;
}

// ---------- Reveal: הופעה עדינה בגלילה ----------

type RevealProps = {
  children: React.ReactNode;
  // השהיה מדורגת (stagger). כשכמה כרטיסים נכנסים יחד, הם מופיעים
  // ברצף קצר במקום כמסה אחת — זה מה שנותן את תחושת ה"זרימה".
  index?: number;
  style?: StyleProp<ViewStyle>;
};

// תקרת ההשהיה: בלעדיה, פריט מס' 30 ברשימה היה מחכה 1.5 שניות
// להופיע. 6 פריטים (=180ms) זה הגבול שבו הדירוג עדיין מורגש
// כתנועה מכוונת ולא כאיטיות.
const MAX_STAGGER_STEPS = 6;
const STAGGER_MS = 30;

// FlatList מרנדר פריטים בזמן שהם נכנסים לחלון התצוגה (windowing),
// ולכן הנפשה על mount היא בפועל "הנפשה בגלילה" — הפריט מונפש
// בדיוק כשהוא מופיע לראשונה, בלי להאזין ל-onScroll ובלי לחשב
// מיקומים ידנית.
export function Reveal({ children, index = 0, style }: RevealProps) {
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 380,
      delay: Math.min(index, MAX_STAGGER_STEPS) * STAGGER_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, progress, reduceMotion]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ---------- TypewriterText: שם האפליקציה "נכתב" ----------

type TypewriterProps = {
  text: string;
  style?: StyleProp<TextStyle>;
  speedMs?: number;
  startDelayMs?: number;
  onDone?: () => void;
};

// מקלידה את הטקסט תו-אחר-תו עם סמן מהבהב. הטקסט המלא תמיד קיים
// בעץ הנגישות (accessibilityLabel) גם באמצע ההקלדה — קורא מסך
// אמור להכריז "Benefits Wallet", לא "B... Be... Ben".
export function TypewriterText({ text, style, speedMs = 85, startDelayMs = 250, onDone }: TypewriterProps) {
  const reduceMotion = useReduceMotion();
  const [visibleCount, setVisibleCount] = useState(0);
  const caretOpacity = useRef(new Animated.Value(1)).current;
  const isDone = visibleCount >= text.length;

  useEffect(() => {
    if (reduceMotion) {
      setVisibleCount(text.length);
      onDone?.();
      return;
    }

    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        setVisibleCount((current) => {
          if (current >= text.length) {
            if (interval) clearInterval(interval);
            return current;
          }
          return current + 1;
        });
      }, speedMs);
    }, startDelayMs);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [text, speedMs, startDelayMs, reduceMotion, onDone]);

  // onDone נקרא כתופעת לוואי של סיום ההקלדה ולא מתוך ה-interval
  // עצמו — קריאה ל-setState של הורה מתוך updater של setState בן
  // היא בדיוק סוג הקינון ש-React מזהיר עליו.
  useEffect(() => {
    if (isDone && !reduceMotion) onDone?.();
  }, [isDone, onDone, reduceMotion]);

  useEffect(() => {
    if (reduceMotion || isDone) {
      caretOpacity.setValue(0);
      return;
    }
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(caretOpacity, { toValue: 0.15, duration: 420, useNativeDriver: true }),
        Animated.timing(caretOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, [caretOpacity, isDone, reduceMotion]);

  return (
    <View style={styles.typewriterRow} accessible accessibilityLabel={text}>
      {/* aria-hidden בפועל: הטקסט החלקי לא נקרא ע"י קורא מסך, רק
          ה-accessibilityLabel של המכולה. */}
      <Text style={style} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {text.slice(0, visibleCount)}
      </Text>
      {!isDone && (
        <Animated.View
          style={[styles.caret, { opacity: caretOpacity }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
    </View>
  );
}

// ---------- FadeIn: הופעה פשוטה בלי תזוזה ----------

export function FadeIn({ children, delayMs = 0, style }: { children: React.ReactNode; delayMs?: number; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: 520,
      delay: delayMs,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delayMs, opacity, reduceMotion]);

  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  typewriterRow: { flexDirection: 'row', alignItems: 'center' },
  caret: {
    width: 2.5,
    height: 24,
    borderRadius: 2,
    backgroundColor: theme.colors.purple,
    marginLeft: 3,
  },
});
