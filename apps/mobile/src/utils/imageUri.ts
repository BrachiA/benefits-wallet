import type { Benefit, Brand, Program } from '../api/types';

// ============================================================
// מקור התמונה המועדף לכל ישות. תמיד R2 קודם, ורק אחריו הקישור
// החיצוני המקורי:
//
// r2ImageUrl/defaultLogoUrl הם עותקים שהורדנו ואחסנו אצלנו
// (backend/src/lib/r2Storage.ts) — הם לא נשברים כשאתר המקור
// מתחלף, מסיר תמונה או חוסם hotlinking, וזו בדיוק הסיבה שהם
// נבנו. imageUrl/logoUrl נשמרים כגיבוי בלבד עבור רשומות ישנות
// שטרם עברו הורדה.
// ============================================================

export function benefitImageUri(benefit: Benefit): string | undefined {
  return benefit.r2ImageUrl ?? benefit.imageUrl ?? undefined;
}

export function brandLogoUri(brand: Brand): string | undefined {
  return brand.defaultLogoUrl ?? brand.logoUrl ?? undefined;
}

export function programLogoUri(program: Program): string | undefined {
  return program.defaultLogoUrl ?? program.logoUrl ?? undefined;
}
