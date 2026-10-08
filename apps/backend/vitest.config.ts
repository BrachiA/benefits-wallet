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
      // R2_* חובה ב-env.ts (לא אופציונלי כמו GEMINI_API_KEY) כי אין
      // מצב תקין "בלי R2" באפליקציה האמיתית — אבל אף בדיקה קיימת לא
      // קוראת בפועל ל-lib/r2Storage (רשת אמיתית), רק ל-env.ts דרך
      // ה-import chain (config/env נטען ע"י lib/gemini וכו'). ערכי
      // dummy מספיקים כדי ש-envSchema.parse לא יקרוס בסביבת בדיקות.
      R2_ACCOUNT_ID: 'test-account-id',
      R2_ACCESS_KEY_ID: 'test-access-key-id',
      R2_SECRET_ACCESS_KEY: 'test-secret-access-key',
      R2_BUCKET_NAME: 'test-bucket',
      R2_ENDPOINT: 'https://test-account-id.r2.cloudflarestorage.com',
      R2_PUBLIC_URL: 'https://test-bucket.example.com',
    },
    // כל קבצי הבדיקה חולקים DB אחד ומנקים אותו בין מקרים — ריצה
    // מקבילית הייתה גורמת להם למחוק נתונים זה של זה.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
