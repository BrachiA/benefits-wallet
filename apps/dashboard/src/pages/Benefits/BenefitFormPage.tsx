import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient, formatSaveError } from '../../api/client';
import { PageHeader, Field, Input, Select, Button, toOptionalNumber } from '../../components/forms/FormPrimitives';
import { ScopeEditor } from '../../components/forms/ScopeEditor';
import { benefitTypeLabels, type Benefit, type BenefitScope, type Category } from '../../types/benefit';

const fieldLabels: Record<string, string> = {
  slug: 'מזהה URL (slug)',
  title: 'כותרת',
  shortDescription: 'תיאור קצר',
  categoryId: 'קטגוריה',
  benefitType: 'סוג הטבה',
  discountValue: 'ערך ההנחה',
  scopes: 'התאמות',
};

const emptyForm = {
  slug: '',
  title: '',
  shortDescription: '',
  categoryId: '',
  benefitType: 'DISCOUNT_PERCENT',
  discountValue: undefined as number | undefined,
  isPopular: false,
  isFeatured: false,
};

export function BenefitFormPage() {
  const { id } = useParams();
  const isEditMode = id !== 'new';
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [scopes, setScopes] = useState<BenefitScope[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.getPaginated<Category[]>('/categories?pageSize=200').then((r) => setCategories(r.data));
    if (isEditMode) {
      apiClient.get<Benefit>(`/benefits/${id}`).then((b) => {
        setForm({
          slug: b.slug,
          title: b.title,
          shortDescription: b.shortDescription,
          categoryId: b.categoryId,
          benefitType: b.benefitType,
          discountValue: toOptionalNumber(b.discountValue),
          isPopular: b.isPopular,
          isFeatured: b.isFeatured,
        });
        setScopes(b.scopes.map((s) => ({ programId: s.programId, brandId: s.brandId, storeId: s.storeId })));
      });
    }
  }, [id, isEditMode]);

  async function handleSubmit() {
    setError(null);
    if (scopes.length === 0) {
      setError('חייבת להיות לפחות שורת התאמה אחת — אחרת ההטבה לא תופיע לאף אחד');
      return;
    }
    setIsSaving(true);
    try {
      if (isEditMode) {
        await apiClient.patch(`/benefits/${id}`, form);
      } else {
        await apiClient.post('/benefits', { ...form, scopes });
      }
      navigate('/benefits');
    } catch (err) {
      setError(formatSaveError(err, fieldLabels));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <PageHeader title={isEditMode ? 'עריכת הטבה' : 'הטבה חדשה'} />

      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
        <Field label="כותרת">
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="לדוגמה: 10% הנחה בזארה" />
        </Field>

        <Field label="תיאור קצר">
          <Input
            value={form.shortDescription}
            onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
            placeholder="מופיע ברשימת ההטבות"
          />
        </Field>

        <Field label="מזהה URL (slug)" hint="אנגלית, מקפים בלבד — לדוגמה zara-10-percent">
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

        <Field label="סוג הטבה">
          <Select value={form.benefitType} onChange={(e) => setForm({ ...form, benefitType: e.target.value })}>
            {Object.entries(benefitTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="ערך ההנחה" hint="אחוז, סכום, או נקודות — לפי סוג ההטבה שנבחר למעלה">
          <Input
            type="number"
            value={form.discountValue ?? ''}
            onChange={(e) => setForm({ ...form, discountValue: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>

        <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={form.isPopular} onChange={(e) => setForm({ ...form, isPopular: e.target.checked })} />
            סמן כפופולרי
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} />
            הצג במומלצות
          </label>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' }} />

        <ScopeEditor scopes={scopes} onChange={setScopes} />

        {error && (
          <div style={{ marginTop: 16, padding: 12, background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'שומר...' : 'שמור הטבה'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/benefits')} type="button">
            ביטול
          </Button>
        </div>
      </div>
    </div>
  );
}
