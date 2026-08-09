import axios from 'axios';
import * as cheerio from 'cheerio';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/AppError';
import { logger } from '../../lib/logger';
import { scraperRepository } from './scraper.repository';
import { robotsChecker } from './robotsChecker';
import { matchingService, type RawScrapedFields } from './matching.service';
import { confidenceService } from './confidence.service';
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
    const { defaultProgramId, defaultBrandId, ...rest } = input;
    // מקור חדש נוצר תמיד לא-פעיל ו-PENDING_REVIEW — אין דרך לעקוף
    // את זה דרך ה-DTO, כי isActive/tosStatus לא נכללים בו כלל.
    return scraperRepository.createSource({
      ...rest,
      isActive: false,
      tosStatus: 'PENDING_REVIEW',
      ...(defaultProgramId && { defaultProgram: { connect: { id: defaultProgramId } } }),
      ...(defaultBrandId && { defaultBrand: { connect: { id: defaultBrandId } } }),
    } as never);
  },

  async updateSource(id: string, input: UpdateScraperSourceInput) {
    await this.getSourceById(id);
    const { defaultProgramId, defaultBrandId, ...rest } = input;
    return scraperRepository.updateSource(id, {
      ...rest,
      ...(defaultProgramId !== undefined && {
        defaultProgram: defaultProgramId ? { connect: { id: defaultProgramId } } : { disconnect: true },
      }),
      ...(defaultBrandId !== undefined && {
        defaultBrand: defaultBrandId ? { connect: { id: defaultBrandId } } : { disconnect: true },
      }),
    } as never);
  },

  async removeSource(id: string) {
    await this.getSourceById(id);
    return scraperRepository.softDeleteSource(id);
  },

  // הפעולה היחידה שיכולה להעביר tosStatus ל-APPROVED. נפרדת
  // מ-updateSource במכוון — זו החלטה שצריכה תיעוד מפורש של מי
  // אישר ומתי, לא רק "שדה שהשתנה" בתוך PATCH כללי.
  async reviewTos(id: string, input: ReviewTosInput) {
    await this.getSourceById(id);
    logger.info({ sourceId: id, status: input.status, reviewedBy: input.reviewedBy }, 'ToS review recorded');
    return scraperRepository.updateSource(id, {
      tosStatus: input.status,
      tosReviewedBy: input.reviewedBy,
      tosReviewedAt: new Date(),
      tosNotes: input.notes,
      // דחיית ToS מכבה את המקור אוטומטית — אי אפשר להישאר "פעיל
      // ודחוי" בו-זמנית.
      ...(input.status === 'REJECTED' && { isActive: false }),
    });
  },

  // הפעלה בפועל: חסומה אם ToS לא אושר. זה השער השני (הראשון הוא
  // findRunnableSources שה-Runner משתמש בו) — הגנה כפולה במכוון.
  async activate(id: string) {
    const source = await this.getSourceById(id);
    if (source.tosStatus !== 'APPROVED') {
      throw AppError.validation('Cannot activate a source whose ToS has not been approved');
    }
    return scraperRepository.updateSource(id, { isActive: true });
  },

  async deactivate(id: string) {
    await this.getSourceById(id);
    return scraperRepository.updateSource(id, { isActive: false });
  },

  // ---------- הרצת סריקה ----------

  // מריץ את כל המקורות שעברו את שני השערים (isActive + tosStatus
  // APPROVED). זו נקודת הכניסה שה-Cron היומי קורא לה.
  async runAllDueSources() {
    const sources = await scraperRepository.findRunnableSources();
    const results = [];
    for (const source of sources) {
      results.push(await this.runSource(source.id));
    }
    return results;
  },

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

    try {
      // הערה: fetchRawItems הוא ה"מנוע" בפועל (HTTP+cheerio או
      // Playwright, לפי source.renderMode) — לא ממומש בשלב הזה,
      // מסומן כ-TODO תשתיתי. הלוגיקה שמסביבו (matching, confidence,
      // ניהול run) היא הליבה שממומשת ומוכנה כבר עכשיו.
      const rawItems: RawScrapedFields[] = await this.fetchRawItems(source);
      itemsFound = rawItems.length;

      for (const fields of rawItems) {
        const outcome = await this.processScrapedItem(source.id, run.id, fields);
        if (outcome === 'CREATED') itemsCreated++;
        if (outcome === 'UPDATED') itemsUpdated++;
        if (outcome === 'FLAGGED') itemsFlagged++;
      }

      await scraperRepository.finishRun(run.id, {
        status: 'SUCCESS',
        itemsFound,
        itemsCreated,
        itemsUpdated,
        itemsFlagged,
      });
      await scraperRepository.updateSource(sourceId, { lastRunAt: new Date(), lastRunStatus: 'SUCCESS' });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await scraperRepository.finishRun(run.id, {
        status: 'FAILED',
        itemsFound,
        itemsCreated,
        itemsUpdated,
        itemsFlagged,
        errorMessage,
      });
      await scraperRepository.updateSource(sourceId, { lastRunAt: new Date(), lastRunStatus: 'FAILED' });
      logger.error({ sourceId, runId: run.id, err }, 'Scraper run failed');
    }

    return scraperRepository.findRunsBySource(sourceId, 1);
  },

  // מטפל בפריט בודד: matching -> confidence -> יצירת ScrapedItem ->
  // אם confidence מספיק גבוה, פרסום/עדכון אוטומטי; אחרת תור בדיקה.
  async processScrapedItem(
    sourceId: string,
    runId: string,
    fields: RawScrapedFields
  ): Promise<'CREATED' | 'UPDATED' | 'FLAGGED' | 'SKIPPED'> {
    const matchResult = await matchingService.match(sourceId, fields);

    if (matchResult.kind === 'UNCHANGED') return 'SKIPPED';

    const previousBenefit =
      matchResult.kind === 'UPDATE' ? await prisma.benefit.findUnique({ where: { id: matchResult.benefitId } }) : null;
    const previousValue = previousBenefit?.discountValue ? Number(previousBenefit.discountValue) : undefined;

    const confidence = confidenceService.calculate(matchResult, fields, previousValue);
    const autoPublish = confidenceService.shouldAutoPublish(confidence, matchResult);

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
      confidenceReasons: confidence.reasons,
      status: autoPublish ? 'AUTO_PUBLISHED' : 'PENDING_REVIEW',
      ...(matchResult.kind === 'UPDATE' && { matchedBenefit: { connect: { id: matchResult.benefitId } } }),
    });

    if (!autoPublish) return 'FLAGGED';

    if (matchResult.kind === 'UPDATE') {
      await this.applyUpdate(matchResult.benefitId, fields, item.id);
      return 'UPDATED';
    }

    // matchResult.kind === 'NEW' אף פעם לא מגיע ל-autoPublish=true
    // (ראו confidenceService.shouldAutoPublish) — משאיר את הענף הזה
    // כ-safety net מפורש ולא כ-unreachable שקט.
    return 'SKIPPED';
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

    await prisma.benefit.update({
      where: { id: benefitId },
      data: {
        ...(fields.title !== undefined && { title: fields.title }),
        ...(fields.shortDescription !== undefined && { shortDescription: fields.shortDescription }),
        ...(fields.discountValue !== undefined && { discountValue: fields.discountValue }),
        ...(fields.imageUrl !== undefined && { imageUrl: fields.imageUrl }),
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
  }): Promise<RawScrapedFields[]> {
    if (source.renderMode !== 'HTTP') {
      logger.warn({ renderMode: source.renderMode }, 'fetchRawItems: renderMode not supported yet, skipping run');
      return [];
    }

    const config = source.scrapeConfig as ScrapeConfig;
    const maxPages = config.maxPages ?? 1;
    const results: RawScrapedFields[] = [];

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
        if (!title || !externalId) return; // שדות חובה חסרים — מדלגים על כרטיס פגום

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

    return results;
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
      return scraperRepository.updateItemStatus(id, { status: 'REJECTED', reviewedBy: input.reviewedBy });
    }

    const rawData = item.rawData as unknown as RawScrapedFields;
    const fields = { ...rawData, ...input.overrides };

    if (item.matchedBenefitId) {
      await this.applyUpdate(item.matchedBenefitId, fields, item.id);
    } else {
      // אישור הטבה חדשה: יוצרים אותה בפועל כעת, לא בזמן הסריקה.
      // categoryId הוא חובה ב-Benefit ואינו חלק מ-scrapeConfig
      // הבסיסי — המנהל נדרש לספק אותו כ-override באישור.
      if (!input.overrides?.categoryId) {
        throw AppError.validation('categoryId is required when approving a new benefit');
      }
      const created = await prisma.benefit.create({
        data: {
          slug: matchingService.slugify(fields.title),
          title: fields.title,
          shortDescription: fields.shortDescription ?? fields.title,
          category: { connect: { id: input.overrides.categoryId } },
          benefitType: 'OTHER',
          discountValue: fields.discountValue,
          imageUrl: fields.imageUrl,
          isActive: true,
          sourceMetadata: { title: { source: 'scraper', scrapedItemId: item.id } },
          lastScrapedItem: { connect: { id: item.id } },
        },
      });
      // matchedBenefitId — ולא רק lastScrapedItemId על ההטבה. אלה
      // שני relations נפרדים, ומנוע ההתאמה בודק דווקא את זה: בלעדיו
      // הפריט נשאר "לא מקושר" לנצח, הזיהוי לפי externalId לא תופס,
      // והמנוע נופל לחיפוש לפי slug של הכותרת — כך ששינוי קטן
      // בכותרת באתר המקור יוצר הטבה כפולה.
      await scraperRepository.updateItemStatus(id, {
        status: 'APPROVED',
        reviewedBy: input.reviewedBy,
        matchedBenefitId: created.id,
      });
      return created;
    }

    return scraperRepository.updateItemStatus(id, { status: 'APPROVED', reviewedBy: input.reviewedBy });
  },
};
