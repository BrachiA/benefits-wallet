import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { apiClient } from '../../api/client';

// קיבוץ הניווט לפי משמעות עסקית, לא רק רשימה שטוחה: "ספקי הטבה"
// (מי נותן), "קטלוג" (מה מוצג), "סורק" (מאיפה זה מגיע אוטומטית).
// זה עוזר לאדם חדש בצוות להבין את מבנה המערכת מהתפריט עצמו.
const navGroups = [
  {
    label: 'ספקי הטבה',
    items: [
      { to: '/issuers', label: 'מנפיקים' },
      { to: '/programs', label: 'מועדונים וכרטיסים' },
    ],
  },
  {
    label: 'קטלוג',
    items: [
      { to: '/categories', label: 'קטגוריות' },
      { to: '/brands', label: 'מותגים' },
      { to: '/stores', label: 'סניפים' },
      { to: '/benefits', label: 'הטבות' },
      { to: '/coupons', label: 'קופונים' },
      { to: '/campaigns', label: 'קמפיינים' },
      { to: '/tags', label: 'תגיות' },
    ],
  },
  {
    label: 'סורק אתרים',
    items: [
      { to: '/scraper-sources', label: 'מקורות סריקה' },
      { to: '/scraped-items', label: 'תור בדיקה' },
      { to: '/duplicate-cleanup', label: 'התרעות AI' },
    ],
  },
];

export function Layout({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  async function handleLogout() {
    // גם אם הבקשה נכשלת (למשל השרת כבר לא מגיב) המנהלת חייבת
    // לחזור למסך הכניסה — לא להישאר תקועה במסך שאין לה יותר גישה
    // אליו בפועל.
    try {
      await apiClient.post('/auth/logout', {});
    } finally {
      onLogout();
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          background: 'var(--surface-sidebar)',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 12px',
        }}
      >
        <div style={{ padding: '4px 12px 24px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#fff' }}>
            <span style={{ color: 'var(--bp-lilac)' }}>B</span>
            <span style={{ color: 'var(--bp-purple)' }}>P</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-on-sidebar-muted)', letterSpacing: 1, marginTop: 2 }}>
            BENEFITS WALLET
          </div>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {navGroups.map((group) => (
            <div key={group.label} style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-on-sidebar-muted)',
                  padding: '0 12px 6px',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {group.label}
              </div>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  style={({ isActive }) => ({
                    display: 'block',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 14,
                    color: isActive ? '#fff' : 'var(--text-on-sidebar)',
                    background: isActive ? 'var(--bp-purple)' : 'transparent',
                    marginBottom: 2,
                  })}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          style={{
            marginTop: 12,
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            color: 'var(--text-on-sidebar-muted)',
            background: 'transparent',
            border: 'none',
            textAlign: 'right',
            cursor: 'pointer',
          }}
        >
          התנתקות
        </button>
      </aside>

      <main style={{ flex: 1, padding: '28px 36px', maxWidth: 1200 }}>{children}</main>
    </div>
  );
}
