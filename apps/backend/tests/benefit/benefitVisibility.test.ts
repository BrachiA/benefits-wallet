import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma';
import { buildBenefitVisibilityWhere } from '../../src/modules/benefit/benefitVisibility';
import { benefitRepository } from '../../src/modules/benefit/benefit.repository';
import { searchService } from '../../src/modules/search/search.service';
import { createBenefit, createBrand, createCategory, createProgram } from '../setup/factories';

// הבדיקות רצות מול Postgres אמיתי ולא מול Prisma ממוקק, במכוון:
// מה שנבדק כאן הוא האם תנאי ה-where *עובד*, לא האם הועבר. מוק היה
// עובר בהצלחה גם על הבאג שבגללו הקובץ הזה נכתב (spread שדרס את
// תנאי התפוגה).

const DAY = 24 * 60 * 60 * 1000;
const past = () => new Date(Date.now() - DAY);
const future = () => new Date(Date.now() + DAY);

async function visibleIds(where: Awaited<ReturnType<typeof buildBenefitVisibilityWhere>>) {
  const rows = await prisma.benefit.findMany({ where, select: { id: true } });
  return rows.map((r) => r.id);
}

describe('buildBenefitVisibilityWhere — תוקף בזמן', () => {
  it('מסתיר הטבה שפג תוקפה', async () => {
    const expired = await createBenefit({ endDate: past() });
    const live = await createBenefit({ endDate: future() });

    const ids = await visibleIds(buildBenefitVisibilityWhere());

    expect(ids).toContain(live.id);
    expect(ids).not.toContain(expired.id);
  });

  it('מסתיר הטבה שטרם נכנסה לתוקף', async () => {
    const notStarted = await createBenefit({ startDate: future() });
    const started = await createBenefit({ startDate: past() });

    const ids = await visibleIds(buildBenefitVisibilityWhere());

    expect(ids).toContain(started.id);
    expect(ids).not.toContain(notStarted.id);
  });

  it('מציג הטבה ללא תאריכים כלל', async () => {
    const always = await createBenefit({ startDate: null, endDate: null });
    expect(await visibleIds(buildBenefitVisibilityWhere())).toContain(always.id);
  });

  it('מסתיר הטבה כבויה או מחוקה', async () => {
    const inactive = await createBenefit({ isActive: false });
    const deleted = await createBenefit({ deletedAt: new Date() });

    const ids = await visibleIds(buildBenefitVisibilityWhere());

    expect(ids).not.toContain(inactive.id);
    expect(ids).not.toContain(deleted.id);
  });

  it('includeInactive מחזיר גם כבויה וגם פגת תוקף — אך לא מחוקה', async () => {
    const inactive = await createBenefit({ isActive: false });
    const expired = await createBenefit({ endDate: past() });
    const deleted = await createBenefit({ deletedAt: new Date() });

    const ids = await visibleIds(buildBenefitVisibilityWhere({ includeInactive: true }));

    // תצוגת הניהול נועדה לאפשר עריכה של הטבות שאינן גלויות. מחיקה
    // רכה היא כן החלטה סופית, ולכן נשארת מוסתרת גם כאן.
    expect(ids).toContain(inactive.id);
    expect(ids).toContain(expired.id);
    expect(ids).not.toContain(deleted.id);
  });

  it('הזמן מחושב בכל קריאה ולא מוקפא בטעינת המודול', async () => {
    // הטבה שפגה 150ms אחרי היצירה. אם now היה נקבע פעם אחת בזמן
    // טעינת המודול, השאילתה השנייה עדיין הייתה מחזירה אותה.
    const soon = await createBenefit({ endDate: new Date(Date.now() + 150) });

    expect(await visibleIds(buildBenefitVisibilityWhere())).toContain(soon.id);
    await new Promise((r) => setTimeout(r, 300));
    expect(await visibleIds(buildBenefitVisibilityWhere())).not.toContain(soon.id);
  });
});

describe('buildBenefitVisibilityWhere — שיוך', () => {
  it('הטבה של מועדון אחר לא מגיעה למשתמשת', async () => {
    const mine = await createProgram();
    const other = await createProgram();
    const forMe = await createBenefit({ scopes: [{ programId: mine.id }] });
    const forOthers = await createBenefit({ scopes: [{ programId: other.id }] });

    const ids = await visibleIds(buildBenefitVisibilityWhere({ audience: { programIds: [mine.id] } }));

    expect(ids).toContain(forMe.id);
    expect(ids).not.toContain(forOthers.id);
  });

  it('scope עם programId=null הוא "כל המועדונים" ומגיע לכולם', async () => {
    const mine = await createProgram();
    const global = await createBenefit({ scopes: [{ programId: undefined, brandId: undefined, cityId: undefined }] });

    const ids = await visibleIds(buildBenefitVisibilityWhere({ audience: { programIds: [mine.id] } }));

    expect(ids).toContain(global.id);
  });

  it('הטבה בלי שום שיוך לא זולגת למשתמשת עם מועדונים', async () => {
    const mine = await createProgram();
    const orphan = await createBenefit({ scopes: [] });

    const ids = await visibleIds(buildBenefitVisibilityWhere({ audience: { programIds: [mine.id] } }));

    expect(ids).not.toContain(orphan.id);
  });

  it('מסתיר הטבה ששייכת למועדון שנמחק', async () => {
    const deletedProgram = await createProgram({ deletedAt: new Date(), isActive: false });
    const orphaned = await createBenefit({ scopes: [{ programId: deletedProgram.id }] });

    const ids = await visibleIds(
      buildBenefitVisibilityWhere({ audience: { programIds: [deletedProgram.id] } })
    );

    expect(ids).not.toContain(orphaned.id);
  });

  it('מסתיר הטבה ששייכת למועדון שכובה', async () => {
    const inactiveProgram = await createProgram({ isActive: false });
    const hidden = await createBenefit({ scopes: [{ programId: inactiveProgram.id }] });

    const ids = await visibleIds(
      buildBenefitVisibilityWhere({ audience: { programIds: [inactiveProgram.id] } })
    );

    expect(ids).not.toContain(hidden.id);
  });

  it('מסתיר הטבה ששייכת למותג שנמחק', async () => {
    const category = await createCategory();
    const deletedBrand = await createBrand({ categoryId: category.id, deletedAt: new Date(), isActive: false });
    const hidden = await createBenefit({ scopes: [{ brandId: deletedBrand.id }] });

    const ids = await visibleIds(buildBenefitVisibilityWhere({ audience: { brandId: deletedBrand.id } }));

    expect(ids).not.toContain(hidden.id);
  });

  it('cityId נאכף רק כשסופקה עיר', async () => {
    const city = await prisma.city.create({ data: { name: `עיר-${Date.now()}` } });
    const cityBound = await createBenefit({ scopes: [{ cityId: city.id }] });

    // בלי עיר בבקשה: ההגבלה הגיאוגרפית לא מסננת, וההטבה מוצגת.
    // זו התנהגות מכוונת כל עוד לאפליקציה אין מנגנון מיקום.
    const withoutCity = await visibleIds(buildBenefitVisibilityWhere({ audience: { cityId: undefined } }));
    expect(withoutCity).toContain(cityBound.id);

    // עם עיר תואמת: מוצגת. עם עיר אחרת: לא.
    const otherCity = await prisma.city.create({ data: { name: `עיר-אחרת-${Date.now()}` } });
    expect(await visibleIds(buildBenefitVisibilityWhere({ audience: { cityId: city.id } }))).toContain(cityBound.id);
    expect(await visibleIds(buildBenefitVisibilityWhere({ audience: { cityId: otherCity.id } }))).not.toContain(
      cityBound.id
    );
  });
});

describe('התנהגות מאושרת: משתמשת ללא מועדונים שמורים', () => {
  // ההתנהגות הזו אושרה במפורש כמכוונת. הבדיקה נועלת אותה כדי
  // ששינוי עתידי לא "יתקן" אותה בטעות למסך ריק: כשאין programIds,
  // תנאי השיוך לא מתווסף כלל, והמשתמשת רואה את כל ההטבות התקפות.
  it('רואה את כל ההטבות התקפות, כולל כאלה ששייכות למועדונים שאין לה', async () => {
    const someoneElsesProgram = await createProgram();
    const scoped = await createBenefit({ scopes: [{ programId: someoneElsesProgram.id }] });
    const orphan = await createBenefit({ scopes: [] });
    const expired = await createBenefit({ endDate: past() });

    const ids = await visibleIds(buildBenefitVisibilityWhere({ audience: { programIds: [] } }));

    expect(ids).toContain(scoped.id);
    expect(ids).toContain(orphan.id);
    // "בלי סינון שיוך" אינו "בלי סינון בכלל" — תוקף בזמן עדיין נאכף.
    expect(ids).not.toContain(expired.id);
  });

  it('גם כשאין audience כלל (למשל תצוגת ניהול)', async () => {
    const prog = await createProgram();
    const scoped = await createBenefit({ scopes: [{ programId: prog.id }] });

    expect(await visibleIds(buildBenefitVisibilityWhere())).toContain(scoped.id);
  });
});

describe('הצרכנים בפועל מכבדים את תנאי הנראות', () => {
  it('findMatchingBenefits עם search לא מאבד את סינון התפוגה', async () => {
    // זו הרגרסיה המקורית: תנאי ה-search הוגדר תחת אותו מפתח OR
    // ומחק את תנאי התפוגה, כך שחיפוש החזיר הטבות שפג תוקפן.
    const expired = await createBenefit({ title: 'מבצע ייחודי לבדיקה', endDate: past() });
    const live = await createBenefit({ title: 'מבצע ייחודי לבדיקה', endDate: future() });

    const { items } = await benefitRepository.findMatchingBenefits(
      { search: 'מבצע ייחודי לבדיקה', sortBy: 'priority' },
      0,
      50
    );
    const ids = items.map((i) => i.id);

    expect(ids).toContain(live.id);
    expect(ids).not.toContain(expired.id);
  });

  it('חיפוש-על לא מחזיר הטבה שפג תוקפה', async () => {
    const expired = await createBenefit({ title: 'ביטוי נדיר לחיפוש', endDate: past() });
    const live = await createBenefit({ title: 'ביטוי נדיר לחיפוש', endDate: future() });

    const results = await searchService.searchAll({
      q: 'ביטוי נדיר לחיפוש',
      limitPerType: 10,
    } as Parameters<typeof searchService.searchAll>[0]);
    const ids = results.benefits.map((b) => b.id);

    expect(ids).toContain(live.id);
    expect(ids).not.toContain(expired.id);
  });

  it('חיפוש-על מסנן לפי המועדונים של מי שמחפש', async () => {
    const mine = await createProgram();
    const other = await createProgram();
    const forMe = await createBenefit({ title: 'כותרת משותפת לבדיקה', scopes: [{ programId: mine.id }] });
    const forOthers = await createBenefit({ title: 'כותרת משותפת לבדיקה', scopes: [{ programId: other.id }] });

    const results = await searchService.searchAll({
      q: 'כותרת משותפת לבדיקה',
      limitPerType: 10,
      programIds: [mine.id],
    } as Parameters<typeof searchService.searchAll>[0]);
    const ids = results.benefits.map((b) => b.id);

    expect(ids).toContain(forMe.id);
    expect(ids).not.toContain(forOthers.id);
  });
});
