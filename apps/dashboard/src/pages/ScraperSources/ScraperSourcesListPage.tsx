import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { PageHeader, Button } from '../../components/forms/FormPrimitives';
import { Badge, statusBadge } from '../../components/Badge';
import { sourceTypeLabels, type ScraperSource } from '../../types/scraperSource';

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
