import { fmt, fmtN } from '../utils/format.js';

export default function StatBar({ orderCount, revenue, expense, profit, profitPct, title }) {
  const profitColor = profit >= 0 ? 'var(--accent)' : 'var(--danger, #ef4444)';
  const stats = [
    { label: 'Orders',        value: fmtN(orderCount),             color: 'var(--text)' },
    { label: 'Total Revenue', value: `EGP ${fmt(revenue)}`,        color: 'var(--text)' },
    { label: 'Expenses',      value: `EGP ${fmt(expense)}`,        color: 'var(--text)' },
    { label: 'Net Profit',    value: `EGP ${fmt(profit)}`,         color: profitColor   },
    { label: 'Profit %',      value: `${profitPct.toFixed(2)}%`,   color: profitColor   },
  ];
  return (
    <div>
      {title && (
        <div style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '.6rem' }}>
          {title}
        </div>
      )}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      {stats.map(s => (
        <div key={s.label} style={{
          flex: '1', minWidth: 140,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '1.1rem 1.25rem',
          animation: 'fadeIn .3s ease',
        }}>
          <div style={{ fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', fontWeight: 600 }}>
            {s.label}
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '.3rem', color: s.color }}>
            {s.value}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
