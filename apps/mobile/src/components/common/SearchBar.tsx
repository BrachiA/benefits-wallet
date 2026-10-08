import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../../theme/theme';

type SearchBarProps = {
  placeholder: string;
  // מצב עריכה: value+onChangeText (משמש ב-SearchScreen עצמו).
  value?: string;
  onChangeText?: (text: string) => void;
  // מצב "כניסה מהירה": בלי onChangeText, לחיצה בכל מקום בשדה
  // מפעילה onPress בלבד — כך נראה בראש מסך הבית, ולחיצה עליו
  // פותחת את טאב החיפוש המלא במקום לשכפל את לוגיקת החיפוש כאן.
  onPress?: () => void;
};

export function SearchBar({ placeholder, value, onChangeText, onPress }: SearchBarProps) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={styles.bar} accessibilityRole="button" accessibilityLabel={placeholder}>
        <Text style={styles.icon}>🔍</Text>
        <Text style={styles.placeholder}>{placeholder}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.bar}>
      <Text style={styles.icon}>🔍</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        style={styles.input}
        textAlign="right"
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // גובה 52 ופינות pill — שדה החיפוש הוא העוגן הוויזואלי בראש
  // מסך הבית (כמו אצל Wolt), ולא עוד שדה טופס בשורה.
  bar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md + 2,
    minHeight: 52,
    ...theme.shadow.card,
  },
  icon: { fontSize: 16, marginLeft: theme.spacing.sm },
  input: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: theme.colors.textPrimary,
    paddingVertical: theme.spacing.sm,
  },
  placeholder: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    textAlign: 'right',
  },
});
