import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient, formatSaveError } from '../../api/client';
import { PageHeader, Field, Input, Select, Button } from '../../components/forms/FormPrimitives';
import { Badge, statusBadge } from '../../components/Badge';
import { sourceTypeLabels, type ScrapeConfig, type ScraperRunResult, type ScraperSource } from '../../types/scraperSource';

type Program = { id: string; name: string };
type Brand = { id: string; name: string };
type Category = { id: string; name: string };

const fieldLabels: Record<string, string> = {
  slug: 'מזהה URL (slug)',
  name: 'שם המקור',
  baseUrl: 'כתובת בסיס',
  sourceType: 'סוג מקור',
  renderMode: 'אופן טעינת הדף',
  scrapeConfig: 'הגדרות סריקה',
  defaultProgramId: 'מועדון ברירת מחדל',
  defaultBrandId: 'מותג ברירת מחדל',
  defaultCategoryId: 'קטגוריית ברירת מחדל',
};

const tosFieldLabels: Record<string, string> = {
  reviewedBy: 'שמך',
  notes: 'הערות',
};

const emptyScrapeConfig: ScrapeConfig = {
  listSelector: '',
  paginationParam: '',
  maxPages: 1,
  fields: { title: '', shortDescription: '', discountValue: '', imageUrl: '', externalId: '', detailUrl: '' },
};

const emptyForm = {
  slug: '',
  name: '',
  sourceType: 'BRAND_SITE' as ScraperSource['sourceType'],
  baseUrl: '',
  renderMode: 'HTTP' as ScraperSource['renderMode'],
  defaultProgramId: '',
  defaultBrandId: '',
  defaultCategoryId: '',
};

// ממיר undefined/מחרוזת ריקה ל-undefined כדי שהשרת לא ידחה שדה
// אופציונלי ריק בתור מחרוזת לא-תקינה, ומסנן maxPages/paginationParam
// ריקים החוצה מ-scrapeConfig לפני שליחה.
function cleanScrapeConfig(config: ScrapeConfig): ScrapeConfig {
  const fields = Object.fromEntries(
    Object.entries(config.fields).filter(([, v]) => v && v.trim() !== '')
  ) as ScrapeConfig['fields'];
  return {
    listSelector: config.listSelector.trim(),
    ...(config.paginationParam?.trim() && { paginationParam: config.paginationParam.trim() }),
    maxPages: config.maxPages && config.maxPages > 0 ? config.maxPages : 1,
    fields,
  };
}

export function ScraperSourceFormPage() {
  const { id } = useParams();
  const isEditMode = id !== 'new';
  const navigate = useNavigate();

  const [source, setSource] = useState<ScraperSource | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [scrapeConfig, setScrapeConfig] = useState<ScrapeConfig>(emptyScrapeConfig);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isActing, setIsActing] = useState(false); // מצב נפרד לפעולות (activate/run) לעומת שמירת טופס
  const [error, setError] = useState<string | null>(null);
  // סיכום הריצה האחרונה שהופעלה מהמסך הזה. נפרד מ-error, כי ריצה
  // יכולה להסתיים בהצלחה, בכישלון, או חלקית — ולמנהלת צריך להיות
  // ברור מיד מה מתוך השלושה קרה, בלי לרענן ולהסתכל בעמודה.
  const [runSummary, setRunSummary] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null);
  const [tosNotes, setTosNotes] = useState('');
  const [reviewerName, setReviewerName] = useState('');

  useEffect(() => {
    apiClient.getPaginated<Program[]>('/programs?pageSize=200').then((r) => setPrograms(r.data));
    apiClient.getPaginated<Brand[]>('/brands?pageSize=200').then((r) => setBrands(r.data));
    apiClient.getPaginated<Category[]>('/categories?pageSize=200').then((r) => setCategories(r.data));
  }, []);

  function loadSource() {
    if (!isEditMode) return;
    apiClient.get<ScraperSource>(`/scraper/sources/${id}`).then((s) => {
      setSource(s);
      setForm({
        slug: s.slug,
        name: s.name,
        sourceType: s.sourceType,
        baseUrl: s.baseUrl,
        renderMode: s.renderMode,
        defaultProgramId: s.defaultProgramId ?? '',
        defaultBrandId: s.defaultBrandId ?? '',
        defaultCategoryId: s.defaultCategoryId ?? '',
      });
      setScrapeConfig({
        listSelector: s.scrapeConfig?.listSelector ?? '',
        paginationParam: s.scrapeConfig?.paginationParam ?? '',
        maxPages: s.scrapeConfig?.maxPages ?? 1,
        fields: {
          title: s.scrapeConfig?.fields?.title ?? '',
          shortDescription: s.scrapeConfig?.fields?.shortDescription ?? '',
          discountValue: s.scrapeConfig?.fields?.discountValue ?? '',
          imageUrl: s.scrapeConfig?.fields?.imageUrl ?? '',
          externalId: s.scrapeConfig?.fields?.externalId ?? '',
          detailUrl: s.scrapeConfig?.fields?.detailUrl ?? '',
        },
      });
    });
  }

  useEffect(loadSource, [id, isEditMode]);

  async function handleSubmit() {
    setError(null);
    setIsSaving(true);
    try {
      const payload = {
        ...form,
        defaultProgramId: form.defaultProgramId || undefined,
        defaultBrandId: form.defaultBrandId || undefined,
        defaultCategoryId: form.defaultCategoryId || undefined,
        scrapeConfig: cleanScrapeConfig(scrapeConfig),
      };
      if (isEditMode) await apiClient.patch(`/scraper/sources/${id}`, payload);
      else await apiClient.post('/scraper/sources', payload);
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
    setRunSummary(null);
    setIsActing(true);
    try {
      const run = await apiClient.post<ScraperRunResult>(`/scraper/sources/${id}/run`, {});
      // ריצה שדילגה על כל מה שמצאה מסתיימת PARTIAL — היא לא נכשלה,
      // אבל גם לא באמת הצליחה, ולכן מוצגת כאזהרה ולא כהצלחה.
      setRunSummary(
        run.status === 'PARTIAL'
          ? { tone: 'warning', text: run.errorMessage ?? 'הסריקה הסתיימה חלקית' }
          : {
              tone: 'success',
              text: `הסריקה הסתיימה: ${run.itemsFound} פריטים נמצאו, ${run.itemsUpdated} עודכנו, ${run.itemsFlagged} הועברו לבדיקה${
                run.itemsSkipped ? `, ${run.itemsSkipped} דולגו` : ''
              }.`,
            }
      );
      loadSource();
    } catch (err) {
      setError(formatSaveError(err));
    } finally {
      setIsActing(false);
    }
  }

  const hasAutoScopeAnchor = Boolean((form.defaultProgramId || form.defaultBrandId) && form.defaultCategoryId);

  return (
    <div style={{ maxWidth: 620 }}>
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
      </div>

      {/* אזור נפרד: איך לזהות הטבות בדף. שדות טכניים (CSS selectors) —
          מיועד למי שמכינה את המקור מול קוד המקור (HTML) של האתר. */}
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>איך לזהות הטבות בדף</div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0, marginBottom: 16 }}>
          שדות טכניים (CSS selectors) — נדרשת הכרות עם קוד המקור (HTML) של האתר הנסרק. בלי
          "בורר הכרטיס" ו"שדה כותרת" תקינים, המקור ירוץ בלי לייצר שום פריט.
        </p>

        <Field label="בורר הכרטיס (listSelector)" hint='ה-selector שתופס כל "כרטיס הטבה" בודד בדף, למשל .benefit-card'>
          <Input
            value={scrapeConfig.listSelector}
            onChange={(e) => setScrapeConfig({ ...scrapeConfig, listSelector: e.target.value })}
            placeholder=".benefit-card"
          />
        </Field>
        <Field label="שדה כותרת" hint="selector יחסי לכרטיס, לטקסט הכותרת">
          <Input
            value={scrapeConfig.fields.title}
            onChange={(e) => setScrapeConfig({ ...scrapeConfig, fields: { ...scrapeConfig.fields, title: e.target.value } })}
            placeholder=".title"
          />
        </Field>
        <Field label="שדה מזהה ייחודי (externalId)" hint='מזהה יציב לכל פריט — לרוב תכונה, כמו @data-id, לא טקסט חופשי'>
          <Input
            value={scrapeConfig.fields.externalId}
            onChange={(e) => setScrapeConfig({ ...scrapeConfig, fields: { ...scrapeConfig.fields, externalId: e.target.value } })}
            placeholder="@data-id"
          />
        </Field>
        <Field label="שדה תיאור קצר (לא חובה)">
          <Input
            value={scrapeConfig.fields.shortDescription}
            onChange={(e) =>
              setScrapeConfig({ ...scrapeConfig, fields: { ...scrapeConfig.fields, shortDescription: e.target.value } })
            }
            placeholder=".desc"
          />
        </Field>
        <Field label="שדה ערך הנחה (לא חובה)" hint="הטקסט יומר אוטומטית למספר, למשל '15% הנחה' -> 15">
          <Input
            value={scrapeConfig.fields.discountValue}
            onChange={(e) =>
              setScrapeConfig({ ...scrapeConfig, fields: { ...scrapeConfig.fields, discountValue: e.target.value } })
            }
            placeholder=".discount"
          />
        </Field>
        <Field label="שדה תמונה (לא חובה)">
          <Input
            value={scrapeConfig.fields.imageUrl}
            onChange={(e) => setScrapeConfig({ ...scrapeConfig, fields: { ...scrapeConfig.fields, imageUrl: e.target.value } })}
            placeholder="img::attr(src)"
          />
        </Field>
        <Field label="שדה קישור לפרטים (לא חובה)">
          <Input
            value={scrapeConfig.fields.detailUrl}
            onChange={(e) => setScrapeConfig({ ...scrapeConfig, fields: { ...scrapeConfig.fields, detailUrl: e.target.value } })}
            placeholder="a::attr(href)"
          />
        </Field>
        <Field label="פרמטר דפדוף (לא חובה)" hint="שם פרמטר ה-URL שמקדם עמוד, למשל page">
          <Input
            value={scrapeConfig.paginationParam}
            onChange={(e) => setScrapeConfig({ ...scrapeConfig, paginationParam: e.target.value })}
            placeholder="page"
          />
        </Field>
        <Field label="מספר עמודים מקסימלי">
          <Input
            type="number"
            min={1}
            value={scrapeConfig.maxPages}
            onChange={(e) => setScrapeConfig({ ...scrapeConfig, maxPages: Number(e.target.value) || 1 })}
          />
        </Field>
      </div>

      {/* עוגן השיוך האוטומטי: כשמוגדר (מועדון/מותג + קטגוריה), הטבה
          חדשה שעוברת את סף הביטחון מתפרסמת לגמרי לבד. בלעדיו, כל
          הטבה חדשה ממקור זה תמיד עוברת דרך תור הבדיקה. */}
      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>שיוך אוטומטי להטבות חדשות</div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0, marginBottom: 16 }}>
          כשיש כאן מועדון או מותג, וגם קטגוריה — הטבה חדשה שהמערכת בטוחה בה מספיק תתפרסם ותשויך
          אוטומטית, בלי לחכות לאישור ידני. בלעדיהם, כל הטבה חדשה תמיד תעבור דרך תור הבדיקה.
        </p>

        <Field label="מועדון ברירת מחדל (לא חובה)">
          <Select value={form.defaultProgramId} onChange={(e) => setForm({ ...form, defaultProgramId: e.target.value })}>
            <option value="">— ללא —</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="מותג ברירת מחדל (לא חובה)">
          <Select value={form.defaultBrandId} onChange={(e) => setForm({ ...form, defaultBrandId: e.target.value })}>
            <option value="">— ללא —</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="קטגוריית ברירת מחדל (לא חובה)">
          <Select value={form.defaultCategoryId} onChange={(e) => setForm({ ...form, defaultCategoryId: e.target.value })}>
            <option value="">— ללא —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <div
          style={{
            fontSize: 13,
            padding: 10,
            borderRadius: 'var(--radius-sm)',
            background: hasAutoScopeAnchor ? 'var(--status-success-bg)' : 'var(--status-warning-bg)',
            color: hasAutoScopeAnchor ? 'var(--status-success-text)' : 'var(--status-warning-text)',
          }}
        >
          {hasAutoScopeAnchor
            ? 'שיוך אוטומטי פעיל למקור הזה.'
            : 'אין שיוך אוטומטי — כל הטבה חדשה תעבור דרך תור הבדיקה, גם אם המערכת בטוחה בה.'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Button onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? 'שומרת...' : 'שמור מקור'}
        </Button>
        <Button variant="secondary" onClick={() => navigate('/scraper-sources')} type="button">
          ביטול
        </Button>
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
                {isActing ? 'סורק...' : 'הרץ עכשיו'}
              </Button>
            </div>

            {runSummary && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 13,
                  background:
                    runSummary.tone === 'success' ? 'var(--status-success-bg)' : 'var(--status-warning-bg)',
                  color:
                    runSummary.tone === 'success' ? 'var(--status-success-text)' : 'var(--status-warning-text)',
                }}
              >
                {runSummary.text}
              </div>
            )}
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
