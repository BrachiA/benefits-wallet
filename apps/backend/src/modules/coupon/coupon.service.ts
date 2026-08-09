import { AppError } from '../../lib/AppError';
import { couponRepository } from './coupon.repository';
import type { CreateCouponInput, ListCouponsQuery, UpdateCouponInput } from './coupon.dto';

export const couponService = {
  async list(query: ListCouponsQuery, page: number, pageSize: number) {
    const { items, total } = await couponRepository.findMany(query, (page - 1) * pageSize, pageSize);
    return { items, meta: { page, pageSize, total } };
  },

  async getById(id: string) {
    const coupon = await couponRepository.findById(id);
    if (!coupon) throw AppError.notFound('Coupon', id);
    return coupon;
  },

  async create(input: CreateCouponInput) {
    // ייחודיות code נאכפת גם ב-DB (constraint לוגי עתידי), אך בדיקה
    // כאן נותנת הודעת שגיאה ברורה במקום לחכות ל-P2002 של Prisma.
    const existing = await couponRepository.findByCode(input.code);
    if (existing) throw AppError.validation(`Coupon code "${input.code}" already exists`);

    const { benefitId, ...rest } = input;
    return couponRepository.create({ ...rest, benefit: { connect: { id: benefitId } } });
  },

  async update(id: string, input: UpdateCouponInput) {
    await this.getById(id);
    if (input.code) {
      const existing = await couponRepository.findByCode(input.code);
      if (existing && existing.id !== id) throw AppError.validation(`Coupon code "${input.code}" already exists`);
    }
    return couponRepository.update(id, input);
  },

  async remove(id: string) {
    await this.getById(id);
    return couponRepository.softDelete(id);
  },

  // לוגיקת מימוש: נבדקת בנפרד מ-CRUD כי היא תיקרא בעתיד מ-endpoint
  // ייעודי ("redeem"), לא רק מהדשבורד.
  async redeem(id: string) {
    await this.getById(id); // 404 אם הקופון לא קיים כלל

    // הבדיקה וההגדלה נעשות כפעולה אטומית אחת ב-DB. חשוב שזה יהיה
    // הצעד הראשון ולא בדיקה מקדימה בקוד: קופון אחרון שנתפס בשתי
    // בקשות מקבילות היה עובר את שתיהן.
    const redeemed = await couponRepository.redeemIfAvailable(id);

    if (!redeemed) {
      // הפעולה נדחתה. שולפים שוב רק כדי להסביר *למה* — זו הודעה
      // למשתמש, לא שער הגנה (השער כבר נאכף למעלה).
      const coupon = await this.getById(id);
      if (!coupon.isActive) throw AppError.validation('Coupon is not active');
      if (coupon.expiresAt && coupon.expiresAt < new Date()) throw AppError.validation('Coupon has expired');
      if (coupon.maxUses !== null && coupon.currentUses >= coupon.maxUses) {
        throw AppError.validation('Coupon usage limit reached');
      }
      // התנאים נראים תקינים עכשיו אך הכתיבה נדחתה — כלומר בקשה
      // מקבילה תפסה את השימוש האחרון בין שתי הפעולות.
      throw AppError.validation('Coupon is no longer available');
    }

    return this.getById(id);
  },
};
