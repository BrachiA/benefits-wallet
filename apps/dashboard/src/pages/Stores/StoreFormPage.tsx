import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient, formatSaveError } from '../../api/client';
import { PageHeader, Field, Input, Select, Button } from '../../components/forms/FormPrimitives';
import type { Brand, Store } from '../../types/store';

const emptyForm = { name: '', address: '', brandId: '', cityName: '', phone: '' };

const fieldLabels: Record<string, string> = {
  name: 'שם הסניף',
  brandId: 'מותג',
  address: 'כתובת',
  phone: 'טלפון',
};

// הערה: City/Region לא קיבלו מודול CRUD משלהם בשלב 4 (הוגדרו
// בשלב 1 כ"טבלאות lookup לצורכי סינון בלבד", לא כישות ניהולית).
// כרגע העיר מוזנת כטקסט חופשי; ברגע שיתווסף endpoint ל-City,
// השדה הזה יוחלף ב-Select שטוען ערים קיימות, כמו brandId למטה.
export function StoreFormPage() {
  const { id } = useParams();
  const isEditMode = id !== 'new';
  const navigate = useNavigate();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.getPaginated<Brand[]>('/brands?pageSize=200').then((r) => setBrands(r.data));
    if (isEditMode) {
      apiClient.get<Store>(`/stores/${id}`).then((s) =>
        setForm({ name: s.name, address: s.address ?? '', brandId: s.brandId, cityName: s.city?.name ?? '', phone: s.phone ?? '' })
      );
    }
  }, [id, isEditMode]);

  async function handleSubmit() {
    setError(null);
    if (!form.brandId) {
      setError('חובה לבחור מותג');
      return;
    }
    setIsSaving(true);
    try {
      // cityId לא נשלח מטופס זה עדיין (ראו הערה למעלה) — הסניף
      // נוצר בלי שיוך עיר עד שיתווסף מסך ניהול ערים.
      const { cityName: _cityName, ...payload } = form;
      if (isEditMode) await apiClient.patch(`/stores/${id}`, payload);
      else await apiClient.post('/stores', payload);
      navigate('/stores');
    } catch (err) {
      setError(formatSaveError(err, fieldLabels));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <PageHeader title={isEditMode ? 'עריכת סניף' : 'סניף חדש'} />
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
        <Field label="שם הסניף">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="זארה קניון עזריאלי" />
        </Field>
        <Field label="מותג">
          <Select value={form.brandId} onChange={(e) => setForm({ ...form, brandId: e.target.value })}>
            <option value="">בחרי מותג</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="עיר" hint="שיוך לעיר קיימת יתווסף בעדכון עתידי — לעת עתה לצורך תיעוד בלבד">
          <Input value={form.cityName} onChange={(e) => setForm({ ...form, cityName: e.target.value })} placeholder="תל אביב" disabled />
        </Field>
        <Field label="כתובת">
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        <Field label="טלפון">
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>

        {error && (
          <div style={{ marginTop: 8, padding: 12, background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'שומר...' : 'שמור סניף'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/stores')} type="button">
            ביטול
          </Button>
        </div>
      </div>
    </div>
  );
}
