import { prisma } from '../../lib/prisma';

export const aiEnrichmentRepository = {
  // ---------- קטגוריזציה ----------

  // רק פריטי הטבה-חדשה (matchedBenefitId=null — עדכון כבר יש לו
  // categoryId דרך ההטבה הקיימת) ממקור בלי defaultCategoryId משלו
  // (אחרת ההצעה לעולם לא תשפיע — ראו scraper.service.createBenefitFromScrapedItem,
  // source.defaultCategoryId גובר על aiSuggestedCategoryId). aiCategorySuggestedAt
  // null = טרם נוסה בכלל.
  async findItemsNeedingCategory(limit: number) {
    return prisma.scrapedItem.findMany({
      where: {
        status: 'PENDING_REVIEW',
        matchedBenefitId: null,
        aiCategorySuggestedAt: null,
        source: { defaultCategoryId: null },
      },
      orderBy: { scrapedAt: 'asc' },
      take: limit,
    });
  },

  async findActiveCategories() {
    return prisma.category.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, slug: true, name: true },
      orderBy: { sortOrder: 'asc' },
    });
  },

  async markCategorySuggested(itemId: string, categoryId: string | null) {
    return prisma.scrapedItem.update({
      where: { id: itemId },
      data: { aiCategorySuggestedAt: new Date(), aiSuggestedCategoryId: categoryId },
    });
  },

  // ---------- אימות תמונה ----------

  async findItemsNeedingImageCheck(limit: number) {
    return prisma.scrapedItem.findMany({
      where: { status: 'PENDING_REVIEW', aiImageCheckedAt: null },
      orderBy: { scrapedAt: 'asc' },
      take: limit,
    });
  },

  async markImageChecked(itemId: string) {
    return prisma.scrapedItem.update({ where: { id: itemId }, data: { aiImageCheckedAt: new Date() } });
  },

  // ---------- סיכום עברי ----------

  async findItemsNeedingSummary(limit: number) {
    return prisma.scrapedItem.findMany({
      where: { status: 'PENDING_REVIEW', aiSummaryGeneratedAt: null },
      orderBy: { scrapedAt: 'asc' },
      take: limit,
    });
  },

  async saveSummary(itemId: string, summary: string | null) {
    return prisma.scrapedItem.update({
      where: { id: itemId },
      data: { aiSummaryGeneratedAt: new Date(), ...(summary && { aiSummary: summary }) },
    });
  },
};
