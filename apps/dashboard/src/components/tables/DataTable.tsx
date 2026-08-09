import type { ReactNode } from 'react';

export type Column<T> = {
  header: string;
  render: (row: T) => ReactNode;
  width?: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  isLoading: boolean;
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyTitle: string;
  emptyHint?: string;
};

// רכיב אחד משרת את כל 11 מסכי הרשימה במערכת: כל ישות מספקת column
// defs משלה, ה-DataTable לא יודע כלום על Benefit/Program/וכו'.
// זו בדיוק ההרחבה הצפויה מה-Dashboard: ישות חדשה = column-defs
// חדש, לא רכיב טבלה חדש.
export function DataTable<T>({
  columns,
  rows,
  isLoading,
  getRowKey,
  onRowClick,
  emptyTitle,
  emptyHint,
}: DataTableProps<T>) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {columns.map((col) => (
              <th
                key={col.header}
                style={{
                  textAlign: 'right',
                  padding: '12px 16px',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--text-muted)',
                  width: col.width,
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                {columns.map((col) => (
                  <td key={col.header} style={{ padding: '14px 16px' }}>
                    <div style={{ height: 14, background: 'var(--surface-hover)', borderRadius: 4, width: '70%' }} />
                  </td>
                ))}
              </tr>
            ))}

          {!isLoading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={{ padding: '48px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>{emptyTitle}</div>
                {emptyHint && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{emptyHint}</div>}
              </td>
            </tr>
          )}

          {!isLoading &&
            rows.map((row) => (
              <tr
                key={getRowKey(row)}
                onClick={() => onRowClick?.(row)}
                style={{
                  borderBottom: '1px solid var(--border)',
                  cursor: onRowClick ? 'pointer' : 'default',
                }}
                onMouseEnter={(e) => {
                  if (onRowClick) e.currentTarget.style.background = 'var(--surface-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {columns.map((col) => (
                  <td key={col.header} style={{ padding: '14px 16px', fontSize: 14 }}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
