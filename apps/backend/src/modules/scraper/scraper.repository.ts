import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { ListScraperSourcesQuery, ListScrapedItemsQuery } from './scraper.dto';

export const scraperRepository = {
  // ---------- ScraperSource ----------

  async findSources(query: ListScraperSourcesQuery, skip: number, take: number) {
    const where: Prisma.ScraperSourceWhereInput = {
      deletedAt: null,
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
  async findByExternalId(sourceId: string, externalId: string) {
    return prisma.scrapedItem.findUnique({
      where: { sourceId_externalId: { sourceId, externalId } },
    });
  },

  async createItem(data: Prisma.ScrapedItemCreateInput) {
    return prisma.scrapedItem.create({ data });
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
      include: { source: true, matchedBenefit: true, run: true },
    });
  },

  async updateItemStatus(
    id: string,
    data: { status: 'AUTO_PUBLISHED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'; reviewedBy?: string }
  ) {
    return prisma.scrapedItem.update({
      where: { id },
      data: { ...data, ...(data.reviewedBy && { reviewedAt: new Date() }) },
    });
  },
};
