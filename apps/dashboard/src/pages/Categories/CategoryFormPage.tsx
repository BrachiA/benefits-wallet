import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient, formatSaveError } from '../../api/client';
import { PageHeader, Field, Input, Select, Button } from '../../components/forms/FormPrimitives';
import type { Category } from '../../types/category';

const emptyForm = { slug: '', name: '', nameEn: '', parentId: '', iconName: '' };

const fieldLabels: Record<string, string> = {
  slug: 'מזהה URL (slug)',
  name: 'שם',
  parentId: 'תת-קטגוריה של',
  iconName: 'שם אייקון',
};

export function CategoryFormPage() {
  const { id } = useParams();
  const isEditMode = id !== 'new';
  const navigate = useNavigate();

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.getPaginated<Category[]>('/categories?pageSize=200').then((r) => setAllCategories(r.data));
    if (isEditMode) {
      apiClient.get<Category>(`/categories/${id}`).then((c) =>
        setForm({ slug: c.slug, name: c.name, nameEn: c.nameEn ?? '', parentId: c.parentId ?? '', iconName: c.iconName ?? '' })
      );
    }
  }, [id, isEditMode]);

  const parentOptions = allCategories.filter((c) => c.id !== id);

  async function handleSubmit() {
    setError(null);
    setIsSaving(true);
    try {
      const payload = { ...form, parentId: form.parentId || undefined };
      if (isEditMode) await apiClient.patch(`/categories/${id}`, payload);
      else await apiClient.post('/categories', payload);
      navigate('/categories');
    } catch (err) {
      setError(formatSaveError(err, fieldLabels));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <PageHeader title={isEditMode ? 'עריכת קטגוריה' : 'קטגוריה חדשה'} />
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
        <Field label="שם">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="אופנה" />
        </Field>
        <Field label="מזהה URL (slug)">
          <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} disabled={isEditMode} />
        </Field>
        <Field label="תת-קטגוריה של" hint="השאירי ריק אם זו קטגוריית-על">
          <Select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
            <option value="">ללא — קטגוריית-על</option>
            {parentOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="שם אייקון" hint="שם מספריית האייקונים הפנימית, לא קובץ">
          <Input value={form.iconName} onChange={(e) => setForm({ ...form, iconName: e.target.value })} placeholder="shirt" />
        </Field>

        {error && (
          <div style={{ marginTop: 8, padding: 12, background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'שומר...' : 'שמור קטגוריה'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/categories')} type="button">
            ביטול
          </Button>
        </div>
      </div>
    </div>
  );
}
