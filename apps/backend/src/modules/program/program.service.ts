import { randomUUID } from 'crypto';
import { AppError } from '../../lib/AppError';
import { cache } from '../../lib/cache';
import { recordAudit } from '../../lib/auditLog';
import { uploadImageBuffer } from '../../lib/r2Storage';
import { programRepository } from './program.repository';
import type { CreateProgramInput, ListProgramsQuery, UpdateProgramInput } from './program.dto';

const CACHE_KEY_PREFIX = 'programs:';

export const programService = {
  async list(query: ListProgramsQuery, page: number, pageSize: number) {
    const { items, total } = await programRepository.findMany(query, (page - 1) * pageSize, pageSize);
    return { items, meta: { page, pageSize, total } };
  },

  async getById(id: string) {
    const program = await programRepository.findById(id);
    if (!program) throw AppError.notFound('Program', id);
    return program;
  },

  async create(input: CreateProgramInput) {
    const path = await this.resolvePath(input.slug, input.parentProgramId);
    const { issuerId, parentProgramId, ...rest } = input;
    // as never: אותה פשרה כמו ב-benefit.service — metadata מגיע מ-Zod
    // כ-Record<string, unknown> ו-Prisma דורש InputJsonValue.
    const program = await programRepository.create({
      ...rest,
      path,
      issuer: { connect: { id: issuerId } },
      ...(parentProgramId && { parentProgram: { connect: { id: parentProgramId } } }),
    } as never);
    await cache.del(`${CACHE_KEY_PREFIX}all`);
    await recordAudit({ entityType: 'Program', entityId: program.id, action: 'CREATE', changedFields: input });
    return program;
  },

  async update(id: string, input: UpdateProgramInput) {
    const existing = await this.getById(id);

    // אם slug או parent השתנו, ה-path חייב להתעדכן — אחרת שאילתות
    // "כל הצאצאים" (LIKE path/%) יחזירו תוצאות שגויות בשקט.
    let path: string | undefined;
    if (input.slug || input.parentProgramId !== undefined) {
      path = await this.resolvePath(
        input.slug ?? existing.slug,
        input.parentProgramId !== undefined ? input.parentProgramId : (existing.parentProgramId ?? undefined)
      );
    }

    const { issuerId, parentProgramId, ...rest } = input;
    const program = await programRepository.update(id, {
      ...rest,
      ...(path && { path }),
      ...(issuerId && { issuer: { connect: { id: issuerId } } }),
      ...(parentProgramId !== undefined && {
        parentProgram: parentProgramId ? { connect: { id: parentProgramId } } : { disconnect: true },
      }),
      // חזרה למצב אוטומטי מאפסת defaultLogoUrl/logoSearchedAt כדי
      // שסבב חיפוש הלוגו הבא (modules/logoSearch) יחפש מחדש במקום
      // להישאר תקוע לצמיתות עם התמונה שהייתה קיימת לפני המעבר ל-
      // MANUAL. החלטת עיצוב מתועדת בדוח הסיום (המנהלת עלולה לראות
      // רגעית "בלי לוגו" עד סבב ה-cron הבא).
      ...(input.logoMode === 'AUTO' && existing.logoMode !== 'AUTO' && { defaultLogoUrl: null, logoSearchedAt: null }),
    } as never);
    await cache.del(`${CACHE_KEY_PREFIX}all`);
    await recordAudit({ entityType: 'Program', entityId: id, action: 'UPDATE', changedFields: input });
    return program;
  },

  // העלאה ידנית של לוגו (חלק ד' — לא חיפוש AI): מנהלת בוחרת קובץ
  // בעצמה. מעביר את המועדון ל-MANUAL כתופעת לוואי מכוונת של ההעלאה
  // עצמה — כדי שסבב חיפוש הלוגו הבא (modules/logoSearch, מסנן
  // logoMode:'AUTO' בלבד) לא ידרוס אותה בטעות. logoSearchedAt מתעדכן
  // גם הוא, לתיעוד בלבד (הסינון האמיתי הוא logoMode, לא השדה הזה).
  async uploadManualLogo(id: string, buffer: Buffer, mimeType: string) {
    await this.getById(id);
    const publicUrl = await uploadImageBuffer(buffer, `logos/program/manual/${id}-${randomUUID()}`, mimeType);
    const program = await programRepository.update(id, {
      defaultLogoUrl: publicUrl,
      logoMode: 'MANUAL',
      logoSearchedAt: new Date(),
    });
    await cache.del(`${CACHE_KEY_PREFIX}all`);
    await recordAudit({
      entityType: 'Program',
      entityId: id,
      action: 'UPDATE',
      changedFields: { defaultLogoUrl: publicUrl, logoMode: 'MANUAL', uploadedManually: true },
    });
    return program;
  },

  async remove(id: string) {
    await this.getById(id);
    const result = await programRepository.softDelete(id);
    await cache.del(`${CACHE_KEY_PREFIX}all`);
    await recordAudit({ entityType: 'Program', entityId: id, action: 'DELETE' });
    return result;
  },

  // בונה materialized path: "max/max-platinum". אם יש parent, ה-path
  // שלו הוא הפריפיקס. תכנון זה נשען על ש-slug ייחודי גלובלית (אכיפה
  // ב-DB), כך שאין התנגשות path בין ענפי היררכיה שונים.
  async resolvePath(slug: string, parentProgramId?: string): Promise<string> {
    if (!parentProgramId) return slug;
    const parent = await programRepository.findByIdRaw(parentProgramId);
    if (!parent) throw AppError.validation(`parentProgramId ${parentProgramId} not found`);
    return `${parent.path}/${slug}`;
  },
};
