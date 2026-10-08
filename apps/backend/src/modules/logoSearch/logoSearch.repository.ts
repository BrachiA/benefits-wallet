import { prisma } from '../../lib/prisma';

export const logoSearchRepository = {
  // רק מועדונים/מותגים במצב AUTO (logoMode) שעדיין אין להם לוגו
  // ברירת מחדל וטרם נוסה חיפוש בכלל (logoSearchedAt=null) — ברגע
  // שנוסה (הצלחה או כישלון) לא מנסים שוב אוטומטית, אחרת כל סבב cron
  // שעתי היה מבזבז מכסת Grounding על אותם מועדונים-בלי-לוגו לנצח.
  // מנהלת יכולה לאפס ידנית ע"י מעבר ל-MANUAL וחזרה ל-AUTO (מנקה את
  // logoSearchedAt, ראו program.service/brand.service).
  async findProgramsNeedingLogo(limit: number) {
    return prisma.program.findMany({
      where: { deletedAt: null, logoMode: 'AUTO', defaultLogoUrl: null, logoSearchedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true, name: true },
    });
  },

  async findBrandsNeedingLogo(limit: number) {
    return prisma.brand.findMany({
      where: { deletedAt: null, logoMode: 'AUTO', defaultLogoUrl: null, logoSearchedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true, name: true },
    });
  },

  async markProgramLogoResolved(id: string, defaultLogoUrl: string | null) {
    return prisma.program.update({
      where: { id },
      data: { logoSearchedAt: new Date(), ...(defaultLogoUrl && { defaultLogoUrl }) },
    });
  },

  async markBrandLogoResolved(id: string, defaultLogoUrl: string | null) {
    return prisma.brand.update({
      where: { id },
      data: { logoSearchedAt: new Date(), ...(defaultLogoUrl && { defaultLogoUrl }) },
    });
  },
};
