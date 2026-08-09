import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

// רץ פעם אחת לפני כל הבדיקות: מוודא ש-DB הבדיקות קיים ושהסכמה בו
// עדכנית. מבודד לחלוטין מ-DB הפיתוח — ראו vitest.config.ts.
export default async function globalSetup() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL חסר — vitest.config.ts אמור להגדיר אותו');

  const dbName = new URL(url).pathname.slice(1);
  if (!dbName.includes('test')) {
    // רשת ביטחון: ה-setup הזה מריץ TRUNCATE על כל הטבלאות בין
    // מקרי בדיקה. אם מישהו יכוון אותו בטעות ל-DB אמיתי, זו מחיקה
    // מלאה. דורשים שהשם יכיל "test" כדי שזה לא יקרה בשקט.
    throw new Error(`סירוב להריץ בדיקות מול DB בשם "${dbName}" — שם ה-DB חייב להכיל "test"`);
  }

  // יצירת ה-DB אם אינו קיים. מתחברים ל-postgres כדי להריץ CREATE.
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  adminUrl.search = '';
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  try {
    const existing = await admin.$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM pg_database WHERE datname = '${dbName}'`
    );
    if (existing.length === 0) {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await admin.$disconnect();
  }

  // הסכמה מוחלת מהמיגרציות עצמן ולא מ-db push, כדי שהבדיקות ירוצו
  // מול אותו מבנה בדיוק שיגיע לפרודקשן.
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
