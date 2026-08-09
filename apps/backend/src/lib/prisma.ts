import { PrismaClient } from '@prisma/client';

// Singleton מוצמד ל-globalThis כדי למנוע ריבוי חיבורים בזמן פיתוח עם
// hot-reload (כל reload בלי singleton יוצר PrismaClient חדש, וכל אחד
// פותח connection pool משלו מול Postgres עד לאזילת החיבורים).
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV === 'development') {
  global.__prisma = prisma;
}
