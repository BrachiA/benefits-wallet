import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme/theme';
import { useBenefits } from '../../api/hooks/useBenefits';
import { useCategories } from '../../api/hooks/useCategories';
import { usePrograms } from '../../api/hooks/usePrograms';
import { useUserSelection } from '../../storage/useUserSelection';
import { personalizedOrder } from '../../storage/personalizedOrder';
import { isNewBenefit } from '../../utils/isNewBenefit';
import { isHotDeal } from '../../utils/hotDeal';
import { useResponsiveLayout } from '../../utils/layout';
import { SearchBar } from '../../components/common/SearchBar';
import { Logo } from '../../components/brand/Logo';
import { FadeIn, Reveal, TypewriterText } from '../../components/common/motion';
import { HomeBenefitCard } from '../../components/domain/HomeBenefitCard';
import {
  CategoryTile,
  ClubCard,
  HotDealCard,
  NewBenefitCard,
  SectionHeader,
  StoreCard,
  type PopularStore,
} from '../../components/domain/HomeSections';
import { EmptyState, ErrorState, LoadingSpinner } from '../../components/common/EmptyState';
import type { Benefit, Brand, Category, Program } from '../../api/types';

type Props = {
  onOpenBenefit: (benefit: Benefit) => void;
  onOpenCategory: (categoryId: string, categoryName: string) => void;
  onOpenProgram: (program: Program) => void;
  onOpenSearch: () => void;
};

// ============================================================
// מסך הבית — עיצוב בהשראת Wolt לפי הדוגמאות שסופקו, בסדר שנקבע
// במפורש: חיפוש למעלה ← קטגוריות מאוירות ← הכרטיסים והמועדונים
// שלי ← מבצעים חמים (50%+) ← החנויות הפופולריות ← שאר ההטבות.
//
// הכול נבנה כ-ListHeaderComponent של FlatList אחד ולא כ-ScrollView
// עם FlatList-ים בפנים: וירטואליזציה אמיתית לרשימה הארוכה למטה
// (זו שיכולה לגדול למאות פריטים), בלי אזהרת "VirtualizedLists
// should never be nested".
// ============================================================

const NEW_BENEFITS_LIMIT = 10;
const HOT_DEALS_LIMIT = 12;
const POPULAR_STORES_LIMIT = 12;
// כמה מועדונים *שאין* למשתמשת להציג אחרי שלה, כדי שהשורה תיראה
// מלאה גם למי שסימנה כרטיס אחד בלבד (הנחיית המוצר).
const CLUB_ROW_TARGET = 8;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'לילה טוב';
  if (hour < 12) return 'בוקר טוב';
  if (hour < 17) return 'צהריים טובים';
  if (hour < 21) return 'ערב טוב';
  return 'לילה טוב';
}

export function HomeScreen({ onOpenBenefit, onOpenCategory, onOpenProgram, onOpenSearch }: Props) {
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();

  // מקור אחד לכל הסקשנים (50 פריטים, מסונן כבר לפי המועדונים של
  // המשתמשת בשרת) — מבצעים חמים, חנויות פופולריות והרשימה הראשית
  // כולם נגזרים ממנו, בלי קריאת רשת נפרדת לכל שורה.
  const {
    data: allBenefits,
    isLoading,
    isError,
    refetch,
  } = useBenefits({ sortBy: 'createdAt' });
  const { data: categories, isLoading: isLoadingCategories } = useCategories();
  const { data: allPrograms } = usePrograms();
  const { isFavorite, toggleFavorite, selection } = useUserSelection();

  const topLevelCategories = useMemo(() => (categories ?? []).filter((c) => !c.parentId), [categories]);

  // המועדונים שלי קודם, ואחריהם מועדונים נתמכים שאין לה — מסומנים
  // כ-owned:false ומוצגים אחרת (ראו ClubCard).
  const clubRow = useMemo(() => {
    const owned = (allPrograms ?? []).filter((p) => selection?.programIds.includes(p.id));
    const notOwned = (allPrograms ?? []).filter((p) => !selection?.programIds.includes(p.id));
    const fillCount = Math.max(0, CLUB_ROW_TARGET - owned.length);
    return [
      ...owned.map((program) => ({ program, owned: true })),
      ...notOwned.slice(0, fillCount).map((program) => ({ program, owned: false })),
    ];
  }, [allPrograms, selection?.programIds]);

  const hotDeals = useMemo(() => (allBenefits ?? []).filter(isHotDeal).slice(0, HOT_DEALS_LIMIT), [allBenefits]);

  const newBenefits = useMemo(
    () => (allBenefits ?? []).filter((b) => isNewBenefit(b.startDate, b.createdAt)).slice(0, NEW_BENEFITS_LIMIT),
    [allBenefits]
  );

  // "החנויות הפופולריות שיש בהן הנחות" נגזרות מהשיוכים (scopes) של
  // ההטבות עצמן ולא מקריאה נפרדת ל-/brands: כך *כל* חנות שמוצגת
  // היא בהגדרה חנות שיש לה הטבה פעילה עבור המשתמשת הזו — בדיוק
  // מה שהתבקש. חנות בלי הטבות פשוט לא נוצרת במפה.
  const popularStores: PopularStore[] = useMemo(() => {
    const byBrand = new Map<string, { brand: Brand; benefitCount: number; bestPercent: number }>();

    for (const benefit of allBenefits ?? []) {
      // אותה הטבה יכולה להחזיק כמה שורות scope לאותו מותג (למשל
      // אחת לכל סניף) — נספרת פעם אחת בלבד לכל מותג.
      const brandsInBenefit = new Map<string, Brand>();
      for (const scope of benefit.scopes ?? []) {
        if (scope.brand) brandsInBenefit.set(scope.brand.id, scope.brand);
      }
      for (const brand of brandsInBenefit.values()) {
        const entry = byBrand.get(brand.id) ?? { brand, benefitCount: 0, bestPercent: 0 };
        entry.benefitCount += 1;
        if (benefit.discountUnit === 'PERCENT' && benefit.discountValue != null) {
          entry.bestPercent = Math.max(entry.bestPercent, benefit.discountValue);
        }
        byBrand.set(brand.id, entry);
      }
    }

    return [...byBrand.values()]
      .sort((a, b) => b.benefitCount - a.benefitCount || b.bestPercent - a.bestPercent)
      .slice(0, POPULAR_STORES_LIMIT)
      .map((entry) => ({
        brand: entry.brand,
        benefitCount: entry.benefitCount,
        bestDiscount: entry.bestPercent > 0 ? `${entry.bestPercent}%` : null,
      }));
  }, [allBenefits]);

  // הרשימה הראשית מדלגת על מה שכבר הופיע בשורת המבצעים החמים —
  // אחרת אותו כרטיס מופיע פעמיים במסך אחד.
  const mainList = useMemo(() => {
    const hotIds = new Set(hotDeals.map((b) => b.id));
    const rest = (allBenefits ?? []).filter((b) => !hotIds.has(b.id));
    return personalizedOrder(rest, (b) => b.category?.id, selection?.categoryInterest ?? {});
  }, [allBenefits, hotDeals, selection?.categoryInterest]);

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  const horizontalPad = theme.spacing.lg;

  return (
    <View style={styles.screen}>
      <FlatList
        // numColumns אינו ניתן לשינוי דינמי ב-FlatList בלי remount —
        // ה-key מכריח אותו כשמסובבים מכשיר/משנים גודל חלון בדפדפן.
        key={`cols-${layout.columns}`}
        data={mainList}
        numColumns={layout.columns}
        keyExtractor={(b) => b.id}
        columnWrapperStyle={layout.columns > 1 ? styles.column : undefined}
        contentContainerStyle={[
          styles.listContent,
          // insets.top: לא נכנסים מתחת למצלמת הסלפי/מגרעת.
          // insets.bottom + 24: מרווח מעל סרגל הטאבים ומחוות הבית,
          // כדי שהכרטיס האחרון לא ייחתך מאחוריהם.
          { paddingTop: insets.top + theme.spacing.md, paddingBottom: insets.bottom + theme.spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={[styles.headerWrap, { maxWidth: layout.contentMaxWidth }]}>
            {/* --- שורת מותג + ברכה --- */}
            <FadeIn style={styles.brandRow}>
              <View style={styles.brandLeft}>
                <Logo size={40} />
                <View style={styles.brandTextWrap}>
                  <TypewriterText text="Benefits Wallet" style={styles.brandName} />
                  <Text style={styles.greeting}>{greeting()} 👋</Text>
                </View>
              </View>
            </FadeIn>

            {/* --- חיפוש --- */}
            <FadeIn delayMs={120}>
              <SearchBar placeholder="חפשי חנות, קטגוריה, מותג או מועדון..." onPress={onOpenSearch} />
            </FadeIn>

            {/* --- קטגוריות מאוירות --- */}
            {!isLoadingCategories && topLevelCategories.length > 0 && (
              <>
                <SectionHeader title="קטגוריות" />
                <FlatList
                  horizontal
                  inverted /* RTL: הגלילה האופקית מתחילה מימין */
                  data={topLevelCategories}
                  keyExtractor={(c: Category) => c.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.row}
                  renderItem={({ item, index }) => (
                    <Reveal index={index}>
                      <CategoryTile category={item} onPress={() => onOpenCategory(item.id, item.name)} />
                    </Reveal>
                  )}
                />
              </>
            )}

            {/* --- הכרטיסים והמועדונים שלי --- */}
            {clubRow.length > 0 && (
              <>
                <SectionHeader
                  title="הכרטיסים והמועדונים שלי"
                  hint={clubRow.some((c) => !c.owned) ? 'ומועדונים נוספים שאפשר להוסיף' : undefined}
                />
                <FlatList
                  horizontal
                  inverted
                  data={clubRow}
                  keyExtractor={(item) => item.program.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.row}
                  renderItem={({ item, index }) => (
                    <Reveal index={index}>
                      <ClubCard
                        program={item.program}
                        owned={item.owned}
                        width={layout.horizontalCardWidth}
                        onPress={() => onOpenProgram(item.program)}
                      />
                    </Reveal>
                  )}
                />
              </>
            )}

            {/* --- מבצעים חמים (50% ומעלה) --- */}
            {hotDeals.length > 0 && (
              <>
                <SectionHeader title="מבצעים חמים 🔥" hint="50% הנחה ומעלה" />
                <FlatList
                  horizontal
                  inverted
                  data={hotDeals}
                  keyExtractor={(b) => b.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.row}
                  renderItem={({ item, index }) => (
                    <Reveal index={index}>
                      <HotDealCard benefit={item} width={layout.horizontalCardWidth} onPress={() => onOpenBenefit(item)} />
                    </Reveal>
                  )}
                />
              </>
            )}

            {/* --- החנויות הפופולריות --- */}
            {popularStores.length > 0 && (
              <>
                <SectionHeader title="החנויות הפופולריות" hint="חנויות עם הטבות פעילות עבורך" />
                <FlatList
                  horizontal
                  inverted
                  data={popularStores}
                  keyExtractor={(s) => s.brand.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.row}
                  renderItem={({ item, index }) => (
                    <Reveal index={index}>
                      <StoreCard store={item} width={146} onPress={() => onOpenSearch()} />
                    </Reveal>
                  )}
                />
              </>
            )}

            {/* --- חדשות אצלנו --- */}
            {newBenefits.length > 0 && (
              <>
                <SectionHeader title="חדש אצלנו" hint="נוספו בשבוע האחרון" />
                <FlatList
                  horizontal
                  inverted
                  data={newBenefits}
                  keyExtractor={(b) => b.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.row}
                  renderItem={({ item, index }) => (
                    <Reveal index={index}>
                      <NewBenefitCard benefit={item} width={140} onPress={() => onOpenBenefit(item)} />
                    </Reveal>
                  )}
                />
              </>
            )}

            <SectionHeader title="עוד הטבות בשבילך" />
          </View>
        }
        renderItem={({ item, index }) => (
          <Reveal index={index} style={layout.columns > 1 ? styles.gridItem : undefined}>
            <HomeBenefitCard
              benefit={item}
              onPress={() => onOpenBenefit(item)}
              isFavorite={isFavorite(item.id)}
              onToggleFavorite={() => toggleFavorite(item.id)}
            />
          </Reveal>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="🎁"
            title="אין עדיין הטבות עבורך"
            hint="ייתכן שהמועדונים שבחרת עדיין לא כוללים הטבות פעילות — אפשר להוסיף מועדונים מהשורה למעלה"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    flexGrow: 1,
    // ממרכז את התוכן במסך רחב (דפדפן) במקום למתוח אותו לכל הרוחב.
    alignSelf: 'center',
    width: '100%',
    maxWidth: 1180,
  },
  headerWrap: { width: '100%' },

  brandRow: { marginBottom: theme.spacing.md },
  // row-reverse: הלוגו והשם נצמדים לימין, כמו שם המותג של Wolt
  // בפינה הימנית בממשק בעברית.
  brandLeft: { flexDirection: 'row-reverse', alignItems: 'center', gap: theme.spacing.sm },
  brandTextWrap: { alignItems: 'flex-end' },
  brandName: { fontSize: theme.fontSize.lg, fontWeight: '800', color: theme.colors.textPrimary },
  greeting: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginTop: 1 },

  row: { gap: theme.spacing.sm, paddingVertical: theme.spacing.xs },

  column: { gap: theme.spacing.md },
  gridItem: { flex: 1 },
});
