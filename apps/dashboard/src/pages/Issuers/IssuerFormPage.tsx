import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient, formatSaveError } from '../../api/client';
import { PageHeader, Field, Input, Button, optionalUrl } from '../../components/forms/FormPrimitives';
import type { Issuer } from '../../types/issuer';

const emptyForm = { slug: '', name: '', nameEn: '', brandColor: '#7F77DD', websiteUrl: '', supportPhone: '' };

const fieldLabels: Record<string, string> = {
  slug: 'מזהה URL (slug)',
  name: 'שם',
  nameEn: 'שם באנגלית',
  brandColor: 'צבע מותג',
  websiteUrl: 'אתר',
  supportPhone: 'טלפון תמיכה',
};

export function IssuerFormPage() {
  const { id } = useParams();
  const isEditMode = id !== 'new';
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isEditMode) {
      apiClient.get<Issuer>(`/issuers/${id}`).then((i) =>
        setForm({
          slug: i.slug,
          name: i.name,
          nameEn: i.nameEn ?? '',
          brandColor: i.brandColor ?? '#7F77DD',
          websiteUrl: i.websiteUrl ?? '',
          supportPhone: i.supportPhone ?? '',
        })
      );
    }
  }, [id, isEditMode]);

  async function handleSubmit() {
    setError(null);
    setIsSaving(true);
    try {
      const payload = { ...form, websiteUrl: optionalUrl(form.websiteUrl) };
      if (isEditMode) await apiClient.patch(`/issuers/${id}`, payload);
      else await apiClient.post('/issuers', payload);
      navigate('/issuers');
    } catch (err) {
      setError(formatSaveError(err, fieldLabels));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <PageHeader title={isEditMode ? 'עריכת מנפיק' : 'מנפיק חדש'} />
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
        <Field label="שם">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="MAX" />
        </Field>
        <Field label="שם באנגלית">
          <Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
        </Field>
        <Field label="מזהה URL (slug)" hint="אנגלית, מקפים בלבד">
          <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} disabled={isEditMode} />
        </Field>
        <Field label="צבע מותג">
          <Input type="color" value={form.brandColor} onChange={(e) => setForm({ ...form, brandColor: e.target.value })} style={{ height: 40, padding: 4 }} />
        </Field>
        <Field label="אתר">
          <Input value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} placeholder="https://" />
        </Field>
        <Field label="טלפון תמיכה">
          <Input value={form.supportPhone} onChange={(e) => setForm({ ...form, supportPhone: e.target.value })} />
        </Field>

        {error && (
          <div style={{ marginTop: 8, padding: 12, background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'שומר...' : 'שמור מנפיק'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/issuers')} type="button">
            ביטול
          </Button>
        </div>
      </div>
    </div>
  );
}
