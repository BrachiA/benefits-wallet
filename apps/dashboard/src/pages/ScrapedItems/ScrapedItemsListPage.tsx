import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { PageHeader, Select } from '../../components/forms/FormPrimitives';
import { Badge, statusBadge } from '../../components/Badge';
import type { ScrapedItem } from '../../types/scrapedItem';

const statusFilterOptions = [
  { value: 'PENDING_REVIEW', label: 'ממתינים לבדיקה' },
  { value: '', label: 'הכל' },
  { value: 'AUTO_PUBLISHED', label: 'פורסמו אוטומטית' },
  { value: 'APPROVED', label: 'אושרו ידנית' },
  { value: 'REJECTED', label: 'נדחו' },
];

export function ScrapedItemsListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ScrapedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // ברירת המחדל היא "ממתינים לבדיקה", לא "הכל" — זו המשימה
  // היומיומית בפועל של מנהלת שנכנסת למסך הזה: לרוקן את התור.
  const [statusFilter, setStatusFilter] = useState('PENDING_REVIEW');

  useEffect(() => {
    setIsLoading(true);
    const query = statusFilter ? `?status=${statusFilter}&pageSize=100` : '?pageSize=100';
    apiClient
      .getPaginated<ScrapedItem[]>(`/scraper/items${query}`)
      .then((r) => setItems(r.data))
      .finally(() => setIsLoading(false));
  }, [statusFilter]);

  const columns: Column<ScrapedItem>[] = [
    { header: 'כותרת שנסרקה', render: (i) => <div style={{ fontWeight: 500 }}>{i.rawData.title}</div> },
    { header: 'מקור', render: (i) => i.source?.name ?? '—' },
    {
      header: 'סוג',
      render: (i) => (i.matchedBenefitId ? `עדכון: ${i.matchedBenefit?.title ?? ''}` : 'הטבה חדשה'),
    },
    {
      header: 'רמת ביטחון',
      render: (i) => {
        const { tone, label } = statusBadge('confidence', i.confidenceScore);
        return <Badge tone={tone}>{label}</Badge>;
      },
    },
    {
      header: 'סטטוס',
      render: (i) => {
        const { tone, label } = statusBadge('itemStatus', i.status);
        return <Badge tone={tone}>{label}</Badge>;
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="תור בדיקה"
        action={
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 180 }}>
            {statusFilterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        }
      />
      <DataTable
        columns={columns}
        rows={items}
        isLoading={isLoading}
        getRowKey={(i) => i.id}
        onRowClick={(i) => navigate(`/scraped-items/${i.id}`)}
        emptyTitle={statusFilter === 'PENDING_REVIEW' ? 'אין פריטים שממתינים לבדיקה' : 'לא נמצאו פריטים'}
        emptyHint={
          statusFilter === 'PENDING_REVIEW'
            ? 'כל התוצאות שנסרקו עד כה פורסמו אוטומטית או טופלו'
            : undefined
        }
      />
    </div>
  );
}
