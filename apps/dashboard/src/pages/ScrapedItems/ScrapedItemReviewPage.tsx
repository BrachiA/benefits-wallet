import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient, formatSaveError } from '../../api/client';
import { PageHeader, Field, Input, Select, Button } from '../../components/forms/FormPrimitives';
import { Badge, statusBadge } from '../../components/Badge';
import type { ScrapedItem } from '../../types/scrapedItem';

type Category = { id: string; name: string };

const fieldLabels: Record<string, string> = {
  reviewedBy: 'שמך',
  overrides: 'פרטי אישור',
};

export function ScrapedItemReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [item, setItem] = useState<ScrapedItem | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reviewerName, setReviewerName] = useState('');
  const [overrideCategoryId, setOverrideCategoryId] = useState('');
  const [overrideTitle, setOverrideTitle] = useState('');
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<ScrapedItem>(`/scraper/items/${id}`).then((i) => {
      setItem(i);
      setOverrideTitle(i.rawData.title);
    });
    apiClient.getPaginated<Category[]>('/categories?pageSize=200').then((r) => setCategories(r.data));
  }, [id]);

  const isNewBenefit = item && !item.matchedBenefitId;

  async function handleDecision(decision: 'APPROVE' | 'REJECT') {
    if (!reviewerName.trim()) {
      setError('נא לציין את שמך לפני קבלת החלטה — זו נדרשת כתיעוד');
      return;
    }
    if (decision === 'APPROVE' && isNewBenefit && !overrideCategoryId) {
      setError('הטבה חדשה חייבת להיות משויכת לקטגוריה לפני אישור');
      return;
    }
    setError(null);
    setIsActing(true);
    try {
      await apiClient.post(`/scraper/items/${id}/review`, {
        decision,
        reviewedBy: reviewerName,
        ...(decision === 'APPROVE' && {
          overrides: {
            title: overrideTitle,
            ...(isNewBenefit && { categoryId: overrideCategoryId }),
          },
        }),
      });
      navigate('/scraped-items');
    } catch (err) {
      setError(formatSaveError(err, fieldLabels));
    } finally {
      setIsActing(false);
    }
  }

  if (!item) return null;

  const isDecided = item.status === 'APPROVED' || item.status === 'REJECTED' || item.status === 'AUTO_PUBLISHED';

  return (
    <div style={{ maxWidth: 600 }}>
      <PageHeader title="בדיקת פריט שנסרק" />

      <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
              {item.source?.name} · {new Date(item.scrapedAt).toLocaleString('he-IL')}
            </div>
            <div style={{ fontSize: 17, fontWeight: 500 }}>{item.rawData.title}</div>
          </div>
          {(() => {
            const { tone, label } = statusBadge('confidence', item.confidenceScore);
            return <Badge tone={tone}>ביטחון: {label}</Badge>;
          })()}
        </div>

        {item.rawData.shortDescription && (
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{item.rawData.shortDescription}</p>
        )}

        <div style={{ display: 'flex', gap: 24, fontSize: 13, marginBottom: 16 }}>
          {item.rawData.discountValue !== undefined && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>ערך שנסרק: </span>
              {item.rawData.discountValue}
            </div>
          )}
          <div>
            <span style={{ color: 'var(--text-muted)' }}>סוג: </span>
            {isNewBenefit ? 'הטבה חדשה' : `עדכון ל"${item.matchedBenefit?.title}"`}
          </div>
        </div>

        {item.confidenceReasons.length > 0 && (
          <div style={{ background: 'var(--status-warning-bg)', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--status-warning-text)', marginBottom: 4 }}>
              למה זה בתור הבדיקה
            </div>
            <ul style={{ margin: 0, paddingRight: 18, fontSize: 13, color: 'var(--status-warning-text)' }}>
              {item.confidenceReasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {!isDecided && (
        <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>החלטה</div>

          <Field label="כותרת סופית" hint="אפשר לתקן לפני אישור, אם הסריקה לא הייתה מדויקת">
            <Input value={overrideTitle} onChange={(e) => setOverrideTitle(e.target.value)} />
          </Field>

          {isNewBenefit && (
            <Field label="קטגוריה" hint="חובה עבור הטבה חדשה">
              <Select value={overrideCategoryId} onChange={(e) => setOverrideCategoryId(e.target.value)}>
                <option value="">בחרי קטגוריה</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="שמך" hint="נדרש כתיעוד — מי אישר/דחה">
            <Input value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} placeholder="שם מלא" />
          </Field>

          {error && (
            <div style={{ marginBottom: 16, padding: 12, background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={() => handleDecision('APPROVE')} disabled={isActing}>
              {isNewBenefit ? 'אשר ופרסם הטבה חדשה' : 'אשר עדכון'}
            </Button>
            <Button variant="danger" onClick={() => handleDecision('REJECT')} disabled={isActing}>
              דחה
            </Button>
            <Button variant="secondary" onClick={() => navigate('/scraped-items')} type="button">
              חזרה לתור
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
