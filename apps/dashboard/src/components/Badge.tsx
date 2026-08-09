import type { ReactNode } from 'react';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral';

const toneStyles: Record<BadgeTone, { bg: string; text: string }> = {
  success: { bg: 'var(--status-success-bg)', text: 'var(--status-success-text)' },
  warning: { bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)' },
  danger: { bg: 'var(--status-danger-bg)', text: 'var(--status-danger-text)' },
  neutral: { bg: 'var(--status-neutral-bg)', text: 'var(--status-neutral-text)' },
};

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  const style = toneStyles[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        background: style.bg,
        color: style.text,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

// ממפה ערכים עסקיים חוזרים לשפת badge אחידה — כל מסך קורא לפונקציה
// הזו במקום לקבוע צבע/טקסט בעצמו, כדי שהמשמעות תישאר עקבית בכל
// המערכת (isActive ירוק בכל מקום, tosStatus צהוב תמיד "ממתין" וכו').
export function statusBadge(kind: 'isActive', value: boolean): { tone: BadgeTone; label: string };
export function statusBadge(
  kind: 'tosStatus',
  value: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'
): { tone: BadgeTone; label: string };
export function statusBadge(
  kind: 'itemStatus',
  value: 'AUTO_PUBLISHED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'
): { tone: BadgeTone; label: string };
export function statusBadge(kind: 'confidence', value: number): { tone: BadgeTone; label: string };
export function statusBadge(kind: string, value: unknown): { tone: BadgeTone; label: string } {
  if (kind === 'isActive') {
    return value ? { tone: 'success', label: 'פעיל' } : { tone: 'neutral', label: 'לא פעיל' };
  }
  if (kind === 'tosStatus') {
    const map: Record<string, { tone: BadgeTone; label: string }> = {
      PENDING_REVIEW: { tone: 'warning', label: 'ממתין לבדיקה' },
      APPROVED: { tone: 'success', label: 'ToS אושר' },
      REJECTED: { tone: 'danger', label: 'ToS נדחה' },
    };
    return map[value as string];
  }
  if (kind === 'itemStatus') {
    const map: Record<string, { tone: BadgeTone; label: string }> = {
      AUTO_PUBLISHED: { tone: 'success', label: 'פורסם אוטומטית' },
      PENDING_REVIEW: { tone: 'warning', label: 'ממתין לבדיקה' },
      APPROVED: { tone: 'success', label: 'אושר' },
      REJECTED: { tone: 'danger', label: 'נדחה' },
    };
    return map[value as string];
  }
  if (kind === 'confidence') {
    const n = value as number;
    if (n >= 70) return { tone: 'success', label: `${n}%` };
    if (n >= 40) return { tone: 'warning', label: `${n}%` };
    return { tone: 'danger', label: `${n}%` };
  }
  return { tone: 'neutral', label: String(value) };
}
