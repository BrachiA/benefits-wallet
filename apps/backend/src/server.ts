import { app } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { startScraperScheduler, stopScraperScheduler } from './modules/scraper/scheduler';
import { startDuplicateCleanupScheduler, stopDuplicateCleanupScheduler } from './modules/duplicateCleanup/duplicateCleanup.scheduler';

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Benefits Wallet API started');
});

// מתוזמן כאן ולא ב-app.ts בכוונה: app.ts מיובא גם בבדיקות (import
// { app } בלי listen), וסריקות מתוזמנות אמיתיות לא אמורות לרוץ
// כשהמטרה היחידה היא לבדוק endpoint בודד.
startScraperScheduler();
startDuplicateCleanupScheduler();

// Graceful shutdown: מוודא שחיבור Prisma נסגר לפני שה-process יוצא,
// כדי לא להשאיר connections תלויות ב-DB בזמן restart/deploy.
async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down gracefully');
  stopScraperScheduler();
  stopDuplicateCleanupScheduler();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
