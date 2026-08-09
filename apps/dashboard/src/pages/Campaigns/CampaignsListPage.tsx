import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { PageHeader, Button } from '../../components/forms/FormPrimitives';
import { Badge, statusBadge } from '../../components/Badge';
import type { Campaign } from '../../types/campaign';

function formatDateRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${new Date(start).toLocaleDateString('he-IL', opts)} – ${new Date(end).toLocaleDateString('he-IL', opts)}`;
}

export function CampaignsListPage() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getPaginated<Campaign[]>('/campaigns?pageSize=100')
      .then((r) => setCampaigns(r.data))
      .finally(() => setIsLoading(false));
  }, []);

  const columns: Column<Campaign>[] = [
    { header: 'קמפיין', render: (c) => <div style={{ fontWeight: 500 }}>{c.title}</div> },
    { header: 'תאריכים', render: (c) => formatDateRange(c.startDate, c.endDate) },
    { header: 'הטבות', render: (c) => `${c.benefits?.length ?? 0}` },
    {
      header: 'סטטוס',
      render: (c) => {
        const { tone, label } = statusBadge('isActive', c.isActive);
        return <Badge tone={tone}>{label}</Badge>;
      },
    },
  ];

  return (
    <div>
      <PageHeader title="קמפיינים" action={<Button onClick={() => navigate('/campaigns/new')}>הוסף קמפיין</Button>} />
      <DataTable
        columns={columns}
        rows={campaigns}
        isLoading={isLoading}
        getRowKey={(c) => c.id}
        onRowClick={(c) => navigate(`/campaigns/${c.id}`)}
        emptyTitle="עדיין אין קמפיינים במערכת"
        emptyHint="קמפיין מארז כמה הטבות יחד לקידום, לדוגמה 'חזרה לבית הספר'"
      />
    </div>
  );
}
