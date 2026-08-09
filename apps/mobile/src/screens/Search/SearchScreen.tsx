import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../../theme/theme';
import { useSearch } from '../../api/hooks/useSearch';
import { useGroupedRecommendations } from '../../api/hooks/useGroupedRecommendations';
import { BenefitCard } from '../../components/domain/BenefitCard';
import { GroupedBenefitsView } from '../../components/domain/GroupedBenefitsView';
import { EmptyState, LoadingSpinner } from '../../components/common/EmptyState';
import type { Benefit } from '../../api/types';
import type { BenefitGroup } from '../../api/hooks/useGroupedRecommendations';

type Props = {
  onOpenBenefit: (benefit: Benefit) => void;
  onOpenCategory: (categoryId: string, categoryName: string) => void;
  onOpenBenefitGroup: (group: BenefitGroup, title: string) => void;
};

// חיפוש-על: לא מוגבל להטבות בלבד — מציג תוצאות מקובצות לפי סוג
// (הטבות, מותגים, מועדונים, קטגוריות, סניפים), תואם לשלב 8 בתכנון.
// מותג נבחר (selectedBrand) הופך את המסך לתצוגת GroupedBenefitsView
// — זה בדיוק התרחיש "פוקס" מהדיון: לחיצה על תוצאת-מותג מציגה
// קבוצות מסודרות (אחוזים/מבצעים/נקודות) במקום רשימה שטוחה.
export function SearchScreen({ onOpenBenefit, onOpenCategory, onOpenBenefitGroup }: Props) {
  const [query, setQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<{ id: string; name: string } | null>(null);
  const { data: results, isLoading } = useSearch(query);
  const { data: groups, isLoading: isLoadingGroups } = useGroupedRecommendations({ brandId: selectedBrand?.id });

  // חזרה מתצוגת-מותג לתוצאות החיפוש הרגילות
  if (selectedBrand) {
    return (
      <View style={styles.container}>
        <Pressable onPress={() => setSelectedBrand(null)} style={styles.backButton} hitSlop={12}>
          <Text style={styles.backText}>‹ חזרה לתוצאות</Text>
        </Pressable>
        <Text style={styles.brandTitle}>{selectedBrand.name}</Text>

        {isLoadingGroups && <LoadingSpinner />}

        {!isLoadingGroups && groups && groups.length === 0 && (
          <EmptyState icon="🔍" title={`אין עדיין הטבות פעילות ב${selectedBrand.name}`} hint="נסי לבדוק שוב בקרוב" />
        )}

        {!isLoadingGroups && groups && groups.length > 0 && (
          <FlatList
            data={[1]}
            keyExtractor={() => 'grouped'}
            renderItem={() => null}
            contentContainerStyle={styles.results}
            ListHeaderComponent={
              <GroupedBenefitsView
                groups={groups}
                onOpenBenefit={onOpenBenefit}
                onOpenGroup={(group) => onOpenBenefitGroup(group, `${selectedBrand.name} · ${group.label}`)}
              />
            }
          />
        )}
      </View>
    );
  }

  const hasQuery = query.trim().length >= 2;
  const hasResults =
    results &&
    (results.benefits.length > 0 ||
      results.brands.length > 0 ||
      results.programs.length > 0 ||
      results.categories.length > 0 ||
      results.stores.length > 0);

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="חפשי חנות, קטגוריה, מותג או מועדון..."
          placeholderTextColor={theme.colors.textMuted}
          style={styles.input}
          textAlign="right"
          autoCorrect={false}
        />
      </View>

      {!hasQuery && <EmptyState icon="🔎" title="חפשי הטבה" hint="לפי שם חנות, מותג, מועדון, קטגוריה או תגית" />}

      {hasQuery && !isLoading && !hasResults && (
        <EmptyState icon="🤷‍♀️" title={`לא נמצאו תוצאות עבור "${query}"`} hint="נסי מילת חיפוש אחרת" />
      )}

      {hasQuery && hasResults && results && (
        <FlatList
          data={[1]}
          keyExtractor={() => 'search-results'}
          renderItem={() => null}
          ListHeaderComponent={
            <View style={styles.results}>
              {results.categories.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>קטגוריות</Text>
                  <View style={styles.chipRow}>
                    {results.categories.map((c) => (
                      <Pressable key={c.id} onPress={() => onOpenCategory(c.id, c.name)} style={styles.chip}>
                        <Text style={styles.chipText}>{c.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {results.brands.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>מותגים</Text>
                  {results.brands.map((b) => (
                    <Pressable key={b.id} onPress={() => setSelectedBrand({ id: b.id, name: b.name })} style={styles.brandRow}>
                      <Text style={styles.brandArrow}>›</Text>
                      <Text style={styles.hintRow}>
                        {b.name} {b.category?.name ? `· ${b.category.name}` : ''}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {results.programs.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>מועדונים וכרטיסים</Text>
                  {results.programs.map((p) => (
                    <Text key={p.id} style={styles.hintRow}>
                      {p.name} {p.issuer?.name ? `· ${p.issuer.name}` : ''}
                    </Text>
                  ))}
                </View>
              )}

              {results.stores.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>סניפים</Text>
                  {results.stores.map((s) => (
                    <Text key={s.id} style={styles.hintRow}>
                      {s.name} {s.city?.name ? `· ${s.city.name}` : ''}
                    </Text>
                  ))}
                </View>
              )}

              {results.benefits.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>הטבות</Text>
                  {results.benefits.map((b) => (
                    <BenefitCard key={b.id} benefit={b} onPress={() => onOpenBenefit(b)} />
                  ))}
                </View>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  searchBar: { padding: theme.spacing.lg, paddingBottom: theme.spacing.sm },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    minHeight: theme.minTouchTarget,
    fontSize: theme.fontSize.md,
    color: theme.colors.textPrimary,
  },
  backButton: {
    marginTop: theme.spacing.lg,
    marginHorizontal: theme.spacing.lg,
    minHeight: theme.minTouchTarget,
    justifyContent: 'center',
  },
  backText: { fontSize: theme.fontSize.md, color: theme.colors.purple, fontWeight: '600' },
  brandTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'right',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  results: { paddingHorizontal: theme.spacing.lg },
  section: { marginBottom: theme.spacing.lg },
  sectionTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textMuted,
    textAlign: 'right',
    marginBottom: theme.spacing.xs,
  },
  chipRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: theme.spacing.xs },
  chip: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minHeight: theme.minTouchTarget,
    justifyContent: 'center',
  },
  chipText: { fontSize: theme.fontSize.sm, color: theme.colors.purpleDark, fontWeight: '500' },
  brandRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    minHeight: theme.minTouchTarget,
  },
  brandArrow: { fontSize: theme.fontSize.md, color: theme.colors.textMuted, marginLeft: 4 },
  hintRow: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    paddingVertical: theme.spacing.xs,
  },
});
