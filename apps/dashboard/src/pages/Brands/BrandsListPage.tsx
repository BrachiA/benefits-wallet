import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { PageHeader, Button } from '../../components/forms/FormPrimitives';
import { Badge, statusBadge } from '../../components/Badge';
import type { Brand } from '../../types/brand';

export function BrandsListPage() {
  const navigate = useNavigate();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getPaginated<Brand[]>('/brands?pageSize=100')
      .then((r) => setBrands(r.data))
      .finally(() => setIsLoading(false));
  }, []);

  const columns: Column<Brand>[] = [
    {
      header: 'מותג',
      render: (b) => (
        <div>
          <div style={{ fontWeight: 500 }}>{b.name}</div>
          {b.parentBrand && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>קבוצת {b.parentBrand.name}</div>}
        </div>
      ),
    },
    { header: 'קטגוריה', render: (b) => b.category?.name ?? '—' },
    {
      header: 'ערוצים',
      render: (b) => (
        <div style={{ display: 'flex', gap: 4 }}>
          {b.hasOnlineStore && <Badge tone="neutral">אונליין</Badge>}
          {b.hasPhysicalStores && <Badge tone="neutral">סניפים</Badge>}
        </div>
      ),
    },
    {
      header: 'סטטוס',
      render: (b) => {
        const { tone, label } = statusBadge('isActive', b.isActive);
        return <Badge tone={tone}>{label}</Badge>;
      },
    },
  ];

  return (
    <div>
      <PageHeader title="מותגים" action={<Button onClick={() => navigate('/brands/new')}>הוסף מותג</Button>} />
      <DataTable
        columns={columns}
        rows={brands}
        isLoading={isLoading}
        getRowKey={(b) => b.id}
        onRowClick={(b) => navigate(`/brands/${b.id}`)}
        emptyTitle="עדיין אין מותגים במערכת"
        emptyHint="מותג הוא הרשת שהמשתמש מזהה — לדוגמה זארה או שופרסל"
      />
    </div>
  );
}
