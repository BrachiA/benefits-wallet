import { prisma } from '../../lib/prisma';

// AlertSettings הוא singleton — שורה אחת בלבד אי-פעם, לא CRUD כללי.
// אותו דפוס getOrCreate כמו העוגן הטכני ב-extensionIngest.service.ts.
export const settingsRepository = {
  async getOrCreateAlertSettings() {
    const existing = await prisma.alertSettings.findFirst();
    if (existing) return existing;
    return prisma.alertSettings.create({ data: {} }); // emailAlertsEnabled ברירת מחדל true מהסכמה
  },

  async updateAlertSettings(id: string, emailAlertsEnabled: boolean) {
    return prisma.alertSettings.update({ where: { id }, data: { emailAlertsEnabled } });
  },
};
