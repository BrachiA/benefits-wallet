import { prisma } from '../../lib/prisma';

export const duplicateCleanupRepository = {
  // ---------- ריצות יתומות ----------

  // ScraperRun אין לו מצב RUNNING — ריצה נחשבת יתומה כשהיא לא
  // הסתיימה (finishedAt ריק) והתחילה מזמן, מעבר לזמן שריצה אמיתית
  // אי-פעם לוקחת. ראו ORPHAN_STALE_HOURS ב-duplicateCleanup.service.
  async findStaleOpenRuns(startedBefore: Date) {
    return prisma.scraperRun.findMany({
      where: { finishedAt: null, startedAt: { lt: startedBefore } },
    });
  },

  async findPendingItemsByRun(runId: string) {
    return prisma.scrapedItem.findMany({
      where: { runId, status: 'PENDING_REVIEW' },
    });
  },

  // ---------- כפילויות סמנטיות ----------

  // מקורות עם פריטים "פתוחים" (עדיין לא שויכו להטבה קיימת — מועמדים
  // ליצירת הטבה חדשה) בחלון הימים האחרון — היקף הבדיקה נגזר מהם,
  // לא מכל מקור שאי-פעם נסרק.
  async findSourceIdsWithOpenItems(scrapedAfter: Date) {
    const rows = await prisma.scrapedItem.findMany({
      where: { scrapedAt: { gte: scrapedAfter }, matchedBenefitId: null },
      select: { sourceId: true },
      distinct: ['sourceId'],
    });
    return rows.map((row) => row.sourceId);
  },

  // מועמדים לכפילות בתוך מקור בודד: matchedBenefitId=null (עדיין לא
  // "נבלעו" להטבה קיימת), בחלון הימים האחרון. status כולל גם
  // APPROVED/AUTO_PUBLISHED כדי לתפוס גם את המקרה הגבולי (פריט כבר
  // אושר, ורק אז מתגלה שיש לו תאום כפול) — הפעולה על סטטוסים אלה
  // תמיד "סימון בלבד", לא SUPERSEDED אוטומטי, ראו duplicateCleanup.service.
  async findDuplicateCandidatesBySource(sourceId: string, scrapedAfter: Date) {
    return prisma.scrapedItem.findMany({
      where: {
        sourceId,
        matchedBenefitId: null,
        scrapedAt: { gte: scrapedAfter },
        status: { in: ['PENDING_REVIEW', 'APPROVED', 'AUTO_PUBLISHED'] },
      },
      orderBy: { scrapedAt: 'asc' },
    });
  },

  async markSuperseded(itemId: string) {
    return prisma.scrapedItem.update({ where: { id: itemId }, data: { status: 'SUPERSEDED' } });
  },

  // ---------- יומן פעולות (AuditLog, entityType ייעודי) ----------

  // entityType ייעודי ('DuplicateCleanupAction', לא 'ScrapedItem') —
  // כך שליפת היומן למסך הדשבורד היא שאילתה טריוויאלית (בלי לסמוך על
  // path filter בתוך Json), ואין סיכון להתנגש עם רשומות AuditLog
  // אחרות שכבר נכתבות היום עם entityType='ScrapedItem' (למשל reviewItem).
  // entityId עדיין מצביע על ה-ScrapedItem האמיתי.
  async findCleanupLog(skip: number, take: number) {
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { entityType: 'DuplicateCleanupAction' },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.auditLog.count({ where: { entityType: 'DuplicateCleanupAction' } }),
    ]);
    return { items, total };
  },

  // ---------- כותרות פריטים (להעשרת תצוגת היומן בדשבורד) ----------

  // ScrapedItem הוא יומן אירועים ולא נמחק אף פעם (ראו הערת המודל
  // ב-schema.prisma), אז entityId/pairedItemId שנשמרו ב-AuditLog
  // תמיד ניתנים לשליפה כאן — גם הרבה אחרי שהסטטוס שלהם השתנה.
  async findItemTitlesByIds(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await prisma.scrapedItem.findMany({
      where: { id: { in: ids } },
      select: { id: true, rawData: true },
    });
    const titleById = new Map<string, string>();
    for (const row of rows) {
      const raw = (row.rawData ?? {}) as Record<string, unknown>;
      titleById.set(row.id, typeof raw.title === 'string' ? raw.title : '(ללא כותרת)');
    }
    return titleById;
  },
};
