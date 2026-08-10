import { afterEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import cron from 'node-cron';
import { scraperService } from '../../src/modules/scraper/scraper.service';
import { createScraperSource } from '../setup/factories';
import { startScraperScheduler, stopScraperScheduler } from '../../src/modules/scraper/scheduler';

// startScraperScheduler תמיד קורא ל-cron.schedule פעם אחת נוספת
// עבור ה-reconcile ticker עצמו (כל 5 דקות), לפני שהוא מתזמן job
// לכל מקור. הבדיקות מסננות לפי ביטוי ה-cron של המקור עצמו כדי
// להתעלם מקריאת ה-ticker.
const SOURCE_CRON = '0 3 * * *'; // ברירת המחדל ב-factories.createScraperSource

function sourceJobCalls(scheduleSpy: MockInstance<typeof cron.schedule>) {
  return scheduleSpy.mock.calls.filter(([expr]) => expr === SOURCE_CRON);
}

afterEach(() => {
  stopScraperScheduler();
  vi.restoreAllMocks();
});

describe('scraper scheduler — reconcile', () => {
  it('מתזמן job רק למקורות שעברו את שני השערים (isActive + tosStatus=APPROVED)', async () => {
    const scheduleSpy = vi.spyOn(cron, 'schedule');
    const runnable = await createScraperSource({ isActive: true, tosStatus: 'APPROVED', slug: `runnable-${Date.now()}` });
    await createScraperSource({ isActive: false, tosStatus: 'APPROVED', slug: `inactive-${Date.now()}` });
    await createScraperSource({ isActive: true, tosStatus: 'PENDING_REVIEW', slug: `pending-${Date.now()}` });

    startScraperScheduler();
    await new Promise((r) => setTimeout(r, 50)); // ה-reconcile הראשוני הוא async

    const calls = sourceJobCalls(scheduleSpy);
    expect(calls).toHaveLength(1);

    // מוודאים שזה באמת המקור הנכון: קורא ל-runSource כשה-callback מופעל
    const callback = calls[0][1] as () => void;
    const runSpy = vi.spyOn(scraperService, 'runSource').mockResolvedValue({} as never);
    callback();
    await new Promise((r) => setTimeout(r, 10));
    expect(runSpy).toHaveBeenCalledWith(runnable.id);
  });

  it('לא מתזמן job למקור כשאין אף מקור מוכן', async () => {
    const scheduleSpy = vi.spyOn(cron, 'schedule');

    startScraperScheduler();
    await new Promise((r) => setTimeout(r, 50));

    expect(sourceJobCalls(scheduleSpy)).toHaveLength(0);
    // אבל ה-ticker עצמו כן רץ — זה מה שמאפשר reconcile עתידי
    expect(scheduleSpy).toHaveBeenCalled();
  });

  it('startScraperScheduler פעמיים ברצף לא יוצר תזמון כפול', async () => {
    const scheduleSpy = vi.spyOn(cron, 'schedule');
    await createScraperSource({ isActive: true, tosStatus: 'APPROVED', slug: `dup-${Date.now()}` });

    startScraperScheduler();
    await new Promise((r) => setTimeout(r, 50));
    const callsAfterFirst = scheduleSpy.mock.calls.length;

    startScraperScheduler(); // אמור להיות no-op — reconcileTask כבר קיים
    await new Promise((r) => setTimeout(r, 50));

    expect(scheduleSpy.mock.calls.length).toBe(callsAfterFirst);
  });

  it('כשל בריצה מתוזמנת אינו זורק החוצה (ה-scheduler לא קורס)', async () => {
    const scheduleSpy = vi.spyOn(cron, 'schedule');
    await createScraperSource({ isActive: true, tosStatus: 'APPROVED', slug: `fail-${Date.now()}` });

    startScraperScheduler();
    await new Promise((r) => setTimeout(r, 50));

    vi.spyOn(scraperService, 'runSource').mockRejectedValue(new Error('בום'));
    const callback = sourceJobCalls(scheduleSpy)[0][1] as () => void;

    await expect(Promise.resolve(callback())).resolves.not.toThrow();
  });
});
