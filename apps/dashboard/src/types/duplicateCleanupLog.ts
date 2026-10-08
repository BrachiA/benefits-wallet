// תואם למה ש-recordAudit כותב בפועל ל-AuditLog עבור
// entityType='DuplicateCleanupAction' — משותף בכוונה בין
// modules/duplicateCleanup (orphaned_run/duplicate_candidate/
// judgment_failed) ל-modules/aiEnrichment (image_verification/
// category_suggestion), ראו aiEnrichment.service.ts.
export type DuplicateCleanupChangedFields = {
  cleanupType:
    | 'orphaned_run'
    | 'duplicate_candidate'
    | 'judgment_failed'
    | 'image_verification'
    | 'category_suggestion'
    | 'logo_search';
  reason: string;
  triggeredBy: 'cron' | 'manual';
  previousStatus?: string;
  newStatus?: string;
  runId?: string;
  pairedItemId?: string;
  confidence?: number;
  flaggedForManualReview?: boolean;
  // judgment_failed בלבד — קריאת Gemini נכשלה טכנית (לא "נקבע לא-כפול"),
  // הזוג לא טופל וייבדק שוב בסבב הבא. ראו duplicateCleanup.service.ts.
  isRateLimit?: boolean;
  // image_verification בלבד
  imageUrl?: string;
  // category_suggestion בלבד
  categorySlug?: string;
  categoryName?: string;
  // logo_search בלבד — entityId מצביע על Program או Brand (לא
  // ScrapedItem), ראו modules/logoSearch/logoSearch.service.ts.
  // entityName מגיע ישירות מ-changedFields (לא lookup נפרד כמו
  // entityTitle של שאר הסוגים) כי duplicateCleanupRepository.
  // findItemTitlesByIds יודע לחפש רק ScrapedItem.
  logoEntityType?: 'Program' | 'Brand';
  entityName?: string;
  sourceDomain?: string;
};

export type DuplicateCleanupLogEntry = {
  id: string;
  entityType: string;
  entityId: string; // מזהה ה-ScrapedItem שהפעולה חלה עליו
  action: string;
  changedFields: DuplicateCleanupChangedFields | null;
  performedBy: string | null;
  createdAt: string;
  // מחושבים בזמן קריאה (duplicateCleanup.service.getCleanupLog) לפי
  // entityId/changedFields.pairedItemId — לא נשמרים ב-AuditLog עצמו.
  entityTitle: string | null;
  pairedItemTitle: string | null;
};
