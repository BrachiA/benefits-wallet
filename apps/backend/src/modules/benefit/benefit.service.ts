import { prisma } from '../../lib/prisma';
import { AppError } from '../../lib/AppError';
import { benefitRepository } from './benefit.repository';
import { calculateValueScore } from '../recommendation/valueScore';
import type { CreateBenefitInput, UpdateBenefitInput, ListBenefitsQuery } from './benefit.dto';

export const benefitService = {
  async list(query: ListBenefitsQuery, page: number, pageSize: number) {
    const { items, total } = await benefitRepository.findMatchingBenefits(
      query,
      (page - 1) * pageSize,
      pageSize
    );
    return { items, meta: { page, pageSize, total } };
  },

  async getById(id: string) {
    const benefit = await benefitRepository.findById(id);
    if (!benefit) throw AppError.notFound('Benefit', id);
    return benefit;
  },

  async create(input: CreateBenefitInput) {
    // ולידציה עסקית שחורגת מ-Zod: כל FK בתוך ה-scopes חייב להתקיים
    // בפועל. Zod מוודא שזה uuid תקין, לא שהרשומה קיימת.
    await this.validateScopeReferences(input.scopes);

    const { scopes, categoryId, ...benefitData } = input;
    const valueScore = await this.computeValueScore(input);

    return benefitRepository.create({
      ...benefitData,
      valueScore,
      category: { connect: { id: categoryId } },
      scopes: { createMany: { data: scopes } },
    } as never);
  },

  async update(id: string, input: UpdateBenefitInput) {
    const existing = await this.getById(id); // זורק 404 אם לא קיים, לפני שמנסים לעדכן
    const { categoryId, ...rest } = input;

    // valueScore מחושב מחדש רק אם שדה רלוונטי לחישוב בפועל השתנה
    // (לא בכל PATCH — עדכון isPopular למשל לא אמור לגרום לקריאת
    // DB נוספת לשליפת קטגוריה). ממזג עם הערכים הקיימים כדי לחשב
    // נכון גם עדכון חלקי.
    const affectsScore = ['benefitType', 'discountValue', 'discountUnit', 'minPurchaseAmount', 'categoryId'].some(
      (field) => field in input
    );
    const valueScore = affectsScore
      ? await this.computeValueScore({
          benefitType: input.benefitType ?? existing.benefitType,
          discountValue: input.discountValue ?? (existing.discountValue ? Number(existing.discountValue) : undefined),
          discountUnit: input.discountUnit ?? existing.discountUnit ?? undefined,
          minPurchaseAmount:
            input.minPurchaseAmount ?? (existing.minPurchaseAmount ? Number(existing.minPurchaseAmount) : undefined),
          categoryId: categoryId ?? existing.categoryId,
        })
      : undefined;

    return benefitRepository.update(id, {
      ...rest,
      ...(valueScore !== undefined && { valueScore }),
      ...(categoryId && { category: { connect: { id: categoryId } } }),
    } as never);
  },

  async remove(id: string) {
    await this.getById(id);
    return benefitRepository.softDelete(id);
  },

  // עוטף calculateValueScore הטהור עם שליפת ה-categorySlug שנדרש
  // לנרמול הטבות DISCOUNT_FIXED/CASHBACK ללא minPurchaseAmount
  // משלהן (ראו valueScore.ts). קריאת DB יחידה קטנה, לא ה-Category
  // המלאה.
  async computeValueScore(input: {
    benefitType: string;
    discountValue?: number;
    discountUnit?: string;
    minPurchaseAmount?: number;
    categoryId: string;
  }): Promise<number> {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId }, select: { slug: true } });
    return calculateValueScore({
      benefitType: input.benefitType,
      discountValue: input.discountValue,
      discountUnit: input.discountUnit as 'PERCENT' | 'ILS' | 'POINTS' | undefined,
      minPurchaseAmount: input.minPurchaseAmount,
      categorySlug: category?.slug,
    });
  },

  async validateScopeReferences(scopes: CreateBenefitInput['scopes']) {
    for (const scope of scopes) {
      if (!scope.programId && !scope.brandId && !scope.storeId && !scope.cityId) {
        throw AppError.validation('Each scope must reference at least one entity (program/brand/store/city)');
      }
    }

    const programIds = scopes.map((s) => s.programId).filter(Boolean) as string[];
    const brandIds = scopes.map((s) => s.brandId).filter(Boolean) as string[];
    const storeIds = scopes.map((s) => s.storeId).filter(Boolean) as string[];
    // cityId נבדק כמו כל שאר הצירים. בלעדיו אפשר היה לשמור הגבלה
    // גיאוגרפית שמצביעה לעיר שאינה קיימת — ה-FK ב-DB אמנם תופס
    // זאת, אך רק כשגיאת P2003 סתומה במקום הודעה מובנת.
    const cityIds = scopes.map((s) => s.cityId).filter(Boolean) as string[];

    const [programCount, brandCount, storeCount, cityCount] = await Promise.all([
      programIds.length ? prisma.program.count({ where: { id: { in: programIds } } }) : 0,
      brandIds.length ? prisma.brand.count({ where: { id: { in: brandIds } } }) : 0,
      storeIds.length ? prisma.store.count({ where: { id: { in: storeIds } } }) : 0,
      cityIds.length ? prisma.city.count({ where: { id: { in: cityIds } } }) : 0,
    ]);

    if (programCount !== new Set(programIds).size) throw AppError.validation('One or more programId not found');
    if (brandCount !== new Set(brandIds).size) throw AppError.validation('One or more brandId not found');
    if (storeCount !== new Set(storeIds).size) throw AppError.validation('One or more storeId not found');
    if (cityCount !== new Set(cityIds).size) throw AppError.validation('One or more cityId not found');
  },
};
