import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient, formatSaveError } from '../../api/client';
import { PageHeader, Field, Input, Select, Button } from '../../components/forms/FormPrimitives';
import { LogoModeField } from '../../components/forms/LogoModeField';
import type { Brand } from '../../types/brand';
import type { Category } from '../../types/category';

const fieldLabels: Record<string, string> = {
  slug: 'מזהה URL (slug)',
  name: 'שם',
  categoryId: 'קטגוריה',
  parentBrandId: 'חלק מקבוצת מותגים',
  searchKeywords: 'מילות חיפוש נוספות',
};

const emptyForm = {
  slug: '',
  name: '',
  categoryId: '',
  parentBrandId: '',
  hasOnlineStore: false,
  hasPhysicalStores: false,
  searchKeywordsText: '', // מוחזק כטקסט מופרד-פסיקים בטופס, מפוצל למערך רק בשמירה
  logoMode: 'AUTO' as 'AUTO' | 'MANUAL',
};

export function BrandFormPage() {
  const { id } = useParams();
  const isEditMode = id !== 'new';
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [defaultLogoUrl, setDefaultLogoUrl] = useState<string | null | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.getPaginated<Category[]>('/categories?pageSize=200').then((r) => setCategories(r.data));
    apiClient.getPaginated<Brand[]>('/brands?pageSize=200').then((r) => setAllBrands(r.data));
    if (isEditMode) {
      apiClient.get<Brand>(`/brands/${id}`).then((b) => {
        setForm({
          slug: b.slug,
          name: b.name,
          categoryId: b.categoryId,
          parentBrandId: b.parentBrandId ?? '',
          hasOnlineStore: b.hasOnlineStore,
          hasPhysicalStores: b.hasPhysicalStores,
          searchKeywordsText: b.searchKeywords.join(', '),
          logoMode: b.logoMode,
        });
        setDefaultLogoUrl(b.defaultLogoUrl);
      });
    }
  }, [id, isEditMode]);

  const parentOptions = allBrands.filter((b) => b.id !== id);

  async function handleSubmit() {
    setError(null);
    if (!form.categoryId) {
      setError('חובה לבחור קטגוריה');
      return;
    }
    setIsSaving(true);
    try {
      const { searchKeywordsText, ...rest } = form;
      const payload = {
        ...rest,
        parentBrandId: form.parentBrandId || undefined,
        searchKeywords: searchKeywordsText
          .split(',')
          .map((k) => k.trim().toLowerCase())
          .filter(Boolean),
      };
      if (isEditMode) await apiClient.patch(`/brands/${id}`, payload);
      else await apiClient.post('/brands', payload);
      navigate('/brands');
    } catch (err) {
      setError(formatSaveError(err, fieldLabels));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <PageHeader title={isEditMode ? 'עריכת מותג' : 'מותג חדש'} />
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
        <Field label="שם">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="זארה" />
        </Field>
        <Field label="מזהה URL (slug)">
          <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} disabled={isEditMode} />
        </Field>
        <Field label="קטגוריה">
          <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            <option value="">בחרי קטגוריה</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="חלק מקבוצת מותגים" hint="לדוגמה: אמריקן איגל שייכת לקבוצת פוקס">
          <Select value={form.parentBrandId} onChange={(e) => setForm({ ...form, parentBrandId: e.target.value })}>
            <option value="">ללא קבוצה</option>
            {parentOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="מילות חיפוש נוספות" hint="מופרדות בפסיקים — לדוגמה zara, ZARA (עוזר לחיפוש דו-לשוני)">
          <Input
            value={form.searchKeywordsText}
            onChange={(e) => setForm({ ...form, searchKeywordsText: e.target.value })}
          />
        </Field>
        <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={form.hasOnlineStore} onChange={(e) => setForm({ ...form, hasOnlineStore: e.target.checked })} />
            יש חנות אונליין
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={form.hasPhysicalStores} onChange={(e) => setForm({ ...form, hasPhysicalStores: e.target.checked })} />
            יש סניפים פיזיים
          </label>
        </div>

        <LogoModeField
          entityKind="brands"
          entityId={id ?? 'new'}
          isEditMode={isEditMode}
          logoMode={form.logoMode}
          defaultLogoUrl={defaultLogoUrl}
          onLogoModeChange={(logoMode) => setForm({ ...form, logoMode })}
          onUploaded={setDefaultLogoUrl}
        />

        {error && (
          <div style={{ marginTop: 8, padding: 12, background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'שומר...' : 'שמור מותג'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/brands')} type="button">
            ביטול
          </Button>
        </div>
      </div>
    </div>
  );
}
