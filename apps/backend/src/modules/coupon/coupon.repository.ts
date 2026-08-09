import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { ListCouponsQuery } from './coupon.dto';

export const couponRepository = {
  async findMany(query: ListCouponsQuery, skip: number, take: number) {
    const where: Prisma.CouponWhereInput = {
      deletedAt: null,
      ...(query.benefitId && { benefitId: query.benefitId }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    };
    const [items, total] = await Promise.all([
      prisma.coupon.findMany({ where, skip, take, include: { benefit: true } }),
      prisma.coupon.count({ where }),
    ]);
    return { items, total };
  },

  async findById(id: string) {
    return prisma.coupon.findFirst({ where: { id, deletedAt: null }, include: { benefit: true } });
  },

  async findByCode(code: string) {
    return prisma.coupon.findFirst({ where: { code, deletedAt: null } });
  },

  async create(data: Prisma.CouponCreateInput) {
    return prisma.coupon.create({ data });
  },

  async update(id: string, data: Prisma.CouponUpdateInput) {
    return prisma.coupon.update({ where: { id }, data });
  },

  async softDelete(id: string) {
    return prisma.coupon.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  },

  // אטומי ברמת ה-DB: מונע race condition כששני משתמשים "משתמשים"
  // באותו קופון בו-זמנית ועוברים את maxUses.
  async incrementUsage(id: string) {
    return prisma.coupon.update({ where: { id }, data: { currentUses: { increment: 1 } } });
  },

  // מימוש אטומי: כל התנאים נבדקים בתוך ה-WHERE של ה-UPDATE עצמו,
  // כך שהבדיקה וההגדלה הן פעולה אחת ברמת ה-DB. הגרסה הקודמת קראה
  // את הקופון, בדקה בקוד, ואז הגדילה — ושתי בקשות מקבילות על
  // הקופון האחרון יכלו שתיהן לעבור את הבדיקה לפני שאחת מהן הגדילה.
  //
  // updateMany (ולא update) כי רק הוא מאפשר WHERE על שדות שאינם
  // מפתח ייחודי, ומחזיר count במקום לזרוק — count=0 פירושו
  // שהתנאים לא התקיימו ברגע הכתיבה.
  //
  // ההשוואה currentUses < maxUses היא בין שני שדות של אותה שורה,
  // ולכן נעשית עם field reference של Prisma ולא בקוד.
  async redeemIfAvailable(id: string): Promise<boolean> {
    const result = await prisma.coupon.updateMany({
      where: {
        id,
        isActive: true,
        deletedAt: null,
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          // maxUses=null פירושו ללא הגבלה
          { OR: [{ maxUses: null }, { currentUses: { lt: prisma.coupon.fields.maxUses } }] },
        ],
      },
      data: { currentUses: { increment: 1 } },
    });
    return result.count > 0;
  },
};
