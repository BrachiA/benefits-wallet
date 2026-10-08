import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { prisma } from '../../src/lib/prisma';
import { createCategory, createRun, createScraperSource } from '../setup/factories';

// מוקאים רק את שלוש קריאות ה-Gemini (גבול הקריאה עצמה) — לא axios,
// שנשאר אמיתי (מבוקר per-test עם vi.spyOn, בדיוק כמו runSource.test.ts)
// כי חלק מהבדיקות בודקות במפורש את הנתיב הדטרמיניסטי של תמונה
// שלא נטענת בכלל, בלי שום מעורבות של Gemini.
vi.mock('../../src/lib/gemini', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/gemini')>();
  return { ...actual, verifyImageMatch: vi.fn(), suggestCategory: vi.fn(), summarizeHebrew: vi.fn() };
});

import { verifyImageMatch, suggestCategory, summarizeHebrew } from '../../src/lib/gemini';
import { aiEnrichmentService } from '../../src/modules/aiEnrichment/aiEnrichment.service';

const mockedVerifyImage = vi.mocked(verifyImageMatch);
const mockedSuggestCategory = vi.mocked(suggestCategory);
const mockedSummarize = vi.mocked(summarizeHebrew);

let externalIdCounter = 0;

async function createItem(
  sourceId: string,
  runId: string,
  overrides: {
    title?: string;
    shortDescription?: string;
    imageUrl?: string;
    matchedBenefitId?: string;
  } = {}
) {
  return prisma.scrapedItem.create({
    data: {
      sourceId,
      runId,
      externalId: `ext-${++externalIdCounter}`,
      rawData: {
        title: overrides.title ?? 'הנחה על קפה בבוקר',
        ...(overrides.shortDescription !== undefined && { shortDescription: overrides.shortDescription }),
        ...(overrides.imageUrl !== undefined && { imageUrl: overrides.imageUrl }),
      } as never,
      confidenceScore: 60,
      status: 'PENDING_REVIEW',
      ...(overrides.matchedBenefitId && { matchedBenefitId: overrides.matchedBenefitId }),
    },
  });
}

beforeEach(() => {
  mockedVerifyImage.mockReset();
  mockedSuggestCategory.mockReset();
  mockedSummarize.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks(); // מנקה גם spyOn(axios, 'get') בין מקרי בדיקה
});

describe('aiEnrichmentService — הצעת קטגוריה', () => {
  it('ביטחון גבוה: ממלא aiSuggestedCategoryId ורושם AuditLog', async () => {
    const category = await createCategory({ slug: 'cinema', name: 'קולנוע' });
    const source = await createScraperSource(); // בלי defaultCategoryId
    const run = await createRun(source.id);
    const item = await createItem(source.id, run.id, { title: 'כרטיס לסרט בקולנוע' });
    mockedSuggestCategory.mockResolvedValue({ outcome: 'suggested', categorySlug: category.slug, confidence: 0.92, reason: 'מתאים לקולנוע' });

    const summary = await aiEnrichmentService.runCategorizationOnly('manual');

    expect(summary.categoriesSuggested).toBe(1);
    const refreshed = await prisma.scrapedItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(refreshed.aiSuggestedCategoryId).toBe(category.id);
    expect(refreshed.aiCategorySuggestedAt).not.toBeNull();

    const log = await prisma.auditLog.findMany({ where: { entityType: 'DuplicateCleanupAction', entityId: item.id } });
    expect(log).toHaveLength(1);
    const fields = log[0].changedFields as { cleanupType?: string; categorySlug?: string };
    expect(fields.cleanupType).toBe('category_suggestion');
    expect(fields.categorySlug).toBe(category.slug);
  });

  it('ביטחון נמוך: נשאר ריק אך מסומן כ"כבר נוסה" (לא ינוסה שוב לנצח)', async () => {
    await createCategory({ slug: 'cinema', name: 'קולנוע' });
    const source = await createScraperSource();
    const run = await createRun(source.id);
    const item = await createItem(source.id, run.id);
    mockedSuggestCategory.mockResolvedValue({ outcome: 'suggested', categorySlug: null, confidence: 0.3, reason: 'לא ברור' });

    const summary = await aiEnrichmentService.runCategorizationOnly('manual');

    expect(summary.categoriesSuggested).toBe(0);
    expect(summary.categoriesSkippedLowConfidence).toBe(1);
    const refreshed = await prisma.scrapedItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(refreshed.aiSuggestedCategoryId).toBeNull();
    expect(refreshed.aiCategorySuggestedAt).not.toBeNull();
  });

  it('מקור עם defaultCategoryId משלו — הפריט לא נחשב זכאי, אין קריאת AI בכלל', async () => {
    const category = await createCategory();
    const source = await createScraperSource({ defaultCategoryId: category.id });
    const run = await createRun(source.id);
    await createItem(source.id, run.id);

    await aiEnrichmentService.runCategorizationOnly('manual');

    expect(mockedSuggestCategory).not.toHaveBeenCalled();
  });

  it('פריט עדכון (matchedBenefitId קיים) — לא נחשב זכאי, אין קריאת AI', async () => {
    const category = await createCategory();
    const benefit = await prisma.benefit.create({
      data: { slug: 'x', title: 'x', shortDescription: 'x', categoryId: category.id, benefitType: 'OTHER' },
    });
    const source = await createScraperSource();
    const run = await createRun(source.id);
    await createItem(source.id, run.id, { matchedBenefitId: benefit.id });

    await aiEnrichmentService.runCategorizationOnly('manual');

    expect(mockedSuggestCategory).not.toHaveBeenCalled();
  });

  it('כשל טכני — לא מסומן כ"נוסה", ייבדק שוב בסבב הבא', async () => {
    await createCategory();
    const source = await createScraperSource();
    const run = await createRun(source.id);
    const item = await createItem(source.id, run.id);
    mockedSuggestCategory.mockResolvedValue({ outcome: 'error', isRateLimit: false, message: 'תקלה' });

    const summary = await aiEnrichmentService.runCategorizationOnly('manual');

    expect(summary.categorySuggestionErrors).toBe(1);
    const refreshed = await prisma.scrapedItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(refreshed.aiCategorySuggestedAt).toBeNull();
  });
});

describe('aiEnrichmentService — אימות תמונה', () => {
  it('תמונה שלא נטענת בכלל: התרעה נרשמת דטרמיניסטית, בלי לקרוא ל-Gemini, הפריט עצמו לא משתנה', async () => {
    const source = await createScraperSource();
    const run = await createRun(source.id);
    // http://localhost:1/ — אף אחד לא מאזין שם, אותה מוסכמה בדיוק כמו factories.createScraperSource ו-matching.service.test.ts
    const item = await createItem(source.id, run.id, { imageUrl: 'http://localhost:1/broken.jpg' });

    const summary = await aiEnrichmentService.runEnrichmentSweep('manual');

    expect(summary.imageAlertsRaised).toBeGreaterThanOrEqual(1);
    expect(mockedVerifyImage).not.toHaveBeenCalled();
    const refreshed = await prisma.scrapedItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(refreshed.status).toBe('PENDING_REVIEW');
    expect(refreshed.aiImageCheckedAt).not.toBeNull();

    const log = await prisma.auditLog.findMany({ where: { entityType: 'DuplicateCleanupAction', entityId: item.id } });
    expect(log.some((l) => (l.changedFields as { cleanupType?: string })?.cleanupType === 'image_verification')).toBe(true);
  });

  it('תמונה תקינה, Gemini קובע אי-התאמה בביטחון גבוה — התרעה נרשמת, הפריט לא נגוע', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({
      data: new ArrayBuffer(8),
      headers: { 'content-type': 'image/jpeg' },
    } as never);
    const source = await createScraperSource();
    const run = await createRun(source.id);
    const item = await createItem(source.id, run.id, { imageUrl: 'http://example.test/image.jpg' });
    mockedVerifyImage.mockResolvedValue({ outcome: 'verified', matches: false, confidence: 0.9, reason: 'לוגו לא קשור' });

    await aiEnrichmentService.runEnrichmentSweep('manual');

    const refreshed = await prisma.scrapedItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(refreshed.status).toBe('PENDING_REVIEW'); // עקרון הבטיחות: AI לא נוגע בפריט, רק מתריע
    const log = await prisma.auditLog.findMany({ where: { entityType: 'DuplicateCleanupAction', entityId: item.id } });
    const imageLog = log.find((l) => (l.changedFields as { cleanupType?: string })?.cleanupType === 'image_verification');
    expect(imageLog).toBeDefined();
    expect((imageLog!.changedFields as { reason?: string }).reason).toBe('לוגו לא קשור');
  });

  it('תמונה תקינה, Gemini קובע התאמה — שקט, שום AuditLog לא נרשם', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({
      data: new ArrayBuffer(8),
      headers: { 'content-type': 'image/jpeg' },
    } as never);
    const source = await createScraperSource();
    const run = await createRun(source.id);
    const item = await createItem(source.id, run.id, { imageUrl: 'http://example.test/image.jpg' });
    mockedVerifyImage.mockResolvedValue({ outcome: 'verified', matches: true, confidence: 0.95, reason: 'מתאים' });

    const summary = await aiEnrichmentService.runEnrichmentSweep('manual');

    expect(summary.imageAlertsRaised).toBe(0);
    const log = await prisma.auditLog.findMany({ where: { entityType: 'DuplicateCleanupAction', entityId: item.id } });
    expect(log).toHaveLength(0);
  });

  it('פריט בלי imageUrl בכלל — מדלג בלי לקרוא ל-Gemini, מסומן כנבדק', async () => {
    const source = await createScraperSource();
    const run = await createRun(source.id);
    const item = await createItem(source.id, run.id);

    await aiEnrichmentService.runEnrichmentSweep('manual');

    expect(mockedVerifyImage).not.toHaveBeenCalled();
    const refreshed = await prisma.scrapedItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(refreshed.aiImageCheckedAt).not.toBeNull();
  });
});

describe('aiEnrichmentService — סיכום עברי', () => {
  it('מייצר סיכום בשדה נפרד, לא דורס את התיאור המקורי', async () => {
    const source = await createScraperSource();
    const run = await createRun(source.id);
    const original = 'תיאור שיווקי מסורבל וארוך במיוחד על ההטבה הזו, עם המון מילים מיותרות';
    const item = await createItem(source.id, run.id, { shortDescription: original });
    mockedSummarize.mockResolvedValue({ outcome: 'summarized', summary: 'תקציר קצר' });

    const summary = await aiEnrichmentService.runEnrichmentSweep('manual');

    expect(summary.itemsSummarized).toBe(1);
    const refreshed = await prisma.scrapedItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(refreshed.aiSummary).toBe('תקציר קצר');
    expect((refreshed.rawData as { shortDescription?: string }).shortDescription).toBe(original); // המקור נשאר קיים במלואו
  });

  it('אין תיאור לסכם — מסומן כ"נוסה", aiSummary נשאר null (לא חוסם התקדמות לפריטים אחרים בסבבים הבאים)', async () => {
    const source = await createScraperSource();
    const run = await createRun(source.id);
    const item = await createItem(source.id, run.id); // בלי shortDescription

    const summary = await aiEnrichmentService.runEnrichmentSweep('manual');

    expect(summary.summariesSkippedNoDescription).toBe(1);
    expect(mockedSummarize).not.toHaveBeenCalled();
    const refreshed = await prisma.scrapedItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(refreshed.aiSummary).toBeNull();
    expect(refreshed.aiSummaryGeneratedAt).not.toBeNull();
  });

  it('כשל טכני — לא מסומן, ייבדק שוב בסבב הבא', async () => {
    const source = await createScraperSource();
    const run = await createRun(source.id);
    const item = await createItem(source.id, run.id, { shortDescription: 'תיאור כלשהו' });
    mockedSummarize.mockResolvedValue({ outcome: 'error', isRateLimit: false, message: 'תקלה' });

    const summary = await aiEnrichmentService.runEnrichmentSweep('manual');

    expect(summary.summaryErrors).toBe(1);
    const refreshed = await prisma.scrapedItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(refreshed.aiSummaryGeneratedAt).toBeNull();
  });
});
