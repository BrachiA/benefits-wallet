import { afterEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { prisma } from '../../src/lib/prisma';
import { AppError } from '../../src/lib/AppError';
import { scraperService } from '../../src/modules/scraper/scraper.service';
import { robotsChecker } from '../../src/modules/scraper/robotsChecker';
import { createScraperSource } from '../setup/factories';

// robots.txt נבדק מול רשת אמיתית; בבדיקות מדובר בכתובת דמה ולכן
// מנטרלים את הבדיקה במקום להמתין ל-timeout.
function allowRobots() {
  return vi.spyOn(robotsChecker, 'isAllowed').mockResolvedValue({ allowed: true });
}

function htmlWithCards(cards: string) {
  return `<!doctype html><html><body>${cards}</body></html>`;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runSource — דיווח כישלון', () => {
  it('כשל בעיבוד מוחזר כשגיאה ולא כתשובת הצלחה', async () => {
    // הבאג המקורי: השגיאה נתפסה, נרשמה ללוג, והתשובה חזרה 200
    // רגילה. המנהל לחץ "הרץ עכשיו" וקיבל מסך ירוק על ריצה שנכשלה.
    allowRobots();
    const source = await createScraperSource();
    vi.spyOn(scraperService, 'fetchRawItems').mockRejectedValue(new Error('התפוצץ באמצע'));

    await expect(scraperService.runSource(source.id)).rejects.toBeInstanceOf(AppError);

    // והריצה עצמה נרשמה כ-FAILED עם הסיבה
    const run = await prisma.scraperRun.findFirstOrThrow({ orderBy: { startedAt: 'desc' } });
    expect(run.status).toBe('FAILED');
    expect(run.errorMessage).toContain('התפוצץ באמצע');
  });

  it('פרטי הכישלון נשמרים ב-details כדי שהדשבורד יוכל להציג אותם', async () => {
    allowRobots();
    const source = await createScraperSource();
    vi.spyOn(scraperService, 'fetchRawItems').mockRejectedValue(new Error('שגיאת רשת'));

    const err = await scraperService.runSource(source.id).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    const appError = err as AppError;
    expect(appError.code).toBe('SCRAPER_RUN_FAILED');
    expect(appError.statusCode).toBe(500);
    expect(appError.details).toMatchObject({ errorMessage: 'שגיאת רשת' });
  });

  it('ריצה תקינה מחזירה את רשומת הריצה עם סטטוס SUCCESS', async () => {
    allowRobots();
    const source = await createScraperSource();
    vi.spyOn(scraperService, 'fetchRawItems').mockResolvedValue({ items: [], skipped: 0 });

    const run = await scraperService.runSource(source.id);

    expect(run.status).toBe('SUCCESS');
    expect(run.finishedAt).not.toBeNull();
  });

  it('מקור שאינו עובר את שני השערים אינו רץ כלל', async () => {
    const notApproved = await createScraperSource({ tosStatus: 'PENDING_REVIEW', isActive: false });

    // AppError.validation שומר את ההסבר ב-details ולא ב-message
    const err = await scraperService.runSource(notApproved.id).then(
      () => null,
      (e: unknown) => e
    );
    expect(err).toBeInstanceOf(AppError);
    expect(String((err as AppError).details)).toMatch(/not runnable/i);
    expect(await prisma.scraperRun.count()).toBe(0);
  });
});

describe('runSource — כרטיסים שדולגו', () => {
  it('סופר כרטיסים שחסרים בהם שדות חובה', async () => {
    allowRobots();
    const source = await createScraperSource();
    // שני כרטיסים תקינים, שניים פגומים (בלי כותרת / בלי מזהה)
    vi.spyOn(axios, 'get').mockResolvedValue({
      data: htmlWithCards(`
        <div class="card" data-id="a"><span class="title">הטבה ראשונה</span></div>
        <div class="card" data-id="b"><span class="title">הטבה שנייה</span></div>
        <div class="card" data-id="c"></div>
        <div class="card"><span class="title">בלי מזהה</span></div>
      `),
    } as never);

    const run = await scraperService.runSource(source.id);

    expect(run.itemsFound).toBe(2);
    expect(run.itemsSkipped).toBe(2);
    expect(run.status).toBe('SUCCESS');
  });

  it('ריצה שדילגה על הכול מסומנת PARTIAL עם הסבר, ולא כהצלחה שקטה', async () => {
    // זו החתימה של selector שנשבר אחרי שינוי מבנה באתר. קודם לכן
    // ריצה כזו נראתה זהה ל"אין הטבות חדשות".
    allowRobots();
    const source = await createScraperSource();
    vi.spyOn(axios, 'get').mockResolvedValue({
      data: htmlWithCards(`
        <div class="card"></div>
        <div class="card"></div>
        <div class="card"></div>
      `),
    } as never);

    const run = await scraperService.runSource(source.id);

    expect(run.itemsFound).toBe(0);
    expect(run.itemsSkipped).toBe(3);
    expect(run.status).toBe('PARTIAL');
    expect(run.errorMessage).toContain('selectors');
  });

  it('דף ריק באמת אינו מסומן כבעיה', async () => {
    allowRobots();
    const source = await createScraperSource();
    vi.spyOn(axios, 'get').mockResolvedValue({ data: htmlWithCards('') } as never);

    const run = await scraperService.runSource(source.id);

    expect(run.itemsFound).toBe(0);
    expect(run.itemsSkipped).toBe(0);
    expect(run.status).toBe('SUCCESS');
  });
});
