import React, { useState } from 'react';
import Badge from './Badge.jsx';
import { fmt, fmtN } from '../utils/format.js';
import { S } from '../styles.js';

export default function ReportTable({ data }) {
  const [sortKey, setSortKey] = useState('default');
  const [sortDir, setSortDir] = useState('asc');
  const [expanded, setExpanded] = useState({});

  const toggleExpand = sku => setExpanded(p => ({ ...p, [sku]: !p[sku] }));

  const toggleSort = key => {
    if (key === 'default') { setSortKey('default'); setSortDir('asc'); return; }
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = [...data.rows].sort((a, b) => {
    if (sortKey === 'default') return 0;
    let av, bv;
    if (sortKey === 'revenue')   { av = a.total_revenue;  bv = b.total_revenue; }
    else if (sortKey === 'qty')  { av = a.total_quantity; bv = b.total_quantity; }
    else if (sortKey === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
    else                         { av = a.sku; bv = b.sku; }
    if (av < bv) return sortDir === 'asc' ? -1 :  1;
    if (av > bv) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  const arrow = key => sortKey === key && key !== 'default' ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '';

  const thBase = {
    padding: '.65rem .85rem',
    fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.06em',
    color: 'var(--muted)', fontWeight: 600,
    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', userSelect: 'none'
  };
  const thSort = { ...thBase, cursor: 'pointer' };
  const td = {
    padding: '.6rem .85rem', borderBottom: '1px solid var(--border)',
    fontSize: '.875rem', verticalAlign: 'middle'
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg)' }}>
            <th style={{ ...thSort, textAlign: 'left'  }} onClick={() => toggleSort('sku')}>SKU{arrow('sku')}</th>
            <th style={{ ...thSort, textAlign: 'left'  }} onClick={() => toggleSort('name')}>Product{arrow('name')}</th>
            <th style={{ ...thBase, textAlign: 'left'  }}>Price (EGP)</th>
            <th style={{ ...thSort, textAlign: 'right' }} onClick={() => toggleSort('qty')}>Qty{arrow('qty')}</th>
            <th style={{ ...thSort, textAlign: 'right' }} onClick={() => toggleSort('revenue')}>Total (EGP){arrow('revenue')}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(row => {
            const isExpanded = expanded[row.sku] !== false;
            const multiPrice = row.prices.length > 1;
            return (
              <React.Fragment key={row.sku}>
                <tr
                  style={{ background: 'var(--surface2)', borderLeft: '3px solid var(--accent)', cursor: multiPrice ? 'pointer' : 'default' }}
                  onClick={() => multiPrice && toggleExpand(row.sku)}
                >
                  <td style={{ ...td, paddingLeft: '.7rem' }}>
                    <Badge>{row.sku}</Badge>
                  </td>
                  <td style={{ ...td, fontWeight: 600, color: 'var(--text)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                      {row.name}
                      {multiPrice && (
                        <span style={{ fontSize: '.7rem', color: 'var(--muted)', fontWeight: 400 }}>
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      )}
                    </span>
                  </td>
                  <td style={{ ...td, ...S.mono, color: 'var(--muted)', fontSize: '.82rem' }}>
                    {multiPrice ? `${row.prices.length} prices` : fmt(row.prices[0].price)}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>
                    {fmtN(row.total_quantity)}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, ...S.mono, color: 'var(--accent)' }}>
                    {fmt(row.total_revenue)}
                  </td>
                </tr>

                {multiPrice && isExpanded && row.prices.map((p, i) => (
                  <tr key={i}>
                    <td style={{ ...td, borderLeft: '3px solid transparent' }} />
                    <td style={{ ...td, color: 'var(--muted)', fontSize: '.82rem' }} />
                    <td style={{ ...td, ...S.mono, color: 'var(--muted)', fontSize: '.82rem' }}>
                      {fmt(p.price)}
                    </td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--muted)', fontSize: '.82rem' }}>
                      {fmtN(p.quantity)}
                    </td>
                    <td style={{ ...td, textAlign: 'right', ...S.mono, color: 'var(--muted)', fontSize: '.82rem' }}>
                      {fmt(p.total)}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            );
          })}

          <tr style={{ borderTop: '2px solid var(--accent)', background: 'var(--surface2)' }}>
            <td style={{ ...td, fontWeight: 700, borderBottom: 'none', borderLeft: '3px solid var(--accent)' }} colSpan={2}>
              Grand Total
            </td>
            <td style={{ ...td, borderBottom: 'none' }} />
            <td style={{ ...td, textAlign: 'right', fontWeight: 700, borderBottom: 'none', color: 'var(--accent)', fontSize: '1rem' }}>
              {fmtN(data.grand_quantity)}
            </td>
            <td style={{ ...td, textAlign: 'right', fontWeight: 700, ...S.mono, borderBottom: 'none', color: 'var(--accent)', fontSize: '1rem' }}>
              {fmt(data.grand_revenue)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
