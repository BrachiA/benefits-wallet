import cron, { type ScheduledTask } from 'node-cron';
import { logger } from '../../lib/logger';
import { duplicateCleanupService } from './duplicateCleanup.service';
import { aiEnrichmentService } from '../aiEnrichment/aiEnrichment.service';
import { logoSearchService } from '../logoSearch/logoSearch.service';

// כל שעה, בדקה 0 — לא per-source ניתן-לתצורה כמו modules/scraper/
// scheduler.ts, כי זה סבב ניקוי גלובלי אחד על כל ה-DB, לא פעולה
// לכל ScraperSource. מרווח שעה: ריצות יתומות ממילא רק "יתומות"
// אחרי שעתיים, ופריטי PENDING_REVIEW ממתינים לבדיקה אנושית בכל
// מקרה — שעה שומרת את הדשבורד רענן בלי עומס API מיותר על Gemini.
const CLEANUP_INTERVAL = '0 * * * *';

let task: ScheduledTask | null = null;

// שלושה sweep-ים בלתי-תלויים (ניקוי כפילויות, אימות תמונה/קטגוריה/
// סיכום, חיפוש לוגו) חולקים את אותו tick בכוונה — לא cron job נפרד
// לכל אחד. try/catch נפרד לכל אחד כדי שכשל באחד לא ימנע מהאחרים
// לרוץ. שלושתם חולקים גם את throttleGeminiCall (lib/gemini.ts) כדי
// שלא יחרגו יחד מ-15 בקשות/דקה.
async function runSweepSafely() {
  try {
    await duplicateCleanupService.runCleanupSweep('cron');
  } catch (err) {
    logger.error({ err }, 'Scheduled duplicate cleanup sweep failed');
  }
  try {
    await aiEnrichmentService.runEnrichmentSweep('cron');
  } catch (err) {
    logger.error({ err }, 'Scheduled AI enrichment sweep failed');
  }
  try {
    await logoSearchService.runLogoSearchSweep('cron');
  } catch (err) {
    logger.error({ err }, 'Scheduled logo search sweep failed');
  }
}

export function startDuplicateCleanupScheduler() {
  if (task) return; // כבר רץ — מונע כפילות אם נקרא פעמיים בטעות
  task = cron.schedule(CLEANUP_INTERVAL, () => {
    void runSweepSafely();
  });
  logger.info('Duplicate cleanup scheduler started');
}

export function stopDuplicateCleanupScheduler() {
  task?.stop();
  task = null;
}
