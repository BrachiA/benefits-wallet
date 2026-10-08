# PROJECT MAP — ארנק חכם (Benefits Wallet)

> **⚠️ הערת עדכניות (אוקטובר 2026):** מסמך זה הוא תמונת מצב מ-9.8.2026 ולא עודכן מאז. כמה מהטענות בו כבר אינן נכונות:
> אין כבר "אין בדיקות" (יש 136 בדיקות Vitest), יש git, ויש הגנת סיסמה בדשבורד. נוספו מאז: תוסף Chrome, אינטגרציית Gemini (ניקוי כפילויות, אימות תמונה, קטגוריזציה), אחסון תמונות ב-Cloudflare R2, חיפוש מטושטש (pg_trgm) והגדרות התראות.
> לתמונה עדכנית ראו את [README הראשי](../README.md) ואת ה-README של כל אפליקציה.

> מסמך העברה מלא. נכתב מתוך קריאה בפועל של הקוד (לא מהזיכרון ולא מהתכנון).
> כל טענה כאן ניתנת לאימות בקובץ+שורה המצוינים. מקומות שלא היו חד-משמעיים מהקוד מסומנים ב-❓.
> תאריך הסקירה: 2026-08-09. אין git בריפו — אין היסטוריה להסתמך עליה, המסמך הזה הוא התיעוד היחיד.

---

## חלק 1: תמונת מצב כללית

### מה המוצר עושה

המשתמשת מחזיקה כמה כרטיסי אשראי ומועדוני לקוחות, ולא זוכרת אילו הטבות מגיעות לה מכל אחד מהם. האפליקציה נותנת לה לבחור פעם אחת אילו מועדונים/כרטיסים יש לה, ומכאן מציגה רק את ההטבות שרלוונטיות לה בפועל — לפי מותג, קטגוריה, או חיפוש חופשי.

בצד השני יש דשבורד ניהול שבו מנהלת התוכן מזינה ומעדכנת את הקטלוג (מנפיקים, מועדונים, מותגים, סניפים, הטבות, קופונים, קמפיינים). כדי שהקטלוג לא יתוחזק רק ידנית, יש מודול סורק (scraper) שמושך הטבות מאתרי מנפיקים/מותגים, מנסה להתאים אותן להטבות קיימות, ומעביר כל דבר שהוא לא בטוח בו לתור בדיקה אנושי.

נכון להיום **אין Authentication בכלל** — לא באפליקציה ולא בדשבורד. בחירת המועדונים של המשתמשת נשמרת מקומית במכשיר (AsyncStorage) ולא בשרת.

### הישויות העסקיות המרכזיות

| ישות | מודל | ההגדרה המדויקת |
|---|---|---|
| **מנפיק** | `Issuer` | הגוף שמנפיק את הכרטיס/המועדון: MAX, Cal, ישראכרט, שופרסל. שכבה מעל המועדון. |
| **מועדון / כרטיס** | `Program` | הישות המאוחדת שהמשתמשת "מחזיקה": כרטיס אשראי, מועדון לקוחות, מועדון עובדים, מועדון רשת. יש היררכיה — "MAX Platinum" הוא ילד של "MAX". **זה מה שנבחר ב-Onboarding.** |
| **מותג** | `Brand` | המותג שהמשתמשת מזהה בשם: זארה, פוקס, איקאה. שייך לקטגוריה אחת. יכול להיות ילד של מותג-אב (קבוצת מותגים). |
| **סניף** | `Store` | סניף פיזי של מותג, עם עיר וקואורדינטות. |
| **הטבה** | `Benefit` | הישות המרכזית. **"נקייה" בכוונה** — אין בה FK למועדון או למותג. הקישור נעשה דרך `BenefitScope`. |
| **כלל תחולה** | `BenefitScope` | טבלת הכללים שקובעת למי ההטבה תקפה. **שורה בודדת = AND בין השדות שאינם null. כמה שורות לאותה הטבה = OR ביניהן.** `null` בשדה = "כל הערכים". זה הלב של המערכת. |
| **משתמש** | ❌ **אין מודל משתמש ב-DB.** | המשתמשת קיימת רק כ-`UserSelection` ב-AsyncStorage במכשיר: `programIds`, `favoriteBenefitIds`, `dismissedBenefitIds`. השרת לא יודע על אף משתמש. |

### Stack טכנולוגי בפועל

נקרא מ-`package.json` בכל app.

**`apps/backend`** — Node + Express 4.21, TypeScript 5.7 (CommonJS)
- Prisma 6.1 + `@prisma/client` מול PostgreSQL
- Zod 3.24 — ולידציה
- pino 9.5 + pino-pretty — לוגים
- helmet 8, cors 2.8, dotenv 17
- **axios 1.19 + cheerio 1.2** — מנוע הסריקה בפועל
- dev: `ts-node-dev --respawn --transpile-only src/server.ts`
- ❗ **אין שום ספריית בדיקות** (אין jest/vitest/supertest) — אין ולו טסט אחד בפרויקט.

**`apps/dashboard`** — React 18.3 + Vite 6, TypeScript 5.7 (ESM)
- react-router-dom 6.28
- ❗ אין ספריית UI, אין CSS framework, אין state manager, אין ספריית טפסים, **אין ספריית toast**. הכל inline styles + CSS variables ב-`src/theme/tokens.css`.

**`apps/mobile`** — Expo 54 + React Native 0.81.5 + React 19.1
- `@tanstack/react-query` 5.62 — כל קריאות הרשת
- `@react-navigation/*` 7 — native-stack + bottom-tabs
- `@react-native-async-storage/async-storage` 2.2 — האחסון המקומי
- ❗ אין ספריית UI — `StyleSheet` ידני מול `src/theme/theme.ts`.

**אין monorepo tooling.** אין workspaces, אין turbo/nx, אין `package.json` בשורש. שלוש אפליקציות עצמאיות לגמרי, כל אחת עם `node_modules` ו-`package-lock.json` משלה. **אין `packages/shared`** — למרות שהערות רבות בקוד מפנות אליו כאילו קיים (ראו חלק 5, פער #7).

---

## חלק 2: מפת המודולים

### `apps/backend`

**תפקיד:** מקור האמת היחיד. כל הנתונים והלוגיקה. גם הדשבורד וגם המובייל מדברים רק איתו.

**נקודת כניסה:** `src/server.ts` → קורא `listen()` בלבד. `src/app.ts` מרכיב את Express ומייצא `app` בלי `listen` — ההפרדה מכוונת כדי לאפשר טסטים ב-supertest בלי פורט TCP (למרות שכאמור אין טסטים בפועל).

**Base path של ה-API: `/api/v1`** (`app.ts:56`). בנוסף `GET /health` מחוץ ל-versioning (`app.ts:36`).

| תיקייה/קובץ | תפקיד |
|---|---|
| `src/config/env.ts` | ולידציית env ב-Zod עם `.parse()` (לא safeParse) — קריסה מיידית בהפעלה אם חסר `DATABASE_URL`. |
| `src/lib/prisma.ts` | Prisma singleton מוצמד ל-`globalThis`, למניעת דליפת connection pools ב-hot reload. |
| `src/lib/AppError.ts` | מחלקת השגיאה האחידה. `notFound()` → 404, `validation()` → 422. |
| `src/lib/apiResponse.ts` | `sendSuccess` / `sendPaginated` / `parsePagination` (תקרה 100 פריטים לעמוד). |
| `src/lib/logger.ts` | pino + `createRequestLogger(requestId)`. |
| `src/lib/cache.ts` | `CacheProvider` interface + מימוש in-memory. **בשימוש רק ל-invalidation** (`cache.del`) ב-issuer/program/category — אף אחד לא קורא `cache.get`, כלומר שום דבר לא נקרא מהמטמון בפועל. |
| `src/middleware/` | `requestLogger` (מזריק requestId), `validateRequest` (Zod, body או query), `notFound`, `errorHandler`. |
| `src/modules/issuer\|program\|category\|brand\|store\|benefit\|coupon\|campaign\|tag` | CRUD בדפוס אחיד ומחזורי: `routes → controller → service → repository → dto`. |
| `src/modules/scraper` | המודול המורכב ביותר. 7 קבצים: `routes/controller/service/repository/dto` + `robotsChecker` + `matching.service` + `confidence.service`. |
| `src/modules/search` | קריאה-בלבד, ללא repository משלו (מוצהר בהערה). מחפש ב-5 סוגי ישות במקביל. |
| `src/modules/recommendation` | `valueScore.ts` (ניקוד כספי) + `benefitGroup.ts` (קיבוץ ומיון) + service. |
| `prisma/schema.prisma` | 20 מודלים + 12 enums. |
| `prisma/seed.ts` | 372 שורות. מוחק הכל ויוצר דאטה לדוגמה. **לא יוצר אף `ScraperSource`.** |

**רשימת ה-routers המורכבים** (`app.ts:43-54`): `/issuers`, `/programs`, `/categories`, `/brands`, `/stores`, `/benefits`, `/coupons`, `/campaigns`, `/tags`, `/scraper`, `/search`, `/recommendations`.

### `apps/dashboard`

**תפקיד:** ממשק הניהול הפנימי. RTL עברית מלאה (`index.html`: `<html lang="he" dir="rtl">`).

**נקודת כניסה:** `src/main.tsx` → `src/App.tsx` (כל ה-routing) → עטוף ב-`Layout`.

| תיקייה | תפקיד |
|---|---|
| `src/api/client.ts` | fetch wrapper. `get/getPaginated/post/patch/delete`. כאן חי גם `formatSaveError` — ממיר שגיאות Zod/עסקיות לעברית קריאה. |
| `src/components/forms/FormPrimitives.tsx` | `Field`, `Input`, `Select`, `Button`, `PageHeader` + `optionalUrl`, `toOptionalNumber`. |
| `src/components/forms/ScopeEditor.tsx` | עורך ה-`BenefitScope` — הרכיב הייחודי של המערכת (בונה את שורות ה-OR). |
| `src/components/tables/DataTable.tsx` | טבלה גנרית `Column<T>[]` עם loading skeleton ו-empty state. |
| `src/components/Badge.tsx` | `Badge` + `statusBadge(kind, value)` — מיפוי מרוכז של enums לצבע+תווית עברית. |
| `src/components/layout/Layout.tsx` | Sidebar מקובץ ל-3 קבוצות: "ספקי הטבה", "קטלוג", "סורק אתרים". |
| `src/pages/<Entity>/` | 11 זוגות של `<Entity>ListPage` + `<Entity>FormPage`. |
| `src/types/` | טיפוסים ידניים לכל ישות (כפילות מול ה-backend, מתועדת). |

**דפוס ה-routing:** `/entity` (רשימה) + `/entity/:id` (טופס; `id === 'new'` = יצירה). היוצא מן הכלל: `/scraped-items/:id` הוא מסך בדיקה בלבד — אין יצירה ידנית של פריט סרוק.

### `apps/mobile`

**תפקיד:** אפליקציית המשתמשת הסופית.

**נקודת כניסה:** `App.tsx` → `QueryClientProvider` + `SafeAreaProvider` → `src/navigation/RootNavigator.tsx`.

| תיקייה | תפקיד |
|---|---|
| `src/navigation/RootNavigator.tsx` | מנהל `splash → onboarding → main` כ-**state מקומי מחוץ ל-NavigationContainer** (מוסבר בהערה: זו הדרך היחידה לאפשר ל-Settings "לקפוץ" בחזרה ל-Onboarding בלי תלות מעגלית). ב-main: 5 טאבים, כל אחד עם Stack משלו. |
| `src/api/client.ts` | fetch wrapper מינימלי — **`get` בלבד**. האפליקציה קוראת בלבד, לא כותבת לשרת. |
| `src/api/hooks/` | 6 hooks של react-query: `useBenefits`, `useCategories`, `useFavoriteBenefits`, `useGroupedRecommendations`, `usePrograms`, `useSearch`. |
| `src/storage/userSelection.ts` | ה-AsyncStorage wrapper + נקודת המיגרציה היחידה (`schemaVersion`). |
| `src/storage/useUserSelection.ts` | עטיפה ריאקטיבית מעל האחסון. |
| `src/components/domain/BenefitCard.tsx` | ה-signature element — כרטיס ההטבה שחוזר בכל מסך. |
| `src/components/domain/GroupedBenefitsView.tsx` | תצוגת הקבוצות (תרחיש "פוקס"). |
| `src/screens/` | 12 מסכים: Splash, Onboarding, Home, Wallet, Benefits, BenefitDetails, Categories, Favorites, Search, Profile, Settings, About. |
| `src/theme/theme.ts` | טוקנים: צבעים, מרווחים, רדיוסים, `minTouchTarget`. |

❗ `CategoriesScreen` קיים אך **אין לו טאב** — מוסבר כהחלטת UX מודעת (`RootNavigator.tsx:179-182`), הכניסה לקטגוריות היא דרך Home ו-Search.

---

## חלק 3: מודל הנתונים המלא

20 מודלים. `@@map` ממפה כל אחד ל-snake_case בטבלה.

### דפוסים חוצי-מודלים

- **Soft delete:** לרוב המודלים העסקיים יש `deletedAt DateTime?`. כל ה-repositories מסננים `deletedAt: null`. **החריגים שאין להם `deletedAt` בכלל:** `BenefitScope`, `City`, `Region`, `CampaignBenefit`, `BenefitTag`, `MediaAsset`, `AuditLog`, `Notification`, `ScraperRun`, `ScrapedItem`.
- **`isActive`** — kill-switch ידני, נפרד לגמרי מ-`deletedAt` ומתאריכי תוקף.
- **`sortOrder`** — סדר תצוגה ידני, כמעט בכל מודל קטלוגי.

### הישויות

#### `Issuer` (`issuers`)
`id, slug @unique, name, nameEn?, logoUrl?, brandColor?` (HEX לצביעת כרטיסים ב-UI), `websiteUrl?, supportPhone?, isActive, sortOrder`, `deletedAt?`
- קשר: `programs Program[]`
- אינדקס: `[isActive, sortOrder]` — השאילתה היחידה שנעשית עליו בפועל.

#### `Program` (`programs`) — המועדון/כרטיס
`id, issuerId → Issuer, parentProgramId? → Program (self, "ProgramHierarchy"), path, slug @unique, name, shortName?, type ProgramType, logoUrl?, cardImageUrl?, color?, description?, joinUrl?, termsUrl?, annualFee Decimal(10,2)?, metadata Json?, isActive, isPopular, sortOrder`
- **`path`** = materialized path, למשל `"max/max-platinum"`. **מתוחזק ידנית בשכבת ה-Service** (`program.service.ts:69-74`), לא ב-DB. הכוונה: לשאול "כל הצאצאים" עם `LIKE path%` בלי recursive CTE.
- **`metadata Json?`** — שדות ספציפיים-לסוג שלא הצדיקו עמודה. ❓ **לא נמצאה שום ולידציה שלו בקוד** למרות שההערה בסכמה אומרת "ולידציה בשכבת ה-Service".
- אינדקסים: `[issuerId]`, `[type, isActive]`, `[path]`

#### `Category` (`categories`)
`id, slug @unique, name, nameEn?, parentId? → Category (self), path, iconName?` (שם אייקון מספרייה פנימית, **לא URL**), `color?, sortOrder, isActive`
- משמש **גם** להטבות **וגם** למותגים.

#### `Brand` (`brands`)
`id, slug @unique, name, nameEn?, parentBrandId? → Brand (self, "BrandGroup"), categoryId → Category, logoUrl?, coverImageUrl?, websiteUrl?, onlineShopUrl?, description?, hasOnlineStore, hasPhysicalStores, searchKeywords String[], isActive, sortOrder`
- `searchKeywords` — לחיפוש דו-לשוני ("זארה"/"zara").
- `categoryId` הוא **חובה** (לא nullable) — למותג חייבת להיות קטגוריה.

#### `Store` (`stores`)
`id, brandId → Brand, name, address?, cityId? → City, lat/lng Decimal(9,6)?, phone?, openingHours Json?, isActive`
- אינדקס `[lat, lng]` — בסיס ל"קרוב אליי" עם bounding box. PostGIS לא בשימוש.

#### `City` (`cities`) / `Region` (`regions`)
מינימליים. `City.name @unique`, `Region.name @unique`. ל-City יש `stores` ו-`benefitScopes`.

#### `Benefit` (`benefits`) — הישות המרכזית
```
id, slug @unique, title, shortDescription, fullDescription?
categoryId → Category
benefitType BenefitType, discountValue Decimal(10,2)?, discountUnit DiscountUnit?
minPurchaseAmount?, maxDiscountAmount? Decimal(10,2)
valueScore Int @default(0)      ← מחושב ב-Service, לא מוזן ידנית
requiresCoupon, channel Channel @default(BOTH)
termsAndConditions?, externalUrl?, imageUrl?
startDate?, endDate?
isPopular, isFeatured, isActive @default(true), priority Int
viewCount Int, favoriteCount Int
sourceMetadata Json?
lastScrapedItemId? @unique → ScrapedItem
deletedAt?
```
- **`sourceMetadata`** — מפה של שדה→מקור העדכון האחרון. נבחר כ-JSON ולא כטבלת `FieldProvenance` נפרדת (מוסבר בסכמה, שורות 376-380).
- **`lastScrapedItemId` הוא `@unique`** — ראו חלק 6, סיכון #4. זה יחס 1:1, כלומר **אותו פריט סרוק לא יכול להיות "העדכון האחרון" של שתי הטבות**.
- ❗ `viewCount` ו-`favoriteCount` **לא מוגדלים בשום מקום בקוד**. תמיד 0.
- אינדקסים: `[categoryId]`, `[isActive, startDate, endDate]` (מוצהר: "הבקשה הכי נפוצה — Home Screen"), `[isPopular, priority]`

#### `BenefitScope` (`benefit_scopes`) — טבלת הכללים
```
id, benefitId → Benefit (onDelete: Cascade)
programId? → Program   ← null = כל המועדונים
brandId?   → Brand     ← null = כל המותגים
storeId?   → Store     ← null = כל סניפי המותג
cityId?    → City      ← הגבלה גיאוגרפית בלי סניף ספציפי
createdAt
```
- **הסמנטיקה:** שורה = AND בין השדות שאינם null. כמה שורות = OR.
- **אין soft delete** — מוצהר בסכמה: "טבלת קישור טהורה".
- **`onDelete: Cascade` על `benefitId` בלבד.** על `programId`/`brandId`/`storeId`/`cityId` **אין `onDelete`** → ברירת המחדל של Prisma היא `Restrict`. ראו ניתוח מחיקות בהמשך.
- אינדקסים: `[programId, brandId]`, `[programId, storeId]`, `[brandId]`, `[benefitId]`

#### `Coupon` (`coupons`)
`id, benefitId → Benefit (Cascade), code, type CouponType, maxUses?, currentUses, expiresAt?, isActive, deletedAt?`
- ❗ **`code` אינו `@unique` ב-DB.** הייחודיות נאכפת רק בקוד (`coupon.service.ts:20-21, 30-31`) — ההערה שם אומרת "נאכפת גם ב-DB (constraint לוגי עתידי)", אבל ה-constraint הזה **לא קיים**. ראו חלק 5, סתירה #2.

#### `Campaign` (`campaigns`) + `CampaignBenefit` (`campaign_benefits`)
`Campaign`: `id, slug @unique, title, description?, bannerImageUrl?, startDate, endDate` (שניהם **חובה**), `isActive, sortOrder, deletedAt?`
`CampaignBenefit`: `@@id([campaignId, benefitId])`, `sortOrder`, שני הצדדים `onDelete: Cascade`.

#### `Tag` (`tags`) + `BenefitTag` (`benefit_tags`)
`Tag`: `id, slug @unique, name, color?, sortOrder, isActive, deletedAt?`
`BenefitTag`: `@@id([benefitId, tagId])`, שני הצדדים Cascade, `@@index([tagId, benefitId])`.

#### `MediaAsset` (`media_assets`)
`id, entityType MediaEntityType, entityId, assetType MediaAssetType, originalUrl, cdnUrl?, width?, height?, sizeBytes?, uploadedAt`
- **polymorphic — אין FK אמיתי על `entityId`.** מוצהר בסכמה: "נאכף בשכבת ה-Service".
- ❗ **אין שום קוד שכותב או קורא ממנו.** מופיע רק ב-`seed.ts:23` (deleteMany). העלאת מדיה לא ממומשת.

#### `AuditLog` (`audit_logs`)
`id, entityType, entityId, action AuditAction, changedFields Json?, performedBy?, createdAt`
- הסכמה מצהירה במפורש (שורה 558): **"append-only, נדרש כי לדשבורד אין Authentication בשלב 1"**.
- ❗ **אין שום קוד שכותב אליו.** מופיע רק ב-`seed.ts:31`. ראו חלק 5, סתירה #1 — זה הפער החמור ביותר בין כוונה מתועדת לקוד.

#### `Notification` (`notifications`)
`id, title, body, relatedBenefitId? → Benefit, triggerType NotificationTrigger, scheduledFor, createdAt`
- מוצהר בסכמה כ"מתוכננת, לא ממומשת (שלב 10)". אכן לא ממומשת. הוגדרה מראש כדי ש-`Benefit` לא יצטרך שינוי מבני בעתיד.

#### `ScraperSource` (`scraper_sources`)
```
id, slug @unique, name, sourceType ScraperSourceType
baseUrl, renderMode ScraperRenderMode @default(HTTP)
scrapeConfig Json                    ← selectors + מיפוי שדות, data-driven
defaultProgramId? → Program          ← עוגן שיוך
defaultBrandId?   → Brand
requestDelayMs Int @default(1000)
scheduleCron String @default("0 3 * * *")
tosStatus TosReviewStatus @default(PENDING_REVIEW)
tosReviewedBy?, tosReviewedAt?, tosNotes?
isActive Boolean @default(false)     ← false בכוונה
lastRunAt?, lastRunStatus?
deletedAt?
```
- **`@@index([isActive, tosStatus])`** — האינדקס בנוי בדיוק לשאילתת השער `findRunnableSources`.
- ❗ `defaultProgramId`/`defaultBrandId` מוגדרים כ"עוגן שיוך" בסכמה (שורות 616-617) אבל **הקוד לא משתמש בהם בשום מקום** בזמן יצירת הטבה. ראו חלק 5, סתירה #3.
- ❗ `scheduleCron` נשמר אבל **אין scheduler בפרויקט**. ראו חלק 6, פער #2.

#### `ScraperRun` (`scraper_runs`)
`id, sourceId → ScraperSource, startedAt, finishedAt?, status ScraperRunStatus @default(PARTIAL), itemsFound, itemsCreated, itemsUpdated, itemsFlagged, errorMessage?`
- `@@index([sourceId, startedAt])`
- `PARTIAL` כברירת מחדל = "רצה ולא סיימה" — אם השרת קרס באמצע, הרשומה נשארת PARTIAL לנצח (אין ניקוי ריצות תקועות).

#### `ScrapedItem` (`scraped_items`)
```
id, sourceId → ScraperSource, runId → ScraperRun
externalId                        ← מזהה יציב מהמקור עצמו
rawData Json                      ← מה שנשלף גולמית, לפני מיפוי
matchedBenefitId? → Benefit ("ScrapedItemMatchedBenefit")
confidenceScore Int, confidenceReasons String[]
status ScrapedItemStatus @default(PENDING_REVIEW), reviewedBy?, reviewedAt?
benefitLastUpdatedFrom Benefit?   ← back-relation של lastScrapedItemId
scrapedAt
```
- **`@@unique([sourceId, externalId])`** — המפתח לזיהוי "ראינו את זה כבר". **זהו גם מקור הבאג החמור ביותר במערכת** — ראו חלק 4, זרימה 2.
- אינדקסים: `[status]`, `[matchedBenefitId]`

### Enums

| Enum | ערכים |
|---|---|
| `ProgramType` | CREDIT_CARD, CUSTOMER_CLUB, EMPLOYEE_CLUB, RETAILER_CLUB, OTHER |
| `BenefitType` | DISCOUNT_PERCENT, DISCOUNT_FIXED, CASHBACK, POINTS, GIFT, TWO_FOR_ONE, FREE_SHIPPING, OTHER |
| `DiscountUnit` | PERCENT, ILS, POINTS |
| `Channel` | ONLINE, IN_STORE, BOTH |
| `CouponType` | SINGLE_USE_SHARED, UNIQUE_PER_USER |
| `MediaEntityType` | BRAND, PROGRAM, BENEFIT, CAMPAIGN, STORE |
| `MediaAssetType` | LOGO, COVER, GALLERY, ICON |
| `AuditAction` | CREATE, UPDATE, DELETE, ACTIVATE, DEACTIVATE |
| `NotificationTrigger` | ENDING_SOON, NEW_BENEFIT, PRICE_DROP |
| `ScraperSourceType` | ISSUER_SITE, BRAND_SITE, AGGREGATOR_SITE |
| `ScraperRenderMode` | HTTP, HEADLESS_BROWSER |
| `TosReviewStatus` | PENDING_REVIEW, APPROVED, REJECTED |
| `ScraperRunStatus` | SUCCESS, PARTIAL, FAILED |
| `ScrapedItemStatus` | AUTO_PUBLISHED, PENDING_REVIEW, APPROVED, REJECTED |

### ניתוח מחיקות — מה קורה כשמוחקים ישות שיש לה תלויות

זו הנקודה שהמשימה ביקשה להדגיש. הניתוח מבוסס על מה שכתוב ב-schema ובקוד, לא על הרצה.

**התשובה הקצרה: הבעיה לא מתממשת בפועל, כי אף ישות עסקית לא נמחקת באמת — הכל soft delete.** כל ה-`remove()` בכל ה-services קוראים ל-`softDelete` שמעדכן `deletedAt` + `isActive: false`. **אף פעם לא `prisma.X.delete()`.**

אבל זה יוצר בעיה אחרת, שקטה יותר:

| תרחיש | מה קורה בפועל | הערכת סיכון |
|---|---|---|
| מוחקים `Program` שיש לו `BenefitScope` פעילים | ה-Program מקבל `deletedAt` ו-`isActive:false`. **שורות ה-`BenefitScope` נשארות שלמות ומצביעות עליו.** | ⚠️ **ההטבה תמשיך להופיע למשתמשת.** `findMatchingBenefits` מסנן `deletedAt` על ה-`Benefit` בלבד — **לא על ה-`Program` שב-scope**. משתמשת שבחרה את המועדון הזה תמשיך לראות את ההטבות שלו לנצח. |
| מוחקים `Program` שיש לו `childPrograms` | הילדים נשארים פעילים, עם `parentProgramId` שמצביע לאב מחוק. `path` שלהם לא משתנה. | ⚠️ עץ יתום שקט. |
| מוחקים `Brand` שיש לו `Store`/`BenefitScope` | אותו דבר בדיוק — הסניפים וה-scopes נשארים. | ⚠️ זהה. |
| מוחקים `Benefit` | soft delete. `BenefitScope` נשארים (למרות ה-Cascade — הוא לא מופעל כי אין מחיקה אמיתית). `findMatchingBenefits` **כן** מסנן `deletedAt` על Benefit → נעלמת מהמשתמשת כמצופה. | ✅ תקין |
| מוחקים `Category` שיש לה `Brand`/`Benefit` | soft delete. `categoryId` הוא **חובה** ב-שניהם, אז הם נשארים מקושרים לקטגוריה מחוקה. | ⚠️ ההטבה תמשיך להופיע; שם קטגוריה מחוקה יוצג ב-`BenefitCard`. |
| מוחקים `ScraperSource` | `softDeleteSource` (`scraper.repository.ts:42-44`) — `deletedAt` + `isActive:false`. ה-`ScraperRun` וה-`ScrapedItem` נשארים. | ✅ סביר — היסטוריית סריקה צריכה לשרוד. |
| **אם מישהו יריץ `delete` אמיתי ב-`prisma studio`/SQL** | `Program`/`Brand`/`Store`/`City` → **`Restrict` יחסום** את המחיקה (FK constraint) כל עוד יש `BenefitScope` מקושר. `Benefit` → Cascade ימחק scopes+coupons+tags+campaign links. | ℹ️ ה-DB מגן, אבל ההודעה תהיה FK error גולמי. |

**המסקנה המעשית:** החוסר האמיתי הוא ש-**`findMatchingBenefits` לא מצטרף (join) ל-Program/Brand כדי לוודא שהם עצמם לא מחוקים/לא פעילים**. ראו חלק 4, זרימה 4, נקודת שבירה 4.2.

---

## חלק 4: זרימות מרכזיות

### זרימה 1: הוספת מקור סריקה חדש והפעלתו

```
דשבורד: /scraper-sources → "הוסף מקור"
  → ScraperSourceFormPage (מצב יצירה, id === 'new')
  → POST /api/v1/scraper/sources
     ├─ validateRequest(createScraperSourceSchema)         [scraper.routes.ts:18]
     ├─ scraperService.createSource                        [scraper.service.ts:89]
     │   └─ כופה isActive:false + tosStatus:PENDING_REVIEW [scraper.service.ts:95-96]
     └─ 201 → navigate('/scraper-sources')
  → פתיחה מחדש לעריכה (id אמיתי) — עכשיו מופיעים 2 אזורים נוספים:
     ├─ אזור "אישור תנאי שימוש"
     │   → POST /sources/:id/review-tos {status, reviewedBy, notes}
     │     └─ אם REJECTED → כופה isActive:false      [scraper.service.ts:134]
     └─ אזור "הרצה"
         ├─ "הפעל מקור" → POST /sources/:id/activate
         │     └─ if tosStatus !== 'APPROVED' → 422    [scraper.service.ts:142-144]
         └─ "הרץ עכשיו" → POST /sources/:id/run
```

**נקודות החלטה:**
| תנאי | תוצאה |
|---|---|
| `tosStatus !== 'APPROVED'` בעת activate | 422 `"Cannot activate a source whose ToS has not been approved"`. ב-UI הכפתור גם מנוטרל מראש (`ScraperSourceFormPage.tsx:215`) + הודעה מוסברת. |
| `reviewTos` עם `status: REJECTED` | `isActive` מאופס אוטומטית — אי אפשר להישאר "פעיל ודחוי". |
| `reviewerName` ריק ב-UI | נחסם בצד לקוח לפני שליחה (`ScraperSourceFormPage.tsx:81-84`), עם הסבר שזה נדרש כתיעוד. |

**🔴 נקודות שבירה שקטה:**

**1.1 — `scrapeConfig` נשמר כ-placeholder עם המילה "TODO" בתוכו.**
`ScraperSourceFormPage.tsx:66-69` — הטופס **לא חושף את `scrapeConfig` בכלל**. ביצירה הוא שולח:
```js
scrapeConfig: {
  listSelector: 'TODO: CSS selector לכרטיס הטבה בדף',
  fields: { title: 'TODO: selector לכותרת', externalId: 'TODO: selector/attribute למזהה ייחודי' },
}
```
זה עובר ולידציית Zod (המחרוזות אינן ריקות!) ונשמר ב-DB. **מקור שנוצר דרך הדשבורד לעולם לא יסרוק שום דבר** — ה-selectors לא תקפים. ההערה בקוד מודה בזה, אבל התוצאה בפועל: הריצה תסתיים ב-`SUCCESS` עם 0 פריטים ובלי שום אינדיקציה שהקונפיג פגום. **אין דרך בשום מסך בדשבורד לתקן את `scrapeConfig`** — חייבים SQL/Prisma Studio.

**1.2 — עריכה (PATCH) לא שולחת `scrapeConfig` בכלל.**
`ScraperSourceFormPage.tsx:62` — במצב עריכה נשלח רק `form` (5 שדות: slug/name/sourceType/baseUrl/renderMode). זה בסדר (`updateScraperSourceSchema` הוא `.partial()`), אבל אומר שגם עריכה לא מתקנת את ה-TODO.

**1.3 — `slug` מנוטרל בעריכה** (`ScraperSourceFormPage.tsx:132`) אבל **עדיין נשלח בגוף ה-PATCH**. אם ה-slug לא השתנה זה no-op; אין באג בפועל, אבל זה שולח שדה מיותר.

---

### זרימה 2: הרצת סריקה (הזרימה המורכבת והשברירית ביותר)

```
POST /api/v1/scraper/sources/:id/run
  → scraperController.runSource → scraperService.runSource(id)     [scraper.service.ts:166]
     │
     ├─ 1. getSourceById → 404 אם לא קיים/מחוק
     ├─ 2. שער: if (!isActive || tosStatus !== 'APPROVED') → 422   [:169-171]
     ├─ 3. robotsChecker.isAllowed(baseUrl, '/') → אם חסום → 422   [:175-179]
     ├─ 4. createRun() → רשומת ScraperRun בסטטוס PARTIAL
     │
     ├─ 5. try {
     │      fetchRawItems(source)                                   [:299]
     │        ├─ if renderMode !== 'HTTP' → logger.warn + return [] ⚠️
     │        └─ לולאה page = 1..maxPages:
     │             ├─ בונה pageUrl (+paginationParam אם page>1)
     │             ├─ robots check פר-דף → אם חסום: break
     │             ├─ axios.get (timeout 10s, UA=BenefitsWalletBot/1.0)
     │             │    └─ על שגיאה: logger.warn + break ⚠️
     │             ├─ cheerio.load → $(listSelector)
     │             ├─ if (items.length === 0) break
     │             ├─ לכל item: extractField() לפי המיני-DSL
     │             │    └─ if (!title || !externalId) → skip שקט ⚠️
     │             └─ if (page < maxPages) sleep(requestDelayMs)
     │
     │      לכל fields → processScrapedItem()                       [:229]
     │        ├─ matchingService.match(sourceId, fields)             [matching.service.ts:29]
     │        │    ├─ findByExternalId(sourceId, externalId)
     │        │    ├─ אם previous?.matchedBenefitId קיים:
     │        │    │    ├─ benefit נמחק? → NEW
     │        │    │    ├─ diffFields ריק? → UNCHANGED
     │        │    │    └─ אחרת → UPDATE
     │        │    ├─ אחרת: חיפוש Benefit לפי slugify(title)
     │        │    │    └─ נמצא? → UNCHANGED / UPDATE
     │        │    └─ אחרת → NEW
     │        │
     │        ├─ if (UNCHANGED) → return 'SKIPPED'  ← היציאה היחידה לפני createItem
     │        ├─ confidenceService.calculate(...)                    [confidence.service.ts:17]
     │        ├─ shouldAutoPublish(...)                              [:59]
     │        ├─ createItem(...)  🔴 ← כאן זה נשבר
     │        ├─ if (!autoPublish) → 'FLAGGED'
     │        ├─ if (UPDATE) → applyUpdate() → 'UPDATED'
     │        └─ if (NEW) → 'SKIPPED' (safety net מפורש)
     │
     │      finishRun(SUCCESS) + updateSource(lastRunAt, lastRunStatus:SUCCESS)
     │    } catch {
     │      finishRun(FAILED, errorMessage) + updateSource(lastRunStatus:FAILED)
     │      logger.error(...)                       ⚠️ ולא זורק הלאה
     │    }
     └─ return findRunsBySource(sourceId, 1)        ⚠️ תמיד 200
```

**🔴 באג #1 (החמור ביותר במערכת) — הריצה השנייה של כל מקור תיכשל.**

`ScrapedItem` מוגדר `@@unique([sourceId, externalId])` (schema.prisma:715), ו-`scraperRepository.createItem` הוא `prisma.scrapedItem.create()` **פשוט, לא `upsert`** (`scraper.repository.ts:79-81`).

`processScrapedItem` קורא ל-`createItem` בכל מסלול **חוץ מ-`UNCHANGED`**. כלומר:

- **ריצה 1:** פריט X (externalId=`x`) → `match` מחזיר `NEW` → נוצר `ScrapedItem` בסטטוס `PENDING_REVIEW`. ✅
- **ריצה 2:** אותו פריט X → `findByExternalId` מוצא את הרשומה מריצה 1, אבל `matchedBenefitId` שלה הוא `null` (כי היא עדיין ממתינה לאישור) → נופל לחיפוש לפי slug → לא מוצא Benefit (עוד לא אושר) → מחזיר `NEW` שוב → `createItem` עם אותו `(sourceId, externalId)` → **`PrismaClientKnownRequestError` P2002** → נתפס ב-catch של `runSource` → **כל הריצה מסומנת `FAILED` והפריטים שנותרו בתור לא מעובדים בכלל**.

אותו דבר קורה גם במסלול `UPDATE`: פריט שכבר קושר להטבה ושהערך שלו השתנה יעבור `createItem` עם אותו מפתח → P2002.

**המשמעות המעשית:** רק מקור שכל הפריטים בו `UNCHANGED` יכול לרוץ פעמיים בהצלחה. כלומר **הסורק עובד פעם אחת בלבד לכל מקור, ואז מפסיק לעבוד — בשקט מוחלט.**

**באג #2 — כישלון ריצה מוחזר כ-200 הצלחה.**
`runSource` תופס את השגיאה, רושם לוג, ו**לא זורק הלאה** (`scraper.service.ts:210-222`). אחר כך מחזיר `findRunsBySource(sourceId, 1)` — מערך של הריצה האחרונה. ה-controller עוטף ב-`sendSuccess` → **200 OK**. הדשבורד (`ScraperSourceFormPage.tsx:110-121`) מפרש כל תשובה שאינה exception כהצלחה, קורא ל-`loadSource()` ולא מציג שום שגיאה. **המנהלת לוחצת "הרץ עכשיו", מקבלת מסך ירוק, והריצה נכשלה.** האינדיקציה היחידה היא עמודת "ריצה אחרונה" ברשימה, שתראה "נכשלה" רק אחרי רענון.

**באג #3 — `HEADLESS_BROWSER` מסתיים כ-SUCCESS עם 0 פריטים.**
`fetchRawItems` מחזיר `[]` עם `logger.warn` בלבד (`:305-308`). ה-run נרשם `SUCCESS`, `itemsFound: 0`. אין שום דרך מהדשבורד להבחין בין "האתר לא החזיר הטבות" ל"מצב הרינדור הזה לא ממומש". הטופס אפילו מציע את האפשרות הזו ב-Select (`ScraperSourceFormPage.tsx:149`) בלי שום אזהרה.

**באג #4 — `applyUpdate` דורס את כל `sourceMetadata` הקודם.**
`scraper.service.ts:277-289` — בונה אובייקט `sourceMetadata` **חדש** רק מהשדות שהגיעו בסריקה הנוכחית, ומציב אותו במקום הקודם. אם בעבר `discountValue` עודכן ידנית ותועד, והסריקה הנוכחית החזירה רק `title` — התיעוד של `discountValue` **נמחק**. זה סותר ישירות את מטרת השדה כפי שמוצהרת ב-schema.prisma:376-380 ("לדעת מאיפה כל שדה הגיע"). צריך היה merge, לא replace.

**באג #5 — שדות מדולגים בשקט.**
`fetchRawItems:348` — `if (!title || !externalId) return;` מדלג על כרטיס בלי לספור אותו ובלי לוג. אם ה-selector של `title` נשבר (האתר שינה מבנה), **כל** הפריטים ידולגו, `itemsFound` יהיה 0, והריצה תסתיים `SUCCESS`. זה בדיוק התרחיש שהסורק אמור להתריע עליו — selector שבור נראה בדיוק כמו "אין הטבות חדשות".

**באג #6 — `paginationParam` לא נבדק מול אתר אמיתי.**
`fetchRawItems:314-318` מניח pagination מבוסס query-param בלבד (`?page=2`). אתרים עם path-based pagination (`/benefits/page/2`) או infinite scroll לא נתמכים. תנאי היציאה `items.length === 0` מניח שהאתר מחזיר דף ריק בסוף — אתר שמחזיר את הדף הראשון שוב עבור `?page=99` ייצור לולאה שסורקת את אותם פריטים `maxPages` פעמים (וכולם יתנגשו ב-P2002 מבאג #1).

**באג #7 — `MatchResult.DUPLICATE` הוא קוד מת.**
הטיפוס מגדיר וריאנט `{ kind: 'DUPLICATE'; existingItemId: string }` (`matching.service.ts:14`) עם הערה מפורשת "ראינו את הפריט הזה בדיוק כבר". **`match()` לעולם לא מחזיר אותו, ו-`processScrapedItem` לא מטפל בו.** זה בדיוק הוריאנט שהיה מונע את באג #1 — נראה שהוא תוכנן ולא חובר.

---

### זרימה 3: אישור/דחיית פריט בתור הבדיקה

```
דשבורד: /scraped-items (ברירת מחדל: status=PENDING_REVIEW)
  → GET /api/v1/scraper/items?status=PENDING_REVIEW&pageSize=100
  → לחיצה על שורה → /scraped-items/:id
  → GET /scraper/items/:id  (include: source, matchedBenefit, run)
  → GET /categories?pageSize=200   (לרשימת הקטגוריות)
  → מציג: כותרת, confidenceScore כ-Badge, confidenceReasons ברשימה
  → POST /scraper/items/:id/review {decision, reviewedBy, overrides}
```

**המסלולים ב-`reviewItem` (`scraper.service.ts:385-423`):**

```
decision === 'REJECT'
  └→ updateItemStatus(REJECTED, reviewedBy) → סוף. הטבה לא נוגעים בה.

decision === 'APPROVE'
  ├─ fields = { ...item.rawData, ...overrides }
  ├─ אם item.matchedBenefitId קיים  (= עדכון להטבה קיימת)
  │   └→ applyUpdate(matchedBenefitId, fields, item.id)
  │      └→ updateItemStatus(APPROVED)
  └─ אחרת  (= הטבה חדשה)
      ├─ if (!overrides?.categoryId) → 422                    [:401-403]
      └→ prisma.benefit.create({
           slug: slugify(title), title, shortDescription: fields.shortDescription ?? title,
           category: connect(categoryId), benefitType: 'OTHER',
           discountValue, imageUrl, isActive: true,
           sourceMetadata: {...}, lastScrapedItem: connect(item.id)
         })
         → updateItemStatus(APPROVED)
```

**נקודות החלטה:**
| תנאי | תוצאה |
|---|---|
| הטבה חדשה בלי `categoryId` | 422 מהשרת. ה-UI חוסם גם מראש (`ScrapedItemReviewPage.tsx:42-45`). |
| `reviewedBy` ריק | נחסם ב-UI (`:38-41`). בשרת: `z.string().min(1)` → 422. |
| הפריט כבר הוכרע (`APPROVED`/`REJECTED`/`AUTO_PUBLISHED`) | ה-UI **מסתיר את כל אזור ההחלטה** (`:69, :120`). |

**🔴 נקודות שבירה שקטה:**

**3.1 — הטבה חדשה נוצרת בלי אף `BenefitScope` → היא זולגת לכל המשתמשים.**
זו ההשלכה החמורה ביותר בזרימה הזו. `prisma.benefit.create` ב-`:404-417` **לא יוצר שום שורת `BenefitScope`**. אבל `findMatchingBenefits` (`benefit.repository.ts:29-38`) מוסיף את תנאי ה-scopes **רק אם** יש `programIds` או `brandId` בשאילתה — ובתוכו `OR: [{programId: {in: [...]}}, {programId: null}]`.

הטבה בלי אף scope **לא תעבור** את `scopes: { some: {...} }` (אין שורות בכלל) — כלומר היא **לא תוצג לאף אחד** בקריאה הרגילה של האפליקציה. מצד שני, ב-`GET /benefits` בלי `programIds` (למשל מהדשבורד) היא **כן** תוצג.
**התוצאה נטו:** המנהלת מאשרת הטבה חדשה, רואה אותה ברשימת ההטבות בדשבורד, וסבורה שהיא פורסמה — אבל **אף משתמשת באפליקציה לא תראה אותה לעולם**, כי אין לה scope. אין שום אזהרה על כך.
זה גם מה שהופך את `defaultProgramId`/`defaultBrandId` ב-`ScraperSource` לחסרי משמעות — הם נועדו בדיוק לזה ולא נקראים.

**3.2 — `benefitType: 'OTHER'` + `discountValue` בלי `discountUnit`.**
ההטבה נוצרת עם `benefitType: 'OTHER'` קשיח ועם `discountValue` מהסריקה, אבל **בלי `discountUnit`**. ההשלכות משורשרות:
- `calculateValueScore` מחזיר **0** — כי `OTHER` אינו אחד משלושת הסוגים הכספיים (`valueScore.ts:38-39`). ההטבה תשקע לתחתית כל מיון לפי valueScore.
- `resolveBenefitGroup('OTHER')` → קבוצת `OTHER` — האחרונה בסדר התצוגה (`benefitGroup.ts:11`).
- **באפליקציה, ערך ההנחה פשוט לא יוצג.** `formatDiscount` (`BenefitCard.tsx:12-18`) בודק את `discountUnit` בשלושה `if` ומחזיר `null` אם אף אחד לא תואם. `discountValue = 15` עם `discountUnit = undefined` → **אין badge הנחה בכלל**.

  *(הערה לתיקון הבנה קודמת: `BenefitCard` **כן** מטפל נכון ב-`discountValue` חסר — `benefit.discountValue == null` מחזיר null מסודר. הבאג האמיתי הוא ההפך: ערך **קיים** בלי יחידה נעלם בשקט.)*

**3.3 — `valueScore` לא מחושב בכלל בהטבה שנוצרת מהסורק.**
`prisma.benefit.create` נקרא **ישירות**, לא דרך `benefitService.create` — ולכן `computeValueScore` לא רץ. `valueScore` נשאר על ברירת המחדל `0`. גם אילו `benefitType` היה נכון, הציון לא היה מחושב.

**3.4 — התנגשות `slug` תיתן 409 סתום.**
`slug: matchingService.slugify(fields.title)` — אין בדיקת ייחודיות ואין סיומת מבדילה. שתי הטבות עם כותרות שמתנרמלות לאותו slug → P2002 → `errorHandler` מחזיר 409 `DUPLICATE_ENTRY`. `formatSaveError` לא מטפל בקוד `DUPLICATE_ENTRY` (הוא בודק רק `VALIDATION_ERROR`) → המנהלת תראה את ה-message הגנרי באנגלית: *"A record with this value already exists"*.

**3.5 — `lastScrapedItemId` הוא `@unique` → אישור כפול יכול להתפוצץ.**
כיוון ש-`Benefit.lastScrapedItemId` הוא `@unique` (schema.prisma:385), **פריט סרוק אחד יכול להיות מקושר רק להטבה אחת**. אם אותו `ScrapedItem` ינסה להתחבר להטבה שנייה (למשל אישור אחרי שכבר בוצע `applyUpdate` על הטבה אחרת) → P2002 → 409.

**3.6 — אין טרנזקציה.**
במסלול "הטבה חדשה": `benefit.create` ואז `updateItemStatus` — שתי פעולות נפרדות. אם השנייה נכשלת, נוצרת הטבה שהפריט שלה נשאר `PENDING_REVIEW` → אישור חוזר ייצור הטבה כפולה (או ייכשל על slug).

**3.7 — `overrides.title` נשלח תמיד, גם בעדכון.**
`ScrapedItemReviewPage.tsx:53-56` שולח `overrides.title` בכל אישור. במסלול UPDATE זה גורם ל-`applyUpdate` לכתוב את הכותרת גם אם המנהלת לא נגעה בה — לא באג חמור, אבל מייצר רשומת provenance מיותרת על `title`.

---

### זרימה 4: הצגת הטבות למשתמשת באפליקציה

```
Splash → userSelectionStorage.hasCompletedOnboarding()  (= programIds.length > 0)
   ├─ false → OnboardingScreen → בחירת מועדונים → toggleProgram → AsyncStorage
   └─ true  → Main (5 טאבים)

HomeScreen / BenefitsListScreen:
  useBenefits({categoryId?, isPopular?, search?, singleProgramId?})
    ├─ useEffect: userSelectionStorage.get() → setStoredProgramIds(s.programIds)
    ├─ enabled: !skip && storedProgramIds !== null     ← מונע בקשה לפני טעינת האחסון
    └─ GET /api/v1/benefits?programIds=a,b,c&pageSize=50[&categoryId=&isPopular=&search=]
         → benefitRepository.findMatchingBenefits            [benefit.repository.ts:18]
              where = {
                isActive: true, deletedAt: null,
                OR: [{endDate: null}, {endDate: {gt: <NOW>}}],
                [categoryId], [isPopular], [search],
                scopes: { some: { OR: [{programId: {in: [...]}} , {programId: null}] } }
              }
              orderBy: priority desc | valueScore desc | createdAt desc
              include: category, scopes(+program,brand,store), tags(+tag)
         → BenefitCard לכל תוצאה
```

**מסלול החיפוש (טאב Search):**
```
useSearch(q)  [enabled רק כש-q.trim().length >= 2]
  → GET /search?q=...&limitPerType=8
     → 5 שאילתות Promise.all: benefits / brands / programs / categories / stores
  → לחיצה על מותג בתוצאות
     → useGroupedRecommendations({brandId})
        → GET /recommendations/grouped?brandId=...
           → קיבוץ ל-PERCENT/NONCASH/POINTS/OTHER + מיון פנימי
           → GroupedBenefitsView (3 הטבות תצוגה מקדימה לקבוצה)
```

**מסלול המועדפים:** `useFavoriteBenefits` שולף `favoriteBenefitIds` מהאחסון ומבצע **בקשה נפרדת לכל ID** (`Promise.all` של `GET /benefits/:id`), עם `.catch(() => null)` שמסנן כשלים. מתועד כפשרה מודעת — אין endpoint של "שלוף לפי רשימת IDs".

**🔴 נקודות שבירה שקטה:**

**4.1 — `new Date()` מוקפא בזמן טעינת המודול. 🔴**
```ts
// benefit.repository.ts:9-13   וגם   recommendation.service.ts:7-11
const activeNotExpiredWhere: Prisma.BenefitWhereInput = {
  isActive: true, deletedAt: null,
  OR: [{ endDate: null }, { endDate: { gt: new Date() } }],   // ← נחשב פעם אחת בלבד!
};
```
זהו קבוע ברמת המודול. `new Date()` מוערך **פעם אחת, כשהקובץ נטען** — כלומר בעליית השרת. בשרת שרץ שבועיים ברצף, הסינון ימשיך להשוות מול תאריך של לפני שבועיים, ו**הטבות שפג תוקפן יוסיפו להופיע למשתמשות**. הבאג הזה שקט לחלוטין בפיתוח, כי `ts-node-dev --respawn` מטעין מחדש בכל שינוי קובץ — הוא יתגלה רק בפרודקשן.

**4.2 — מועדון/מותג מחוק לא מסונן.**
`findMatchingBenefits` מסנן `deletedAt: null` על ה-`Benefit` בלבד. ה-`scopes.some` בודק רק `programId`/`brandId` — **בלי לבדוק את `program.deletedAt` או `program.isActive`**. הטבה ששייכת למועדון שנמחק (soft delete) תמשיך להופיע לכל מי שבחר את המועדון הזה. ראו טבלת המחיקות בחלק 3.

**4.3 — `search` דורס את סינון התפוגה. 🔴**
```ts
// benefit.repository.ts:19-28
const where = {
  ...activeNotExpiredWhere,          // ← מכיל OR: [{endDate: null}, {endDate: {gt: now}}]
  ...(query.categoryId && {...}),
  ...(query.isPopular !== undefined && {...}),
  ...(query.search && {
    OR: [                            // ← 🔴 אותו מפתח "OR" — דורס את הקודם!
      { title: { contains: query.search, mode: 'insensitive' } },
      { shortDescription: { contains: query.search, mode: 'insensitive' } },
    ],
  }),
  ...
};
```
ב-JS, spread של אותו מפתח דורס. ברגע ש-`search` מסופק, **תנאי ה-`endDate` נעלם לחלוטין** — וחיפוש מחזיר גם הטבות שפג תוקפן. `isActive`/`deletedAt` שורדים (מפתחות שונים), אבל התפוגה לא. הפתרון הנכון הוא `AND: [...]`.
`recommendation.service.ts` **לא** סובל מזה (אין לו `search`), ו-`searchService` **כן** סובל מגרסה אחרת של אותה בעיה — הוא לא בודק `endDate` בכלל (`search.service.ts:32-44`).

**4.4 — משתמשת בלי מועדונים רואה את כל ההטבות במערכת.**
`useBenefits` מגן רק מפני `null` (`enabled: storedProgramIds !== null`), אבל **מערך ריק `[]` אינו `null`**. אם `programIds` ריק, הפרמטר לא נשלח (`if (storedProgramIds?.length)`), ואז `findMatchingBenefits` **לא מוסיף את תנאי ה-scopes בכלל** → מחזיר את כל ההטבות הפעילות במערכת. בפועל זה נחסם כי Onboarding דורש בחירה, אבל משתמשת שתסיר את כל המועדונים ב-Settings תגיע למצב הזה.

**4.5 — `pageSize=50` קשיח, בלי pagination.**
`useBenefits:48` מקבע `pageSize=50` ואף מסך לא טוען עמוד שני. `parsePagination` מגביל ל-100 ממילא. הטבה 51 לא נגישה למשתמשת בשום דרך.

**4.6 — `useGroupedRecommendations` לא תומך ב-`programIds`.**
ה-hook בונה `hasAnchor` רק מ-`brandId || categoryId` (`:22`), אבל השרת מקבל גם `programIds` כעוגן חוקי (`recommendation.service.ts:18`). התרחיש "כל ההנחות שלי מ-MAX" מוזכר במפורש ב-DTO (`recommendation.dto.ts:4-5`) — נתמך בשרת, **לא נגיש מהאפליקציה**.

**4.7 — `searchKeywords` מחייב התאמה מדויקת.**
`search.service.ts:55` — `searchKeywords: { has: q.toLowerCase() }`. `has` הוא שוויון מלא על איבר במערך, לא `contains`. חיפוש "zar" לא ימצא מותג עם keyword "zara". גם ה-`toLowerCase()` מניח שכל ה-keywords נשמרו ב-lowercase — **אין שום אכיפה של זה** ביצירת מותג.

---

## חלק 5: כללי עסק ואילוצים

### כללים שנאכפים בפועל

| # | הכלל | איפה נאכף | הערות |
|---|---|---|---|
| 1 | מקור סריקה לא רץ אלא אם `isActive === true` **וגם** `tosStatus === 'APPROVED'` | `scraper.repository.ts:28-32` (`findRunnableSources`) **וגם** `scraper.service.ts:169-171` (`runSource`) | הגנה כפולה מכוונת ומתועדת. **שני השערים אכן קיימים.** |
| 2 | אי אפשר להפעיל מקור שה-ToS שלו לא אושר | `scraper.service.ts:142-144` | 422. ה-UI חוסם גם מראש: `ScraperSourceFormPage.tsx:215`. |
| 3 | מקור חדש נוצר תמיד לא-פעיל ו-PENDING_REVIEW | `scraper.service.ts:95-96` + `scraper.dto.ts:34-35` (השדות פשוט לא קיימים ב-DTO) | אכיפה בשתי שכבות — אין דרך לעקוף דרך ה-API. |
| 4 | דחיית ToS מכבה את המקור אוטומטית | `scraper.service.ts:134` | אי אפשר להיות "פעיל ודחוי". |
| 5 | `review-tos` הוא endpoint נפרד מ-PATCH, ומחייב `reviewedBy` | `scraper.routes.ts:23` + `scraper.dto.ts:42-46` | `reviewedBy: z.string().min(1)`. תיעוד חובה. |
| 6 | robots.txt נבדק לפני כל ריצה, ושוב פר-דף | `scraper.service.ts:175-179` (root) + `:322-326` (פר-דף) | כשל רשת בבדיקה **לא** חוסם (`robotsChecker.ts:28-33`) — מוצהר כמכוון. |
| 7 | הטבה חדשה לעולם לא מתפרסמת אוטומטית | `confidence.service.ts:63` | `if (matchResult.kind === 'NEW') return false;` — לפני חישוב הסף. |
| 8 | סף פרסום אוטומטי = 70 | `confidence.service.ts:7` (`AUTO_PUBLISH_THRESHOLD`) | קבוע יחיד ומרוכז. |
| 9 | שינוי ערך הנחה מעל 50% נחשב חשוד (‎-25 נק') | `confidence.service.ts:11, 41-47` | |
| 10 | אישור הטבה חדשה מחייב `categoryId` | `scraper.service.ts:401-403` | ה-UI חוסם גם מראש: `ScrapedItemReviewPage.tsx:42-45`. |
| 11 | כל `BenefitScope` חייב להפנות לפחות לישות אחת | `benefit.service.ts:96-98` | יש לו אפילו תרגום עברי ייעודי ב-`client.ts:51-53`. |
| 12 | כל FK ב-scopes חייב להתקיים בפועל | `benefit.service.ts:101-113` | count מול `new Set().size` — תופס גם כפילויות. **`cityId` לא נבדק** (רק program/brand/store). |
| 13 | `valueScore` מחושב אוטומטית, לא מוזן ידנית | `benefit.service.ts:29` (create), `:47-59` (update, רק אם שדה רלוונטי השתנה) | **לא חל על הטבה שנוצרת מהסורק** — ראו 3.3. |
| 14 | רק DISCOUNT_PERCENT/DISCOUNT_FIXED/CASHBACK מקבלים ציון כספי | `valueScore.ts:38-39` | כל השאר = 0 במכוון. |
| 15 | סדר קבוצות ההמלצה קבוע: אחוזים → מבצעים → נקודות → אחר | `benefitGroup.ts:11` | לא נגזר מתוכן. |
| 16 | עדיפות פנימית ב-NONCASH: 1+1 → משלוח חינם → מתנה | `benefitGroup.ts:33-37` | |
| 17 | "חדש" = נוצר או עודכן ב-7 הימים האחרונים | `benefitGroup.ts:42-47` | badge, לא סדר מיון. |
| 18 | המלצות מקובצות דורשות עוגן אחד לפחות | `recommendation.service.ts:18-23` | בלי עוגן מחזיר `{groups: []}`. |
| 19 | קופון לא ימומש אם לא פעיל / פג / הגיע למכסה | `coupon.service.ts:44-49` | |
| 20 | קוד קופון ייחודי | `coupon.service.ts:20-21, 30-31` | **רק בקוד — אין constraint ב-DB.** ראו סתירה #2. |
| 21 | `path` של Program/Category נבנה מה-parent | `program.service.ts:69-74`, `category.service.ts:60-65` | |
| 22 | `pageSize` מוגבל ל-100 | `apiResponse.ts:19` | הגנה מפני `?pageSize=99999`. |
| 23 | env לא תקין → קריסה מיידית | `config/env.ts:14` (`.parse` ולא `safeParse`) | מוצהר כמכוון. |
| 24 | `slug` בפורמט kebab-case | `benefit.dto.ts:20`, `scraper.dto.ts:24` | `/^[a-z0-9-]+$/` |
| 25 | כל שגיאה עוברת דרך `errorHandler` יחיד | `middleware/validateRequest.ts:10` (`next(error)` ולא `res.json`) | נקודת אמת אחת לפורמט השגיאה. |

### 🔴 סתירות בין כוונה מתועדת לקוד בפועל (= באגים)

**סתירה #1 — `AuditLog` מוגדר כ"נדרש כי אין Authentication" ואף פעם לא נכתב אליו.**
`schema.prisma:557-572` מצהיר במפורש: *"AUDIT LOG — append-only, נדרש כי לדשבורד אין Authentication בשלב 1"*. הרציונל ברור: בלי הזדהות, לוג הפעולות הוא מנגנון האחריותיות היחיד.
**בפועל: אין ולו קריאה אחת ל-`prisma.auditLog.create` בכל הקוד.** ההופעה היחידה של המודל היא `deleteMany` ב-`seed.ts:31`. כל פעולות ה-CRUD בכל המודולים — יצירה, עדכון, מחיקה, הפעלה, כיבוי — לא מתועדות. ה-enum `AuditAction` (כולל `ACTIVATE`/`DEACTIVATE` שנוצרו במיוחד עבור הסורק) לא בשימוש. **המערכת חסרת אחריותיות לחלוטין: אין דרך לדעת מי שינה מה ומתי.**

**סתירה #2 — ייחודיות `code` בקופון "נאכפת גם ב-DB" אבל אין constraint.**
`coupon.service.ts:18-19` כותב: *"ייחודיות code נאכפת גם ב-DB (constraint לוגי עתידי), אך בדיקה כאן נותנת הודעת שגיאה ברורה"*. ב-`schema.prisma:448` השדה הוא `code String` — **בלי `@unique`, בלי `@@unique`**. הבדיקה בקוד היא read-then-write בלי טרנזקציה → **race condition**: שתי בקשות במקביל עם אותו קוד ייצרו שתי רשומות, ושום דבר לא יעצור אותן.

**סתירה #3 — `defaultProgramId`/`defaultBrandId` מוגדרים כ"עוגן שיוך אוטומטי" ולא נקראים לעולם.**
`schema.prisma:616-617`: *"עוגן שיוך: תוצאה שנמצאת במקור הזה משויכת אוטומטית, בלי לדרוש שכל פריט סרוק 'יידע' לאיזה מועדון/מותג הוא שייך"*.
**בפועל:** שני השדות נכתבים ב-`createSource`/`updateSource` בלבד. `reviewItem` (`:404-417`) יוצר `Benefit` **בלי לקרוא אותם ובלי ליצור `BenefitScope`**. הפונקציונליות שהם נועדו לספק לא קיימת — וזו הסיבה השורשית לבאג 3.1.

**סתירה #4 — הערה טוענת ש-`fetchRawItems` "לא ממומש", אבל הוא כן.**
`scraper.service.ts:188-191` כותב: *"fetchRawItems הוא ה'מנוע' בפועל... **לא ממומש בשלב הזה**, מסומן כ-TODO תשתיתי"*. בפועל הפונקציה **מומשה במלואה** עבור `HTTP` (‎`:299-369`, axios+cheerio+pagination+מיני-DSL). ההערה מיושנת ומטעה — קורא חדש עלול להסיק שהסורק לא עובד בכלל, בעוד שהמצב האמיתי מורכב יותר (עובד ל-HTTP, לא עובד ל-HEADLESS_BROWSER, ונשבר בריצה השנייה).

**סתירה #5 — `metadata` של Program מוצהר כמאומת ב-Service ולא מאומת.**
`schema.prisma:183` — *"שדות ספציפיים-לסוג שלא הצדיקו עמודה נפרדת (ולידציה בשכבת ה-Service)"*. ❓ לא נמצאה שום ולידציה של `metadata` ב-`program.service.ts`.

**סתירה #6 — `MediaAsset` מוצהר כ"נדרש עבור העלה לוגו בדשבורד" ולא ממומש.**
`schema.prisma:534` — *"polymorphic, נדרש עבור 'העלה לוגו / העלה תמונות' בדשבורד. אין FK אמיתי ברמת DB על entityId — **נאכף בשכבת ה-Service**"*. אין service, אין router, אין קוד. כל שדות התמונה במערכת הם `String?` של URL שמוקלד ידנית.

**סתירה #7 — הערות רבות מפנות ל-`packages/shared` שלא קיים.**
`benefit.dto.ts:3-6`, `validateRequest.ts:4`, `dashboard/src/api/client.ts:2-4`, `mobile/src/api/client.ts:1-2`, `mobile/src/storage/userSelection.ts:3-4` — כולם מתייחסים ל-`@benefits-wallet/shared` כאילו הוא יעד מתוכנן ומוסכם. **התיקייה `packages/` לא קיימת, ואין workspaces שיאפשרו לה לעבוד.** התוצאה בפועל: הטיפוסים והסכמות משוכפלים ידנית בין 3 האפליקציות, בלי שום מנגנון שיתריע כשהם מתפצלים.

**סתירה #8 — הערה טוענת שההפרדה `app.ts`/`server.ts` נועדה לטסטים, ואין טסטים.**
`app.ts:22-24` — *"ההפרדה הזו קריטית לבדיקות: אפשר לייבא { app } ולהריץ נגדו supertest"*. אין supertest, אין test runner, אין קובץ טסט. ההפרדה עצמה נכונה וטובה — רק הנימוק לא מומש.

**סתירה #9 — `replaceScopes` קיים ולא נקרא — אי אפשר לערוך scopes אחרי יצירה.**
`benefit.repository.ts:91-98` מממש `replaceScopes` בטרנזקציה תקינה. **אף אחד לא קורא לו** (אומת ב-grep; ההפניה היחידה היא הערה ב-`campaign.repository.ts:46`). בנוסף `updateBenefitSchema` עושה `.omit({scopes: true})` (`benefit.dto.ts:54`). **המשמעות: אחרי שנוצרה הטבה, אי אפשר לשנות למי היא תקפה — דרך ה-API בכלל.** זה חור פונקציונלי משמעותי, לא רק קוד מת.

---

## חלק 6: פערים ואזורי סיכון ידועים

### פערים קריטיים

| # | הפער | חומרה | מיקום |
|---|---|---|---|
| 1 | **ריצת סריקה שנייה נכשלת ב-P2002** — `createItem` הוא `create` ולא `upsert` מול `@@unique([sourceId, externalId])` | 🔴 חוסם | `scraper.repository.ts:79-81` + `scraper.service.ts:245-254` |
| 2 | **אין scheduler בכלל** — `runAllDueSources` מוגדר ולא נקרא, `scheduleCron` נשמר ולא נקרא. אין node-cron/agenda ב-deps | 🔴 חוסם | `scraper.service.ts:157-164` |
| 3 | **כישלון ריצה מוחזר כ-200** | 🔴 שקט | `scraper.service.ts:210-225` |
| 4 | **הטבה מאושרת נוצרת בלי scope → אף משתמשת לא תראה אותה** | 🔴 שקט | `scraper.service.ts:404-417` |
| 5 | **`new Date()` מוקפא בטעינת המודול** → הטבות שפג תוקפן נשארות גלויות | 🔴 שקט, פרודקשן בלבד | `benefit.repository.ts:9-13`, `recommendation.service.ts:7-11` |
| 6 | **`search` דורס את סינון התפוגה** (התנגשות מפתח `OR`) | 🟠 שקט | `benefit.repository.ts:19-28` |
| 7 | **`AuditLog` לא נכתב לעולם** למרות שמוצהר כנדרש | 🟠 | סתירה #1 |
| 8 | **אי אפשר לערוך `BenefitScope` אחרי יצירה** | 🟠 | סתירה #9 |
| 9 | **`scrapeConfig` לא ניתן לעריכה בשום מסך** — נשמר עם "TODO" בתוכו | 🟠 | `ScraperSourceFormPage.tsx:66-69` |
| 10 | **`HEADLESS_BROWSER` לא ממומש** — מסתיים SUCCESS עם 0 פריטים | 🟠 | `scraper.service.ts:305-308` |

### שגיאות קומפילציה קיימות (אומתו בהרצה)

**`apps/backend` — `npm run build` נכשל:**
```
error TS6059: File 'prisma/seed.ts' is not under 'rootDir' 'src'.
```
`tsconfig.json` כולל `"rootDir": "src"` יחד עם `"include": ["src/**/*.ts", "prisma/seed.ts"]` — שני אלה סותרים. `npm run dev` עובד (ts-node-dev עם `--transpile-only` מדלג על בדיקת טיפוסים), אבל **הפרויקט לא ניתן לבנייה לפרודקשן כמו שהוא**.

**`apps/dashboard` — `npm run typecheck` נכשל:**
```
src/api/client.ts(17,34): error TS2339: Property 'env' does not exist on type 'ImportMeta'.
```
חסר `"types": ["vite/client"]` ב-`compilerOptions`. **`npm run build` (שהוא `tsc -b && vite build`) נכשל גם הוא.** `npm run dev` עובד כי Vite לא בודק טיפוסים.

**`apps/mobile` — `npx tsc --noEmit` עובר נקי.** ✅

### קוד מת / לא מחובר

| מה | מיקום | הערה |
|---|---|---|
| `MatchResult.DUPLICATE` | `matching.service.ts:14` | וריאנט שלא מוחזר ולא מטופל — בדיוק מה שהיה מונע את פער #1 |
| `benefitRepository.replaceScopes` | `benefit.repository.ts:91` | לא נקרא |
| `scraperService.runAllDueSources` | `scraper.service.ts:157` | לא נקרא |
| `cache.get` | `lib/cache.ts:14` | רק `cache.del` בשימוש — שום דבר לא נקרא מהמטמון |
| `Benefit.viewCount` / `favoriteCount` | `schema.prisma:373-374` | אף פעם לא מוגדלים |
| `MediaAsset` (מודל שלם) | `schema.prisma:538` | רק `deleteMany` ב-seed |
| `AuditLog` (מודל שלם) | `schema.prisma:561` | רק `deleteMany` ב-seed |
| `Notification` (מודל שלם) | `schema.prisma:579` | מוצהר כלא-ממומש |
| `UserSelection.dismissedBenefitIds` | `mobile/src/storage/userSelection.ts:9` | נשמר ב-type, אין `toggleDismissed` ואף מסך לא קורא אותו |
| `Coupon.type` (`CouponType`) | `schema.prisma:449` | נשמר, אף לוגיקה לא מבדילה בין `SINGLE_USE_SHARED` ל-`UNIQUE_PER_USER` |

### פערים בתשתית ובאבטחה

- **אין Authentication בשום מקום.** הדשבורד פתוח לגמרי — כל מי שמגיע ל-URL יכול למחוק את כל הקטלוג. אין middleware של auth, אין API key, אין rate limiting. זה מוצהר כ"שלב 1" בהערות, אבל בשילוב עם היעדר `AuditLog` — אין גם עקבות.
- **`CORS_ORIGINS=*`** ב-`.env` הנוכחי (`config/env.ts:9` מאפשר רשימה מופרדת בפסיקים; הערך בפועל הוא `*`).
- **אין טסטים כלל.** אין test runner בשום `package.json`.
- **אין git.** הריפו אינו repository — אין היסטוריה, אין branches, אין דרך לשחזר שינוי.
- **מיגרציה אחת בלבד:** `20260801223357_init`. כל הסכמה, כולל טבלאות הסורק, נוצרה במכה אחת.
- **`seed.ts` מוחק את כל ה-DB** לפני שהוא זורע. הרצה בטעות על סביבה עם דאטה אמיתי = אובדן מוחלט. אין שום הגנה (בדיקת `NODE_ENV`, אישור אינטראקטיבי).
- **`seed.ts` לא יוצר אף `ScraperSource`** — לכן `GET /scraper/sources` מחזיר `[]` בסביבה נקייה (אומת בהרצה).
- **ריצות תקועות ב-`PARTIAL`:** אם השרת נופל באמצע ריצה, ה-`ScraperRun` נשאר `PARTIAL` לנצח. אין ניקוי, אין timeout.
- **`robotsChecker` מתעלם מ-`Allow:`** (`robotsChecker.ts:38-57`) — פרסור מינימלי שקורא רק `Disallow`. אתר עם `Disallow: /` + `Allow: /benefits` ייחסם לגמרי. מוצהר כמכוון ("מספיק לצורך רשת הביטחון הזו"), אבל התוצאה היא חסימת-יתר שקטה.
- **אין טרנזקציות** באף אחד מהזרימות המורכבות (`reviewItem`, `processScrapedItem`, `campaignService.create`).

### הערות TODO/FIXME בפועל בקוד

חיפוש `TODO|FIXME|HACK|XXX` על כל קבצי `.ts`/`.tsx`/`.prisma` (למעט `node_modules`) מחזיר **רק 3 מופעים אמיתיים** — כל השאר הם `placeholder=` של שדות טופס:

| קובץ:שורה | התוכן |
|---|---|
| `apps/backend/src/modules/scraper/scraper.service.ts:190` | `// מסומן כ-TODO תשתיתי` (מיושן — ראו סתירה #4) |
| `apps/dashboard/src/pages/ScraperSources/ScraperSourceFormPage.tsx:67` | `listSelector: 'TODO: CSS selector לכרטיס הטבה בדף'` |
| `apps/dashboard/src/pages/ScraperSources/ScraperSourceFormPage.tsx:68` | `fields: { title: 'TODO: selector לכותרת', externalId: 'TODO: selector/attribute למזהה ייחודי' }` |

⚠️ **חשוב:** שתי השורות האחרונות אינן הערות — הן **מחרוזות שנכתבות ל-DB בפועל**. אפשר לאתר מקורות פגומים ב-SQL: `SELECT * FROM scraper_sources WHERE scrape_config::text LIKE '%TODO%'`.

**המסקנה:** מיעוט ה-TODO בקוד **אינו** סימן לבשלות. רוב הפערים שתועדו למעלה אינם מסומנים בשום צורה — הם מוסווים כהערות הסבר שנשמעות בטוחות ("הלוגיקה שמסביבו היא הליבה שממומשת ומוכנה כבר עכשיו").

### מה נבדק בפועל מול השרת החי, ומה לא

**נבדק והוכח:**
- `npx prisma migrate status` → "Database schema is up to date"
- `GET /api/v1/scraper/sources` → `200 {"success":true,"data":[],"meta":{...}}`
- דשבורד עולה ב-Vite; `/scraper-sources` מחזיר 200
- `npx tsc --noEmit` בשלושת האפליקציות (תוצאות למעלה)

**❓ לא נבדק end-to-end (דורש דאטה אמיתי או אתר יעד):**
- ריצת סריקה מלאה מול אתר אמיתי — **כולל אימות באג #1**, שהוא היפותזה מקריאת קוד ולא נצפה בהרצה
- pagination מול אתר עם `paginationParam`
- אישור פריט → יצירת הטבה → הופעתה (או אי-הופעתה) באפליקציה
- כל זרימות המובייל — האפליקציה לא הורצה בסימולטור
- התנהגות `robotsChecker` מול robots.txt אמיתי

---

## חלק 7: מילון מונחים

### מונחים עסקיים ייחודיים לפרויקט

| מונח | הגדרה |
|---|---|
| **מנפיק (Issuer)** | הגוף המנפיק: MAX, Cal, ישראכרט. **שכבה מעל המועדון** — למנפיק אחד יכולים להיות כמה מועדונים. |
| **מועדון / כרטיס (Program)** | הישות המאוחדת שהמשתמשת "מחזיקה" ובוחרת ב-Onboarding. כוללת גם כרטיסי אשראי וגם מועדוני לקוחות — **בכוונה אותו מודל**, כי מבחינת המשתמשת שניהם "מה שיש לי בארנק". |
| **Program מול Brand — ההבדל המהותי** | `Program` = **מי נותן** את ההטבה (MAX, מועדון שופרסל). `Brand` = **איפה ממשים** אותה (זארה, איקאה). "10% בזארה עם MAX" = הטבה עם scope שמחבר `programId=MAX` ל-`brandId=זארה`. **שני צירים בלתי תלויים, לא היררכיה.** |
| **Scope (BenefitScope)** | כלל התחולה. **שורה = AND בין השדות שאינם null; כמה שורות לאותה הטבה = OR.** `null` = "כל הערכים". דוגמה: שורה עם `programId=MAX, brandId=זארה` פירושה "רק למחזיקי MAX, רק בזארה". שורה עם `programId=null, brandId=זארה` = "לכולם בזארה". |
| **הטבה "נקייה"** | העיצוב שבו ל-`Benefit` אין FK למועדון או למותג — כל הקישור עובר דרך `BenefitScope`. מאפשר להטבה אחת לחול על כמה מועדונים בלי שכפול. |
| **path (materialized path)** | מחרוזת כמו `"max/max-platinum"` על `Program`/`Category`. מתוחזקת ידנית ב-Service. מאפשרת "כל הצאצאים" עם `LIKE` במקום recursive CTE. |
| **valueScore** | ציון 0-100 המבטא **אחוז חיסכון משוער**. מחושב אוטומטית. **רק** ל-`DISCOUNT_PERCENT`/`DISCOUNT_FIXED`/`CASHBACK`; כל השאר מקבלים 0 **במכוון** — כדי לא "לתמחר" מתנה מול אחוז. |
| **קבוצת הטבות (BenefitGroup)** | `PERCENT` / `NONCASH` / `POINTS` / `OTHER`. הפתרון להשוואת הטבות שאינן ברות-השוואה: **מקבצים ולא מנקדים ביחד**. סדר קבוע: הנחות → מבצעים → נקודות → אחר. |
| **"חדש" (isNew)** | badge בלבד, לא סדר מיון. הטבה שנוצרה **או** עודכנה ב-7 הימים האחרונים. |
| **תרחיש "פוקס"** | מקרה הייחוס בתכנון: משתמשת מחפשת מותג, ומקבלת את ההטבות שלו מקובצות לפי סוג. ממומש ב-`recommendation.service` + `GroupedBenefitsView`. |

### מונחי הסורק

| מונח | הגדרה |
|---|---|
| **ScraperSource** | הגדרת מקור סריקה. **data-driven במלואו** — מקור חדש = שורה בטבלה, לא deploy. |
| **`tosStatus`** | **השער החוקי-אתי.** אדם חייב לקרוא את תנאי השימוש של האתר ולסמן אישור מפורש. **נפרד לגמרי מ-`isActive`** — צריך את שניהם כדי לרוץ. `PENDING_REVIEW` (ברירת מחדל) / `APPROVED` / `REJECTED`. |
| **`isActive` (של מקור)** | מתג ההפעלה התפעולי. ברירת מחדל `false` **במכוון**. **לא מספיק לבדו** — בלי `tosStatus=APPROVED` המקור לא ירוץ. |
| **שני השערים** | `isActive` + `tosStatus` הם **תנאים עצמאיים ומצטברים**. מוצגים כשתי עמודות נפרדות ברשימה **בכוונה** (`ScraperSourcesListPage.tsx:25-27`) כדי שהמנהלת תראה איזה מהם חוסם. |
| **`scrapeConfig`** | JSON עם `listSelector`, `paginationParam?`, `maxPages`, ו-`fields` (מיפוי שדה→selector). ⚠️ **לא ניתן לעריכה בשום מסך.** |
| **המיני-DSL של `fields`** | תחביר לשליפת ערך (`scraper.service.ts:37-54`): `'@data-id'` = attribute על הכרטיס עצמו · `'a::attr(href)'` = attribute על תת-אלמנט · `'.title'` = טקסט של תת-אלמנט. |
| **`externalId`** | מזהה יציב **מהמקור עצמו** (URL של דף ההטבה, או ID ב-HTML) — לא טקסט חופשי. `@@unique` יחד עם `sourceId`. הבסיס לזיהוי "ראינו את זה כבר". |
| **`rawData`** | מה שנשלף גולמית לפני מיפוי ל-`Benefit`. נשמר ל-debug/audit ולעיבוד מחדש אם לוגיקת המיפוי תשתפר. |
| **Matching Engine** | `matching.service.ts`. מחזיר `NEW` / `UPDATE` / `UNCHANGED` (ותיאורטית `DUPLICATE` — לא ממומש). מזהה קודם לפי `externalId`, ואם אין — לפי `slugify(title)` כדי לא ליצור כפילות מול הטבה שהוזנה ידנית. |
| **`confidenceScore`** | 0-100. **מתחיל ב-100 ויורד** לפי כללי ניכוי: הטבה חדשה ‎-40 · כותרת חסרה/קצרה ‎-30 · שינוי ערך >50% ‎-25 · אין `externalId` ‎-20 · אין ערך הנחה ‎-15. |
| **`confidenceReasons`** | מערך מחרוזות **בעברית**, מוצג בדשבורד תחת "למה זה בתור הבדיקה". השקיפות של הניקוד. |
| **`AUTO_PUBLISH_THRESHOLD`** | 70. מעליו — פרסום אוטומטי; מתחתיו — תור בדיקה. **הטבה חדשה (`NEW`) לא מתפרסמת אוטומטית לעולם, בלי קשר לציון.** |
| **`ScrapedItemStatus`** | `PENDING_REVIEW` = ממתין לאדם · `AUTO_PUBLISHED` = עבר את הסף ופורסם בלי אדם · `APPROVED` = אדם אישר · `REJECTED` = אדם דחה. |
| **`PENDING_REVIEW` מול `confidenceScore` — ההבדל** | `confidenceScore` הוא **המדד** (כמה המערכת בטוחה). `PENDING_REVIEW` הוא **התוצאה** (מה עושים עם זה). ציון נמוך → סטטוס `PENDING_REVIEW`. שים לב: `PENDING_REVIEW` הוא גם ערך ב-`TosReviewStatus` וגם ב-`ScrapedItemStatus` — **שני enums שונים לחלוטין** עם אותו שם ערך. |
| **`sourceMetadata`** | JSON על `Benefit`: מפה של שדה→מקור העדכון האחרון (scraper/manual + מתי + מאיזה פריט). ⚠️ נדרס בכל עדכון במקום להתמזג (באג #4). |
| **`renderMode`** | `HTTP` = axios+cheerio (ממומש) · `HEADLESS_BROWSER` = Playwright (**לא ממומש**). |

### מונחים טכניים ייחודיים לפרויקט

| מונח | הגדרה |
|---|---|
| **`formatSaveError`** | `dashboard/src/api/client.ts:61`. ממיר שגיאת שרת להודעה עברית קריאה. מקבל `fieldLabels` (מיפוי שם-שדה-DTO → תווית עברית) שמוגדר מקומית בכל טופס. מטפל בשני סוגי `VALIDATION_ERROR`: `details` כמחרוזת (שגיאה עסקית) או כ-`{fieldErrors}` (Zod flatten). |
| **`statusBadge(kind, value)`** | `dashboard/src/components/Badge.tsx`. נקודת האמת המרוכזת למיפוי enum → צבע+תווית עברית. `kind` יכול להיות `'tosStatus'`, `'isActive'`, `'itemStatus'`, `'confidence'` ועוד. |
| **`DataTable` / `Column<T>`** | הטבלה הגנרית. כל עמודה = `{header, render: (row) => ReactNode}`. |
| **`ScopeEditor`** | הרכיב הייחודי לבניית שורות ה-`BenefitScope` (ה-OR-ים) בטופס ההטבה. |
| **`UserSelection`** | האובייקט היחיד ב-AsyncStorage: `{programIds, favoriteBenefitIds, dismissedBenefitIds, updatedAt, schemaVersion}`. **תחליף למודל משתמש** כל עוד אין Authentication. |
| **`schemaVersion`** | שדה ב-`UserSelection`. נקודת המיגרציה היחידה (`userSelection.ts:30-34`) — כרגע placeholder, אין גרסאות קודמות. |
| **`sendSuccess` / `sendPaginated`** | פורמט התגובה האחיד: `{success:true, data}` או `{success:true, data, meta:{page,pageSize,total}}`. שגיאה: `{success:false, error:{code,message,details}}`. |
| **`AppError.validation(details)`** | 422 עם code `VALIDATION_ERROR`. `details` יכול להיות מחרוזת חופשית — **אותו code בדיוק כמו שגיאת Zod**, וזו הסיבה ש-`formatSaveError` צריך להבדיל ביניהם לפי טיפוס. |
