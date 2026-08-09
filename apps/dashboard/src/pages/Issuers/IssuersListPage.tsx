import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { PageHeader, Button } from '../../components/forms/FormPrimitives';
import { Badge, statusBadge } from '../../components/Badge';
import type { Issuer } from '../../types/issuer';

export function IssuersListPage() {
  const navigate = useNavigate();
  const [issuers, setIssuers] = useState<Issuer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getPaginated<Issuer[]>('/issuers?pageSize=100')
      .then((r) => setIssuers(r.data))
      .finally(() => setIsLoading(false));
  }, []);

  const columns: Column<Issuer>[] = [
    {
      header: 'מנפיק',
      render: (i) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {i.brandColor && (
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: i.brandColor, flexShrink: 0 }} />
          )}
          <span style={{ fontWeight: 500 }}>{i.name}</span>
        </div>
      ),
    },
    { header: 'מזהה', render: (i) => i.slug },
    { header: 'טלפון תמיכה', render: (i) => i.supportPhone ?? '—' },
    {
      header: 'סטטוס',
      render: (i) => {
        const { tone, label } = statusBadge('isActive', i.isActive);
        return <Badge tone={tone}>{label}</Badge>;
      },
    },
  ];

  return (
    <div>
      <PageHeader title="מנפיקים" action={<Button onClick={() => navigate('/issuers/new')}>הוסף מנפיק</Button>} />
      <DataTable
        columns={columns}
        rows={issuers}
        isLoading={isLoading}
        getRowKey={(i) => i.id}
        onRowClick={(i) => navigate(`/issuers/${i.id}`)}
        emptyTitle="עדיין אין מנפיקים במערכת"
        emptyHint="מנפיק הוא חברת האשראי או הרשת שמנפיקה את הכרטיס — לדוגמה MAX או Cal"
      />
    </div>
  );
}
