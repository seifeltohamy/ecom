import { fmt, fmtN } from '../utils/format.js';

export default function StatBar({ rows, grand_quantity, grand_revenue, order_count }) {
  const stats = [
    { label: 'Orders',           value: fmtN(order_count)       },
    { label: 'Total SKUs',       value: rows.length.toString()  },
    { label: 'Total Units Sold', value: fmtN(grand_quantity)    },
    { label: 'Total Revenue',    value: `EGP ${fmt(grand_revenue)}` }
  ];
  return (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', flex: 1 }}>
      {stats.map(s => (
        <div key={s.label} style={{
          flex: '1', minWidth: 140,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '1.1rem 1.25rem',
          animation: 'fadeIn .3s ease'
        }}>
          <div style={{ fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', fontWeight: 600 }}>
            {s.label}
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '.3rem', color: 'var(--text)' }}>
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}
