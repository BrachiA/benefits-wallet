import { describe, expect, it } from 'vitest';
import { isNewBenefit } from '../../src/modules/recommendation/benefitGroup';

// פונקציה טהורה — בלי DB, בשונה משאר הבדיקות בתיקייה הזו.

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

describe('isNewBenefit', () => {
  it('משתמשת ב-startDate כשהוא קיים, לא ב-createdAt', () => {
    const oldCreation = daysAgo(365);
    expect(isNewBenefit(daysAgo(3), oldCreation)).toBe(true);
    expect(isNewBenefit(daysAgo(10), oldCreation)).toBe(false);
  });

  it('נופלת ל-createdAt כשאין startDate', () => {
    expect(isNewBenefit(null, daysAgo(3))).toBe(true);
    expect(isNewBenefit(null, daysAgo(10))).toBe(false);
  });

  it('גבול מדויק: בדיוק 7 ימים עדיין נחשב חדש', () => {
    const cutoff = new Date(Date.now() - 7 * DAY);
    expect(isNewBenefit(cutoff, daysAgo(365))).toBe(true);
  });
});
