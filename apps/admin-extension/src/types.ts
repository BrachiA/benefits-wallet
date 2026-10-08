// טיפוסים בלבד — מיובאים תמיד עם `import type`, נמחקים לגמרי בקומפילציה.
// אין תלות ריצה בקובץ הזה, כדי ש-popup.js (המוזרק/נטען כ-<script type="module">)
// יישאר קובץ יחיד עצמאי.

export type ExtractedItem = {
  externalId: string;
  title: string;
  shortDescription?: string;
  category?: string;
  originalPrice?: number;
  discountedPrice?: number;
  discountValue?: number;
  discountUnit?: 'PERCENT' | 'ILS';
  imageUrl?: string;
  termsAndConditions?: string;
  validUntil?: string;
  detailUrl?: string;
};

export type ExtractionResult = {
  items: ExtractedItem[];
  warnings: string[];
  pageTitle: string;
  pageUrl: string;
};

export type IngestReport = {
  runId: string;
  pageUrl: string;
  totalItems: number;
  created: number;
  updated: number;
  flagged: number;
  skipped: number;
  errors: Array<{ externalId: string; title: string; message: string }>;
};

// תואם למה ש-duplicateCleanupService.runCleanupSweep (בקאנד) מחזיר —
// ראו apps/backend/src/modules/duplicateCleanup/duplicateCleanup.service.ts.
export type CleanupReport = {
  trigger: 'cron' | 'manual';
  runsCheckedForOrphans: number;
  itemsSupersededAsOrphans: number;
  pairsSupersededAsDuplicates: number;
  pairsFlaggedForReview: number;
  // כמה זוגות בפועל נשפטו/לא נבדקו בגלל כשל טכני — ראו duplicateCleanup.service.ts.
  // geminiCallsAttempted/Succeeded/Failed סופרים קריאות batch (כל קריאה
  // מכסה כמה זוגות בבת אחת), לא זוגות — לא מתאימים לתצוגה למשתמש.
  pairsJudged: number;
  pairsSkippedDueToError: number;
  geminiCallsAttempted: number;
  geminiCallsSucceeded: number;
  geminiCallsFailed: number;
  rateLimitHit: boolean;
};

// תואם למה ש-aiEnrichmentService.runCategorizationOnly (בקאנד) מחזיר —
// ראו apps/backend/src/modules/aiEnrichment/aiEnrichment.service.ts.
export type CategorizationReport = {
  trigger: 'cron' | 'manual';
  categoriesSuggested: number;
  categoriesSkippedLowConfidence: number;
  categorySuggestionErrors: number;
};

export type ApiEnvelope<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } };

export type PaginatedEnvelope<T> =
  | { success: true; data: T[]; meta: { page: number; pageSize: number; total: number } }
  | { success: false; error: { code: string; message: string } };

// שדות מזעריים בלבד — כל מה שהתוסף צריך כדי למלא את ה-dropdown.
export type ProgramOption = { id: string; name: string };
export type BrandOption = { id: string; name: string };
