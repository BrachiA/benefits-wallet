import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient, formatSaveError } from '../../api/client';
import { PageHeader, Field, Input, Button } from '../../components/forms/FormPrimitives';
import type { Campaign } from '../../types/campaign';

type BenefitOption = { id: string; title: string };

const emptyForm = { slug: '', title: '', description: '', startDate: '', endDate: '' };

const fieldLabels: Record<string, string> = {
  slug: 'מזהה URL (slug)',
  title: 'כותרת',
  description: 'תיאור',
  startDate: 'מתאריך',
  endDate: 'עד תאריך',
  benefitIds: 'הטבות בקמפיין',
};

export function CampaignFormPage() {
  const { id } = useParams();
  const isEditMode = id !== 'new';
  const navigate = useNavigate();

  const [allBenefits, setAllBenefits] = useState<BenefitOption[]>([]);
  const [selectedBenefitIds, setSelectedBenefitIds] = useState<string[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.getPaginated<BenefitOption[]>('/benefits?pageSize=200').then((r) => setAllBenefits(r.data));
    if (isEditMode) {
      apiClient.get<Campaign>(`/campaigns/${id}`).then((c) => {
        setForm({
          slug: c.slug,
          title: c.title,
          description: c.description ?? '',
          startDate: c.startDate.slice(0, 10),
          endDate: c.endDate.slice(0, 10),
        });
        setSelectedBenefitIds(c.benefits.map((b) => b.benefit.id));
      });
    }
  }, [id, isEditMode]);

  function toggleBenefit(benefitId: string) {
    setSelectedBenefitIds((prev) => (prev.includes(benefitId) ? prev.filter((b) => b !== benefitId) : [...prev, benefitId]));
  }

  async function handleSubmit() {
    setError(null);
    if (new Date(form.endDate) <= new Date(form.startDate)) {
      setError('תאריך הסיום חייב להיות אחרי תאריך ההתחלה');
      return;
    }
    setIsSaving(true);
    try {
      const payload = { ...form, benefitIds: selectedBenefitIds };
      if (isEditMode) await apiClient.patch(`/campaigns/${id}`, payload);
      else await apiClient.post('/campaigns', payload);
      navigate('/campaigns');
    } catch (err) {
      setError(formatSaveError(err, fieldLabels));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <PageHeader title={isEditMode ? 'עריכת קמפיין' : 'קמפיין חדש'} />
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
        <Field label="כותרת">
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="חזרה לבית הספר 2026" />
        </Field>
        <Field label="מזהה URL (slug)">
          <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} disabled={isEditMode} />
        </Field>
        <Field label="תיאור">
          <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div style={{ display: 'flex', gap: 12 }}>
          <Field label="מתאריך">
            <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </Field>
          <Field label="עד תאריך">
            <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </Field>
        </div>

        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>הטבות בקמפיין</div>
        <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: 20 }}>
          {allBenefits.map((b) => (
            <label
              key={b.id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', fontSize: 13, borderBottom: '1px solid var(--border)' }}
            >
              <input type="checkbox" checked={selectedBenefitIds.includes(b.id)} onChange={() => toggleBenefit(b.id)} />
              {b.title}
            </label>
          ))}
          {allBenefits.length === 0 && (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>אין עדיין הטבות להוספה</div>
          )}
        </div>

        {error && (
          <div style={{ marginTop: -8, marginBottom: 16, padding: 12, background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'שומר...' : 'שמור קמפיין'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/campaigns')} type="button">
            ביטול
          </Button>
        </div>
      </div>
    </div>
  );
}
