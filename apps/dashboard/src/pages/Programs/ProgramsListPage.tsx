import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { DataTable, type Column } from '../../components/tables/DataTable';
import { PageHeader, Button } from '../../components/forms/FormPrimitives';
import { Badge, statusBadge } from '../../components/Badge';
import { programTypeLabels, type Program } from '../../types/program';

export function ProgramsListPage() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getPaginated<Program[]>('/programs?pageSize=100')
      .then((r) => setPrograms(r.data))
      .finally(() => setIsLoading(false));
  }, []);

  const columns: Column<Program>[] = [
    {
      header: 'מועדון / כרטיס',
      render: (p) => (
        // הזחה ויזואלית: ילד היררכי (יש parentProgram) מוצג עם רווח
        // מוביל, בדיוק כדי שהמנהל יראה את מבנה ה-path בלי לפרש JSON
        <div style={{ paddingRight: p.parentProgramId ? 20 : 0, fontWeight: p.parentProgramId ? 400 : 500 }}>
          {p.parentProgramId && <span style={{ color: 'var(--text-muted)' }}>↳ </span>}
          {p.name}
        </div>
      ),
    },
    { header: 'מנפיק', render: (p) => p.issuer?.name ?? '—' },
    { header: 'סוג', render: (p) => programTypeLabels[p.type] ?? p.type },
    { header: 'דמי שנתי', render: (p) => (p.annualFee ? `₪${p.annualFee}` : 'ללא') },
    {
      header: 'סטטוס',
      render: (p) => {
        const { tone, label } = statusBadge('isActive', p.isActive);
        return <Badge tone={tone}>{label}</Badge>;
      },
    },
  ];

  return (
    <div>
      <PageHeader title="מועדונים וכרטיסים" action={<Button onClick={() => navigate('/programs/new')}>הוסף מועדון</Button>} />
      <DataTable
        columns={columns}
        rows={programs}
        isLoading={isLoading}
        getRowKey={(p) => p.id}
        onRowClick={(p) => navigate(`/programs/${p.id}`)}
        emptyTitle="עדיין אין מועדונים במערכת"
        emptyHint="הוסיפי מנפיק קודם, ואז מועדון או כרטיס תחתיו"
      />
    </div>
  );
}
