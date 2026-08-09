import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { PageHeader, Button } from '../../components/forms/FormPrimitives';
import { Badge, statusBadge } from '../../components/Badge';
import type { Coupon } from '../../types/coupon';

export function CouponsListPage() {
  const navigate = useNavigate();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getPaginated<Coupon[]>('/coupons?pageSize=100')
      .then((r) => setCoupons(r.data))
      .finally(() => setIsLoading(false));
  }, []);

  const columns: Column<Coupon>[] = [
    { header: 'קוד', render: (c) => <code style={{ fontSize: 13 }}>{c.code}</code> },
    { header: 'הטבה', render: (c) => c.benefit?.title ?? '—' },
    {
      header: 'שימוש',
      render: (c) => (c.maxUses ? `${c.currentUses} / ${c.maxUses}` : `${c.currentUses} (ללא הגבלה)`),
    },
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
      <PageHeader title="קופונים" action={<Button onClick={() => navigate('/coupons/new')}>הוסף קופון</Button>} />
      <DataTable
        columns={columns}
        rows={coupons}
        isLoading={isLoading}
        getRowKey={(c) => c.id}
        onRowClick={(c) => navigate(`/coupons/${c.id}`)}
        emptyTitle="עדיין אין קופונים במערכת"
        emptyHint="קופון משויך תמיד להטבה קיימת שדורשת קוד מימוש"
      />
    </div>
  );
}
