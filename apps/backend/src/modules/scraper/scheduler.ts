import cron, { type ScheduledTask } from 'node-cron';
import { logger } from '../../lib/logger';
import { scraperRepository } from './scraper.repository';
import { scraperService } from './scraper.service';

// ============================================================
// מפעיל את runSource לכל מקור לפי ה-scheduleCron השמור עליו
// (שלב 5, ב.5.3). לפני זה scheduleCron נשמר ב-DB ואף פעם לא נקרא —
// הסריקה "היומית האוטומטית" הייתה כפתור ידני בלבד.
//
// עיצוב: job אחד לכל מקור (node-cron.schedule עם ה-cron string שלו),
// ולא טיימר גלובלי יחיד — כי כל מקור יכול להיות מוגדר לתדירות שונה
// (scheduleCron הוא שדה per-source, לא קבוע גלובלי). "reconcile"
// רץ כל כמה דקות ומתאים את מפת ה-jobs הפעילים למציאות בפועל: מקור
// שהופעל/שונה מקבל job חדש, מקור שהושבת/נדחה מאבד את שלו.
// ============================================================

const RECONCILE_INTERVAL = '*/5 * * * *'; // כל 5 דקות — מספיק תגובתי, לא מציף

type TrackedJob = { task: ScheduledTask; scheduleCron: string };
const jobs = new Map<string, TrackedJob>();
let reconcileTask: ScheduledTask | null = null;

async function runSourceSafely(sourceId: string) {
  try {
    await scraperService.runSource(sourceId);
  } catch (err) {
    // runSource כבר שולח התראת מייל ורושם ל-DB במסלול הכשל שלו;
    // כאן רק מוודאים שחריגה לא מפילה את תהליך ה-scheduler עצמו.
    logger.error({ sourceId, err }, 'Scheduled scraper run failed');
  }
}

// מתאים את מפת ה-jobs הפעילים לרשימת המקורות שמותר להם לרוץ כרגע
// (isActive + tosStatus=APPROVED — אותו שער בדיוק כמו הרצה ידנית).
async function reconcile() {
  const runnable = await scraperRepository.findRunnableSources();
  const runnableIds = new Set(runnable.map((s) => s.id));

  // מקורות שכבר לא רצים (הושבתו/נדחו/נמחקו) — עוצרים את ה-job שלהם.
  for (const [sourceId, job] of jobs) {
    if (!runnableIds.has(sourceId)) {
      job.task.stop();
      jobs.delete(sourceId);
      logger.info({ sourceId }, 'Stopped scheduled job for source no longer runnable');
    }
  }

  for (const source of runnable) {
    const existing = jobs.get(source.id);
    if (existing && existing.scheduleCron === source.scheduleCron) continue; // כבר מתוזמן נכון

    if (existing) {
      existing.task.stop();
      jobs.delete(source.id);
    }

    if (!cron.validate(source.scheduleCron)) {
      // ביטוי cron לא תקין לא אמור לקרות (הדשבורד לא מציע עריכה
      // חופשית שלו כרגע), אבל אם זה בכל זאת קורה — לא רוצים שמקור
      // אחד שבור יפיל את כל ה-reconcile של שאר המקורות.
      logger.warn({ sourceId: source.id, scheduleCron: source.scheduleCron }, 'Invalid scheduleCron, skipping');
      continue;
    }

    const task = cron.schedule(source.scheduleCron, () => runSourceSafely(source.id));
    jobs.set(source.id, { task, scheduleCron: source.scheduleCron });
    logger.info({ sourceId: source.id, scheduleCron: source.scheduleCron }, 'Scheduled scraper job');
  }
}

export function startScraperScheduler() {
  if (reconcileTask) return; // כבר רץ — מונע כפילות אם נקרא פעמיים בטעות
  reconcileTask = cron.schedule(RECONCILE_INTERVAL, () => {
    reconcile().catch((err) => logger.error({ err }, 'Scraper scheduler reconcile failed'));
  });
  // ריצה מיידית בעליית התהליך, בלי לחכות ל-tick הראשון של ה-cron —
  // אחרת מקור שהופעל רגע לפני restart מחכה עד 5 דקות בחינם.
  reconcile().catch((err) => logger.error({ err }, 'Scraper scheduler initial reconcile failed'));
  logger.info('Scraper scheduler started');
}

export function stopScraperScheduler() {
  reconcileTask?.stop();
  reconcileTask = null;
  for (const job of jobs.values()) job.task.stop();
  jobs.clear();
}
