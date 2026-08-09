import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient, formatSaveError } from '../../api/client';
import { PageHeader, Field, Input, Select, Button } from '../../components/forms/FormPrimitives';
import { Badge, statusBadge } from '../../components/Badge';
import { sourceTypeLabels, type ScraperSource } from '../../types/scraperSource';

const fieldLabels: Record<string, string> = {
  slug: 'מזהה URL (slug)',
  name: 'שם המקור',
  baseUrl: 'כתובת בסיס',
  sourceType: 'סוג מקור',
  renderMode: 'אופן טעינת הדף',
};

const tosFieldLabels: Record<string, string> = {
  reviewedBy: 'שמך',
  notes: 'הערות',
};

const emptyForm = {
  slug: '',
  name: '',
  sourceType: 'BRAND_SITE' as ScraperSource['sourceType'],
  baseUrl: '',
  renderMode: 'HTTP' as ScraperSource['renderMode'],
};

export function ScraperSourceFormPage() {
  const { id } = useParams();
  const isEditMode = id !== 'new';
  const navigate = useNavigate();

  const [source, setSource] = useState<ScraperSource | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [isActing, setIsActing] = useState(false); // מצב נפרד לפעולות (activate/run) לעומת שמירת טופס
  const [error, setError] = useState<string | null>(null);
  const [tosNotes, setTosNotes] = useState('');
  const [reviewerName, setReviewerName] = useState('');

  function loadSource() {
    if (!isEditMode) return;
    apiClient.get<ScraperSource>(`/scraper/sources/${id}`).then((s) => {
      setSource(s);
      setForm({ slug: s.slug, name: s.name, sourceType: s.sourceType, baseUrl: s.baseUrl, renderMode: s.renderMode });
    });
  }

  useEffect(loadSource, [id, isEditMode]);

  async function handleSubmit() {
    setError(null);
    setIsSaving(true);
    try {
      // scrapeConfig לא נכלל בטופס הזה במכוון: זה קונפיג טכני
      // (selectors, מיפוי שדות) שדורש ידע במבנה ה-HTML של האתר —
      // לא משהו שמנהלת עסקית ממלאת ידנית. יוזן בנפרד/בקובץ JSON
      // בשלב ההטמעה בפועל של כל מקור. הערכים כאן הם placeholder
      // תקין-לוולידציה בלבד (השרת דורש listSelector/title/externalId
      // לא-ריקים) — חובה לעדכן אותם בפועל לפני שהמקור יופעל.
      if (isEditMode) await apiClient.patch(`/scraper/sources/${id}`, form);
      else {
        await apiClient.post('/scraper/sources', {
          ...form,
          scrapeConfig: {
            listSelector: 'TODO: CSS selector לכרטיס הטבה בדף',
            fields: { title: 'TODO: selector לכותרת', externalId: 'TODO: selector/attribute למזהה ייחודי' },
          },
        });
      }
      navigate('/scraper-sources');
    } catch (err) {
      setError(formatSaveError(err, fieldLabels));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTosDecision(status: 'APPROVED' | 'REJECTED') {
    if (!reviewerName.trim()) {
      setError('נא לציין את שמך לפני אישור/דחיית תנאי שימוש — זו החלטה שצריכה תיעוד מפורש');
      return;
    }
    setError(null);
    setIsActing(true);
    try {
      await apiClient.post(`/scraper/sources/${id}/review-tos`, { status, reviewedBy: reviewerName, notes: tosNotes || undefined });
      loadSource();
    } catch (err) {
      setError(formatSaveError(err, tosFieldLabels));
    } finally {
      setIsActing(false);
    }
  }

  async function handleToggleActive() {
    setError(null);
    setIsActing(true);
    try {
      await apiClient.post(`/scraper/sources/${id}/${source?.isActive ? 'deactivate' : 'activate'}`, {});
      loadSource();
    } catch (err) {
      setError(formatSaveError(err));
    } finally {
      setIsActing(false);
    }
  }

  async function handleRunNow() {
    setError(null);
    setIsActing(true);
    try {
      await apiClient.post(`/scraper/sources/${id}/run`, {});
      loadSource();
    } catch (err) {
      setError(formatSaveError(err));
    } finally {
      setIsActing(false);
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <PageHeader title={isEditMode ? 'עריכת מקור סריקה' : 'מקור סריקה חדש'} />

      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, marginBottom: 16 }}>
        <Field label="שם המקור">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="דף הטבות MAX" />
        </Field>
        <Field label="מזהה URL (slug)">
          <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} disabled={isEditMode} />
        </Field>
        <Field label="כתובת בסיס">
          <Input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://www.max.co.il" />
        </Field>
        <Field label="סוג מקור">
          <Select value={form.sourceType} onChange={(e) => setForm({ ...form, sourceType: e.target.value as typeof form.sourceType })}>
            {Object.entries(sourceTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="אופן טעינת הדף" hint="HTML רגיל טוען מהר יותר. דף עם JavaScript כבד (כמו React) דורש דפדפן מלא">
          <Select value={form.renderMode} onChange={(e) => setForm({ ...form, renderMode: e.target.value as typeof form.renderMode })}>
            <option value="HTTP">HTML רגיל</option>
            <option value="HEADLESS_BROWSER">דורש דפדפן (אתר עם JavaScript כבד)</option>
          </Select>
        </Field>

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'שומר...' : 'שמור מקור'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/scraper-sources')} type="button">
            ביטול
          </Button>
        </div>
      </div>

      {isEditMode && source && (
        <>
          {/* אזור נפרד ומודגש בכוונה: אישור תנאי שימוש הוא לא שדה
              טופס רגיל, זו החלטה עסקית-משפטית עם תיעוד חובה. */}
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>אישור תנאי שימוש</div>
              {(() => {
                const { tone, label } = statusBadge('tosStatus', source.tosStatus);
                return <Badge tone={tone}>{label}</Badge>;
              })()}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 0 }}>
              יש לבדוק את תנאי השימוש של האתר לפני שמאשרים סריקה אוטומטית. המקור לא ירוץ, גם אם
              יופעל, עד שאישור כאן יינתן במפורש.
            </p>

            {source.tosReviewedBy && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                נבדק לאחרונה ע"י {source.tosReviewedBy}
                {source.tosReviewedAt && ` · ${new Date(source.tosReviewedAt).toLocaleDateString('he-IL')}`}
                {source.tosNotes && ` · "${source.tosNotes}"`}
              </div>
            )}

            <Field label="שמך" hint="נדרש כתיעוד — מי אישר/דחה ומתי">
              <Input value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} placeholder="שם מלא" />
            </Field>
            <Field label="הערות (לא חובה)">
              <Input value={tosNotes} onChange={(e) => setTosNotes(e.target.value)} placeholder="לדוגמה: robots.txt פתוח, אין סעיף איסור scraping" />
            </Field>

            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => handleTosDecision('APPROVED')} disabled={isActing}>
                אשר תנאי שימוש
              </Button>
              <Button variant="danger" onClick={() => handleTosDecision('REJECTED')} disabled={isActing}>
                דחה
              </Button>
            </div>
          </div>

          {/* הרצה בפועל — חסום מפורשות ב-UI אם ToS לא אושר, לא רק
              בשרת, כדי שהמנהלת תבין למה מיד ולא רק תקבל שגיאה */}
          <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>הרצה</div>
            {source.tosStatus !== 'APPROVED' && (
              <p style={{ fontSize: 13, color: 'var(--status-warning-text)', marginTop: 0 }}>
                אי אפשר להפעיל את המקור עד שתנאי השימוש יאושרו למעלה.
              </p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="secondary" onClick={handleToggleActive} disabled={isActing || source.tosStatus !== 'APPROVED'}>
                {source.isActive ? 'השבת מקור' : 'הפעל מקור'}
              </Button>
              <Button variant="secondary" onClick={handleRunNow} disabled={isActing || !source.isActive}>
                הרץ עכשיו
              </Button>
            </div>
          </div>
        </>
      )}

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
          {error}
        </div>
      )}
    </div>
  );
}
