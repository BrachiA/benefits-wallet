import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

// עוטף nodemailer + SMTP. אם ה-SMTP לא הוגדר (סביבת פיתוח בלי
// שרת מייל אמיתי), רושמים ללוג במקום לזרוק — התראה שלא נשלחת
// לא אמורה להפיל ריצת סריקה או בקשת API.
const transporter =
  env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      })
    : null;

export async function sendMail(subject: string, html: string): Promise<void> {
  if (!transporter) {
    logger.warn({ subject }, 'SMTP not configured — email not sent, logging instead');
    return;
  }
  try {
    await transporter.sendMail({
      from: env.SMTP_FROM ?? env.SMTP_USER,
      to: env.ADMIN_ALERT_EMAIL,
      subject,
      html,
    });
  } catch (err) {
    // כשל שליחה לא אמור להפיל את הפעולה שגרמה להתראה — למשל
    // ריצת סריקה שהצליחה חייבת להסתיים בהצלחה גם אם המייל נכשל.
    logger.error({ err, subject }, 'Failed to send alert email');
  }
}
