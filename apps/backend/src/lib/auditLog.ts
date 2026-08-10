import { prisma } from './prisma';
import { logger } from './logger';

// ============================================================
// כתיבה ל-AuditLog (שלב 5, ב.5.4). הסכמה מצהירה במפורש: "נדרש כי
// לדשבורד אין Authentication בשלב 1" — אבל שום קוד לא כתב אליו
// עד עכשיו, כלומר לא הייתה שום דרך לדעת מי שינה מה ומתי.
//
// performedBy נשאר null לרוב הפעולות: יש רק סיסמת מנהל משותפת אחת
// (שלב 5, א.3), לא משתמשים בשם. במקומות שבהם המסך כבר אוסף שם
// באופן מפורש (אישור ToS, אישור/דחיית פריט סרוק) — השם מועבר.
//
// כשל בכתיבת האודיט לא אמור להפיל פעולה עסקית אמיתית: זהו יומן
// אבחוני, לא מקור אמת. נתפס ונרשם ללוג בלבד.
// ============================================================

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'ACTIVATE' | 'DEACTIVATE';

export async function recordAudit(params: {
  entityType: string;
  entityId: string;
  action: AuditAction;
  changedFields?: Record<string, unknown>;
  performedBy?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        changedFields: params.changedFields as never,
        performedBy: params.performedBy,
      },
    });
  } catch (err) {
    logger.error({ err, params }, 'Failed to write audit log entry');
  }
}
