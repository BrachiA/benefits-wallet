import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { Select, Button } from './FormPrimitives';
import type { BenefitScope, Brand, Program, Store } from '../../types/benefit';

type ScopeEditorProps = {
  scopes: BenefitScope[];
  onChange: (scopes: BenefitScope[]) => void;
};

// מממש חזותית בדיוק את המודל מהתכנון: כל "שורת התאמה" היא AND בין
// השדות שנבחרו בה (תוכנית + מותג + סניף), וכמה שורות ביחד הן OR.
// זו הסיבה שהעורך לא "טופס אחד עם dropdowns" אלא רשימת שורות
// שאפשר להוסיף/להסיר — בדיוק כמו שהוגדר ב-BenefitScope.
export function ScopeEditor({ scopes, onChange }: ScopeEditorProps) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => {
    apiClient.getPaginated<Program[]>('/programs?pageSize=200').then((r) => setPrograms(r.data));
    apiClient.getPaginated<Brand[]>('/brands?pageSize=200').then((r) => setBrands(r.data));
    apiClient.getPaginated<Store[]>('/stores?pageSize=200').then((r) => setStores(r.data));
  }, []);

  function updateRow(index: number, patch: Partial<BenefitScope>) {
    const next = scopes.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onChange(next);
  }

  function addRow() {
    onChange([...scopes, {}]);
  }

  function removeRow(index: number) {
    onChange(scopes.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>למי ההטבה תקפה</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        כל שורה היא צירוף (מועדון + מותג + סניף) — השאירי ריק כדי לומר "כולם". כמה שורות ביחד
        פועלות כ"או": ההטבה תקפה אם צירוף כלשהו מתקיים.
      </div>

      {scopes.map((scope, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            padding: 12,
            background: 'var(--surface-hover)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 8,
          }}
        >
          <Select
            value={scope.programId ?? ''}
            onChange={(e) => updateRow(i, { programId: e.target.value || undefined })}
            style={{ flex: 1 }}
          >
            <option value="">כל המועדונים</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.issuer ? `${p.issuer.name} — ${p.name}` : p.name}
              </option>
            ))}
          </Select>

          <Select
            value={scope.brandId ?? ''}
            onChange={(e) => updateRow(i, { brandId: e.target.value || undefined })}
            style={{ flex: 1 }}
          >
            <option value="">כל המותגים</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>

          <Select
            value={scope.storeId ?? ''}
            onChange={(e) => updateRow(i, { storeId: e.target.value || undefined })}
            style={{ flex: 1 }}
          >
            <option value="">כל הסניפים</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.brand ? `${s.brand.name} — ${s.name}` : s.name}
              </option>
            ))}
          </Select>

          <button
            onClick={() => removeRow(i)}
            aria-label="הסר שורת התאמה"
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--status-danger-text)',
              cursor: 'pointer',
              fontSize: 18,
              padding: '0 6px',
            }}
          >
            ×
          </button>
        </div>
      ))}

      {scopes.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>
          עדיין אין שורת התאמה — ההטבה לא תופיע לאף משתמש עד שתוסיפי לפחות אחת.
        </div>
      )}

      <Button variant="secondary" onClick={addRow} type="button">
        הוסף שורת התאמה
      </Button>
    </div>
  );
}
