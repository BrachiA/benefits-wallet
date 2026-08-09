// ============================================================
// Benefits Wallet — Seed
// דוגמאות אמיתיות כדי שהאפליקציה תעבוד מיד: מנפיקים, מועדונים
// (כולל היררכיה), קטגוריות, מותגים, הטבות עם Scope אמיתי, קופון,
// תגית וקמפיין. זה גם קובץ הייחוס להבנת ה-Scope-model בפועל.
// ============================================================

import { PrismaClient, ProgramType, BenefitType, DiscountUnit, Channel } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ---- הגנה מפני הרצה בטעות ----
  // ה-seed מוחק את *כל* הנתונים לפני שהוא זורע. אם ב-DB כבר יש
  // דאטה (כלומר זו כנראה סביבה חיה ולא סביבת פיתוח ריקה), עוצרים
  // אלא אם המפעיל ביקש דריסה במפורש עם SEED_FORCE=true.
  const existingIssuers = await prisma.issuer.count();
  const existingBenefits = await prisma.benefit.count();
  const forced = process.env.SEED_FORCE === 'true';

  if (process.env.NODE_ENV === 'production' && !forced) {
    console.error('עצירה: NODE_ENV=production. ה-seed מוחק את כל הנתונים.');
    console.error('אם זו באמת הכוונה, הריצו שוב עם SEED_FORCE=true.');
    process.exit(1);
  }
  if ((existingIssuers > 0 || existingBenefits > 0) && !forced) {
    console.error(`עצירה: נמצאו נתונים קיימים ב-DB (${existingIssuers} מנפיקים, ${existingBenefits} הטבות).`);
    console.error('ה-seed מוחק את כל הנתונים לפני זריעה. אם זו הכוונה, הריצו שוב עם SEED_FORCE=true:');
    console.error('  SEED_FORCE=true npx prisma db seed');
    process.exit(1);
  }

  console.log('מנקה נתונים קיימים...');
  // סדר מחיקה הפוך לסדר התלויות — כדי לא להיתקל ב-FK constraint
  await prisma.notification.deleteMany();
  await prisma.campaignBenefit.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.benefitTag.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.benefitScope.deleteMany();
  await prisma.benefit.deleteMany();
  await prisma.mediaAsset.deleteMany();
  await prisma.store.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.category.deleteMany();
  await prisma.program.deleteMany();
  await prisma.issuer.deleteMany();
  await prisma.city.deleteMany();
  await prisma.region.deleteMany();
  await prisma.auditLog.deleteMany();

  // ---------- Regions & Cities ----------
  const merkaz = await prisma.region.create({ data: { name: 'מרכז' } });
  const telAviv = await prisma.city.create({ data: { name: 'תל אביב', regionId: merkaz.id } });
  const ramatGan = await prisma.city.create({ data: { name: 'רמת גן', regionId: merkaz.id } });

  // ---------- Issuers ----------
  console.log('יוצר מנפיקים...');
  const max = await prisma.issuer.create({
    data: { slug: 'max', name: 'MAX', brandColor: '#FF4D4D', isActive: true, sortOrder: 1 },
  });
  const cal = await prisma.issuer.create({
    data: { slug: 'cal', name: 'Cal', brandColor: '#0057B8', isActive: true, sortOrder: 2 },
  });
  const isracard = await prisma.issuer.create({
    data: { slug: 'isracard', name: 'ישראכרט', brandColor: '#F7941D', isActive: true, sortOrder: 3 },
  });
  const shufersal = await prisma.issuer.create({
    data: { slug: 'shufersal', name: 'שופרסל', brandColor: '#E30613', isActive: true, sortOrder: 4 },
  });

  // ---------- Programs (עם היררכיה: MAX -> MAX Platinum) ----------
  console.log('יוצר מועדונים/כרטיסים...');
  const maxProgram = await prisma.program.create({
    data: {
      issuerId: max.id,
      slug: 'max',
      name: 'MAX',
      type: ProgramType.CREDIT_CARD,
      path: 'max',
      isActive: true,
      isPopular: true,
      sortOrder: 1,
    },
  });

  const maxPlatinum = await prisma.program.create({
    data: {
      issuerId: max.id,
      parentProgramId: maxProgram.id,
      slug: 'max-platinum',
      name: 'MAX Platinum',
      type: ProgramType.CREDIT_CARD,
      path: 'max/max-platinum',
      annualFee: 240,
      isActive: true,
      sortOrder: 2,
    },
  });

  const calProgram = await prisma.program.create({
    data: {
      issuerId: cal.id,
      slug: 'cal',
      name: 'Cal',
      type: ProgramType.CREDIT_CARD,
      path: 'cal',
      isActive: true,
      isPopular: true,
      sortOrder: 3,
    },
  });

  const isracardProgram = await prisma.program.create({
    data: {
      issuerId: isracard.id,
      slug: 'isracard',
      name: 'ישראכרט',
      type: ProgramType.CREDIT_CARD,
      path: 'isracard',
      isActive: true,
      isPopular: true,
      sortOrder: 4,
    },
  });

  const haverClub = await prisma.program.create({
    data: {
      issuerId: shufersal.id,
      slug: 'haver',
      name: 'חבר',
      type: ProgramType.CUSTOMER_CLUB,
      path: 'haver',
      isActive: true,
      isPopular: true,
      sortOrder: 5,
    },
  });

  // ---------- Categories (עם תת-קטגוריה) ----------
  console.log('יוצר קטגוריות...');
  const fashion = await prisma.category.create({
    data: { slug: 'fashion', name: 'אופנה', path: 'fashion', iconName: 'shirt', sortOrder: 1 },
  });
  const fashionShoes = await prisma.category.create({
    data: {
      slug: 'fashion-shoes',
      name: 'הנעלה',
      parentId: fashion.id,
      path: 'fashion/fashion-shoes',
      iconName: 'shoe',
      sortOrder: 1,
    },
  });
  const food = await prisma.category.create({
    data: { slug: 'food', name: 'מזון וסופרמרקט', path: 'food', iconName: 'shopping-cart', sortOrder: 2 },
  });
  const electronics = await prisma.category.create({
    data: { slug: 'electronics', name: 'אלקטרוניקה', path: 'electronics', iconName: 'device', sortOrder: 3 },
  });
  const dining = await prisma.category.create({
    data: { slug: 'dining', name: 'מסעדות ובתי קפה', path: 'dining', iconName: 'coffee', sortOrder: 4 },
  });

  // ---------- Brands ----------
  console.log('יוצר מותגים...');
  const foxGroup = await prisma.brand.create({
    data: {
      slug: 'fox-group',
      name: 'קבוצת פוקס',
      categoryId: fashion.id,
      hasOnlineStore: true,
      hasPhysicalStores: true,
      searchKeywords: ['fox', 'פוקס'],
    },
  });
  const zara = await prisma.brand.create({
    data: {
      slug: 'zara',
      name: 'זארה',
      categoryId: fashion.id,
      hasOnlineStore: true,
      hasPhysicalStores: true,
      searchKeywords: ['zara', 'זארה'],
    },
  });
  const americanEagle = await prisma.brand.create({
    data: {
      slug: 'american-eagle',
      name: 'אמריקן איגל',
      parentBrandId: foxGroup.id,
      categoryId: fashion.id,
      hasOnlineStore: true,
      hasPhysicalStores: true,
      searchKeywords: ['american eagle', 'אמריקן איגל'],
    },
  });
  const shufersalBrand = await prisma.brand.create({
    data: {
      slug: 'shufersal',
      name: 'שופרסל',
      categoryId: food.id,
      hasOnlineStore: true,
      hasPhysicalStores: true,
      searchKeywords: ['שופרסל', 'shufersal'],
    },
  });
  const ksp = await prisma.brand.create({
    data: {
      slug: 'ksp',
      name: 'KSP',
      categoryId: electronics.id,
      hasOnlineStore: true,
      hasPhysicalStores: true,
      searchKeywords: ['ksp', 'קיי אס פי'],
    },
  });
  const cofixBrand = await prisma.brand.create({
    data: {
      slug: 'cofix',
      name: 'Cofix',
      categoryId: dining.id,
      hasOnlineStore: false,
      hasPhysicalStores: true,
      searchKeywords: ['cofix', 'קופיקס'],
    },
  });

  // ---------- Stores ----------
  console.log('יוצר סניפים...');
  const zaraStore = await prisma.store.create({
    data: {
      brandId: zara.id,
      name: 'זארה קניון עזריאלי',
      cityId: telAviv.id,
      lat: 32.0748,
      lng: 34.7918,
      isActive: true,
    },
  });
  await prisma.store.create({
    data: {
      brandId: cofixBrand.id,
      name: 'Cofix רמת גן',
      cityId: ramatGan.id,
      lat: 32.0823,
      lng: 34.8141,
      isActive: true,
    },
  });

  // ---------- Benefits + Scopes (הלב של ה-Seed) ----------
  console.log('יוצר הטבות עם Scope...');

  // דוגמה 1: הטבה שתקפה בכל מי שיש MAX (כולל Platinum, בזכות ה-path)
  // וגם בכל מי שיש Cal — כלומר שני Scope-ים לאותה הטבה = OR
  const benefit1 = await prisma.benefit.create({
    data: {
      slug: 'zara-10-percent',
      title: '10% הנחה בזארה',
      shortDescription: '10% הנחה על כל הקנייה בזארה, אונליין וסניפים',
      categoryId: fashion.id,
      benefitType: BenefitType.DISCOUNT_PERCENT,
      discountValue: 10,
      discountUnit: DiscountUnit.PERCENT,
      channel: Channel.BOTH,
      valueScore: 60,
      isActive: true,
      isPopular: true,
      priority: 10,
    },
  });
  await prisma.benefitScope.create({
    data: { benefitId: benefit1.id, programId: maxProgram.id, brandId: zara.id },
  });
  await prisma.benefitScope.create({
    data: { benefitId: benefit1.id, programId: calProgram.id, brandId: zara.id },
  });

  // דוגמה 2: הטבה בלעדית ל-MAX Platinum בלבד (לא לכרטיס הרגיל) — בכל מותג
  const benefit2 = await prisma.benefit.create({
    data: {
      slug: 'platinum-electronics-15',
      title: '15% הנחה באלקטרוניקה למחזיקי MAX Platinum',
      shortDescription: '15% הנחה ב-KSP למחזיקי MAX Platinum בלבד',
      categoryId: electronics.id,
      benefitType: BenefitType.DISCOUNT_PERCENT,
      discountValue: 15,
      discountUnit: DiscountUnit.PERCENT,
      maxDiscountAmount: 500,
      channel: Channel.BOTH,
      valueScore: 85,
      isActive: true,
      isFeatured: true,
      priority: 20,
    },
  });
  await prisma.benefitScope.create({
    data: { benefitId: benefit2.id, programId: maxPlatinum.id, brandId: ksp.id },
  });

  // דוגמה 3: הטבה של מועדון "חבר" תקפה בכל שופרסל, ללא הגבלת סניף
  const benefit3 = await prisma.benefit.create({
    data: {
      slug: 'haver-shufersal-cashback',
      title: '5% קאשבק בשופרסל',
      shortDescription: 'החזר כספי של 5% בכל קנייה בשופרסל למחזיקי מועדון חבר',
      categoryId: food.id,
      benefitType: BenefitType.CASHBACK,
      discountValue: 5,
      discountUnit: DiscountUnit.PERCENT,
      channel: Channel.IN_STORE,
      valueScore: 55,
      isActive: true,
      isPopular: true,
      priority: 5,
    },
  });
  await prisma.benefitScope.create({
    data: { benefitId: benefit3.id, programId: haverClub.id, brandId: shufersalBrand.id },
  });

  // דוגמה 4: הטבה גלובלית — ללא programId (חלה על כל מי שיש כל כרטיס), רק בסניף אחד
  const benefit4 = await prisma.benefit.create({
    data: {
      slug: 'zara-azrieli-gift',
      title: 'מתנה בקנייה מעל 300 ₪',
      shortDescription: 'מתנה בקנייה מעל 300 ₪ בסניף זארה עזריאלי בלבד',
      categoryId: fashionShoes.id,
      benefitType: BenefitType.GIFT,
      minPurchaseAmount: 300,
      channel: Channel.IN_STORE,
      requiresCoupon: true,
      valueScore: 40,
      isActive: true,
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-08-31'),
      priority: 3,
    },
  });
  await prisma.benefitScope.create({
    data: { benefitId: benefit4.id, storeId: zaraStore.id },
  });

  // ---------- Coupon ----------
  await prisma.coupon.create({
    data: {
      benefitId: benefit4.id,
      code: 'ZARA300GIFT',
      type: 'SINGLE_USE_SHARED',
      maxUses: 1000,
      expiresAt: new Date('2026-08-31'),
      isActive: true,
    },
  });

  // ---------- Tags ----------
  console.log('יוצר תגיות...');
  const tagWeekend = await prisma.tag.create({ data: { slug: 'weekend', name: 'סוף שבוע' } });
  const tagOnlineOnly = await prisma.tag.create({ data: { slug: 'online-only', name: 'רק באינטרנט' } });

  await prisma.benefitTag.create({ data: { benefitId: benefit1.id, tagId: tagOnlineOnly.id } });
  await prisma.benefitTag.create({ data: { benefitId: benefit4.id, tagId: tagWeekend.id } });

  // ---------- Campaign ----------
  console.log('יוצר קמפיין...');
  const campaign = await prisma.campaign.create({
    data: {
      slug: 'back-to-school-2026',
      title: 'חזרה לבית הספר 2026',
      description: 'ההטבות הכי משתלמות לקראת שנת הלימודים',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-09-15'),
      isActive: true,
      sortOrder: 1,
    },
  });
  await prisma.campaignBenefit.create({ data: { campaignId: campaign.id, benefitId: benefit1.id, sortOrder: 1 } });
  await prisma.campaignBenefit.create({ data: { campaignId: campaign.id, benefitId: benefit4.id, sortOrder: 2 } });

  console.log('Seed הושלם בהצלחה.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
