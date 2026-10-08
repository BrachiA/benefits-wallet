import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { EXTENSION_ANCHOR_SLUG } from './extensionIngest.dto';
import type { ListScraperSourcesQuery, ListScrapedItemsQuery } from './scraper.dto';

export const scraperRepository = {
  // ---------- ScraperSource ----------

  async findSources(query: ListScraperSourcesQuery, skip: number, take: number) {
    const where: Prisma.ScraperSourceWhereInput = {
      deletedAt: null,
      // עוגן ה-FK הטכני של תוסף Chrome (extensionIngest.service) אינו
      // "מקור סריקה" מבחינת הדשבורד — אין לו scrapeConfig אמיתי, אין
      // טעם לאשר לו ToS או להפעילו דרך המסכים האלה. מוסתר מכל רשימה.
      slug: { not: EXTENSION_ANCHOR_SLUG },
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.tosStatus && { tosStatus: query.tosStatus }),
    };
    const [items, total] = await Promise.all([
      prisma.scraperSource.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.scraperSource.count({ where }),
    ]);
    return { items, total };
  },

  async findSourceById(id: string) {
    return prisma.scraperSource.findFirst({ where: { id, deletedAt: null } });
  },

  // מקורות שמותר להריץ בפועל כרגע: פעילים + ToS מאושר. זו שאילתת
  // השער היחידה שה-Runner מותר לו להשתמש בה כדי לבחור מה להריץ —
  // כל דרך אחרת לאתר מקורות עוקפת את הבדיקה האתית-חוקית.
  async findRunnableSources() {
    return prisma.scraperSource.findMany({
      where: { deletedAt: null, isActive: true, tosStatus: 'APPROVED' },
    });
  },

  async createSource(data: Prisma.ScraperSourceCreateInput) {
    return prisma.scraperSource.create({ data });
  },

  async updateSource(id: string, data: Prisma.ScraperSourceUpdateInput) {
    return prisma.scraperSource.update({ where: { id }, data });
  },

  async softDeleteSource(id: string) {
    return prisma.scraperSource.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  },

  // ---------- ScraperRun ----------

  async createRun(sourceId: string) {
    return prisma.scraperRun.create({ data: { sourceId, status: 'PARTIAL' } });
  },

  async finishRun(
    runId: string,
    data: {
      status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
      itemsFound: number;
      itemsCreated: number;
      itemsUpdated: number;
      itemsFlagged: number;
      itemsSkipped?: number;
      errorMessage?: string;
    }
  ) {
    return prisma.scraperRun.update({ where: { id: runId }, data: { ...data, finishedAt: new Date() } });
  },

  async findRunsBySource(sourceId: string, take = 20) {
    return prisma.scraperRun.findMany({ where: { sourceId }, orderBy: { startedAt: 'desc' }, take });
  },

  // ---------- ScrapedItem ----------

  // המפתח לזיהוי "ראינו כבר": לא לפי טקסט, לפי (sourceId, externalId).
  // מאז שהטבלה היא יומן אירועים יש כמה שורות לאותו מפתח, ולכן
  // findFirst עם מיון יורד — המופע האחרון הוא זה שמשקף את מצב
  // הפריט, וכל מה שלפניו הוא היסטוריה.
  async findLatestByExternalId(sourceId: string, externalId: string) {
    return prisma.scrapedItem.findFirst({
      where: { sourceId, externalId },
      orderBy: { scrapedAt: 'desc' },
    });
  },

  async createItem(data: Prisma.ScrapedItemCreateInput) {
    return prisma.scrapedItem.create({ data });
  },

  // כשפריט נראה שוב בזמן שמופע קודם שלו עדיין ממתין להכרעה,
  // המופע הישן מסומן SUPERSEDED. הרשומה נשמרת ביומן אך יוצאת
  // מתור הבדיקה — אחרת סריקה יומית הייתה מוסיפה שורה נוספת לתור
  // בכל יום שבו המנהל לא הספיק לטפל בפריט.
  async supersedePendingItems(sourceId: string, externalId: string) {
    return prisma.scrapedItem.updateMany({
      where: { sourceId, externalId, status: 'PENDING_REVIEW' },
      data: { status: 'SUPERSEDED' },
    });
  },

  async findItems(query: ListScrapedItemsQuery, skip: number, take: number) {
    const where: Prisma.ScrapedItemWhereInput = {
      ...(query.sourceId && { sourceId: query.sourceId }),
      ...(query.status && { status: query.status }),
    };
    const [items, total] = await Promise.all([
      prisma.scrapedItem.findMany({
        where,
        skip,
        take,
        orderBy: { scrapedAt: 'desc' },
        include: { source: true, matchedBenefit: true },
      }),
      prisma.scrapedItem.count({ where }),
    ]);
    return { items, total };
  },

  async findItemById(id: string) {
    return prisma.scrapedItem.findUnique({
      where: { id },
      include: { source: true, matchedBenefit: true, run: true, aiSuggestedCategory: true },
    });
  },

  async updateItemStatus(
    id: string,
    data: {
      status: 'AUTO_PUBLISHED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED';
      reviewedBy?: string;
      // נקבע כשאישור ידני יוצר הטבה חדשה: בלעדיו הפריט נשאר בלי
      // קישור להטבה, ומנוע ההתאמה לא מזהה אותו בריצה הבאה ונופל
      // לחיפוש לפי slug של הכותרת.
      matchedBenefitId?: string;
    }
  ) {
    return prisma.scrapedItem.update({
      where: { id },
      data: {
        status: data.status,
        ...(data.reviewedBy && { reviewedBy: data.reviewedBy, reviewedAt: new Date() }),
        ...(data.matchedBenefitId && { matchedBenefitId: data.matchedBenefitId }),
      },
    });
  },
};
