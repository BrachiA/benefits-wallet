import { afterAll, beforeEach } from 'vitest';
import { prisma } from '../../src/lib/prisma';

// רשימת הטבלאות נשלפת מה-DB ולא מקודדת ידנית — כך הוספת מודל חדש
// לסכמה לא משאירה שאריות שקטות בין בדיקות.
let cachedTables: string[] | null = null;

async function tableNames(): Promise<string[]> {
  if (cachedTables) return cachedTables;
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'
  `;
  cachedTables = rows.map((r) => `"${r.tablename}"`);
  return cachedTables;
}

// מצב נקי לפני כל מקרה בדיקה. TRUNCATE ... CASCADE ולא deleteMany:
// מהיר יותר, ולא דורש למחוק בסדר תלויות ה-FK.
beforeEach(async () => {
  const tables = await tableNames();
  if (tables.length === 0) return;
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await prisma.$disconnect();
});
