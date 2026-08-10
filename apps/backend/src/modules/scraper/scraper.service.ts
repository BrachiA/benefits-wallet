import axios from 'axios';
import * as cheerio from 'cheerio';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/AppError';
import { logger } from '../../lib/logger';
import { recordAudit } from '../../lib/auditLog';
import { benefitService } from '../benefit/benefit.service';
import { scraperRepository } from './scraper.repository';
import { robotsChecker } from './robotsChecker';
import { matchingService, type RawScrapedFields } from './matching.service';
import { confidenceService } from './confidence.service';
import { buildAutoScopeRow, hasAutoScopeAnchor, type ScraperSourceAnchor } from './scraperAutoScope';
import { scraperAlerts } from './scraperAlerts';
import type {
  CreateScraperSourceInput,
  ListScraperSourcesQuery,
  ListScrapedItemsQuery,
  ReviewScrapedItemInput,
  ReviewTosInput,
  UpdateScraperSourceInput,
} from './scraper.dto';

type ScrapeConfig = {
  listSelector: string;
  paginationParam?: string;
  maxPages?: number;
  fields: {
    title: string;
    shortDescription?: string;
    discountValue?: string;
    imageUrl?: string;
    externalId: string;
    detailUrl?: string;
  };
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// מיני-DSL לכתיבת scrapeConfig.fields.*, כדי לתמוך גם בטקסט וגם
// ב-attributes בלי שדה נפרד לכל אחד: '@name' = attribute על כרטיס
// הפריט עצמו (למשל '@data-benefit-id'), 'selector::attr(name)' =
// attribute על תת-אלמנט (למשל 'a::attr(href)'), כל דבר אחר = טקסט
// של תת-אלמנט לפי CSS selector רגיל.
function extractField($item: cheerio.Cheerio<any>, spec: string | undefined): string | undefined {
  if (!spec) return undefined;
  if (spec.startsWith('@')) {
    return $item.attr(spec.slice(1))?.trim() || undefined;
  }
  const attrMatch = spec.match(/^(.*)::attr\(([^)]+)\)$/);
  if (attrMatch) {
    const [, selector, attrName] = attrMatch;
    const target = selector.trim() ? $item.find(selector.trim()).first() : $item;
    return target.attr(attrName)?.trim() || undefined;
  }
  return $item.find(spec).first().text().trim() || undefined;
}

// שולפת את המספר הראשון מתוך טקסט חופשי (למשל "15% הנחה" -> 15) —
// הדף לא בהכרח מציג מספר "נקי", והשרת ממילא מצפה ל-number.
function parseDiscountValue(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const match = raw.replace(/,/g, '').match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

// hrefs/src שנסרקים הם לרוב יחסיים לדף — הופך אותם למוחלטים לפי
// baseUrl, כדי שהתמונה/קישור יעבדו גם כשמוצגים מחוץ להקשר הדף המקורי.
function resolveUrl(value: string | undefined, baseUrl: string): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return undefined;
  }
}

export const scraperService = {
  // ---------- ScraperSource CRUD ----------

  async listSources(query: ListScraperSourcesQuery, page: number, pageSize: number) {
    const { items, total } = await scraperRepository.findSources(query, (page - 1) * pageSize, pageSize);
    return { items, meta: { page, pageSize, total } };
  },

  async getSourceById(id: string) {
    const source = await scraperRepository.findSourceById(id);
    if (!source) throw AppError.notFound('ScraperSource', id);
    return source;
  },

  async createSource(input: CreateScraperSourceInput) {
    const { defaultProgramId, defaultBrandId, defaultCategoryId, ...rest } = input;
    // מקור חדש נוצר תמיד לא-פעיל ו-PENDING_REVIEW — אין דרך לעקוף
    // את זה דרך ה-DTO, כי isActive/tosStatus לא נכללים בו כלל.
    const source = await scraperRepository.createSource({
      ...rest,
      isActive: false,
      tosStatus: 'PENDING_REVIEW',
      ...(defaultProgramId && { defaultProgram: { connect: { id: defaultProgramId } } }),
      ...(defaultBrandId && { defaultBrand: { connect: { id: defaultBrandId } } }),
      ...(defaultCategoryId && { defaultCategory: { connect: { id: defaultCategoryId } } }),
    } as never);
    await recordAudit({ entityType: 'ScraperSource', entityId: source.id, action: 'CREATE', changedFields: input });
    return source;
  },

  async updateSource(id: string, input: UpdateScraperSourceInput) {
    await this.getSourceById(id);
    const { defaultProgramId, defaultBrandId, defaultCategoryId, ...rest } = input;
    const source = await scraperRepository.updateSource(id, {
      ...rest,
      ...(defaultProgramId !== undefined && {
        defaultProgram: defaultProgramId ? { connect: { id: defaultProgramId } } : { disconnect: true },
      }),
      ...(defaultBrandId !== undefined && {
        defaultBrand: defaultBrandId ? { connect: { id: defaultBrandId } } : { disconnect: true },
      }),
      ...(defaultCategoryId !== undefined && {
        defaultCategory: defaultCategoryId ? { connect: { id: defaultCategoryId } } : { disconnect: true },
      }),
    } as never);
    await recordAudit({ entityType: 'ScraperSource', entityId: id, action: 'UPDATE', changedFields: input });
    return source;
  },

  async removeSource(id: string) {
    await this.getSourceById(id);
    const result = await scraperRepository.softDeleteSource(id);
    await recordAudit({ entityType: 'ScraperSource', entityId: id, action: 'DELETE' });
    return result;
  },

  // הפעולה היחידה שיכולה להעביר tosStatus ל-APPROVED. נפרדת
  // מ-updateSource במכוון — זו החלטה שצריכה תיעוד מפורש של מי
  // אישר ומתי, לא רק "שדה שהשתנה" בתוך PATCH כללי.
  async reviewTos(id: string, input: ReviewTosInput) {
    await this.getSourceById(id);
    logger.info({ sourceId: id, status: input.status, reviewedBy: input.reviewedBy }, 'ToS review recorded');
    const source = await scraperRepository.updateSource(id, {
      tosStatus: input.status,
      tosReviewedBy: input.reviewedBy,
      tosReviewedAt: new Date(),
      tosNotes: input.notes,
      // דחיית ToS מכבה את המקור אוטומטית — אי אפשר להישאר "פעיל
      // ודחוי" בו-זמנית.
      ...(input.status === 'REJECTED' && { isActive: false }),
    });
    await recordAudit({
      entityType: 'ScraperSource',
      entityId: id,
      action: 'UPDATE',
      changedFields: { tosStatus: input.status, notes: input.notes },
      performedBy: input.reviewedBy,
    });
    return source;
  },

  // הפעלה בפועל: חסומה אם ToS לא אושר. זה השער השני (הראשון הוא
  // findRunnableSources שה-Runner משתמש בו) — הגנה כפולה במכוון.
  async activate(id: string) {
    const source = await this.getSourceById(id);
    if (source.tosStatus !== 'APPROVED') {
      throw AppError.validation('Cannot activate a source whose ToS has not been approved');
    }
    const updated = await scraperRepository.updateSource(id, { isActive: true });
    await recordAudit({ entityType: 'ScraperSource', entityId: id, action: 'ACTIVATE' });
    return updated;
  },

  async deactivate(id: string) {
    await this.getSourceById(id);
    const updated = await scraperRepository.updateSource(id, { isActive: false });
    await recordAudit({ entityType: 'ScraperSource', entityId: id, action: 'DEACTIVATE' });
    return updated;
  },

  // ---------- הרצת סריקה ----------
  //
  // הערה (שלב 5, ב.5.3): "מריץ את כל המקורות המוכנים בבת אחת" הוסר
  // מכאן — הפונקציה הזו הייתה קיימת ולא נקראה, והיא לא יכולה לכבד
  // את scheduleCron הפרטני של כל מקור (מקור עם "0 3 * * *" ומקור
  // עם "0 */6 * * *" חייבים לרוץ בקצב שונה, לא באותו tick חיצוני).
  // התזמון האמיתי חי ב-scheduler.ts: job נפרד לכל מקור עם ה-cron
  // string שלו, לא קריאה גורפת אחת.

  async runSource(sourceId: string) {
    const source = await this.getSourceById(sourceId);

    if (!source.isActive || source.tosStatus !== 'APPROVED') {
      throw AppError.validation('Source is not runnable (inactive or ToS not approved)');
    }

    // בדיקת robots.txt כרשת ביטחון טכנית נוספת, גם אחרי אישור ToS
    // אנושי — האתר יכול לעדכן robots.txt בכל רגע בלי שהמנהל ידע.
    const robotsResult = await robotsChecker.isAllowed(source.baseUrl, '/');
    if (!robotsResult.allowed) {
      logger.warn({ sourceId, reason: robotsResult.reason }, 'Scraper run blocked by robots.txt');
      throw AppError.validation(`Blocked by robots.txt: ${robotsResult.reason}`);
    }

    const run = await scraperRepository.createRun(sourceId);
    let itemsFound = 0;
    let itemsCreated = 0;
    let itemsUpdated = 0;
    let itemsFlagged = 0;
    let itemsSkipped = 0;

    try {
      // הערה: fetchRawItems הוא ה"מנוע" בפועל (HTTP+cheerio או
      // Playwright, לפי source.renderMode) — לא ממומש בשלב הזה,
      // מסומן כ-TODO תשתיתי. הלוגיקה שמסביבו (matching, confidence,
      // ניהול run) היא הליבה שממומשת ומוכנה כבר עכשיו.
      const fetched = await this.fetchRawItems(source);
      const rawItems: RawScrapedFields[] = fetched.items;
      itemsFound = rawItems.length;
      itemsSkipped = fetched.skipped;

      for (const fields of rawItems) {
        const outcome = await this.processScrapedItem(source, run.id, fields);
        if (outcome === 'CREATED') itemsCreated++;
        if (outcome === 'UPDATED') itemsUpdated++;
        if (outcome === 'FLAGGED') itemsFlagged++;
      }

      // ריצה שדילגה על כל מה שמצאה אינה הצלחה: זו החתימה של selector
      // שנשבר אחרי שינוי מבנה באתר המקור. בלי הסימון הזה היא נראית
      // בדיוק כמו "אין הטבות חדשות". סיבה 3 מתוך שלוש ההתראות
      // שאושרו (א.2) — המנהל צריך לדעת בלי לגלות בעצמו.
      const allSkipped = itemsSkipped > 0 && itemsFound === 0;
      const status = allSkipped ? 'PARTIAL' : 'SUCCESS';
      if (allSkipped) {
        logger.warn(
          { sourceId, runId: run.id, itemsSkipped },
          'Scraper run skipped every card it found — selectors are probably broken'
        );
        await scraperAlerts.selectorsLikelyBroken({ sourceName: source.name, itemsSkipped, runId: run.id });
      }

      const finished = await scraperRepository.finishRun(run.id, {
        status,
        itemsFound,
        itemsCreated,
        itemsUpdated,
        itemsFlagged,
        itemsSkipped,
        ...(allSkipped && {
          errorMessage: `נמצאו ${itemsSkipped} כרטיסים בדף, אך אף אחד לא הכיל כותרת ומזהה תקינים — ייתכן שה-selectors אינם תואמים עוד למבנה האתר`,
        }),
      });
      await scraperRepository.updateSource(sourceId, { lastRunAt: new Date(), lastRunStatus: status });
      return finished;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const failed = await scraperRepository.finishRun(run.id, {
        status: 'FAILED',
        itemsFound,
        itemsCreated,
        itemsUpdated,
        itemsFlagged,
        itemsSkipped,
        errorMessage,
      });
      await scraperRepository.updateSource(sourceId, { lastRunAt: new Date(), lastRunStatus: 'FAILED' });
      logger.error({ sourceId, runId: run.id, err }, 'Scraper run failed');
      // סיבה 2 מתוך שלוש ההתראות שאושרו — ריצה שנכשלה בחריגה.
      await scraperAlerts.runFailed({ sourceName: source.name, errorMessage, runId: failed.id });

      // נזרק ולא נבלע: קודם לכן הכשל הוחזר כתשובת 200 רגילה, והמנהל
      // קיבל מסך ירוק על ריצה שנכשלה. פרטי הריצה נשמרים ב-details
      // כדי שהדשבורד יוכל להציג מה בדיוק קרה.
      throw new AppError('SCRAPER_RUN_FAILED', `Scraper run failed: ${errorMessage}`, 500, {
        runId: failed.id,
        itemsFound,
        itemsUpdated,
        itemsFlagged,
        itemsSkipped,
        errorMessage,
      });
    }
  },

  // מטפל בפריט בודד: matching -> confidence -> יצירת ScrapedItem ->
  // אם confidence מספיק גבוה, פרסום/עדכון אוטומטי; אחרת תור בדיקה.
  // source מועבר במלואו (לא רק sourceId) כי צריך לקרוא ממנו את
  // עוגן השיוך האוטומטי (defaultProgramId/defaultBrandId/defaultCategoryId).
  async processScrapedItem(
    source: ScraperSourceAnchor & { id: string; name: string },
    runId: string,
    fields: RawScrapedFields
  ): Promise<'CREATED' | 'UPDATED' | 'FLAGGED' | 'SKIPPED'> {
    const sourceId = source.id;
    const matchResult = await matchingService.match(sourceId, fields);

    if (matchResult.kind === 'UNCHANGED') return 'SKIPPED';

    const previousBenefit =
      matchResult.kind === 'UPDATE' ? await prisma.benefit.findUnique({ where: { id: matchResult.benefitId } }) : null;
    const previousValue = previousBenefit?.discountValue ? Number(previousBenefit.discountValue) : undefined;

    const confidence = confidenceService.calculate(matchResult, fields, previousValue);
    const autoScopeOk = hasAutoScopeAnchor(source);
    const autoPublish = confidenceService.shouldAutoPublish(confidence, matchResult, autoScopeOk);

    // אם NEW נחסם רק בגלל היעדר עוגן שיוך (לא ציון נמוך), זו הסיבה
    // האמיתית שהמנהל צריך לראות — הן בדשבורד (confidenceReasons)
    // והן במייל. מחושב לפני היצירה כדי ששני הערוצים יציגו אותו דבר.
    const missingAnchor = matchResult.kind === 'NEW' && !autoScopeOk;
    const reasons = missingAnchor
      ? [...confidence.reasons, 'אין למקור עוגן שיוך (מועדון/מותג + קטגוריה) — לא ניתן לפרסם אוטומטית']
      : confidence.reasons;

    // מופעים קודמים של אותו פריט שעדיין ממתינים להכרעה כבר לא
    // רלוונטיים — המופע שנוצר עכשיו מחליף אותם. בלי זה, סריקה
    // יומית של פריט שלא טופל הייתה מוסיפה שורה לתור בכל יום.
    await scraperRepository.supersedePendingItems(sourceId, fields.externalId);

    const item = await scraperRepository.createItem({
      source: { connect: { id: sourceId } },
      run: { connect: { id: runId } },
      externalId: fields.externalId,
      rawData: fields as never,
      confidenceScore: confidence.score,
      confidenceReasons: reasons,
      status: autoPublish ? 'AUTO_PUBLISHED' : 'PENDING_REVIEW',
      ...(matchResult.kind === 'UPDATE' && { matchedBenefit: { connect: { id: matchResult.benefitId } } }),
    });

    if (autoPublish) {
      if (matchResult.kind === 'UPDATE') {
        await this.applyUpdate(matchResult.benefitId, fields, item.id);
        return 'UPDATED';
      }
      // NEW + autoPublish: אפשרי רק כש-autoScopeOk הוא true (ראו
      // shouldAutoPublish) — יש עוגן שיוך תקין, אז יוצרים את ההטבה
      // במלואה כולל BenefitScope, בלי אדם בלולאה.
      const created = await this.createBenefitFromScrapedItem(source, fields, item.id);
      await scraperRepository.updateItemStatus(item.id, { status: 'AUTO_PUBLISHED', matchedBenefitId: created.id });
      return 'CREATED';
    }

    // כל מה שנשאר: NEW בלי עוגן שיוך, או ציון מתחת לסף. סיבה 1
    // מתוך שלוש ההתראות שאושרו — פריט שנכנס לתור הבדיקה.
    await scraperAlerts.itemFlagged({
      sourceName: source.name,
      title: fields.title,
      confidenceScore: confidence.score,
      confidenceReasons: reasons,
      scrapedItemId: item.id,
    });
    return 'FLAGGED';
  },

  // יוצר Benefit חדש מתוך פריט שעבר את סף הביטחון ויש לו עוגן שיוך
  // תקין, כולל שורת BenefitScope. משותף בין המסלול האוטומטי (כאן)
  // לאישור הידני (reviewItem) כדי שהשיוך לא יישכח באחד מהם.
  async createBenefitFromScrapedItem(
    source: ScraperSourceAnchor,
    fields: RawScrapedFields,
    scrapedItemId: string,
    categoryIdOverride?: string
  ) {
    const categoryId = categoryIdOverride ?? source.defaultCategoryId;
    if (!categoryId) {
      throw AppError.validation('categoryId is required when approving a new benefit');
    }
    const valueScore = await benefitService.computeValueScore({
      benefitType: 'OTHER',
      discountValue: fields.discountValue,
      categoryId,
    });
    // scopeRow ריק (למקור אין defaultProgramId וגם לא defaultBrandId)
    // אומר "אין ממה לגזור שיוך" — לא "שייך לכולם". יצירת שורת scope
    // עם כל השדות null הייתה עושה בדיוק את הטעות ההפוכה, ולכן
    // מדלגים על .create כשהוא ריק ומשאירים את ההטבה בלי scope (פער
    // ידוע: המנהל משלים שיוך בעריכת ההטבה, ראו ScopeEditor).
    const scopeRow = buildAutoScopeRow(source);
    const hasScope = Object.keys(scopeRow).length > 0;

    return prisma.benefit.create({
      data: {
        slug: matchingService.slugify(fields.title),
        title: fields.title,
        shortDescription: fields.shortDescription ?? fields.title,
        category: { connect: { id: categoryId } },
        benefitType: 'OTHER',
        discountValue: fields.discountValue,
        imageUrl: fields.imageUrl,
        valueScore,
        isActive: true,
        sourceMetadata: { title: { source: 'scraper', scrapedItemId } },
        lastScrapedItem: { connect: { id: scrapedItemId } },
        ...(hasScope && { scopes: { create: scopeRow } }),
      },
    });
  },

  // מעדכן הטבה קיימת מתוצאת סריקה, כולל תיעוד sourceMetadata לכל
  // שדה שהשתנה — זו המימוש בפועל של "לדעת מאיפה כל שדה הגיע".
  async applyUpdate(benefitId: string, fields: RawScrapedFields, scrapedItemId: string) {
    const provenance = {
      source: 'scraper',
      scrapedItemId,
      scrapedAt: new Date().toISOString(),
    };
    // מוצהר כ-Prisma.JsonObject (ולא Record<string, unknown>) כדי
    // שההשמה ל-benefit.update תעבור typecheck בלי cast.
    const sourceMetadata: Prisma.JsonObject = {};
    if (fields.title !== undefined) sourceMetadata.title = provenance;
    if (fields.shortDescription !== undefined) sourceMetadata.shortDescription = provenance;
    if (fields.discountValue !== undefined) sourceMetadata.discountValue = provenance;

    // valueScore מחושב מחדש כשערך ההנחה השתנה, בדיוק כמו בעדכון
    // ידני מהדשבורד. בלי זה הטבה שהסורק שיפר מ-10% ל-50% הייתה
    // נשארת עם הציון הישן ושוקעת במיון בזמן שהיא הטובה במערכת —
    // וזה קורה במסלול האוטומטי, בלי שאף אחד רואה.
    // שאר הפרמטרים נלקחים מההטבה הקיימת: הסורק מספק רק ערך הנחה.
    let valueScore: number | undefined;
    if (fields.discountValue !== undefined) {
      const existing = await prisma.benefit.findUnique({ where: { id: benefitId } });
      if (existing) {
        valueScore = await benefitService.computeValueScore({
          benefitType: existing.benefitType,
          discountValue: fields.discountValue,
          discountUnit: existing.discountUnit ?? undefined,
          minPurchaseAmount: existing.minPurchaseAmount ? Number(existing.minPurchaseAmount) : undefined,
          categoryId: existing.categoryId,
        });
      }
    }

    await prisma.benefit.update({
      where: { id: benefitId },
      data: {
        ...(fields.title !== undefined && { title: fields.title }),
        ...(fields.shortDescription !== undefined && { shortDescription: fields.shortDescription }),
        ...(fields.discountValue !== undefined && { discountValue: fields.discountValue }),
        ...(fields.imageUrl !== undefined && { imageUrl: fields.imageUrl }),
        ...(valueScore !== undefined && { valueScore }),
        sourceMetadata,
        lastScrapedItem: { connect: { id: scrapedItemId } },
      },
    });
  },

  // מימוש renderMode=HTTP בלבד (axios+cheerio). HEADLESS_BROWSER
  // (Playwright) יתווסף בנפרד אם/כשיידרש — לא נכשל, רק מדלג עם אזהרה
  // בלוג, כדי ש-runSource ידע בבירור שהמקור לא הופעל בגלל renderMode
  // ולא בגלל שגיאה.
  async fetchRawItems(source: {
    baseUrl: string;
    renderMode: string;
    scrapeConfig: unknown;
    requestDelayMs: number;
  }): Promise<{ items: RawScrapedFields[]; skipped: number }> {
    if (source.renderMode !== 'HTTP') {
      logger.warn({ renderMode: source.renderMode }, 'fetchRawItems: renderMode not supported yet, skipping run');
      return { items: [], skipped: 0 };
    }

    const config = source.scrapeConfig as ScrapeConfig;
    const maxPages = config.maxPages ?? 1;
    const results: RawScrapedFields[] = [];
    // כרטיסים שנמצאו בדף אך חסרו בהם שדות חובה. נספר ומדווח, כדי
    // שאפשר יהיה להבחין בין "אין הטבות" לבין "ה-selector נשבר".
    let skipped = 0;

    for (let page = 1; page <= maxPages; page++) {
      const pageUrl = new URL(source.baseUrl);
      if (page > 1 && config.paginationParam) {
        pageUrl.searchParams.set(config.paginationParam, String(page));
      }

      // robots.txt נבדק פר-דף בפועל (לא רק '/' כמו ב-runSource) — עמוד
      // 2+ עם query params יכול תיאורטית להיות אסור בנפרד.
      const robotsResult = await robotsChecker.isAllowed(source.baseUrl, pageUrl.pathname + pageUrl.search);
      if (!robotsResult.allowed) {
        logger.warn({ url: pageUrl.toString(), reason: robotsResult.reason }, 'Page blocked by robots.txt, stopping pagination');
        break;
      }

      let html: string;
      try {
        const response = await axios.get<string>(pageUrl.toString(), {
          timeout: 10000,
          headers: { 'User-Agent': 'BenefitsWalletBot/1.0 (+scraper)' },
        });
        html = response.data;
      } catch (err) {
        logger.warn({ url: pageUrl.toString(), err }, 'Failed to fetch page, stopping pagination');
        break;
      }

      const $ = cheerio.load(html);
      const items = $(config.listSelector);
      if (items.length === 0) break; // אין עוד פריטים — מניחים שהגענו לסוף הדפדוף

      items.each((_, el) => {
        const $item = $(el);
        const title = extractField($item, config.fields.title);
        const externalId = extractField($item, config.fields.externalId);
        if (!title || !externalId) {
          // שדות חובה חסרים — מדלגים על כרטיס פגום, אך סופרים אותו.
          skipped++;
          return;
        }

        const imageUrl = resolveUrl(extractField($item, config.fields.imageUrl), source.baseUrl);
        const detailUrl = resolveUrl(extractField($item, config.fields.detailUrl), source.baseUrl);

        results.push({
          title,
          externalId,
          shortDescription: extractField($item, config.fields.shortDescription),
          discountValue: parseDiscountValue(extractField($item, config.fields.discountValue)),
          ...(imageUrl && { imageUrl }),
          ...(detailUrl && { detailUrl }),
        });
      });

      // מכבד requestDelayMs בין בקשות — רק כשבאמת עוד עמוד בדרך, לא
      // אחרי העמוד האחרון.
      if (page < maxPages) await sleep(source.requestDelayMs);
    }

    if (skipped > 0) {
      logger.warn(
        { baseUrl: source.baseUrl, skipped, extracted: results.length },
        'Some scraped cards were missing required fields and were skipped'
      );
    }

    return { items: results, skipped };
  },

  // ---------- ScrapedItem: תור בדיקה ----------

  async listItems(query: ListScrapedItemsQuery, page: number, pageSize: number) {
    const { items, total } = await scraperRepository.findItems(query, (page - 1) * pageSize, pageSize);
    return { items, meta: { page, pageSize, total } };
  },

  async getItemById(id: string) {
    const item = await scraperRepository.findItemById(id);
    if (!item) throw AppError.notFound('ScrapedItem', id);
    return item;
  },

  // החלטת מנהל בתור הבדיקה: אישור (כולל תיקוני overrides) או דחייה.
  async reviewItem(id: string, input: ReviewScrapedItemInput) {
    const item = await this.getItemById(id);

    if (input.decision === 'REJECT') {
      const rejected = await scraperRepository.updateItemStatus(id, { status: 'REJECTED', reviewedBy: input.reviewedBy });
      await recordAudit({
        entityType: 'ScrapedItem',
        entityId: id,
        action: 'UPDATE',
        changedFields: { decision: 'REJECT' },
        performedBy: input.reviewedBy,
      });
      return rejected;
    }

    const rawData = item.rawData as unknown as RawScrapedFields;
    const fields = { ...rawData, ...input.overrides };

    if (item.matchedBenefitId) {
      await this.applyUpdate(item.matchedBenefitId, fields, item.id);
    } else {
      // אישור הטבה חדשה: יוצרים אותה בפועל כעת, לא בזמן הסריקה.
      // categoryId הוא חובה ב-Benefit — המנהל מספק אותו כ-override
      // אלא אם למקור יש defaultCategoryId (אז זו ברירת המחדל).
      const source = await this.getSourceById(item.sourceId);
      const categoryId = input.overrides?.categoryId ?? source.defaultCategoryId ?? undefined;

      // אותו נתיב יצירה שהמסלול האוטומטי משתמש בו — כולל חישוב
      // valueScore, יצירת BenefitScope מעוגן המקור אם יש (ואם אין —
      // בלי scope, והמנהל משלים שיוך בעריכת ההטבה, ראו ב.5.2),
      // וקישור matchedBenefitId ולא רק lastScrapedItemId (שני
      // relations נפרדים; בלעדי matchedBenefitId מנוע ההתאמה נופל
      // לחיפוש לפי slug בריצה הבאה ועלול ליצור הטבה כפולה).
      const created = await this.createBenefitFromScrapedItem(source, fields, item.id, categoryId);

      await scraperRepository.updateItemStatus(id, {
        status: 'APPROVED',
        reviewedBy: input.reviewedBy,
        matchedBenefitId: created.id,
      });
      await recordAudit({
        entityType: 'ScrapedItem',
        entityId: id,
        action: 'UPDATE',
        changedFields: { decision: 'APPROVE', createdBenefitId: created.id },
        performedBy: input.reviewedBy,
      });
      return created;
    }

    const approved = await scraperRepository.updateItemStatus(id, { status: 'APPROVED', reviewedBy: input.reviewedBy });
    await recordAudit({
      entityType: 'ScrapedItem',
      entityId: id,
      action: 'UPDATE',
      changedFields: { decision: 'APPROVE', updatedBenefitId: item.matchedBenefitId },
      performedBy: input.reviewedBy,
    });
    return approved;
  },
};
