export type ScraperSource = {
  id: string;
  slug: string;
  name: string;
  sourceType: 'ISSUER_SITE' | 'BRAND_SITE' | 'AGGREGATOR_SITE';
  baseUrl: string;
  renderMode: 'HTTP' | 'HEADLESS_BROWSER';
  requestDelayMs: number;
  scheduleCron: string;
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
