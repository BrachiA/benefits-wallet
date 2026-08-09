import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { PageHeader, Button } from '../../components/forms/FormPrimitives';
import { Badge, statusBadge } from '../../components/Badge';
import type { Category } from '../../types/category';

export function CategoriesListPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getPaginated<Category[]>('/categories?pageSize=100')
      .then((r) => setCategories(r.data))
      .finally(() => setIsLoading(false));
  }, []);

  const columns: Column<Category>[] = [
    {
      header: 'קטגוריה',
      render: (c) => (
        <div style={{ paddingRight: c.parentId ? 20 : 0, fontWeight: c.parentId ? 400 : 500 }}>
          {c.parentId && <span style={{ color: 'var(--text-muted)' }}>↳ </span>}
          {c.name}
        </div>
      ),
    },
    { header: 'מזהה', render: (c) => c.slug },
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
      <PageHeader title="קטגוריות" action={<Button onClick={() => navigate('/categories/new')}>הוסף קטגוריה</Button>} />
      <DataTable
        columns={columns}
        rows={categories}
        isLoading={isLoading}
        getRowKey={(c) => c.id}
        onRowClick={(c) => navigate(`/categories/${c.id}`)}
        emptyTitle="עדיין אין קטגוריות במערכת"
        emptyHint="קטגוריות מסווגות הטבות ומותגים — לדוגמה אופנה, מזון, אלקטרוניקה"
      />
    </div>
  );
}
