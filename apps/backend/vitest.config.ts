import { defineConfig } from 'vitest/config';

// DB ייעודי לבדיקות, נפרד לחלוטין מ-DB הפיתוח. הבדיקות מוחקות
// טבלאות בין מקרי בדיקה, ולכן אסור שיצביעו על משהו אחר.
// ניתן לעקוף עם TEST_DATABASE_URL (למשל ב-CI).
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://benefits:benefits@localhost:5432/benefits_wallet_test?schema=public';

// נקבע ברמת הקובץ ולא רק ב-test.env, כדי שגם globalSetup (שרץ לפני
// סביבת הבדיקה) יראה אותו.
process.env.DATABASE_URL = TEST_DATABASE_URL;

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/setup/globalSetup.ts'],
    setupFiles: ['./tests/setup/resetBetweenTests.ts'],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      NODE_ENV: 'test',
      LOG_LEVEL: 'error', // הבדיקות מפעילות נתיבי כשל בכוונה; לא מציפים את הפלט
    },
    // כל קבצי הבדיקה חולקים DB אחד ומנקים אותו בין מקרים — ריצה
    // מקבילית הייתה גורמת להם למחוק נתונים זה של זה.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
