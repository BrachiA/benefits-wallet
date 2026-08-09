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
    // includeInactive: תצוגת ניהול. בלי זה הדשבורד מקבל את אותה
    // רשימה מסוננת שהאפליקציה מקבלת, והטבה שפג תוקפה נעלמת מהמסך
    // בדיוק כשצריך להיכנס אליה כדי להאריך אותה.
    apiClient
      .getPaginated<Benefit[]>('/benefits?pageSize=50&includeInactive=true')
      .then((res) => setBenefits(res.data))
      .finally(() => setIsLoading(false));
  }, []);

  // מציג למה ההטבה לא גלויה כרגע למשתמשות, כשזה המצב. "כבויה"
  // ו"פג תוקף" הן סיבות שונות שדורשות פעולה שונה מהמנהלת.
  function visibilityBadge(b: Benefit) {
    if (!b.isActive) return statusBadge('isActive', b.isActive);
    const now = Date.now();
    if (b.endDate && new Date(b.endDate).getTime() <= now) {
      return { tone: 'danger' as const, label: 'פג תוקף' };
    }
    if (b.startDate && new Date(b.startDate).getTime() > now) {
      return { tone: 'warning' as const, label: 'טרם התחילה' };
    }
    return statusBadge('isActive', b.isActive);
  }

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
        const { tone, label } = visibilityBadge(b);
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
