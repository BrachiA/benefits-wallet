import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/theme';
import { CategoryIllustration, tileColorFor } from '../illustrations/CategoryIllustration';
import { BenefitImage } from '../common/BenefitImage';
import { formatDiscount } from './BenefitCard';
import { hotDealLabel } from '../../utils/hotDeal';
import { benefitImageUri, brandLogoUri, programLogoUri } from '../../utils/imageUri';
import type { Benefit, Brand, Category, Program } from '../../api/types';

// ============================================================
// אבני הבניין של מסך הבית, בהשראת שפת העיצוב של Wolt: כותרת
// סקשן עם "עוד" בצד, ואז גלילה אופקית של כרטיסים עשירים-בתמונה.
// כולם מרוכזים בקובץ אחד כי הם נצרכים יחד ורק ע"י HomeScreen —
// פיצול ל-5 קבצים בני 30 שורות היה מקשה על קריאת המסך כמכלול.
// ============================================================

// ---------- כותרת סקשן ----------

export function SectionHeader({ title, hint, onSeeAll }: { title: string; hint?: string; onSeeAll?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleWrap}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {hint && <Text style={styles.sectionHint}>{hint}</Text>}
      </View>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={10} style={styles.seeAll} accessibilityRole="button">
          <Text style={styles.seeAllText}>עוד ›</Text>
        </Pressable>
      )}
    </View>
  );
}

// ---------- אריח קטגוריה ----------

export function CategoryTile({ category, onPress }: { category: Category; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.categoryTile, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={category.name}
    >
      {/* 46 בתוך אריח 78: בבדיקה ויזואלית איור בגודל 54 נגע כמעט
          בקצוות האריח ונראה דחוס. המרווח הזה הוא מה שנותן לשורה
          את ה"נשימה". */}
      <View style={[styles.categoryArt, { backgroundColor: tileColorFor(category.slug) }]}>
        <CategoryIllustration slug={category.slug} size={46} />
      </View>
      <Text style={styles.categoryLabel} numberOfLines={2}>
        {category.name}
      </Text>
    </Pressable>
  );
}

// ---------- כרטיס מועדון / כרטיס אשראי ----------

// owned=false הוא מועדון שאנחנו תומכים בו אך המשתמשת לא סימנה
// שיש לה אותו. הוא מוצג בכוונה (בעמעום קל + תווית "להוספה")
// ולא מוסתר: משתמשת עם כרטיס אחד הייתה רואה שורה כמעט ריקה,
// ובלי שום רמז שיש עוד מה להוסיף. ראו הנחיית המוצר.
export function ClubCard({
  program,
  owned,
  onPress,
  width,
}: {
  program: Program;
  owned: boolean;
  onPress: () => void;
  width: number;
}) {
  const logo = programLogoUri(program);
  const accent = program.color ?? theme.colors.purple;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.clubCard, { width }, !owned && styles.clubCardMuted, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={owned ? program.name : `${program.name} — זמין להוספה`}
    >
      <View style={[styles.clubAccent, { backgroundColor: accent }]} />
      <View style={styles.clubBody}>
        <View style={[styles.clubLogo, { borderColor: accent }]}>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.clubLogoImage} resizeMode="contain" />
          ) : (
            <Text style={styles.clubLogoLetter}>{program.name.trim().charAt(0)}</Text>
          )}
        </View>
        <Text style={styles.clubName} numberOfLines={2}>
          {program.name}
        </Text>
        {owned ? (
          program.issuer?.name ? <Text style={styles.clubIssuer}>{program.issuer.name}</Text> : null
        ) : (
          <View style={styles.addChip}>
            <Text style={styles.addChipText}>+ להוספה</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ---------- כרטיס מבצע חם (50% ומעלה) ----------

export function HotDealCard({ benefit, onPress, width }: { benefit: Benefit; onPress: () => void; width: number }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.hotCard, { width }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${benefit.title}, מבצע חם ${hotDealLabel(benefit)}`}
    >
      <View style={styles.hotImageWrap}>
        <BenefitImage
          uri={benefitImageUri(benefit)}
          label={benefit.title}
          categorySlug={benefit.category?.slug}
          style={styles.hotImage}
          borderRadius={0}
          illustrationSize={52}
        />
        <View style={styles.hotBadge}>
          <Text style={styles.hotBadgeText}>{hotDealLabel(benefit)}</Text>
        </View>
      </View>
      <View style={styles.hotBody}>
        <Text style={styles.hotTitle} numberOfLines={2}>
          {benefit.title}
        </Text>
        {benefit.category?.name && <Text style={styles.hotCategory}>{benefit.category.name}</Text>}
      </View>
    </Pressable>
  );
}

// ---------- כרטיס חנות/מותג ----------

export type PopularStore = { brand: Brand; benefitCount: number; bestDiscount: string | null };

export function StoreCard({ store, onPress, width }: { store: PopularStore; onPress: () => void; width: number }) {
  const logo = brandLogoUri(store.brand);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.storeCard, { width }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${store.brand.name}, ${store.benefitCount} הטבות`}
    >
      <View style={styles.storeLogoWrap}>
        {logo ? (
          <Image source={{ uri: logo }} style={styles.storeLogoImage} resizeMode="contain" />
        ) : (
          <Text style={styles.storeLogoLetter}>{store.brand.name.trim().charAt(0)}</Text>
        )}
      </View>
      <Text style={styles.storeName} numberOfLines={1}>
        {store.brand.name}
      </Text>
      <View style={styles.storeMetaRow}>
        {store.bestDiscount && (
          <View style={styles.storeDiscountChip}>
            <Text style={styles.storeDiscountText}>עד {store.bestDiscount}</Text>
          </View>
        )}
        <Text style={styles.storeCount}>
          {store.benefitCount} {store.benefitCount === 1 ? 'הטבה' : 'הטבות'}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------- באנר "מה חדש" קומפקטי ----------

export function NewBenefitCard({ benefit, onPress, width }: { benefit: Benefit; onPress: () => void; width: number }) {
  const discount = formatDiscount(benefit);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.newCard, { width }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${benefit.title}, חדש`}
    >
      <View style={styles.newImageWrap}>
        <BenefitImage
          uri={benefitImageUri(benefit)}
          label={benefit.title}
          categorySlug={benefit.category?.slug}
          style={styles.newImage}
          borderRadius={0}
          illustrationSize={44}
        />
        <View style={styles.newBadge}>
          <Text style={styles.newBadgeText}>חדש</Text>
        </View>
        {discount && (
          <View style={styles.newDiscount}>
            <Text style={styles.newDiscountText}>{discount}</Text>
          </View>
        )}
      </View>
      <Text style={styles.newTitle} numberOfLines={2}>
        {benefit.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },

  // --- כותרת סקשן ---
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
    // 20 ולא 24: בבדיקה ויזואלית המסך דרש גלילה ארוכה מדי לפני
    // ההטבה הראשונה. ההפרש נראה זניח בסקשן בודד ומצטבר ל~40px
    // על פני שש הכותרות במסך.
    marginTop: theme.spacing.md + 4,
  },
  sectionTitleWrap: { flex: 1 },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    textAlign: 'right',
  },
  sectionHint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textAlign: 'right',
    marginTop: 2,
  },
  seeAll: {
    minHeight: theme.minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xs,
  },
  seeAllText: { fontSize: theme.fontSize.sm, fontWeight: '700', color: theme.colors.purple },

  // --- קטגוריה ---
  // רוחב המכולה (92) גדול מרוחב האריח (78) בכוונה: שמות קטגוריה
  // בעברית ארוכים ("מסעדות ובתי קפה", "אטרקציות ובידור משפחתי")
  // נחתכו באמצע מילה כשהתווית הוגבלה לרוחב האריח עצמו. עכשיו יש
  // לתווית מקום לשתי שורות מלאות, והאריחים נשארים מרווחים.
  categoryTile: { width: 92, alignItems: 'center' },
  categoryArt: {
    width: 78,
    height: 78,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  categoryLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    lineHeight: 15,
    // גובה קבוע לשתי שורות — בלעדיו, אריח עם שם בן מילה אחת
    // ואריח עם שם בן שתי מילים יוצרים שורה עם תחתית "משוננת".
    height: 30,
  },

  // --- מועדון ---
  clubCard: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  clubCardMuted: { opacity: 0.72, borderStyle: 'dashed' },
  clubAccent: { height: 6 },
  clubBody: { padding: theme.spacing.sm + 4, alignItems: 'flex-end' },
  clubLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  clubLogoImage: { width: '78%', height: '78%' },
  clubLogoLetter: { fontSize: 20, fontWeight: '800', color: theme.colors.lilac },
  clubName: { fontSize: theme.fontSize.sm, fontWeight: '700', color: theme.colors.textPrimary, textAlign: 'right' },
  clubIssuer: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, textAlign: 'right', marginTop: 2 },
  addChip: {
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  addChipText: { fontSize: 11, fontWeight: '700', color: theme.colors.lilac },

  // --- מבצע חם ---
  hotCard: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.hot,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  hotImageWrap: { width: '100%', height: 104 },
  hotImage: { width: '100%', height: '100%' },
  hotBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    backgroundColor: theme.colors.hot,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  // טקסט כהה על אקצנט בהיר — לבן על כתום נכשל בניגודיות. ראו
  // הערת textOnAccent ב-theme.ts.
  hotBadgeText: { fontSize: theme.fontSize.sm, fontWeight: '800', color: theme.colors.textOnAccent },
  hotBody: { padding: theme.spacing.sm + 2 },
  // גובה קבוע לשתי שורות: בלעדיו כרטיס עם כותרת בת שורה אחת
  // ("1+1 על כל הפיצות") נמוך מכרטיס עם כותרת בת שתיים, והשורה
  // האופקית מקבלת תחתית "משוננת" — הסימן הכי מובהק לשורת כרטיסים
  // לא-מעוצבת.
  hotTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'right',
    lineHeight: 18,
    height: 36,
  },
  hotCategory: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, textAlign: 'right', marginTop: 3 },

  // --- חנות ---
  storeCard: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    alignItems: 'center',
    ...theme.shadow.card,
  },
  storeLogoWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  storeLogoImage: { width: '80%', height: '80%' },
  storeLogoLetter: { fontSize: 24, fontWeight: '800', color: theme.colors.lilac },
  storeName: { fontSize: theme.fontSize.sm, fontWeight: '700', color: theme.colors.textPrimary, textAlign: 'center' },
  // flexWrap:'nowrap' + רוחב כרטיס 146 (ראו HomeScreen): ב-132px
  // הצ'יפ "עד 30%" ו"4 הטבות" נשברו לשתי שורות ויצרו כרטיסים
  // בגבהים שונים באותה שורה.
  storeMetaRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'nowrap' },
  storeDiscountChip: {
    backgroundColor: theme.colors.successBg,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  storeDiscountText: { fontSize: 11, fontWeight: '800', color: theme.colors.success },
  storeCount: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted },

  // --- חדש ---
  newCard: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  newImageWrap: { width: '100%', height: 92 },
  newImage: { width: '100%', height: '100%' },
  newBadge: {
    position: 'absolute',
    top: theme.spacing.xs,
    right: theme.spacing.xs,
    backgroundColor: theme.colors.success,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  newBadgeText: { fontSize: 11, fontWeight: '800', color: theme.colors.textOnAccent },
  newDiscount: {
    position: 'absolute',
    bottom: theme.spacing.xs,
    left: theme.spacing.xs,
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  newDiscountText: { fontSize: 11, fontWeight: '800', color: theme.colors.textOnAccent },
  // אותה סיבה כמו hotTitle — גובה קבוע לשתי שורות מיישר את תחתית
  // כל הכרטיסים בשורה.
  newTitle: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'right',
    padding: theme.spacing.sm,
    lineHeight: 16,
    height: 32 + theme.spacing.sm * 2,
  },
});
