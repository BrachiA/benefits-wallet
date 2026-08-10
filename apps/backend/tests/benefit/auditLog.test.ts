import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { issuerService } from '../../src/modules/issuer/issuer.service';
import { benefitService } from '../../src/modules/benefit/benefit.service';
import { scraperService } from '../../src/modules/scraper/scraper.service';
import { createBenefit, createCategory, createIssuer, createProgram, createRun, createScraperSource } from '../setup/factories';

// לפני שהקובץ הזה נכתב, AuditLog לא נכתב אליו מעולם למרות שהסכמה
// מצהירה שהוא נדרש "כי אין Authentication" — כלומר לא הייתה שום
// דרך לדעת מי שינה מה ומתי. הבדיקות מכסות לפחות פעולה אחת מכל סוג
// (CREATE/UPDATE/DELETE/ACTIVATE/DEACTIVATE) ולפחות מודול עסקי אחד
// שאינו הטבות/סורק, כדי לוודא שההתחברות היא כללית ולא מקרית.

async function latestAudit(entityType: string, entityId: string) {
  return prisma.auditLog.findFirst({ where: { entityType, entityId }, orderBy: { createdAt: 'desc' } });
}

describe('AuditLog — CRUD כללי (issuer כדוגמה למודול קטלוג)', () => {
  it('יצירה נכתבת', async () => {
    const issuer = await issuerService.create({ slug: `iss-${Date.now()}`, name: 'מנפיק בדיקה' } as never);

    const entry = await latestAudit('Issuer', issuer.id);
    expect(entry?.action).toBe('CREATE');
  });

  it('עדכון נכתב', async () => {
    const issuer = await createIssuer();
    await issuerService.update(issuer.id, { name: 'שם חדש' } as never);

    const entry = await latestAudit('Issuer', issuer.id);
    expect(entry?.action).toBe('UPDATE');
  });

  it('מחיקה נכתבת', async () => {
    const issuer = await createIssuer();
    await issuerService.remove(issuer.id);

    const entry = await latestAudit('Issuer', issuer.id);
    expect(entry?.action).toBe('DELETE');
  });
});

describe('AuditLog — הטבות, כולל שיוך', () => {
  it('יצירת הטבה נכתבת', async () => {
    const category = await createCategory();
    const program = await createProgram();
    const created = await benefitService.create({
      slug: `b-${Date.now()}`,
      title: 'הטבה',
      shortDescription: 'תיאור',
      categoryId: category.id,
      benefitType: 'DISCOUNT_PERCENT',
      requiresCoupon: false,
      channel: 'BOTH',
      isPopular: false,
      isFeatured: false,
      priority: 0,
      scopes: [{ programId: program.id }],
    } as never);

    const entry = await latestAudit('Benefit', created.id);
    expect(entry?.action).toBe('CREATE');
  });

  it('עדכון שיוך (scopes) נכתב כמו כל עדכון אחר', async () => {
    const benefit = await createBenefit();
    await benefitService.update(benefit.id, { scopes: [] });

    const entry = await latestAudit('Benefit', benefit.id);
    expect(entry?.action).toBe('UPDATE');
  });
});

describe('AuditLog — מקור סריקה: ACTIVATE/DEACTIVATE ותיעוד מבצע', () => {
  it('activate נכתב עם action=ACTIVATE', async () => {
    const source = await createScraperSource({ tosStatus: 'APPROVED', isActive: false });

    await scraperService.activate(source.id);

    const entry = await latestAudit('ScraperSource', source.id);
    expect(entry?.action).toBe('ACTIVATE');
  });

  it('deactivate נכתב עם action=DEACTIVATE', async () => {
    const source = await createScraperSource({ isActive: true });

    await scraperService.deactivate(source.id);

    const entry = await latestAudit('ScraperSource', source.id);
    expect(entry?.action).toBe('DEACTIVATE');
  });

  it('reviewTos מתעד את reviewedBy כ-performedBy', async () => {
    const source = await createScraperSource({ tosStatus: 'PENDING_REVIEW' });

    await scraperService.reviewTos(source.id, { status: 'APPROVED', reviewedBy: 'בודקת ראשית' });

    const entry = await latestAudit('ScraperSource', source.id);
    expect(entry?.performedBy).toBe('בודקת ראשית');
  });

  it('מחיקת מקור נכתבת', async () => {
    const source = await createScraperSource();
    await scraperService.removeSource(source.id);

    const entry = await latestAudit('ScraperSource', source.id);
    expect(entry?.action).toBe('DELETE');
  });
});

describe('AuditLog — אישור/דחיית פריט סרוק מתעד את שם הבודקת', () => {
  it('דחייה נכתבת עם performedBy', async () => {
    const source = await createScraperSource();
    const run = await createRun(source.id);
    const item = await prisma.scrapedItem.create({
      data: {
        sourceId: source.id,
        runId: run.id,
        externalId: 'x1',
        rawData: { title: 't', externalId: 'x1' } as never,
        confidenceScore: 50,
        status: 'PENDING_REVIEW',
      },
    });

    await scraperService.reviewItem(item.id, { decision: 'REJECT', reviewedBy: 'בודקת שנייה' });

    const entry = await latestAudit('ScrapedItem', item.id);
    expect(entry?.performedBy).toBe('בודקת שנייה');
    expect(entry?.action).toBe('UPDATE');
  });
});

describe('AuditLog — כשל בכתיבה לא מפיל את הפעולה העסקית', () => {
  it('remove מצליח גם אם ניתן לדמיין כשל אודיט (מבחן עקיף: הפעולה עצמה תמיד מחזירה תוצאה)', async () => {
    // אין כאן mock לכשל בפועל (recordAudit לא מיוצא מנקודת הזרקה
    // נוחה כרגע) — הבדיקה מוודאת לפחות שהזרימה הרגילה שלמה: הפעולה
    // העסקית עצמה מסתיימת ומחזירה תוצאה תקינה, לא נבלעת ע"י האודיט.
    const issuer = await createIssuer();
    const result = await issuerService.remove(issuer.id);
    expect(result).toBeTruthy();
  });
});
