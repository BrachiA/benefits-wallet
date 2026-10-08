import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, formatSaveError } from '../../api/client';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { PageHeader, Button, Field, Input } from '../../components/forms/FormPrimitives';
import { Badge, statusBadge } from '../../components/Badge';
import { sourceTypeLabels, type ScraperSource } from '../../types/scraperSource';
import type { AlertSettings } from '../../types/alertSettings';

// כרטיס עצמאי (לא קומפוננטה נפרדת בכוונה — אותה מוסכמה כמו אזור
// אישור ה-ToS בטופס המקור: כרטיס inline בתוך הדף שמשתמש בו, לא
// עוד קובץ). ממוקם בראש רשימת המקורות, כי זה בדיוק המקום שמנהלת
// שמנהלת התראות סריקה תחפש בו קודם — ולא הצדיק מסך "הגדרות" נפרד
// עבור מתג בודד.
function EmailAlertsToggleCard() {
  const [settings, setSettings] = useState<AlertSettings | null>(null);
  const [changedBy, setChangedBy] = useState('');
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadSettings() {
    apiClient.get<AlertSettings>('/settings/alerts').then(setSettings);
  }

  useEffect(loadSettings, []);

  async function handleToggle() {
    if (!settings) return;
    if (!changedBy.trim()) {
      setError('נא לציין את שמך לפני שינוי — זו החלטה שצריכה תיעוד מפורש');
      return;
    }
    setError(null);
    setIsActing(true);
    try {
      await apiClient.patch('/settings/alerts', {
        emailAlertsEnabled: !settings.emailAlertsEnabled,
        changedBy,
      });
      loadSettings();
    } catch (err) {
      setError(formatSaveError(err));
    } finally {
      setIsActing(false);
    }
  }

  if (!settings) return null;

  const { tone, label } = statusBadge('isActive', settings.emailAlertsEnabled);

  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 24,
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 500 }}>התראות במייל על בעיות סריקה</div>
        <Badge tone={tone}>{label === 'פעיל' ? 'שליחה פעילה' : 'שליחה כבויה'}</Badge>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 0 }}>
        כשפעיל, נשלח מייל על כל פריט שממתין לבדיקה, ריצה שנכשלה, או חשד ל-selectors שבורים. כשכבוי — שום מייל לא
        יוצא, אבל הפריטים/ריצות עדיין נכנסים לתור ומתועדים בדשבורד בדיוק כרגיל. שימושי כשריצה בודדת (למשל דרך תוסף
        הכרום) מייצרת הרבה פריטים בבת אחת ומציפה את תיבת הדואר.
      </p>
      {settings.updatedAt && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          עודכן לאחרונה: {new Date(settings.updatedAt).toLocaleString('he-IL')}
        </div>
      )}
      {error && (
        <div style={{ fontSize: 13, color: 'var(--status-danger-text)', marginBottom: 12 }}>{error}</div>
      )}
      <Field label="שמך" hint="נדרש כתיעוד — מי שינה את המצב ומתי">
        <Input value={changedBy} onChange={(e) => setChangedBy(e.target.value)} placeholder="שם מלא" />
      </Field>
      <Button variant={settings.emailAlertsEnabled ? 'danger' : 'primary'} onClick={handleToggle} disabled={isActing}>
        {settings.emailAlertsEnabled ? 'כבה שליחת מיילים' : 'הפעל שליחת מיילים'}
      </Button>
    </div>
  );
}

export function ScraperSourcesListPage() {
  const navigate = useNavigate();
  const [sources, setSources] = useState<ScraperSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getPaginated<ScraperSource[]>('/scraper/sources?pageSize=100')
      .then((r) => setSources(r.data))
      .finally(() => setIsLoading(false));
  }, []);

  const columns: Column<ScraperSource>[] = [
    { header: 'מקור', render: (s) => <div style={{ fontWeight: 500 }}>{s.name}</div> },
    { header: 'סוג', render: (s) => sourceTypeLabels[s.sourceType] ?? s.sourceType },
    {
      // עמודה נפרדת מ"פעיל", בכוונה: אלה שני שערים עצמאיים (ראו
      // scraper.service.ts) — המנהלת צריכה לראות את שניהם בנפרד,
      // לא רק "פעיל/לא-פעיל" מאוחד שמסתיר את הסיבה.
      header: 'אישור תנאי שימוש',
      render: (s) => {
        const { tone, label } = statusBadge('tosStatus', s.tosStatus);
        return <Badge tone={tone}>{label}</Badge>;
      },
    },
    {
      header: 'הרצה',
      render: (s) => {
        const { tone, label } = statusBadge('isActive', s.isActive);
        return <Badge tone={tone}>{label}</Badge>;
      },
    },
    {
      header: 'ריצה אחרונה',
      render: (s) => {
        if (!s.lastRunAt) return <span style={{ color: 'var(--text-muted)' }}>עדיין לא רצה</span>;
        const date = new Date(s.lastRunAt).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        if (s.lastRunStatus === 'FAILED') return <span style={{ color: 'var(--status-danger-text)' }}>{date} — נכשלה</span>;
        return date;
      },
    },
  ];

  return (
    <div>
      <PageHeader title="מקורות סריקה" action={<Button onClick={() => navigate('/scraper-sources/new')}>הוסף מקור</Button>} />
      <EmailAlertsToggleCard />
      <DataTable
        columns={columns}
        rows={sources}
        isLoading={isLoading}
        getRowKey={(s) => s.id}
        onRowClick={(s) => navigate(`/scraper-sources/${s.id}`)}
        emptyTitle="עדיין אין מקורות סריקה"
        emptyHint="הוספת מקור חדש דורשת בדיקת תנאי שימוש לפני שהוא יכול לרוץ"
      />
    </div>
  );
}
