import { useState, type FormEvent } from 'react';
import { apiClient, formatSaveError } from '../../api/client';
import { Field, Input, Button } from '../../components/forms/FormPrimitives';

// מסך הכניסה היחיד לדשבורד (שלב 5, א.3). בכוונה מינימלי — שדה
// סיסמה אחד וכפתור, בלי שם משתמש (אין ריבוי משתמשים) ובלי "שכחתי
// סיסמה" (אין לכך תשתית). נועד למי שאינה מתכנתת: בלי מונחים
// טכניים, שגיאה בעברית ברורה.
export function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post('/auth/login', { password });
      onSuccess();
    } catch (err) {
      setError(formatSaveError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-sidebar)',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 340,
          background: 'var(--surface-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 32,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 4 }}>
            <span style={{ color: 'var(--bp-lilac)' }}>ארנק</span>{' '}
            <span style={{ color: 'var(--bp-purple)' }}>ההטבות</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>כניסה לממשק הניהול</div>
        </div>

        <Field label="סיסמה">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            placeholder="הקלידי את הסיסמה"
          />
        </Field>

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              background: 'var(--status-danger-bg)',
              color: 'var(--status-danger-text)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <Button type="submit" disabled={isSubmitting || !password} style={{ width: '100%' }}>
          {isSubmitting ? 'מתחברת...' : 'כניסה'}
        </Button>
      </form>
    </div>
  );
}
