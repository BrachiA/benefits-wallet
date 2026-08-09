import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

// שדות URL אופציונליים ב-backend מוגדרים כ-z.string().url().optional() —
// .optional() מקבל רק undefined, לא מחרוזת ריקה, ו-.url() דוחה מחרוזת
// ריקה. טופס ששולח '' לשדה URL ריק תמיד ייכשל בוולידציה; יש להעביר
// כל שדה URL אופציונלי דרך הפונקציה הזו לפני השליחה ל-API.
export function optionalUrl(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

// שדות Decimal/Int אופציונליים ב-DB (annualFee, discountValue, maxUses...)
// חוזרים מה-API כ-null כשלא הוגדרו, ו-Decimal חוזר כמחרוזת גם כשכן
// הוגדר (כך Prisma מסדרל Decimal ל-JSON). z.number().optional() דוחה
// גם null וגם string — יש להעביר כל שדה כזה דרך הפונקציה הזו בטעינת
// הטופס, כדי שה-state תמיד יחזיק number | undefined תקין.
export function toOptionalNumber(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

const fieldBase: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-sm)',
  background: '#fff',
  color: 'var(--text-primary)',
  fontSize: 14,
};

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--text-primary)' }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...fieldBase, ...props.style }} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...fieldBase, ...props.style }} />;
}

type ButtonVariant = 'primary' | 'secondary' | 'danger';

const buttonStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: 'var(--bp-purple)', color: '#fff', border: 'none' },
  secondary: { background: '#fff', color: 'var(--text-primary)', border: '1px solid var(--border-strong)' },
  danger: { background: 'var(--status-danger-text)', color: '#fff', border: 'none' },
};

// שם הכפתור תמיד פועל + תוצאה ("שמור הטבה", לא "שלח") — לפי
// ה-skill: "an action keeps the same name through the whole flow".
export function Button({
  variant = 'primary',
  children,
  ...props
}: { variant?: ButtonVariant } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        ...buttonStyles[variant],
        padding: '9px 18px',
        borderRadius: 'var(--radius-sm)',
        fontSize: 14,
        fontWeight: 500,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.6 : 1,
        ...props.style,
      }}
    >
      {children}
    </button>
  );
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>{title}</h1>
      {action}
    </div>
  );
}
