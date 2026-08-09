import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient, formatSaveError } from '../../api/client';
import { PageHeader, Field, Input, Select, Button, toOptionalNumber } from '../../components/forms/FormPrimitives';
import { programTypeLabels, type Issuer, type Program } from '../../types/program';

const emptyForm = { slug: '', name: '', issuerId: '', parentProgramId: '', type: 'CREDIT_CARD', annualFee: undefined as number | undefined };

const fieldLabels: Record<string, string> = {
  slug: 'מזהה URL (slug)',
  name: 'שם',
  issuerId: 'מנפיק',
  type: 'סוג',
  parentProgramId: 'שייך תחת (דרגה גבוהה יותר)',
  annualFee: 'דמי שנתי',
};

export function ProgramFormPage() {
  const { id } = useParams();
  const isEditMode = id !== 'new';
  const navigate = useNavigate();

  const [issuers, setIssuers] = useState<Issuer[]>([]);
  const [allPrograms, setAllPrograms] = useState<Program[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.getPaginated<Issuer[]>('/issuers?pageSize=100').then((r) => setIssuers(r.data));
    apiClient.getPaginated<Program[]>('/programs?pageSize=200').then((r) => setAllPrograms(r.data));
    if (isEditMode) {
      apiClient.get<Program>(`/programs/${id}`).then((p) =>
        setForm({
          slug: p.slug,
          name: p.name,
          issuerId: p.issuerId,
          parentProgramId: p.parentProgramId ?? '',
          type: p.type,
          annualFee: toOptionalNumber(p.annualFee),
        })
      );
    }
  }, [id, isEditMode]);

  // תוכנית לא יכולה להיות ההורה של עצמה — מסננת את עצמה מרשימת
  // האפשרויות ל-parentProgramId בעריכה.
  const parentOptions = allPrograms.filter((p) => p.id !== id);

  async function handleSubmit() {
    setError(null);
    if (!form.issuerId) {
      setError('חובה לבחור מנפיק');
      return;
    }
    setIsSaving(true);
    try {
      const payload = { ...form, parentProgramId: form.parentProgramId || undefined };
      if (isEditMode) await apiClient.patch(`/programs/${id}`, payload);
      else await apiClient.post('/programs', payload);
      navigate('/programs');
    } catch (err) {
      setError(formatSaveError(err, fieldLabels));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <PageHeader title={isEditMode ? 'עריכת מועדון' : 'מועדון חדש'} />
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
        <Field label="שם">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="MAX Platinum" />
        </Field>
        <Field label="מזהה URL (slug)">
          <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} disabled={isEditMode} />
        </Field>
        <Field label="מנפיק">
          <Select value={form.issuerId} onChange={(e) => setForm({ ...form, issuerId: e.target.value })}>
            <option value="">בחרי מנפיק</option>
            {issuers.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="סוג">
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {Object.entries(programTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="שייך תחת (דרגה גבוהה יותר)" hint="לדוגמה: MAX Platinum שייך תחת MAX. השאירי ריק אם זו רמה עליונה">
          <Select value={form.parentProgramId} onChange={(e) => setForm({ ...form, parentProgramId: e.target.value })}>
            <option value="">ללא — רמה עליונה</option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="דמי שנתי" hint="השאירי ריק אם אין">
          <Input
            type="number"
            value={form.annualFee ?? ''}
            onChange={(e) => setForm({ ...form, annualFee: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>

        {error && (
          <div style={{ marginTop: 8, padding: 12, background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'שומר...' : 'שמור מועדון'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/programs')} type="button">
            ביטול
          </Button>
        </div>
      </div>
    </div>
  );
}
