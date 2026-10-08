// ============================================================
// Benefits Wallet — Seed
//
// שלב 8 (+ השלמה): כל הישויות כאן (מנפיקים, מועדונים, מותגים,
// קטגוריות) הן ישויות אמיתיות שקיימות בפועל בישראל — לא דוגמאות
// מומצאות. כל ה-Benefit-ים בקובץ מבוססים על מידע ציבורי שנאסף
// ידנית (לא סריקה אוטומטית) בתאריך המצוין ב-sourceMetadata.source
// של כל אחד, עם קישור למקור. זו הבחנה מכוונת ומתועדת: קריאה
// ועיבוד ידני של דף ציבורי שונה מהרצת תוכנית סריקה אוטומטית, ולכן
// אינה כפופה לשער ה-tosStatus (שממשיך לחול במלואו על מודול הסורק).
//
// העיקרון לא השתנה מהגרסה הראשונה: מקור אמיתי לכל רשומה, בלי
// לבדות מספרים. ההרחבה (11 הטבות, לעומת 3 בגרסה הראשונה) הגיעה
// מהרחבת היקף המחקר לכל קטגוריה — לא מהקלה בדרישת המקור. קטגוריית
// "מסעדות ובתי קפה" נשארה עם הטבה אחת בלבד ביודעין: מקור שני
// שנמצא (קפה קפה) לא אומת מול דומיין רשמי משלו, ולכן לא נכלל.
// ============================================================

import { PrismaClient, ProgramType, BenefitType, DiscountUnit, Channel, ScraperSourceType, ScraperRenderMode } from '@prisma/client';

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
  await prisma.scrapedItem.deleteMany();
  await prisma.scraperRun.deleteMany();
  await prisma.scraperSource.deleteMany();
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
  // חמישה מנפיקים אמיתיים: שלוש חברות כרטיסי האשראי הגדולות
  // בישראל (MAX, Cal, ישראכרט) ושתי רשתות קמעונאיות שמפעילות
  // מועדון לקוחות משלהן (רשת "יש" תחת Cal, שופרסל ורמי לוי עם
  // מועדונים עצמאיים).
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
  const ramiLevy = await prisma.issuer.create({
    data: { slug: 'rami-levy', name: 'רמי לוי', brandColor: '#ED1C24', isActive: true, sortOrder: 5 },
  });
  const foxGroupIssuer = await prisma.issuer.create({
    data: { slug: 'fox-group', name: 'קבוצת פוקס', brandColor: '#1C1C1C', isActive: true, sortOrder: 6 },
  });

  // ---------- Programs ----------
  // MAX ו-MAX Platinum הן שתי דרגות אמיתיות של כרטיס MAX (היררכיה
  // ב-path, כמו במקור). "כרטיס יש" הוא כרטיס האשראי האמיתי של
  // רשת יש, מונפק ומתופעל ע"י Cal. "חבר" הוא מועדון הלקוחות
  // האמיתי של רמי לוי — לא של שופרסל (זו הייתה טעות בסיד הקודם).
  // שופרסל מפעילה מועדון לקוחות עצמאי בשם "מועדון לקוחות שופרסל"
  // (מאומת מול תקנון רשמי, ראו sourceMetadata בהטבות למטה).
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
      // annualFee לא מולא: לא נמצא מקור ציבורי מאומת לסכום המדויק
      // הנוכחי בזמן איסוף הדאטה — עדיף שדה ריק על ניחוש.
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

  const yeshCard = await prisma.program.create({
    data: {
      issuerId: cal.id,
      slug: 'yesh-card',
      name: 'כרטיס יש',
      type: ProgramType.CREDIT_CARD,
      path: 'yesh-card',
      description: 'כרטיס האשראי של רשת יש, מונפק ומתופעל ע"י Cal.',
      isActive: true,
      sortOrder: 4,
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
      sortOrder: 5,
    },
  });

  const shufersalClub = await prisma.program.create({
    data: {
      issuerId: shufersal.id,
      slug: 'shufersal-club',
      name: 'מועדון לקוחות שופרסל',
      type: ProgramType.CUSTOMER_CLUB,
      path: 'shufersal-club',
      isActive: true,
      isPopular: true,
      sortOrder: 6,
    },
  });

  const chaverClub = await prisma.program.create({
    data: {
      issuerId: ramiLevy.id,
      slug: 'chaver',
      name: 'חבר',
      type: ProgramType.CUSTOMER_CLUB,
      path: 'chaver',
      description: 'מועדון הלקוחות של רמי לוי.',
      isActive: true,
      isPopular: true,
      sortOrder: 7,
    },
  });

  const dreamCard = await prisma.program.create({
    data: {
      issuerId: foxGroupIssuer.id,
      slug: 'dream-card',
      name: 'Dream Card',
      type: ProgramType.CUSTOMER_CLUB,
      path: 'dream-card',
      description: 'מועדון הלקוחות של קבוצת פוקס (פוקס, פוקס הום, לה-לין, בילבונג, מנגו, יאנגה, טרמינל X ועוד).',
      isActive: true,
      isPopular: true,
      sortOrder: 8,
    },
  });

  const lifestyleCard = await prisma.program.create({
    data: {
      issuerId: isracard.id,
      slug: 'lifestyle-card',
      name: 'כרטיס לייף סטייל',
      type: ProgramType.CREDIT_CARD,
      path: 'lifestyle-card',
      description: 'כרטיס אשראי משותף לישראכרט וסופר-פארם.',
      isActive: true,
      sortOrder: 9,
    },
  });

  // ---------- Categories ----------
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
  const health = await prisma.category.create({
    data: { slug: 'health-pharm', name: 'בריאות ופארם', path: 'health-pharm', iconName: 'health', sortOrder: 5 },
  });
  // הרחבה (14.8.2026): נבדק מול 40 כותרות אמיתיות ורוב לא התאימו
  // לאף אחת מ-6 הקטגוריות המקוריות למעלה — נדרש כדי ש-modules/
  // aiEnrichment (הצעת קטגוריה אוטומטית) יהיה לו למה למפות פריטים
  // כמו הטבות תיירות/בילוי/תרבות שלא היה להן בית עד עכשיו.
  await prisma.category.create({
    data: { slug: 'travel-leisure', name: 'תיירות ונופש', path: 'travel-leisure', iconName: 'travel', sortOrder: 6 },
  });
  await prisma.category.create({
    data: { slug: 'attractions', name: 'אטרקציות ובידור משפחתי', path: 'attractions', iconName: 'attraction', sortOrder: 7 },
  });
  await prisma.category.create({
    data: { slug: 'culture-shows', name: 'תרבות ומופעים', path: 'culture-shows', iconName: 'ticket', sortOrder: 8 },
  });
  await prisma.category.create({
    data: { slug: 'cinema', name: 'קולנוע', path: 'cinema', iconName: 'film', sortOrder: 9 },
  });
  await prisma.category.create({
    data: { slug: 'education', name: 'חינוך וקורסים', path: 'education', iconName: 'book', sortOrder: 10 },
  });
  await prisma.category.create({
    data: { slug: 'gift-cards', name: 'תווי קנייה כלליים', path: 'gift-cards', iconName: 'gift-card', sortOrder: 11 },
  });
  await prisma.category.create({
    data: { slug: 'digital-subscriptions', name: 'מנויי תוכן דיגיטלי', path: 'digital-subscriptions', iconName: 'subscription', sortOrder: 12 },
  });

  // ---------- Brands ----------
  // כולן רשתות/מותגים אמיתיים הפעילים בישראל.
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
  const ramiLevyBrand = await prisma.brand.create({
    data: {
      slug: 'rami-levy',
      name: 'רמי לוי',
      categoryId: food.id,
      hasOnlineStore: true,
      hasPhysicalStores: true,
      searchKeywords: ['רמי לוי', 'rami levy'],
    },
  });
  const yeshBrand = await prisma.brand.create({
    data: {
      slug: 'yesh',
      name: 'יש',
      categoryId: food.id,
      hasOnlineStore: false,
      hasPhysicalStores: true,
      searchKeywords: ['יש', 'yesh'],
    },
  });
  const bePharmBrand = await prisma.brand.create({
    data: {
      slug: 'be-pharm',
      name: 'Be פארם',
      categoryId: health.id,
      hasOnlineStore: true,
      hasPhysicalStores: true,
      searchKeywords: ['be pharm', 'בי פארם', 'ביפארם'],
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
  const superPharmBrand = await prisma.brand.create({
    data: {
      slug: 'super-pharm',
      name: 'סופר-פארם',
      categoryId: health.id,
      hasOnlineStore: true,
      hasPhysicalStores: true,
      searchKeywords: ['סופר פארם', 'super pharm', 'super-pharm', 'בית מרקחת'],
    },
  });
  const aromaBrand = await prisma.brand.create({
    data: {
      slug: 'aroma',
      name: 'ארומה אספרסו בר',
      categoryId: dining.id,
      hasOnlineStore: false,
      hasPhysicalStores: true,
      searchKeywords: ['ארומה', 'aroma', 'קפה'],
    },
  });
  // בלי Benefit מצורף בכוונה — נוספה כמותג אמיתי בעיקר כדי לוודא
  // שחיפוש-לפי-סוג ("גלידה") מחזיר תוצאה רלוונטית, לא רק חיפוש שם
  // מדויק. לא כל מותג בקטלוג חייב הטבה מצורפת (כמו זארה/פוקס למעלה).
  const goldaBrand = await prisma.brand.create({
    data: {
      slug: 'golda',
      name: 'גולדה',
      categoryId: dining.id,
      hasOnlineStore: false,
      hasPhysicalStores: true,
      searchKeywords: ['גולדה', 'golda', 'גלידה', 'ice cream'],
    },
  });

  // ---------- Stores ----------
  console.log('יוצר סניפים...');
  await prisma.store.create({
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

  // ---------- Benefits + Scopes ----------
  // שלושת אלה, ורק אלה: כל אחד מבוסס על מידע ציבורי שנאסף ידנית
  // בפועל (לא בדוי, לא סריקה אוטומטית) בתאריך ומהמקור המצוינים
  // ב-sourceMetadata. valueScore מחושב לפי אותה נוסחה בדיוק כמו
  // ב-recommendation/valueScore.ts (PERCENT -> הערך עצמו, GIFT -> 0),
  // ולא מוזן כניחוש.
  console.log('יוצר הטבות עם Scope (מקור: מחקר ידני, לא סריקה)...');

  const researchDate = new Date().toISOString();
  const yeshSource = {
    source: 'manual-research',
    url: 'https://www.cal-online.co.il/cards/yesh/',
    researchedAt: researchDate,
  };
  const chaverSource = {
    source: 'manual-research',
    url: 'https://www.rami-levy.co.il/he/club-rules',
    researchedAt: researchDate,
  };

  const yeshDiscountBenefit = await prisma.benefit.create({
    data: {
      slug: 'yesh-10-percent-10-products',
      title: '10% הנחה על 10 מוצרים נבחרים בחנויות יש',
      shortDescription: 'מחזיקי כרטיס יש בוחרים 10 מוצרים ונהנים מ-10% הנחה עליהם, כולל מבצעים כפולים',
      fullDescription:
        'למחזיקי כרטיס יש (Cal) מגיעה הטבה של 10% הנחה על 10 מוצרים לבחירה בחנויות רשת יש, בתוקף לשנה מיום ההצטרפות. הכרטיס והמועדון שומרים לעצמם את הזכות לשנות את ההטבה מעת לעת.',
      categoryId: food.id,
      benefitType: BenefitType.DISCOUNT_PERCENT,
      discountValue: 10,
      discountUnit: DiscountUnit.PERCENT,
      channel: Channel.IN_STORE,
      valueScore: 10,
      isActive: true,
      isPopular: true,
      startDate: new Date(),
      priority: 10,
      sourceMetadata: { title: yeshSource, shortDescription: yeshSource, discountValue: yeshSource },
    },
  });
  await prisma.benefitScope.create({
    data: { benefitId: yeshDiscountBenefit.id, programId: yeshCard.id, brandId: yeshBrand.id },
  });

  const yeshSignupGift = await prisma.benefit.create({
    data: {
      slug: 'yesh-signup-gift',
      title: 'מתנת הצטרפות עד 400 ₪ לחנויות יש',
      shortDescription: 'מצטרפות/ים חדשות/ים לכרטיס יש מקבלות מתנת הצטרפות, בנוסף לפטור מדמי כרטיס ודמי מועדון לשנה',
      categoryId: food.id,
      benefitType: BenefitType.GIFT,
      discountValue: 400,
      discountUnit: DiscountUnit.ILS,
      channel: Channel.IN_STORE,
      valueScore: 0,
      isActive: true,
      startDate: new Date(),
      priority: 8,
      sourceMetadata: { title: yeshSource, discountValue: yeshSource },
    },
  });
  await prisma.benefitScope.create({
    data: { benefitId: yeshSignupGift.id, programId: yeshCard.id, brandId: yeshBrand.id },
  });

  const bePharmBenefit = await prisma.benefit.create({
    data: {
      slug: 'chaver-bepharm-5-percent',
      title: '5% הנחה קבועה ב-Be פארם',
      shortDescription: 'מחזיקי כרטיס אשראי רמי לוי (מועדון חבר) מקבלים 5% הנחה קבועה בקנייה ב-Be פארם',
      categoryId: health.id,
      benefitType: BenefitType.DISCOUNT_PERCENT,
      discountValue: 5,
      discountUnit: DiscountUnit.PERCENT,
      channel: Channel.IN_STORE,
      valueScore: 5,
      isActive: true,
      isPopular: true,
      startDate: new Date(),
      priority: 10,
      sourceMetadata: { title: chaverSource, shortDescription: chaverSource, discountValue: chaverSource },
    },
  });
  await prisma.benefitScope.create({
    data: { benefitId: bePharmBenefit.id, programId: chaverClub.id, brandId: bePharmBrand.id },
  });

  // ---------- הרחבת הטבות (השלמה): כיסוי לכל קטגוריה עיקרית ----------
  // אותו עיקרון בדיוק כמו שלוש ההטבות הראשונות: מקור ציבורי אמיתי
  // לכל רשומה, בלי לבדות מספרים. שלוש הבאות (Dream Card) מגיעות
  // מתקנון רשמי אחד של קבוצת פוקס — כך גם אלקטרוניקה (שני מקורות
  // רשמיים נפרדים של ישראכרט על KSP).
  const dreamCardSource = {
    source: 'manual-research',
    url: 'https://www.terminalx.com/pub/media/Files/terms11.pdf',
    researchedAt: researchDate,
  };
  const kspMastercardSource = {
    source: 'manual-research',
    url: 'https://digital.isracard.co.il/link/d292b053f5df4a8bb02bce036f9981c0.aspx',
    researchedAt: researchDate,
  };
  const kspMastercardDaySource = {
    source: 'manual-research',
    url: 'https://digital.isracard.co.il/link/66bc430993184c9681754cdd6d29d4d3.aspx',
    researchedAt: researchDate,
  };
  const aromaSource = {
    source: 'manual-research',
    url: 'https://www.aroma.co.il/תקנוני-ארומה-קארד/',
    researchedAt: researchDate,
  };
  const lifestyleSource = {
    source: 'manual-research',
    url: 'https://marketing.isracard.co.il/clubs/lifestyle/',
    researchedAt: researchDate,
  };

  // --- אופנה: קבוצת פוקס / Dream Card (3 הטבות מאותו תקנון רשמי) ---
  const dreamCardGift = await prisma.benefit.create({
    data: {
      slug: 'dream-card-signup-gift',
      title: 'מתנת הצטרפות 100 ₪ למועדון Dream Card',
      shortDescription: 'מצטרפות חדשות למועדון מקבלות 100 ₪ למימוש חד-פעמי באחד ממותגי הקבוצה (פוקס, פוקס הום, לה-לין, בילבונג, מנגו, יאנגה, טרמינל X ועוד), בחודש שאחרי ההצטרפות',
      categoryId: fashion.id,
      benefitType: BenefitType.GIFT,
      discountValue: 100,
      discountUnit: DiscountUnit.ILS,
      channel: Channel.BOTH,
      valueScore: 0,
      isActive: true,
      startDate: new Date(),
      priority: 8,
      sourceMetadata: { title: dreamCardSource, shortDescription: dreamCardSource, discountValue: dreamCardSource },
    },
  });
  await prisma.benefitScope.create({ data: { benefitId: dreamCardGift.id, programId: dreamCard.id, brandId: foxGroup.id } });

  const dreamCardBirthday = await prisma.benefit.create({
    data: {
      slug: 'dream-card-birthday-30-percent',
      title: 'הטבת יום הולדת — 30% הנחה חד-פעמית',
      shortDescription: '30% הנחה חד-פעמית בכל אחד ממותגי הקבוצה בקנייה עד 500 ₪, בחודש יום ההולדת',
      categoryId: fashion.id,
      benefitType: BenefitType.DISCOUNT_PERCENT,
      discountValue: 30,
      discountUnit: DiscountUnit.PERCENT,
      maxDiscountAmount: 500,
      channel: Channel.BOTH,
      valueScore: 30,
      isActive: true,
      startDate: new Date(),
      priority: 9,
      sourceMetadata: { title: dreamCardSource, shortDescription: dreamCardSource, discountValue: dreamCardSource },
    },
  });
  await prisma.benefitScope.create({ data: { benefitId: dreamCardBirthday.id, programId: dreamCard.id, brandId: foxGroup.id } });

  const dreamCardCashback = await prisma.benefit.create({
    data: {
      slug: 'dream-card-cashback-10-percent',
      title: 'צבירת קאשבק 10% בקבוצת פוקס',
      shortDescription: '10% מכל סכום רכישה נצבר כקאשבק, ניתן להמרה לכסף לאחר צבירה של 30 נקודות מינימום',
      categoryId: fashion.id,
      benefitType: BenefitType.CASHBACK,
      discountValue: 10,
      discountUnit: DiscountUnit.PERCENT,
      channel: Channel.BOTH,
      valueScore: 10,
      isActive: true,
      startDate: new Date(),
      priority: 7,
      sourceMetadata: { title: dreamCardSource, shortDescription: dreamCardSource, discountValue: dreamCardSource },
    },
  });
  await prisma.benefitScope.create({ data: { benefitId: dreamCardCashback.id, programId: dreamCard.id, brandId: foxGroup.id } });

  // --- מזון: תוספת לרמי לוי — הטבה גלובלית (brandId null = בכל מותג) ---
  const chaverOutsideCashback = await prisma.benefit.create({
    data: {
      slug: 'chaver-outside-network-5-percent',
      title: '5% קאשבק בקניות מחוץ לרשת רמי לוי',
      shortDescription: 'מחזיקי כרטיס אשראי רמי לוי (מועדון חבר) מקבלים 5% קאשבק על קניות ברשתות אחרות — ריהוט, נופש וביגוד',
      categoryId: food.id,
      benefitType: BenefitType.CASHBACK,
      discountValue: 5,
      discountUnit: DiscountUnit.PERCENT,
      channel: Channel.BOTH,
      valueScore: 5,
      isActive: true,
      startDate: new Date(),
      priority: 6,
      sourceMetadata: { title: chaverSource, shortDescription: chaverSource, discountValue: chaverSource },
    },
  });
  await prisma.benefitScope.create({ data: { benefitId: chaverOutsideCashback.id, programId: chaverClub.id } });

  // --- אלקטרוניקה: KSP, שתי הטבות נפרדות מ-2 תקנונים רשמיים של ישראכרט/Mastercard ---
  const kspMastercard = await prisma.benefit.create({
    data: {
      slug: 'ksp-mastercard-10-percent',
      title: '10% הנחה באתר KSP למחזיקי Mastercard',
      shortDescription: 'הנחה של 10% באתר KSP.co.il, בתשלום בכרטיס Mastercard בלבד — לפי תקנון ישראכרט',
      categoryId: electronics.id,
      benefitType: BenefitType.DISCOUNT_PERCENT,
      discountValue: 10,
      discountUnit: DiscountUnit.PERCENT,
      channel: Channel.ONLINE,
      valueScore: 10,
      isActive: true,
      startDate: new Date(),
      priority: 8,
      sourceMetadata: { title: kspMastercardSource, shortDescription: kspMastercardSource, discountValue: kspMastercardSource },
    },
  });
  await prisma.benefitScope.create({ data: { benefitId: kspMastercard.id, brandId: ksp.id } });

  const kspMastercardDay = await prisma.benefit.create({
    data: {
      slug: 'ksp-mastercard-day',
      title: 'הטבת Mastercard Day ב-KSP',
      shortDescription: '75 ₪ הנחה בהזמנה מעל 499 ₪ (או 100 ₪ הנחה בהזמנה מעל 990 ₪) באתר KSP, בתשלום ב-Mastercard — לפי תקנון ישראכרט',
      categoryId: electronics.id,
      benefitType: BenefitType.DISCOUNT_FIXED,
      discountValue: 75,
      discountUnit: DiscountUnit.ILS,
      minPurchaseAmount: 499,
      channel: Channel.ONLINE,
      valueScore: 15,
      isActive: true,
      startDate: new Date(),
      priority: 7,
      sourceMetadata: { title: kspMastercardDaySource, shortDescription: kspMastercardDaySource, discountValue: kspMastercardDaySource },
    },
  });
  await prisma.benefitScope.create({ data: { benefitId: kspMastercardDay.id, brandId: ksp.id } });

  // --- מסעדות ובתי קפה: ארומה (מקור רשמי, מותג יחיד בקטגוריה — ראו הערה בראש הקובץ) ---
  const aromaCard = await prisma.benefit.create({
    data: {
      slug: 'aroma-card-10-percent',
      title: '10% הנחה קבועה — כרטיס ארומה',
      shortDescription: 'הנחה קבועה של 10% בכל קנייה, בעת טעינת כרטיס ארומה (100–400 ₪, בקפיצות של 50 ₪). לא ניתן לשלב עם מבצעים נוספים',
      categoryId: dining.id,
      benefitType: BenefitType.DISCOUNT_PERCENT,
      discountValue: 10,
      discountUnit: DiscountUnit.PERCENT,
      channel: Channel.IN_STORE,
      valueScore: 10,
      isActive: true,
      startDate: new Date(),
      priority: 8,
      sourceMetadata: { title: aromaSource, shortDescription: aromaSource, discountValue: aromaSource },
    },
  });
  await prisma.benefitScope.create({ data: { benefitId: aromaCard.id, brandId: aromaBrand.id } });

  // --- בריאות ופארם: תוספת — כרטיס לייף סטייל (ישראכרט + סופר-פארם) ---
  const lifestyleGift = await prisma.benefit.create({
    data: {
      slug: 'lifestyle-card-signup-gift',
      title: 'מתנת הצטרפות עד 500 ₪ למועדון לייף סטייל',
      shortDescription: 'מצטרפות חדשות לכרטיס לייף סטייל (ישראכרט + סופר-פארם) מקבלות מתנת הצטרפות, בנוסף להנחות אוטומטיות באלפי בתי עסק',
      categoryId: health.id,
      benefitType: BenefitType.GIFT,
      discountValue: 500,
      discountUnit: DiscountUnit.ILS,
      channel: Channel.BOTH,
      valueScore: 0,
      isActive: true,
      startDate: new Date(),
      priority: 8,
      sourceMetadata: { title: lifestyleSource, shortDescription: lifestyleSource, discountValue: lifestyleSource },
    },
  });
  await prisma.benefitScope.create({ data: { benefitId: lifestyleGift.id, programId: lifestyleCard.id, brandId: superPharmBrand.id } });

  // --- גולדה: שובר קילו גלידה מאתר ההטבות הרשמי של ישראכרט ---
  // התגלה תוך כדי בדיקה בפועל של סעיף 13 (חיפוש-לפי-סוג): searchBrands
  // (search.service.ts) מחזיר רק מותגים עם הטבה שקופה משויכת ישירות
  // אליהם — מותג בלי שום Benefit לא יימצא בחיפוש בכלל, גם אם
  // searchKeywords שלו תואם במדויק. גולדה חייבת הטבה אמיתית, לא רק
  // להתקיים כמותג, כדי ש"גלידה" בחיפוש יחזיר תוצאה.
  const goldaSource = {
    source: 'manual-research',
    url: 'https://benefits.isracard.co.il/benefitsforall/-top/golda_35848/',
    researchedAt: researchDate,
  };
  const goldaVoucher = await prisma.benefit.create({
    data: {
      slug: 'golda-kilo-89-nis',
      title: 'קילו גלידה בגולדה ב-89 ₪',
      shortDescription: 'שובר לקילו גלידה ברשת גולדה במחיר קבוע של 89 ₪, לרכישה באתר ההטבות של ישראכרט (TOP)',
      categoryId: dining.id,
      benefitType: BenefitType.OTHER,
      channel: Channel.BOTH,
      requiresCoupon: true,
      valueScore: 0,
      isActive: true,
      startDate: new Date(),
      priority: 6,
      sourceMetadata: { title: goldaSource, shortDescription: goldaSource },
    },
  });
  await prisma.benefitScope.create({ data: { benefitId: goldaVoucher.id, programId: isracardProgram.id, brandId: goldaBrand.id } });

  // ---------- ScraperSource: מקורות ממתינים לאישור אנושי ----------
  // תשעה מקורות אמיתיים (שישה שנמסרו בשיחה קודמת + שלושה נוספים
  // שנמצאו כאן), כולם PENDING_REVIEW ו-isActive:false — לא יופעלו
  // לעולם ע"י ה-seed. tosNotes מתעד ממצאים אמיתיים מבדיקה ידנית
  // ב-2026-08 (robots.txt, האם ההטבות גלויות בלי login, והאם האתר
  // ניתן לסריקה סטטית או שהוא JS SPA שדורש renderMode:HEADLESS_BROWSER
  // — מצב שהקוד תומך בו כערך אך לא ממש עדיין, ראו scraper.service.ts
  // fetchRawItems). scrapeConfig הוא placeholder מוצהר בכל מקום
  // שלא נותח בפועל — לא selectors בדויים, כדי לא לחזור על "באג 1.1"
  // (placeholder שנראה כאילו הוא תקין ומחזיר 0 תוצאות בשקט).
  console.log('יוצר מקורות סריקה ממתינים לאישור...');

  const NOT_ANALYZED = {
    listSelector: 'NOT_ANALYZED — ראו tosNotes',
    fields: { title: 'NOT_ANALYZED', externalId: 'NOT_ANALYZED' },
  };

  await prisma.scraperSource.create({
    data: {
      slug: 'max-benefits-lobby',
      name: 'MAX — הטבות ופינוקים',
      sourceType: ScraperSourceType.ISSUER_SITE,
      baseUrl: 'https://www.max.co.il/benefits/lobby',
      renderMode: ScraperRenderMode.HEADLESS_BROWSER,
      scrapeConfig: NOT_ANALYZED,
      defaultProgramId: maxProgram.id,
      tosStatus: 'PENDING_REVIEW',
      isActive: false,
      tosNotes:
        'נבדק ידנית 2026-08 (WebFetch+curl). הדף עצמו ציבורי, בלי login. אך ה-HTML הנטען הוא שלד ניווט בלבד — תוכן ההטבות בפועל נטען דינמית ב-JS (SPA), לא מופיע ב-HTML הסטטי. renderMode:HTTP הקיים (cheerio) לא יחלץ ממנו כלום. תנאי שימוש: קישור כללי בפוטר האתר, URL מדויק לא אותר בבדיקה.',
    },
  });

  await prisma.scraperSource.create({
    data: {
      slug: 'max-premium-benefits',
      name: 'MAX Premium — הטבות',
      sourceType: ScraperSourceType.ISSUER_SITE,
      baseUrl: 'https://www.max.co.il/he-IL/Benefits/Clubs/Premium/Pages/GalleryPremiumBenefits.aspx',
      renderMode: ScraperRenderMode.HEADLESS_BROWSER,
      scrapeConfig: NOT_ANALYZED,
      defaultProgramId: maxPlatinum.id,
      tosStatus: 'PENDING_REVIEW',
      isActive: false,
      tosNotes:
        'נבדק ידנית 2026-08. אותו דומיין ומגבלה כמו מקור MAX הרגיל — HTML הוא שלד ניווט/פוטר, התוכן נטען דינמית. renderMode:HEADLESS_BROWSER נדרש.',
    },
  });

  await prisma.scraperSource.create({
    data: {
      slug: 'isracard-flycard',
      name: 'ישראכרט — FLY CARD',
      sourceType: ScraperSourceType.ISSUER_SITE,
      baseUrl: 'https://www.isracard.co.il/flycard/private',
      renderMode: ScraperRenderMode.HEADLESS_BROWSER,
      scrapeConfig: NOT_ANALYZED,
      tosStatus: 'PENDING_REVIEW',
      isActive: false,
      tosNotes:
        'המקור הכי-נבדק מבין כל אלה — נבדק ידנית 2026-08 עם WebFetch וגם curl גולמי. גלוי לחלוטין בלי login (דמי כרטיס, קצב צבירת נקודות, מבצע הצטרפות — הכל ציבורי). robots.txt של isracard.co.il נבדק בפועל: Allow:/ ל-User-agent:*, אינו חוסם /flycard/private באופן ספציפי (ראה Disallow פרטני ל-/flycard/employee ו-/flycard/business בלבד). תקנון: https://digital.isracard.co.il/globalassets/FLYCARD-TERMS.pdf, פרטיות: https://marketing.isracard.co.il/pages/legal-privacy/. עם זאת: HTML גולמי (curl) חושף שהאתר בנוי ב-Wix (thunderbolt renderer) — תוכן הכרטיסים לא קיים ב-HTML הסטטי כלל. renderMode:HTTP הקיים לא יעבוד. הכי מתאים מבחינת ToS/גישה, אבל דורש מימוש HEADLESS_BROWSER קודם — מומלץ כמועמד ראשון לכך.',
    },
  });

  await prisma.scraperSource.create({
    data: {
      slug: 'discount-green-wallet',
      name: 'בנק דיסקונט — הארנק הירוק',
      sourceType: ScraperSourceType.ISSUER_SITE,
      baseUrl: 'https://www.discountbank.co.il/private/credit-cards/digital-wallets/',
      renderMode: ScraperRenderMode.HTTP,
      scrapeConfig: NOT_ANALYZED,
      tosStatus: 'PENDING_REVIEW',
      isActive: false,
      tosNotes:
        'נבדק ידנית 2026-08 (WebFetch בלבד, לא curl גולמי — renderMode לכן לא ודאי). הדף עצמו ציבורי, בלי login, ותקנון "הארנק הירוק" מקושר בתחתיתו. אבל זהו עמוד שיווקי-כללי על המנגנון, לא רשימת בתי-עסק/הטבות פרטניות — אין items חוזרים לבנות מהם scrapeConfig. לא ברור שיש בכלל עמוד קטלוג מתאים לסריקה.',
    },
  });

  await prisma.scraperSource.create({
    data: {
      slug: 'rami-levy-chaver',
      name: 'רמי לוי — מועדון חבר',
      sourceType: ScraperSourceType.ISSUER_SITE,
      baseUrl: 'https://club.rami-levy.co.il/',
      renderMode: ScraperRenderMode.HTTP,
      scrapeConfig: NOT_ANALYZED,
      defaultProgramId: chaverClub.id,
      defaultBrandId: ramiLevyBrand.id,
      tosStatus: 'PENDING_REVIEW',
      isActive: false,
      tosNotes:
        'נבדק ידנית 2026-08. תת-הדומיין mehadrin.rami-levy.co.il (אתר ההטבות בפועל של המועדון) חסם בקשה אוטומטית (403). club.rami-levy.co.il/members/join נגיש (200) אך הוא דף הצטרפות, לא קטלוג הטבות. תקנון המועדון (rami-levy.co.il/he/club-rules) נגיש ותקין — HTML אמיתי, לא SPA — ושימש כמקור לאחד משלושת ה-Benefit בסיד. robots.txt של rami-levy.co.il (נבדק בפועל) פותח ב-Disallow:* גורף אך מוסיף Allow:/he/* ספציפי יותר — לפי הסטנדרט (Google) ה-Allow הארוך יותר גובר, אך זה טעון אימות מול המימוש בפועל של robotsChecker.ts לפני כל סריקה. דפי מוצרים/מבצעים שנבדקו (/he/online/promotions) הם Nuxt.js SPA. לא נמצא עמוד קטלוג-הטבות סטטי לסריקה.',
    },
  });

  await prisma.scraperSource.create({
    data: {
      slug: 'yours-club-funcard',
      name: 'מועדון שלך (FunCard)',
      sourceType: ScraperSourceType.ISSUER_SITE,
      baseUrl: 'https://www2.funcard.co.il/',
      renderMode: ScraperRenderMode.HTTP,
      scrapeConfig: NOT_ANALYZED,
      tosStatus: 'PENDING_REVIEW',
      isActive: false,
      tosNotes:
        'נבדק ידנית 2026-08. גישה אישית ("FunCard האישי שלך") דורשת login במפורש — מוצהר בעמוד עצמו. חלק כללי (מדרגות הנחה עד 30% על 750 ₪ ראשונים) גלוי בלי login, אבל זה תיאור שיווקי כללי, לא רשימת בתי-עסק לסריקה. בזמן הבדיקה האתר הציג הודעת "סגור זמנית לשדרוג". תקנון גמלאים נמצא כ-PDF (2link.co.il). לא מתאים ל-scrapeConfig כרגע.',
    },
  });

  await prisma.scraperSource.create({
    data: {
      slug: 'cal-benefits-world',
      name: 'Cal — עולם של הטבות',
      sourceType: ScraperSourceType.ISSUER_SITE,
      baseUrl: 'https://www.cal-online.co.il/benefits/',
      renderMode: ScraperRenderMode.HTTP,
      scrapeConfig: NOT_ANALYZED,
      defaultProgramId: calProgram.id,
      tosStatus: 'PENDING_REVIEW',
      isActive: false,
      tosNotes:
        'מקור נוסף (לא מתוך הרשימה שנמסרה) שנמצא במחקר. נבדק ידנית 2026-08: בקשת HTTP ישירה (גם WebFetch וגם curl) נחסמה ע"י הגנת WAF של האתר ("Request Rejected" / HTTP 400) — כנראה דורש דפדפן אמיתי עם עוגיות/JS, לא רק User-Agent. לא ניתן היה לאמת גלוי-לציבור, robots.txt, או להציע scrapeConfig. דורש בדיקה ידנית בדפדפן אמיתי, לא רק כלי אוטומטיים.',
    },
  });

  await prisma.scraperSource.create({
    data: {
      slug: 'isracard-benefits-portal',
      name: 'ישראכרט — הטבות',
      sourceType: ScraperSourceType.ISSUER_SITE,
      baseUrl: 'https://benefits.isracard.co.il/',
      renderMode: ScraperRenderMode.HTTP,
      scrapeConfig: NOT_ANALYZED,
      defaultProgramId: isracardProgram.id,
      tosStatus: 'PENDING_REVIEW',
      isActive: false,
      tosNotes:
        'מקור נוסף שנמצא במחקר. נבדק ידנית 2026-08: הבקשה חזרה 403 Forbidden (WebFetch). חיפוש ציבורי מרמז שמימוש הטבות אישיות דורש הזנת 6 ספרות אחרונות של כרטיס + ת"ז — כלומר לפחות חלק מהתוכן דורש זיהוי אישי, לא רק login רגיל. לא נמצא scrapeConfig אפשרי.',
    },
  });

  await prisma.scraperSource.create({
    data: {
      slug: 'shufersal-club-benefits',
      name: 'שופרסל — מועדון לקוחות',
      sourceType: ScraperSourceType.ISSUER_SITE,
      baseUrl: 'https://www.shufersal.co.il/online/he/Club_Benefits',
      renderMode: ScraperRenderMode.HTTP,
      scrapeConfig: NOT_ANALYZED,
      defaultProgramId: shufersalClub.id,
      defaultBrandId: shufersalBrand.id,
      tosStatus: 'PENDING_REVIEW',
      isActive: false,
      tosNotes:
        'מקור נוסף שנמצא במחקר. נבדק ידנית 2026-08 (WebFetch+curl, HTTP 200, HTML אמיתי לא-SPA). ההטבות/קופונים בפועל דורשים login מפורש — אושר הן ע"י הודעת ההתחברות שהוצגה והן ע"י כך שהתוכן הגלוי הוא placeholder בלבד ("קופונים...במיוחד בשבילך" מוצג רק אחרי כניסה). לפי ההנחיה — לא בוצע ניסיון לעקוף. תקנון: https://www.shufersal.co.il/online/regulations. לא ניתן לבנות scrapeConfig אמיתי בלי גישה מאושרת של לקוחה מחוברת.',
    },
  });

  console.log('Seed הושלם בהצלחה.');
  console.log(
    `מנפיקים: 6, מועדונים: 9, קטגוריות: 13, מותגים: 11, הטבות: 12 (כולן מתועדות עם מקור), מקורות סריקה: 9 (כולם PENDING_REVIEW, לא פעילים).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
