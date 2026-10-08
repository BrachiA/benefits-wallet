import { prisma } from '../../lib/prisma';
import { Prisma } from '@prisma/client';
import { buildBenefitVisibilityWhere } from '../benefit/benefitVisibility';
import { GROUP_DISPLAY_ORDER, GROUP_LABELS, isNewBenefit, resolveBenefitGroup, sortWithinGroup } from './benefitGroup';
import type { GroupedRecommendationsQuery } from './recommendation.dto';
import type { BenefitGroupKey } from './benefitGroup';

export const recommendationService = {
  // מחזיר תצוגה מוכנה-לרינדור: מערך קבוצות בסדר התצוגה הקבוע,
  // כל קבוצה עם ההטבות שלה כבר ממוינות. הקליינט לא צריך לדעת
  // כלום על סדר-קבוצות או לוגיקת מיון — רק לרנדר את מה שחוזר.
  async getGrouped(query: GroupedRecommendationsQuery) {
    if (!query.brandId && !query.categoryId && !query.programIds?.length) {
      // בלי שום עוגן (מותג/קטגוריה/מועדון) השאילתה תחזיר את כל
      // ההטבות הפעילות במערכת — לא שימושי ולא מה שהמנוע נועד לו.
      // דורשים לפחות עוגן אחד, כמו בתרחיש "פוקס" מהדיון.
      return { groups: [] };
    }

    const where: Prisma.BenefitWhereInput = {
      AND: [
        buildBenefitVisibilityWhere({
          audience: { programIds: query.programIds, brandId: query.brandId },
        }),
        ...(query.categoryId ? [{ categoryId: query.categoryId }] : []),
      ],
    };

    const benefits = await prisma.benefit.findMany({
      where,
      include: { category: true, tags: { include: { tag: true } } },
    });

    // isNewOnly מסנן כאן, לפני הקיבוץ — כך קבוצה שכל ההטבות שלה
    // "לא חדשות" פשוט לא תופיע בתוצאה, ולא תישאר ריקה על המסך.
    const filtered = query.isNewOnly
      ? benefits.filter((b) => isNewBenefit(b.startDate, b.createdAt))
      : benefits;

    const byGroup = new Map<BenefitGroupKey, typeof filtered>();
    for (const benefit of filtered) {
      const group = resolveBenefitGroup(benefit.benefitType);
      if (!byGroup.has(group)) byGroup.set(group, []);
      byGroup.get(group)!.push(benefit);
    }

    const groups = GROUP_DISPLAY_ORDER.filter((key) => byGroup.has(key)).map((key) => {
      const groupBenefits = byGroup.get(key)!;
      const sorted = sortWithinGroup(groupBenefits, key);
      return {
        group: key,
        label: GROUP_LABELS[key],
        benefits: sorted.slice(0, query.limitPerGroup).map((b) => ({
          ...b,
          isNew: isNewBenefit(b.startDate, b.createdAt),
        })),
      };
    });

    return { groups };
  },
};
