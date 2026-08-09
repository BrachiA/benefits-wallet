import { prisma } from '../../lib/prisma';
import { scraperRepository } from './scraper.repository';

export type RawScrapedFields = {
  title: string;
  shortDescription?: string;
  discountValue?: number;
  imageUrl?: string;
  externalId: string;
  detailUrl?: string;
};

export type MatchResult =
  | { kind: 'DUPLICATE'; existingItemId: string } // ראינו את הפריט הזה בדיוק כבר, שום דבר לא השתנה
  | { kind: 'UPDATE'; benefitId: string; changedFields: string[] } // הטבה קיימת עם ערכים שהשתנו
  | { kind: 'UNCHANGED'; benefitId: string } // הטבה קיימת, שום שינוי אמיתי
  | { kind: 'NEW' }; // לא נמצאה התאמה — מועמדת להטבה חדשה

export const matchingService = {
  // שלב 1: בדיקת "ראינו כבר את הפריט הזה בריצה קודמת" — לפי המפתח
  // היציב (sourceId, externalId), לא לפי טקסט.
  async findPreviousItem(sourceId: string, externalId: string) {
    return scraperRepository.findByExternalId(sourceId, externalId);
  },

  // שלב 2: אם הפריט חדש (לא נראה קודם) או שכבר ראינו אותו אבל בלי
  // matchedBenefitId (כלומר עדיין ממתין לאישור כהטבה חדשה) — בודקים
  // אם יש הטבה קיימת שמתאימה, כדי לא ליצור כפילות בטעות.
  async match(sourceId: string, fields: RawScrapedFields): Promise<MatchResult> {
    const previous = await this.findPreviousItem(sourceId, fields.externalId);

    if (previous?.matchedBenefitId) {
      // כבר קושר להטבה קיימת בעבר — משווים ערכים לזיהוי שינוי אמיתי
      const benefit = await prisma.benefit.findUnique({ where: { id: previous.matchedBenefitId } });
      if (!benefit) return { kind: 'NEW' }; // ההטבה נמחקה בינתיים; מתייחסים כחדש

      const changedFields = this.diffFields(benefit, fields);
      if (changedFields.length === 0) return { kind: 'UNCHANGED', benefitId: benefit.id };
      return { kind: 'UPDATE', benefitId: benefit.id, changedFields };
    }

    // אין קישור קודם — בודקים אם קיימת הטבה "דומה מספיק" לפי slug
    // גזור מהכותרת, כדי לתפוס מקרה שבו הטבה נוצרה ידנית בדשבורד
    // ואז נסרקה מאותו מקור בפעם הראשונה (למנוע כפילות).
    const candidateSlug = this.slugify(fields.title);
    const existingBenefit = await prisma.benefit.findFirst({
      where: { slug: candidateSlug, deletedAt: null },
    });

    if (existingBenefit) {
      const changedFields = this.diffFields(existingBenefit, fields);
      if (changedFields.length === 0) return { kind: 'UNCHANGED', benefitId: existingBenefit.id };
      return { kind: 'UPDATE', benefitId: existingBenefit.id, changedFields };
    }

    return { kind: 'NEW' };
  },

  // השוואת שדות בין הטבה קיימת לערכים שנסרקו. משווה רק שדות
  // שהסורק בפועל סיפק (undefined = "לא נסרק", לא "נמחק").
  diffFields(
    benefit: { title: string; shortDescription: string; discountValue: unknown; imageUrl: string | null },
    fields: RawScrapedFields
  ): string[] {
    const changed: string[] = [];
    if (fields.title !== undefined && fields.title !== benefit.title) changed.push('title');
    if (fields.shortDescription !== undefined && fields.shortDescription !== benefit.shortDescription) {
      changed.push('shortDescription');
    }
    if (fields.discountValue !== undefined && Number(benefit.discountValue) !== fields.discountValue) {
      changed.push('discountValue');
    }
    if (fields.imageUrl !== undefined && fields.imageUrl !== benefit.imageUrl) changed.push('imageUrl');
    return changed;
  },

  slugify(title: string): string {
    return title
      .trim()
      .toLowerCase()
      .replace(/[^\u0590-\u05FFa-z0-9\s-]/g, '') // שומר עברית + אנגלית + מספרים
      .replace(/\s+/g, '-')
      .slice(0, 100);
  },
};
