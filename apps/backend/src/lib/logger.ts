import pino from 'pino';

// pino נבחר על winston: JSON structured logging מהיר משמעותית,
// וזה הפורמט שיזרום בעתיד ל-log aggregator (Datadog/CloudWatch).
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
      : undefined,
});

// child logger מוצמד ל-requestId — כל לוג של בקשה בודדת ניתן למעקב
// מלא בפרודקשן, גם תחת traffic מקבילי גבוה.
export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}
