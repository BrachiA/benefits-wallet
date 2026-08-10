// תואם ל-scrapeConfigSchema ב-backend/src/modules/scraper/scraper.dto.ts.
// כל שדה תחת fields הוא CSS selector, או '@attr' לתכונה על הכרטיס
// עצמו, או 'selector::attr(attr)' לתכונה על תת-אלמנט — ראו
// extractField ב-scraper.service.ts.
export type ScrapeConfig = {
  listSelector: string;
  paginationParam?: string;
  maxPages?: number;
  fields: {
    title: string;
    shortDescription?: string;
    discountValue?: string;
    imageUrl?: string;
    externalId: string;
    detailUrl?: string;
  };
};

export type ScraperSource = {
  id: string;
  slug: string;
  name: string;
  sourceType: 'ISSUER_SITE' | 'BRAND_SITE' | 'AGGREGATOR_SITE';
  baseUrl: string;
  renderMode: 'HTTP' | 'HEADLESS_BROWSER';
  scrapeConfig: ScrapeConfig;
  requestDelayMs: number;
  scheduleCron: string;
  // עוגן השיוך האוטומטי (שלב 5, א.2) — כשמוגדרים, הטבה חדשה
  // שעוברת את סף הביטחון יכולה להתפרסם לגמרי לבד, כולל שיוך.
  defaultProgramId?: string;
  defaultBrandId?: string;
  defaultCategoryId?: string;
  tosStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  tosReviewedBy?: string;
  tosReviewedAt?: string;
  tosNotes?: string;
  isActive: boolean;
  lastRunAt?: string;
  lastRunStatus?: 'SUCCESS' | 'PARTIAL' | 'FAILED';
};

// תוצאת POST /scraper/sources/:id/run — רשומת הריצה שהסתיימה.
// כישלון אינו מגיע לכאן אלא כשגיאה (SCRAPER_RUN_FAILED).
export type ScraperRunResult = {
  id: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  itemsFound: number;
  itemsUpdated: number;
  itemsFlagged: number;
  itemsSkipped: number;
  errorMessage?: string;
};

export const sourceTypeLabels: Record<string, string> = {
  ISSUER_SITE: 'אתר מנפיק',
  BRAND_SITE: 'אתר מותג',
  AGGREGATOR_SITE: 'אתר מרכז הטבות',
};
