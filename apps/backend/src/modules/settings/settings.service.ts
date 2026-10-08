import { recordAudit } from '../../lib/auditLog';
import { settingsRepository } from './settings.repository';
import type { UpdateAlertSettingsInput } from './settings.dto';

export const settingsService = {
  async getAlertSettings() {
    return settingsRepository.getOrCreateAlertSettings();
  },

  async updateAlertSettings(input: UpdateAlertSettingsInput) {
    const current = await settingsRepository.getOrCreateAlertSettings();
    const updated = await settingsRepository.updateAlertSettings(current.id, input.emailAlertsEnabled);
    await recordAudit({
      entityType: 'AlertSettings',
      entityId: updated.id,
      action: 'UPDATE',
      changedFields: { emailAlertsEnabled: input.emailAlertsEnabled },
      performedBy: input.changedBy,
    });
    return updated;
  },

  // נקודת האמת היחידה ל"האם מותר לשלוח מייל התראה עכשיו" — נקראת
  // מ-scraperAlerts.ts לפני כל שליחה. קריאת DB ישירה בלי cache:
  // זה נקרא רק כשיש התראה בפועל לשלוח (לא בכל request), אז אין
  // הצדקה לשכבת cache עם סיכון להישאר "תקוע" על ערך ישן אחרי שינוי.
  async isEmailAlertsEnabled(): Promise<boolean> {
    const settings = await settingsRepository.getOrCreateAlertSettings();
    return settings.emailAlertsEnabled;
  },
};
