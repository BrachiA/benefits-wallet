import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { PageHeader } from '../../components/forms/FormPrimitives';
import { Badge, type BadgeTone } from '../../components/Badge';
import type { DuplicateCleanupLogEntry } from '../../types/duplicateCleanupLog';

// "פעולה" נגזרת מ-changedFields.flaggedForManualReview, לא מ-AuditAction
// עצמו (שתמיד 'UPDATE' כאן) — ראו duplicateCleanup.service.ts: מקרה
// גבולי (פריט כבר נסקר/אושר) לעולם לא הופך ל-SUPERSEDED אוטומטית,
// רק מסומן.
function actionBadge(entry: DuplicateCleanupLogEntry): { tone: BadgeTone; label: string } {
  // judgment_failed: הזוג לא נבדק בפועל (כשל טכני/rate limit ב-Gemini,
  // לא "Gemini קבע שזה לא כפול") — מסומן בנפרד כדי שההבדל יהיה גלוי
  // בדשבורד, לא רק בלוג. ראו duplicateCleanup.service.ts.
  if (entry.changedFields?.cleanupType === 'judgment_failed') {
    return { tone: 'danger', label: entry.changedFields.isRateLimit ? 'נכשל — חריגת מכסה' : 'נכשל — ינוסה שוב' };
  }
  if (entry.changedFields?.cleanupType === 'image_verification') return { tone: 'danger', label: 'התרעה — דורש בדיקה' };
  if (entry.changedFields?.cleanupType === 'category_suggestion') return { tone: 'neutral', label: 'קטגוריה מולאה אוטומטית' };
  if (entry.changedFields?.cleanupType === 'logo_search') {
    return entry.changedFields.imageUrl
      ? { tone: 'neutral', label: 'לוגו נמצא ועודכן' }
      : { tone: 'warning', label: 'לוגו לא נמצא' };
  }
  if (entry.changedFields?.flaggedForManualReview) return { tone: 'warning', label: 'סומן לבדיקה ידנית' };
  return { tone: 'neutral', label: 'הוחלף (SUPERSEDED)' };
}

function typeLabel(cleanupType: DuplicateCleanupLogEntry['changedFields']): string {
  if (cleanupType?.cleanupType === 'orphaned_run') return 'ריצה יתומה';
  if (cleanupType?.cleanupType === 'duplicate_candidate') return 'כפילות בין ריצות';
  if (cleanupType?.cleanupType === 'judgment_failed') return 'בדיקת AI נכשלה';
  if (cleanupType?.cleanupType === 'image_verification') return 'אימות תמונה';
  if (cleanupType?.cleanupType === 'category_suggestion') return 'הצעת קטגוריה';
  if (cleanupType?.cleanupType === 'logo_search') return 'חיפוש לוגו';
  return '—';
}

// מציג את שני הפריטים המעורבים בפועל (לא רק ה-ID) כדי שאפשר יהיה
// לוודא בעין מי הוחלף במי, בלי לחפור ב-DB. ריצה יתומה/אימות תמונה/
// הצעת קטגוריה נוגעים בפריט בודד — אין "פריט שני" להציג.
function itemsCell(entry: DuplicateCleanupLogEntry) {
  const entityTitle = entry.entityTitle ?? '(פריט לא נמצא)';
  if (
    entry.changedFields?.cleanupType === 'orphaned_run' ||
    entry.changedFields?.cleanupType === 'image_verification' ||
    entry.changedFields?.cleanupType === 'category_suggestion' ||
    entry.changedFields?.cleanupType === 'logo_search'
  ) {
    return <span style={{ fontSize: 13 }}>{entityTitle}</span>;
  }
  const pairedTitle = entry.pairedItemTitle ?? '(פריט לא נמצא)';
  if (entry.changedFields?.cleanupType === 'judgment_failed') {
    return (
      <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 320 }}>
        <span>{entityTitle}</span>
        <span style={{ color: 'var(--text-muted)' }}>↔ {pairedTitle}</span>
      </div>
    );
  }
  const flagged = entry.changedFields?.flaggedForManualReview;
  return (
    <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 320 }}>
      <span>{flagged ? 'ישן: ' : 'הוחלף: '}{entityTitle}</span>
      <span style={{ color: 'var(--text-muted)' }}>{flagged ? '↔ חדש: ' : '← הושאר: '}{pairedTitle}</span>
    </div>
  );
}

export function DuplicateCleanupLogPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<DuplicateCleanupLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getPaginated<DuplicateCleanupLogEntry[]>('/duplicate-cleanup/log?pageSize=100')
      .then((r) => setEntries(r.data))
      .finally(() => setIsLoading(false));
  }, []);

  const columns: Column<DuplicateCleanupLogEntry>[] = [
    { header: 'תאריך', render: (e) => new Date(e.createdAt).toLocaleString('he-IL') },
    { header: 'סוג', render: (e) => typeLabel(e.changedFields) },
    { header: 'פריטים מעורבים', render: itemsCell },
    {
      header: 'פעולה',
      render: (e) => {
        const { tone, label } = actionBadge(e);
        return <Badge tone={tone}>{label}</Badge>;
      },
    },
    {
      header: 'נימוק',
      render: (e) => (
        <div
          style={{
            background: 'var(--status-warning-bg)',
            color: 'var(--status-warning-text)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 10px',
            fontSize: 13,
            maxWidth: 420,
          }}
        >
          {e.changedFields?.reason ?? '—'}
        </div>
      ),
    },
    {
      header: 'הופעל ע"י',
      render: (e) => e.performedBy ?? '—',
    },
  ];

  return (
    <div>
      <PageHeader title="התרעות AI" />
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -12, marginBottom: 20 }}>
        כל פעולות ה-AI (Gemini) שדורשות עין אנושית או שכדאי לדעת עליהן: ניקוי כפילויות/ריצות יתומות, התרעות אימות
        תמונה, והצעות קטגוריה שמולאו אוטומטית. לחיצה על שורה פותחת את הפריט הנוגע בדבר.
      </p>
      <DataTable
        columns={columns}
        rows={entries}
        isLoading={isLoading}
        getRowKey={(e) => e.id}
        onRowClick={(e) => {
          // logo_search: entityId מצביע על Program/Brand, לא ScrapedItem —
          // ראו logoEntityType ב-types/duplicateCleanupLog.ts.
          if (e.changedFields?.cleanupType === 'logo_search') {
            const base = e.changedFields.logoEntityType === 'Brand' ? '/brands' : '/programs';
            navigate(`${base}/${e.entityId}`);
            return;
          }
          navigate(`/scraped-items/${e.entityId}`);
        }}
        emptyTitle="עדיין לא בוצעו פעולות ניקוי"
        emptyHint="המנגנון רץ כל שעה אוטומטית, וגם מיד אחרי סריקה מהתוסף אם הופעל ידנית"
      />
    </div>
  );
}
