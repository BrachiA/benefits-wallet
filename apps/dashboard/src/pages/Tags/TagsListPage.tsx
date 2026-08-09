import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { PageHeader, Button } from '../../components/forms/FormPrimitives';
import { Badge, statusBadge } from '../../components/Badge';
import type { Tag } from '../../types/tag';

export function TagsListPage() {
  const navigate = useNavigate();
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getPaginated<Tag[]>('/tags?pageSize=100')
      .then((r) => setTags(r.data))
      .finally(() => setIsLoading(false));
  }, []);

  const columns: Column<Tag>[] = [
    {
      header: 'תגית',
      render: (t) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {t.color && <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />}
          {t.name}
        </div>
      ),
    },
    {
      header: 'סטטוס',
      render: (t) => {
        const { tone, label } = statusBadge('isActive', t.isActive);
        return <Badge tone={tone}>{label}</Badge>;
      },
    },
  ];

  return (
    <div>
      <PageHeader title="תגיות" action={<Button onClick={() => navigate('/tags/new')}>הוסף תגית</Button>} />
      <DataTable
        columns={columns}
        rows={tags}
        isLoading={isLoading}
        getRowKey={(t) => t.id}
        onRowClick={(t) => navigate(`/tags/${t.id}`)}
        emptyTitle="עדיין אין תגיות במערכת"
        emptyHint="תגיות חופשיות לסינון וחיפוש — לדוגמה 'סוף שבוע' או '1+1'"
      />
    </div>
  );
}
