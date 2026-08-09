import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient, formatSaveError } from '../../api/client';
import { PageHeader, Field, Input, Select, Button, toOptionalNumber } from '../../components/forms/FormPrimitives';
import type { Coupon } from '../../types/coupon';

type BenefitOption = { id: string; title: string };

const fieldLabels: Record<string, string> = {
  benefitId: 'הטבה',
  code: 'קוד קופון',
  type: 'סוג',
  maxUses: 'מגבלת שימושים',
  expiresAt: 'בתוקף עד',
};

const emptyForm = { benefitId: '', code: '', type: 'SINGLE_USE_SHARED' as 'SINGLE_USE_SHARED' | 'UNIQUE_PER_USER', maxUses: undefined as number | undefined, expiresAt: '' };

export function CouponFormPage() {
  const { id } = useParams();
  const isEditMode = id !== 'new';
  const navigate = useNavigate();

  const [benefits, setBenefits] = useState<BenefitOption[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.getPaginated<BenefitOption[]>('/benefits?pageSize=200').then((r) => setBenefits(r.data));
    if (isEditMode) {
      apiClient.get<Coupon>(`/coupons/${id}`).then((c) =>
        setForm({
          benefitId: c.benefitId,
          code: c.code,
          type: c.type,
          maxUses: toOptionalNumber(c.maxUses),
          expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : '',
        })
      );
    }
  }, [id, isEditMode]);

  async function handleSubmit() {
    setError(null);
    if (!form.benefitId) {
      setError('חובה לשייך את הקופון להטבה');
      return;
    }
    setIsSaving(true);
    try {
      const payload = { ...form, expiresAt: form.expiresAt || undefined };
      if (isEditMode) {
        const { benefitId: _benefitId, ...updatePayload } = payload; // benefitId לא ניתן לעדכון אחרי יצירה
        await apiClient.patch(`/coupons/${id}`, updatePayload);
      } else {
        await apiClient.post('/coupons', payload);
      }
      navigate('/coupons');
    } catch (err) {
      setError(formatSaveError(err, fieldLabels));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <PageHeader title={isEditMode ? 'עריכת קופון' : 'קופון חדש'} />
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
        <Field label="הטבה">
          <Select value={form.benefitId} onChange={(e) => setForm({ ...form, benefitId: e.target.value })} disabled={isEditMode}>
            <option value="">בחרי הטבה</option>
            {benefits.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="קוד קופון">
          <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="ZARA300GIFT" />
        </Field>
        <Field label="סוג" hint="קוד משותף לכולם, או קוד ייחודי לכל משתמש (דורש הרשמה — לא זמין עדיין)">
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type })}>
            <option value="SINGLE_USE_SHARED">קוד משותף</option>
            <option value="UNIQUE_PER_USER" disabled>
              ייחודי למשתמש (בקרוב)
            </option>
          </Select>
        </Field>
        <Field label="מגבלת שימושים" hint="השאירי ריק ללא הגבלה">
          <Input type="number" value={form.maxUses ?? ''} onChange={(e) => setForm({ ...form, maxUses: e.target.value ? Number(e.target.value) : undefined })} />
        </Field>
        <Field label="בתוקף עד">
          <Input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
        </Field>

        {error && (
          <div style={{ marginTop: 8, padding: 12, background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'שומר...' : 'שמור קופון'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/coupons')} type="button">
            ביטול
          </Button>
        </div>
      </div>
    </div>
  );
}
