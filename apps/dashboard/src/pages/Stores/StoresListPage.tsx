import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { PageHeader, Button } from '../../components/forms/FormPrimitives';
import { Badge, statusBadge } from '../../components/Badge';
import type { Store } from '../../types/store';

export function StoresListPage() {
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getPaginated<Store[]>('/stores?pageSize=100')
      .then((r) => setStores(r.data))
      .finally(() => setIsLoading(false));
  }, []);

  const columns: Column<Store>[] = [
    { header: 'סניף', render: (s) => <div style={{ fontWeight: 500 }}>{s.name}</div> },
    { header: 'מותג', render: (s) => s.brand?.name ?? '—' },
    { header: 'עיר', render: (s) => s.city?.name ?? '—' },
    {
      header: 'סטטוס',
      render: (s) => {
        const { tone, label } = statusBadge('isActive', s.isActive);
        return <Badge tone={tone}>{label}</Badge>;
      },
    },
  ];

  return (
    <div>
      <PageHeader title="סניפים" action={<Button onClick={() => navigate('/stores/new')}>הוסף סניף</Button>} />
      <DataTable
        columns={columns}
        rows={stores}
        isLoading={isLoading}
        getRowKey={(s) => s.id}
        onRowClick={(s) => navigate(`/stores/${s.id}`)}
        emptyTitle="עדיין אין סניפים במערכת"
        emptyHint="סניף הוא נקודת מכירה פיזית של מותג — נדרש רק להטבות תקפות במיקום ספציפי"
      />
    </div>
  );
}
