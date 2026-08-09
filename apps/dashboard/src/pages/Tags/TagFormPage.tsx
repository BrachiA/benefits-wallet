import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient, formatSaveError } from '../../api/client';
import { PageHeader, Field, Input, Button } from '../../components/forms/FormPrimitives';
import type { Tag } from '../../types/tag';

const emptyForm = { slug: '', name: '', color: '#7F77DD' };

const fieldLabels: Record<string, string> = {
  slug: 'מזהה URL (slug)',
  name: 'שם',
  color: 'צבע',
};

export function TagFormPage() {
  const { id } = useParams();
  const isEditMode = id !== 'new';
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isEditMode) {
      apiClient.get<Tag>(`/tags/${id}`).then((t) => setForm({ slug: t.slug, name: t.name, color: t.color ?? '#7F77DD' }));
    }
  }, [id, isEditMode]);

  async function handleSubmit() {
    setError(null);
    setIsSaving(true);
    try {
      if (isEditMode) await apiClient.patch(`/tags/${id}`, form);
      else await apiClient.post('/tags', form);
      navigate('/tags');
    } catch (err) {
      setError(formatSaveError(err, fieldLabels));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 440 }}>
      <PageHeader title={isEditMode ? 'עריכת תגית' : 'תגית חדשה'} />
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
        <Field label="שם">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="סוף שבוע" />
        </Field>
        <Field label="מזהה URL (slug)">
          <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} disabled={isEditMode} />
        </Field>
        <Field label="צבע">
          <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ height: 40, padding: 4 }} />
        </Field>

        {error && (
          <div style={{ marginTop: 8, padding: 12, background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'שומר...' : 'שמור תגית'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/tags')} type="button">
            ביטול
          </Button>
        </div>
      </div>
    </div>
  );
}
