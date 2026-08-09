import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { PageHeader, Button } from '../../components/forms/FormPrimitives';
import { Badge, statusBadge } from '../../components/Badge';
import { benefitTypeLabels, type Benefit } from '../../types/benefit';

export function BenefitsListPage() {
  const navigate = useNavigate();
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getPaginated<Benefit[]>('/benefits?pageSize=50')
      .then((res) => setBenefits(res.data))
      .finally(() => setIsLoading(false));
  }, []);

  const columns: Column<Benefit>[] = [
    { header: 'הטבה', render: (b) => <div style={{ fontWeight: 500 }}>{b.title}</div> },
    { header: 'קטגוריה', render: (b) => b.category?.name ?? '—' },
    { header: 'סוג', render: (b) => benefitTypeLabels[b.benefitType] ?? b.benefitType },
    {
      header: 'תקף עבור',
      render: (b) => `${b.scopes.length} התאמות`,
    },
    {
      header: 'סטטוס',
      render: (b) => {
        const { tone, label } = statusBadge('isActive', b.isActive);
        return <Badge tone={tone}>{label}</Badge>;
      },
    },
    {
      header: 'בולט',
      render: (b) => (b.isPopular ? <Badge tone="neutral">פופולרי</Badge> : null),
    },
  ];

  return (
    <div>
      <PageHeader
        title="הטבות"
        action={<Button onClick={() => navigate('/benefits/new')}>הוסף הטבה</Button>}
      />
      <DataTable
        columns={columns}
        rows={benefits}
        isLoading={isLoading}
        getRowKey={(b) => b.id}
        onRowClick={(b) => navigate(`/benefits/${b.id}`)}
        emptyTitle="עדיין אין הטבות במערכת"
        emptyHint="הוסיפי הטבה ידנית, או המתיני לתוצאות מסורק האתרים"
      />
    </div>
  );
}
