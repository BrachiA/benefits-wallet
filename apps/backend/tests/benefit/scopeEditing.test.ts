import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { AppError } from '../../src/lib/AppError';
import { benefitService } from '../../src/modules/benefit/benefit.service';
import { createBenefit, createBrand, createCategory, createProgram } from '../setup/factories';

// הבאג שנסגר כאן: replaceScopes היה קיים ב-repository ומעולם לא
// נקרא — updateBenefitSchema סינן את scopes החוצה, ולכן לא הייתה
// שום דרך לתקן "למי ההטבה תקפה" אחרי שההטבה כבר קיימת.
describe('עדכון הטבה — שיוך (BenefitScope) ניתן לעריכה', () => {
  it('PATCH בלי scopes אינו נוגע בשיוך הקיים', async () => {
    const program = await createProgram();
    const benefit = await createBenefit({ scopes: [{ programId: program.id }] });

    await benefitService.update(benefit.id, { title: 'כותרת חדשה' });

    const scopes = await prisma.benefitScope.findMany({ where: { benefitId: benefit.id } });
    expect(scopes).toHaveLength(1);
    expect(scopes[0].programId).toBe(program.id);
  });

  it('PATCH עם scopes מחליף את השיוך הקיים לגמרי', async () => {
    const oldProgram = await createProgram();
    const newBrand = await createBrand();
    const benefit = await createBenefit({ scopes: [{ programId: oldProgram.id }] });

    await benefitService.update(benefit.id, { scopes: [{ brandId: newBrand.id }] });

    const scopes = await prisma.benefitScope.findMany({ where: { benefitId: benefit.id } });
    expect(scopes).toHaveLength(1);
    expect(scopes[0].brandId).toBe(newBrand.id);
    expect(scopes[0].programId).toBeNull();
  });

  it('PATCH עם scopes ריק מוחק את כל השיוך (ומעלים את ההטבה מכולם)', async () => {
    const program = await createProgram();
    const benefit = await createBenefit({ scopes: [{ programId: program.id }] });

    await benefitService.update(benefit.id, { scopes: [] });

    expect(await prisma.benefitScope.count({ where: { benefitId: benefit.id } })).toBe(0);
  });

  it('דוחה scope חדש שמפנה לישות שלא קיימת, ולא נוגע בשיוך הישן', async () => {
    const program = await createProgram();
    const benefit = await createBenefit({ scopes: [{ programId: program.id }] });

    await expect(
      benefitService.update(benefit.id, { scopes: [{ programId: '00000000-0000-0000-0000-000000000000' }] })
    ).rejects.toBeInstanceOf(AppError);

    const scopes = await prisma.benefitScope.findMany({ where: { benefitId: benefit.id } });
    expect(scopes).toHaveLength(1);
    expect(scopes[0].programId).toBe(program.id);
  });

  it('דוחה scope ריק לגמרי (בלי אף ישות) — אותו כלל כמו ביצירה', async () => {
    const benefit = await createBenefit({ scopes: [] });
    const category = await createCategory();
    void category;

    await expect(benefitService.update(benefit.id, { scopes: [{}] })).rejects.toBeInstanceOf(AppError);
  });

  it('כמה שורות scope (OR) נשמרות כולן', async () => {
    const program = await createProgram();
    const brand = await createBrand();
    const benefit = await createBenefit({ scopes: [] });

    await benefitService.update(benefit.id, {
      scopes: [{ programId: program.id }, { brandId: brand.id }],
    });

    const scopes = await prisma.benefitScope.findMany({ where: { benefitId: benefit.id } });
    expect(scopes).toHaveLength(2);
  });
});
