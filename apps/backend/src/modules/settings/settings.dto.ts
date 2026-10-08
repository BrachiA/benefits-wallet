import { z } from 'zod';

// changedBy נדרש (לא אופציונלי) — אותו דפוס בדיוק כמו reviewTos/
// reviewItem: שינוי שצריך תיעוד מפורש של מי ומתי, לא PATCH שקט.
export const updateAlertSettingsSchema = z.object({
  emailAlertsEnabled: z.boolean(),
  changedBy: z.string().min(1),
});

export type UpdateAlertSettingsInput = z.infer<typeof updateAlertSettingsSchema>;
