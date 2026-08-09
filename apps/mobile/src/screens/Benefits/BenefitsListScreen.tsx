import { FlatList, StyleSheet, Text } from 'react-native';
import { theme } from '../../theme/theme';
import { useBenefits } from '../../api/hooks/useBenefits';
import { useUserSelection } from '../../storage/useUserSelection';
import { BenefitCard } from '../../components/domain/BenefitCard';
import { EmptyState, LoadingSpinner } from '../../components/common/EmptyState';
import type { Benefit } from '../../api/types';

type Props = {
  categoryId?: string;
  categoryName?: string; // לכותרת בלבד, נמנע מקריאת /categories נוספת
  programId?: string; // מגיע מ-WalletScreen: "מה מגיע לי עם הכרטיס הזה"
  programName?: string;
  // מגיע מ-SearchScreen כשנפתחת קבוצת המלצות שלמה ("הצג עוד X
  // הטבות"): הרשימה כבר נטענה וממוינת ע"י useGroupedRecommendations,
  // אין טעם לטעון שוב דרך useBenefits (שממש מנגנון סינון שונה
  // לגמרי — Scope-matching, לא קיבוץ-לפי-סוג).
  staticBenefits?: Benefit[];
  staticTitle?: string;
  onOpenBenefit: (benefit: Benefit) => void;
};

// מסך הרשימה המלאה: לא מסונן ל-isPopular כמו Home — זה "כל ההטבות
// שתקפות לי", אופציונלית מצומצם לקטגוריה בודדת (מ-Home/Categories/
// Search), לכרטיס בודד (מ-Wallet), או מציג רשימה קבועה שכבר
// התקבלה (מ-SearchScreen -> קבוצת המלצות).
export function BenefitsListScreen({
  categoryId,
  categoryName,
  programId,
  programName,
  staticBenefits,
  staticTitle,
  onOpenBenefit,
}: Props) {
  const isStatic = staticBenefits !== undefined;
  // useBenefits תמיד נקרא (חוקי React הוקס — אי אפשר להתנות קריאת
  // hook), אך enabled מכבה אותו לגמרי במצב static כדי שלא תיווצר
  // קריאת storage/רשת מיותרת על גבי הרשימה שכבר סופקה.
  const { data: fetchedBenefits, isLoading } = useBenefits({
    categoryId,
    singleProgramId: programId,
    skip: isStatic,
  });
  const { isFavorite, toggleFavorite } = useUserSelection();

  const benefits = isStatic ? staticBenefits : fetchedBenefits;
  if (!isStatic && isLoading) return <LoadingSpinner />;

  const title = staticTitle ?? categoryName ?? programName ?? 'כל ההטבות';

  return (
    <FlatList
      data={benefits ?? []}
      keyExtractor={(b) => b.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={<Text style={styles.title}>{title}</Text>}
      renderItem={({ item }) => (
        <BenefitCard
          benefit={item}
          onPress={() => onOpenBenefit(item)}
          isFavorite={isFavorite(item.id)}
          onToggleFavorite={() => toggleFavorite(item.id)}
        />
      )}
      ListEmptyComponent={
        <EmptyState
          icon="🔍"
          title="לא נמצאו הטבות"
          hint={
            categoryId || programId
              ? 'נסי סינון אחר, או בדקי אם יש לך כרטיסים רלוונטיים בארנק'
              : 'ודאי שבחרת כרטיסים ומועדונים בהגדרות'
          }
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: theme.spacing.lg, backgroundColor: theme.colors.background, flexGrow: 1 },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'right',
    marginBottom: theme.spacing.md,
  },
});
