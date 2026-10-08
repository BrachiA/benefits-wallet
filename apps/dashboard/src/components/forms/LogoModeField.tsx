import { useRef, useState } from 'react';
import { apiClient } from '../../api/client';
import { Field, Button } from './FormPrimitives';

type LogoMode = 'AUTO' | 'MANUAL';

// משותף ל-ProgramFormPage/BrandFormPage — אותה זרימת "לוגו ברירת
// מחדל" (חלק ד' של משימת אחסון התמונות): toggle אוטומטי/ידני +
// העלאה ידנית. ה-toggle עצמו הוא עוד שדה בטופס הרגיל (נשמר עם כפתור
// "שמור", כמו hasOnlineStore/isPopular וכו') — אבל ההעלאה עצמה
// פועלת מיידית (POST נפרד), לא ממתינה לשמירת הטופס, כי היא מחליפה
// בפועל קובץ ב-R2 ולא רק שדה טקסט. זמינה רק אחרי שהישות כבר נשמרה
// (endpoint דורש id אמיתי).
export function LogoModeField({
  entityKind,
  entityId,
  isEditMode,
  logoMode,
  defaultLogoUrl,
  onLogoModeChange,
  onUploaded,
}: {
  entityKind: 'programs' | 'brands';
  entityId: string;
  isEditMode: boolean;
  logoMode: LogoMode;
  defaultLogoUrl?: string | null;
  onLogoModeChange: (mode: LogoMode) => void;
  onUploaded: (defaultLogoUrl: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleUpload() {
    if (!selectedFile) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      const updated = await apiClient.uploadFile<{ defaultLogoUrl?: string | null }>(
        `/${entityKind}/${entityId}/logo`,
        selectedFile
      );
      if (updated.defaultLogoUrl) onUploaded(updated.defaultLogoUrl);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      setUploadError('העלאת התמונה נכשלה — נסי שוב');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Field label="לוגו">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        {defaultLogoUrl ? (
          <img
            src={defaultLogoUrl}
            alt="לוגו נוכחי"
            style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: '#fff' }}
          />
        ) : (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-sm)',
              border: '1px dashed var(--border-strong)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: 'var(--text-muted)',
            }}
          >
            אין
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => onLogoModeChange('AUTO')}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-strong)',
              background: logoMode === 'AUTO' ? 'var(--bp-purple)' : '#fff',
              color: logoMode === 'AUTO' ? '#fff' : 'var(--text-primary)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            אוטומטי
          </button>
          <button
            type="button"
            onClick={() => onLogoModeChange('MANUAL')}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-strong)',
              background: logoMode === 'MANUAL' ? 'var(--bp-purple)' : '#fff',
              color: logoMode === 'MANUAL' ? '#fff' : 'var(--text-primary)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            ידני
          </button>
        </div>
      </div>

      {logoMode === 'AUTO' && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          המערכת מחפשת ומעדכנת לוגו רשמי אוטומטית (בדיקה שעתית). אפשר לעבור למצב ידני ולהעלות תמונה בעצמך בכל עת.
        </div>
      )}

      {logoMode === 'MANUAL' && !isEditMode && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>שמרי תחילה כדי להעלות לוגו ידני.</div>
      )}

      {logoMode === 'MANUAL' && isEditMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            החיפוש האוטומטי לא ירוץ עוד עבור הרשומה הזו כל עוד היא במצב ידני.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              style={{ fontSize: 13 }}
            />
            <Button type="button" variant="secondary" onClick={handleUpload} disabled={!selectedFile || isUploading}>
              {isUploading ? 'מעלה...' : 'העלה תמונה'}
            </Button>
          </div>
          {uploadError && <div style={{ fontSize: 12, color: 'var(--status-danger-text)' }}>{uploadError}</div>}
        </div>
      )}
    </Field>
  );
}
