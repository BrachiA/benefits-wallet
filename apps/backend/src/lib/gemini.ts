import { ApiError, GoogleGenAI, ThinkingLevel, Type, createPartFromBase64, createPartFromText } from '@google/genai';
import { env } from '../config/env';
import { logger } from './logger';

// עוטף @google/genai. אם GEMINI_API_KEY לא הוגדר, מחזירים null במקום
// לזרוק — modules/duplicateCleanup ממשיך לעבוד (ניקוי הריצות היתומות
// דטרמיניסטי ולא תלוי כאן), רק שלב שיפוט הכפילויות הסמנטיות מדלג.
// אותו client משותף גם ל-modules/aiEnrichment (אימות תמונה/קטגוריה/
// סיכום) — לא client נפרד לכל צרכן.
//
// NODE_ENV==='test' חוסם client אמיתי בכל מקרה, כמו transporter ב-
// lib/mailer.ts — טסטים לא אמורים לתלות בקריאות רשת אמיתיות למודל.
const client = env.NODE_ENV !== 'test' && env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: env.GEMINI_API_KEY }) : null;

// gemini-3.1-flash-lite נבחר (לא 3.5) — זול יותר וגם מתואר בתיעוד
// הרשמי כ"frontier-class performance rivaling larger models"; 3.5
// מדגיש throughput, לא איכות חשיבה. אומת מול ai.google.dev ב-14.8.2026.
// אותו מודל משמש לכל קריאות ה-AI בפרויקט (כפילויות, אימות תמונה,
// קטגוריזציה, סיכום) — multimodal (מקבל גם תמונה) בכל דורות Gemini
// flash-lite, לא רק בדגמי ה-Pro.
const MODEL = 'gemini-3.1-flash-lite';

// טייר חינמי של Gemini מוגבל ל-15 בקשות/דקה (ai.google.dev, אומת
// 14.8.2026). module-level ולא per-consumer, כי המכסה נאכפת ע"י
// Google per-API-key על פני כל הפרויקט — לא רק duplicateCleanup, גם
// aiEnrichment. שני הצרכנים חייבים לחלוק את אותו מונה כדי שקריאה
// שיוצאת מסוף sweep אחד וקריאה שיוצאת מתחילת sweep אחר (למשל שני
// השלבים הרצים ברצף באותו tick של ה-cron) לא ייצאו בלי מרווח ביניהן.
// מרווח בטוח: 12/דקה = 5 שניות.
let lastGeminiCallAt = 0;
const GEMINI_MIN_INTERVAL_MS = 5000;

export async function throttleGeminiCall(): Promise<void> {
  const elapsed = Date.now() - lastGeminiCallAt;
  if (elapsed < GEMINI_MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, GEMINI_MIN_INTERVAL_MS - elapsed));
  }
  lastGeminiCallAt = Date.now();
}

export type DuplicateJudgment = { isDuplicate: boolean; confidence: number; reason: string };

export type DuplicateJudgmentCandidate = {
  title: string;
  shortDescription?: string;
  discountValue?: number;
  discountUnit?: string;
};

export type DuplicateJudgmentPair = { itemA: DuplicateJudgmentCandidate; itemB: DuplicateJudgmentCandidate };

// קבוצות של 10-15 זוגות לקריאה: מספיק גדול כדי לצמצם דרסטית את
// מספר הקריאות (ומכאן את זמן ה-throttle המצטבר), קטן מספיק כדי
// להימנע מ"lost in the middle" — ירידת דיוק ידועה כשמבקשים ממודל
// לשפוט הרבה פריטים באותה קריאה. 12 נבחר כאמצע הטווח שאושר.
export const DUPLICATE_BATCH_SIZE = 12;

// מערך תוצאות אחד לכל זוג, עם pairIndex (1-based, תואם למספור
// בפרומפט) — כך אפשר לאמת שחזרו בדיוק אותו מספר תוצאות כמו זוגות
// שנשלחו, ולמפות בחזרה בלי להניח שהמודל שומר על סדר הקלט.
const DUPLICATE_JUDGMENT_BATCH_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      pairIndex: { type: Type.INTEGER, description: 'המספר הסידורי של הזוג (1-based), כפי שמופיע בפרומפט' },
      isDuplicate: { type: Type.BOOLEAN, description: 'האם שני הפריטים בזוג הזה מתארים את אותה הטבה אמיתית' },
      confidence: { type: Type.NUMBER, description: 'ביטחון בשיפוט, בין 0 ל-1' },
      reason: { type: Type.STRING, description: 'נימוק קצר וברור בעברית לשיפוט' },
    },
    required: ['pairIndex', 'isDuplicate', 'confidence', 'reason'],
  },
};

// תוצאה מובחנת בין שלושה מצבים שהקורא (duplicateCleanup.service)
// חייב לטפל בהם אחרת: 'skipped' (אין client — מצב תקין, לא כשל),
// 'judged' (judgments במקביל אחד-לאחד עם pairs שנשלחו, לפי סדר
// הקלט — לא סדר התשובה), ו-'error' (הקריאה נכשלה טכנית על כל
// ה-batch כולו — rate limit, רשת, תשובה חלקית/לא תקינה. אין
// partial success מנוחש: אם אפילו זוג אחד בקבוצה לא חזר תקין,
// כל הקבוצה מטופלת ככשל, ראו judgeDuplicateBatch).
export type DuplicateJudgmentBatchOutcome =
  | { outcome: 'skipped' }
  | { outcome: 'judged'; judgments: DuplicateJudgment[] }
  | { outcome: 'error'; isRateLimit: boolean; message: string };

function formatCandidate(item: DuplicateJudgmentCandidate): string {
  return `כותרת="${item.title}"${item.shortDescription ? `, תיאור="${item.shortDescription}"` : ''}${item.discountValue !== undefined ? `, הנחה=${item.discountValue}${item.discountUnit ?? ''}` : ''}`;
}

// שיפוט קבוצה של עד DUPLICATE_BATCH_SIZE זוגות מועמדים לכפילות
// בקריאה אחת. מחזיר outcome:'skipped' אם אין client מוגדר (בלי
// מפתח, או בסביבת טסט) — הקורא מדלג על שלב הכפילויות הסמנטיות
// במקרה הזה, לא זורק.
//
// לא קובעים temperature/topP/topK בכלל: התיעוד הרשמי ממליץ במפורש
// להשאיר ברירות מחדל למודלי Gemini 3.x ("can cause unexpected
// behavior... particularly in reasoning tasks") — ולפי תיעוד Firebase
// AI Logic, המודלים בדור הזה פשוט מתעלמים מהם (ignored), לא רק
// "לא מומלץ". thinkingLevel כן רלוונטי (שדה נפרד, config.thinkingConfig,
// מאומת מול dist/genai.d.ts): 'MEDIUM' נבחר כי המשימה כאן — להבחין
// בין כפילות אמיתית לבין שתי הטבות שונות שרק *נשמעות* דומה (למשל
// "הנחה בסניף מסוים" מול "הנחה ברשת") — כוללת הבחנות עדינות
// שמצדיקות יותר מרמת "low", אבל יש רשת ביטחון (SUPERSEDED רק בביטחון
// גבוה, אחרת סימון בלבד + נימוק ב-AuditLog) שמאפשרת לכייל את זה
// מאוחר יותר לפי מה שבאמת נראה בלוג.
export async function judgeDuplicateBatch(pairs: DuplicateJudgmentPair[]): Promise<DuplicateJudgmentBatchOutcome> {
  if (!client) {
    logger.warn('Gemini not configured — duplicate judgment batch skipped');
    return { outcome: 'skipped' };
  }

  const pairSections = pairs.map(
    (pair, idx) => `זוג ${idx + 1}:\nפריט א: ${formatCandidate(pair.itemA)}\nפריט ב: ${formatCandidate(pair.itemB)}`
  );

  const prompt = [
    `להלן ${pairs.length} זוגות של פריטי הטבה, כל זוג נסרק מאותו אתר בשתי ריצות שונות. עבור כל זוג בנפרד, קבעו אם שני`,
    'הפריטים בו מתארים את אותה הטבה אמיתית בפועל (למשל: אותו אירוע/מוצר/הנחה, גם אם הכותרת מנוסחת מעט אחרת),',
    'או שתי הטבות שונות לגמרי. השיפוט של כל זוג עצמאי לחלוטין משאר הזוגות ברשימה.',
    '',
    `החזירו מערך JSON עם בדיוק ${pairs.length} תוצאות — פריט אחד לכל זוג, עם pairIndex התואם למספור למטה. אל תדלגו`,
    'על אף זוג ואל תמציאו זוגות נוספים.',
    '',
    ...pairSections,
  ].join('\n');

  try {
    const response = await client.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: DUPLICATE_JUDGMENT_BATCH_SCHEMA,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
      },
    });

    const text = response.text;
    if (!text) {
      logger.warn('Gemini returned empty response for duplicate judgment batch');
      return { outcome: 'error', isRateLimit: false, message: 'Empty response from Gemini' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      logger.warn({ text }, 'Gemini duplicate judgment batch response was not valid JSON');
      return { outcome: 'error', isRateLimit: false, message: 'Response was not valid JSON' };
    }

    if (!Array.isArray(parsed)) {
      logger.warn({ text }, 'Gemini duplicate judgment batch response was not an array');
      return { outcome: 'error', isRateLimit: false, message: 'Response was not an array' };
    }

    const byPairIndex = new Map<number, DuplicateJudgment>();
    for (const entry of parsed) {
      const e = entry as Partial<{ pairIndex: unknown; isDuplicate: unknown; confidence: unknown; reason: unknown }>;
      if (
        typeof e !== 'object' ||
        e === null ||
        typeof e.pairIndex !== 'number' ||
        typeof e.isDuplicate !== 'boolean' ||
        typeof e.confidence !== 'number' ||
        typeof e.reason !== 'string'
      ) {
        logger.warn({ text }, 'Gemini duplicate judgment batch entry failed shape validation');
        return { outcome: 'error', isRateLimit: false, message: 'Response entry failed shape validation' };
      }
      byPairIndex.set(e.pairIndex, { isDuplicate: e.isDuplicate, confidence: e.confidence, reason: e.reason });
    }

    // דורש התאמה מלאה 1:1 ל-pairIndex שנשלחו — לא רק אותו מספר
    // תוצאות. תוצאה חלקית/עם אינדקסים כפולים/חסרים מטופלת כמו כל
    // כשל טכני אחר על כל ה-batch, לא כ"הצלחה חלקית" מנוחשת.
    const judgments: DuplicateJudgment[] = [];
    for (let i = 0; i < pairs.length; i++) {
      const judgment = byPairIndex.get(i + 1);
      if (!judgment) {
        logger.warn({ expectedPairIndex: i + 1, received: byPairIndex.size, sent: pairs.length }, 'Gemini duplicate judgment batch missing or misaligned result');
        return { outcome: 'error', isRateLimit: false, message: `Missing result for pairIndex ${i + 1} (sent ${pairs.length}, received ${byPairIndex.size})` };
      }
      judgments.push(judgment);
    }

    return { outcome: 'judged', judgments };
  } catch (err) {
    // ApiError.status הוא HTTP status אמיתי שחשוף ע"י @google/genai
    // (מאומת מול dist/genai.d.ts, לא ניחוש) — 429 הוא הדרך היחידה
    // להבחין rate limit מכל כשל טכני אחר (רשת, timeout וכו').
    const isRateLimit = err instanceof ApiError && err.status === 429;
    logger.error({ err, isRateLimit }, 'Gemini duplicate judgment batch call failed');
    return { outcome: 'error', isRateLimit, message: err instanceof Error ? err.message : String(err) };
  }
}

// ============================================================
// modules/aiEnrichment — שלושה שימושים נוספים באותו client, לא
// תשתית AI נפרדת: אימות תמונה (מולטימודלי), הצעת קטגוריה, סיכום
// עברי. כל אחד פר-פריט בודד (לא batch כמו כפילויות) — נפח נמוך
// יחסית לזוגות הכפילות, וכל אחד רץ פעם אחת בחיי הפריט (מסומן
// aiCategorySuggestedAt/aiImageCheckedAt/aiSummary לא-ריק אחרי
// הניסיון, ראו aiEnrichment.service.ts), כך שאין הצטברות עומס.
// ============================================================

export type ItemContentCandidate = { title: string; shortDescription?: string };

// ---------- אימות תמונה (מולטימודלי) ----------

const IMAGE_VERIFICATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    matches: { type: Type.BOOLEAN, description: 'האם התמונה סבירה כתמונה של ההטבה המתוארת — לא לוגו כללי לא-קשור, לא תמונה של הטבה אחרת לגמרי' },
    confidence: { type: Type.NUMBER, description: 'ביטחון בשיפוט, בין 0 ל-1' },
    reason: { type: Type.STRING, description: 'נימוק קצר וברור בעברית' },
  },
  required: ['matches', 'confidence', 'reason'],
};

export type ImageVerificationOutcome =
  | { outcome: 'skipped' }
  | { outcome: 'verified'; matches: boolean; confidence: number; reason: string }
  | { outcome: 'error'; isRateLimit: boolean; message: string };

// מקבל bytes של תמונה שכבר נשלפו (לא URL) — הקורא (aiEnrichment.service)
// אחראי להוריד את התמונה מ-imageUrl הסרוק ולזהות mimeType; תמונה
// ששבורה/לא נטענת בכלל מזוהה שם דטרמיניסטית, בלי לבזבז קריאת AI.
// דרישת דיוק נמוכה במכוון (ראו הנחיית המשימה): לא זיהוי "זו בדיוק
// הטבה X", רק תפיסת מקרים ברורים — לוגו לא קשור, placeholder גנרי,
// הטבה אחרת לגמרי.
export async function verifyImageMatch(
  item: ItemContentCandidate,
  imageBase64: string,
  imageMimeType: string
): Promise<ImageVerificationOutcome> {
  if (!client) {
    logger.warn('Gemini not configured — image verification skipped');
    return { outcome: 'skipped' };
  }

  const prompt = [
    'זוהי תמונה שנסרקה אתר של הטבה/מבצע. בדקו אם התמונה סבירה כתמונה של ההטבה המתוארת למטה —',
    'לא בהכרח זיהוי מדויק, אלא תפיסת מקרים ברורים של אי-התאמה: לוגו כללי לא-קשור, placeholder גנרי,',
    'תמונה שבורה/לא קריאה, או תמונה שנראית כמו הטבה אחרת לגמרי.',
    '',
    `כותרת ההטבה: "${item.title}"${item.shortDescription ? `\nתיאור: "${item.shortDescription}"` : ''}`,
  ].join('\n');

  try {
    const response = await client.models.generateContent({
      model: MODEL,
      contents: [createPartFromText(prompt), createPartFromBase64(imageBase64, imageMimeType)],
      config: {
        responseMimeType: 'application/json',
        responseSchema: IMAGE_VERIFICATION_SCHEMA,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
      },
    });

    const text = response.text;
    if (!text) {
      logger.warn('Gemini returned empty response for image verification');
      return { outcome: 'error', isRateLimit: false, message: 'Empty response from Gemini' };
    }
    const parsed = JSON.parse(text) as { matches: boolean; confidence: number; reason: string };
    if (typeof parsed.matches !== 'boolean' || typeof parsed.confidence !== 'number' || typeof parsed.reason !== 'string') {
      logger.warn({ text }, 'Gemini image verification response failed shape validation');
      return { outcome: 'error', isRateLimit: false, message: 'Response failed shape validation' };
    }
    return { outcome: 'verified', matches: parsed.matches, confidence: parsed.confidence, reason: parsed.reason };
  } catch (err) {
    const isRateLimit = err instanceof ApiError && err.status === 429;
    logger.error({ err, isRateLimit }, 'Gemini image verification call failed');
    return { outcome: 'error', isRateLimit, message: err instanceof Error ? err.message : String(err) };
  }
}

// ---------- הצעת קטגוריה ----------

export type CategoryOption = { slug: string; name: string };

export type CategorySuggestionOutcome =
  | { outcome: 'skipped' }
  | { outcome: 'suggested'; categorySlug: string | null; confidence: number; reason: string }
  | { outcome: 'error'; isRateLimit: boolean; message: string };

// categorySlug מוגבל בסכמה עצמה ל-enum של slugs קיימים בפועל (ראו
// availableCategories) — לא טקסט חופשי שצריך למפות בדיעבד, וגם לא
// אפשרות למודל "להמציא" קטגוריה שלא קיימת אצלנו. nullable:true
// משמש כערוץ "אין קטגוריה מתאימה בביטחון מספיק" מפורש מהמודל עצמו,
// בנוסף לסף confidence שהקורא (aiEnrichment.service) עדיין מפעיל —
// אותה הגנה כפולה כמו בשיפוט כפילויות.
export async function suggestCategory(
  item: ItemContentCandidate & { rawCategoryHint?: string },
  availableCategories: CategoryOption[]
): Promise<CategorySuggestionOutcome> {
  if (!client) {
    logger.warn('Gemini not configured — category suggestion skipped');
    return { outcome: 'skipped' };
  }
  if (availableCategories.length === 0) {
    return { outcome: 'error', isRateLimit: false, message: 'No available categories provided' };
  }

  const schema = {
    type: Type.OBJECT,
    properties: {
      categorySlug: {
        type: Type.STRING,
        enum: availableCategories.map((c) => c.slug),
        nullable: true,
        description: 'ה-slug של הקטגוריה המתאימה ביותר מתוך הרשימה שסופקה, או null אם אף קטגוריה לא מתאימה בביטחון סביר',
      },
      confidence: { type: Type.NUMBER, description: 'ביטחון בשיפוט, בין 0 ל-1' },
      reason: { type: Type.STRING, description: 'נימוק קצר וברור בעברית' },
    },
    required: ['categorySlug', 'confidence', 'reason'],
  };

  const categoryList = availableCategories.map((c) => `${c.slug}: ${c.name}`).join('\n');
  const prompt = [
    'להלן פריט הטבה שנסרק, בלי קטגוריה ברורה. קבעו לאיזו קטגוריה מהרשימה למטה הוא הכי מתאים.',
    'אם אף קטגוריה לא מתאימה בביטחון סביר, החזירו categorySlug: null — אל תנחשו קטגוריה גרועה.',
    '',
    `כותרת: "${item.title}"${item.shortDescription ? `\nתיאור: "${item.shortDescription}"` : ''}${item.rawCategoryHint ? `\nקטגוריה כפי שהופיעה באתר המקור (טקסט חופשי, לא מאומת): "${item.rawCategoryHint}"` : ''}`,
    '',
    'רשימת הקטגוריות הקיימות (slug: שם):',
    categoryList,
  ].join('\n');

  try {
    const response = await client.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
      },
    });

    const text = response.text;
    if (!text) {
      logger.warn('Gemini returned empty response for category suggestion');
      return { outcome: 'error', isRateLimit: false, message: 'Empty response from Gemini' };
    }
    const parsed = JSON.parse(text) as { categorySlug: string | null; confidence: number; reason: string };
    if (
      (parsed.categorySlug !== null && typeof parsed.categorySlug !== 'string') ||
      typeof parsed.confidence !== 'number' ||
      typeof parsed.reason !== 'string'
    ) {
      logger.warn({ text }, 'Gemini category suggestion response failed shape validation');
      return { outcome: 'error', isRateLimit: false, message: 'Response failed shape validation' };
    }
    return { outcome: 'suggested', categorySlug: parsed.categorySlug, confidence: parsed.confidence, reason: parsed.reason };
  } catch (err) {
    const isRateLimit = err instanceof ApiError && err.status === 429;
    logger.error({ err, isRateLimit }, 'Gemini category suggestion call failed');
    return { outcome: 'error', isRateLimit, message: err instanceof Error ? err.message : String(err) };
  }
}

// ---------- סיכום עברי ----------

const SUMMARY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: 'תקציר קצר וברור בעברית, משפט או שניים, בלי סגנון שיווקי מסורבל' },
  },
  required: ['summary'],
};

export type SummarizationOutcome =
  | { outcome: 'skipped' }
  | { outcome: 'summarized'; summary: string }
  | { outcome: 'error'; isRateLimit: boolean; message: string };

// לא מחליף את הטקסט המקורי בשום שכבה — הקורא (aiEnrichment.service)
// שומר את התוצאה בשדה נפרד (ScrapedItem.aiSummary), הטקסט הגולמי
// נשאר קיים תמיד. ראו הנחיית המשימה: הדשבורד תמיד מאפשר לעבור בין
// הסיכום למקור, לא מסתיר את המקור בשום מסך.
export async function summarizeHebrew(item: { title: string; shortDescription: string }): Promise<SummarizationOutcome> {
  if (!client) {
    logger.warn('Gemini not configured — summarization skipped');
    return { outcome: 'skipped' };
  }

  const prompt = [
    'הפכו את תיאור ההטבה הגולמי הבא לתקציר עברי קצר וברור — משפט או שניים, בלי ניסוח שיווקי מסורבל,',
    'רק העובדות המהותיות (מה ההטבה, למי, בתנאי מה אם רלוונטי).',
    '',
    `כותרת: "${item.title}"`,
    `תיאור גולמי: "${item.shortDescription}"`,
  ].join('\n');

  try {
    const response = await client.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: SUMMARY_SCHEMA,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
      },
    });

    const text = response.text;
    if (!text) {
      logger.warn('Gemini returned empty response for summarization');
      return { outcome: 'error', isRateLimit: false, message: 'Empty response from Gemini' };
    }
    const parsed = JSON.parse(text) as { summary: string };
    if (typeof parsed.summary !== 'string' || !parsed.summary.trim()) {
      logger.warn({ text }, 'Gemini summarization response failed shape validation');
      return { outcome: 'error', isRateLimit: false, message: 'Response failed shape validation' };
    }
    return { outcome: 'summarized', summary: parsed.summary.trim() };
  } catch (err) {
    const isRateLimit = err instanceof ApiError && err.status === 429;
    logger.error({ err, isRateLimit }, 'Gemini summarization call failed');
    return { outcome: 'error', isRateLimit, message: err instanceof Error ? err.message : String(err) };
  }
}

// ============================================================
// modules/duplicateCleanup — שלב "logo_search" (חלק ג' של משימת
// אחסון התמונות): מוצא URL ללוגו הרשמי של מועדון/מותג באמצעות
// Grounding with Google Search (google_search tool), לא רק ידע
// גולמי של המודל — כדי לקבל קישור אמיתי ולא מומצא. נבנה מול הטיפוסים
// המותקנים בפועל (node_modules/@google/genai/dist/genai.d.ts, לא
// תיעוד/סניפטים שסופקו): config.tools:[{googleSearch:{searchTypes:
// {imageSearch:{}}}}], והתוצאה נשלפת מ-response.candidates[0].
// groundingMetadata.groundingChunks[].image.imageUri — לא מבקשים
// מהמודל לכתוב את ה-URL בעצמו כטקסט/JSON (לא responseSchema/
// responseMimeType כאן בכלל): imageUri מגיע ישירות ממנוע החיפוש,
// לא מהמודל "מדקלם" קישור מהזיכרון שלו, שנוטה יותר להמצאה/טעות.
//
// ⚠ אומת ב-17.8.2026 מול קריאה חיה: כל קריאה עם tools:[{googleSearch}]
// על gemini-3.1-flash-lite מחזירה 429 RESOURCE_EXHAUSTED מיידי על
// מפתח בלי Cloud Billing מקושר — לפי ai.google.dev/gemini-api/docs/
// pricing, Grounding with Google Search על משפחת Gemini 3.x "Not
// available" בטייר החינמי כלל (בשונה מ-Gemini 2.5, שיש לו מכסה
// חינמית יומית גם בלי billing). קריאות רגילות (בלי tools) על אותו
// מפתח עובדות תקין — הבעיה ספציפית ל-grounding, לא למכסה הכללית.
// המשמעות: הפונקציה הזו לא נבדקה מול תוצאה אמיתית — קוד מוכן להפעלה
// מיידית ברגע ש-billing יופעל בפרויקט Google Cloud של המפתח, ראו
// דוח הסיום.
// ============================================================

export type LogoSearchOutcome =
  | { outcome: 'skipped' }
  | { outcome: 'found'; imageUrl: string; sourceTitle?: string; sourceDomain?: string }
  | { outcome: 'not_found' }
  | { outcome: 'error'; isRateLimit: boolean; message: string };

// entityName הוא שם המועדון/מותג כפי שמופיע ב-DB (Program.name /
// Brand.name) — לא כולל הקשר נוסף (issuer וכו'), כי זה מה שיש לנו
// בפועל לחפש לפיו.
export async function findOfficialLogo(entityName: string): Promise<LogoSearchOutcome> {
  if (!client) {
    logger.warn('Gemini not configured — logo search skipped');
    return { outcome: 'skipped' };
  }

  const prompt = [
    `מצאו את הלוגו הרשמי והעדכני ביותר של "${entityName}" — מועדון לקוחות, מותג, או כרטיס אשראי ישראלי.`,
    'העדיפו תמונת לוגו רשמית מהאתר של המותג עצמו, ולא מפורום/בלוג/אתר צד-שלישי לא-רשמי.',
    'אם קיימת גרסה מעודכנת יותר (למשל אחרי ריברנדינג) העדיפו אותה, אך גרסה מעט ישנה עדיין מקובלת אם זו התוצאה הכי אמינה שנמצאה.',
  ].join('\n');

  try {
    const response = await client.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: { searchTypes: { imageSearch: {} } } }],
      },
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const imageChunk = chunks.find((c) => c.image?.imageUri);
    if (!imageChunk?.image?.imageUri) {
      return { outcome: 'not_found' };
    }

    return {
      outcome: 'found',
      imageUrl: imageChunk.image.imageUri,
      sourceTitle: imageChunk.image.title,
      sourceDomain: imageChunk.image.domain,
    };
  } catch (err) {
    const isRateLimit = err instanceof ApiError && err.status === 429;
    logger.error({ err, isRateLimit }, 'Gemini logo search call failed');
    return { outcome: 'error', isRateLimit, message: err instanceof Error ? err.message : String(err) };
  }
}
