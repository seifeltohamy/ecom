import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../utils/auth.js';
import { fmt, fmtN } from '../utils/format.js';
import { S } from '../styles.js';
import Card, { CardTitle } from '../components/Card.jsx';
import Btn from '../components/Btn.jsx';
import Spinner from '../components/Spinner.jsx';
import Alert from '../components/Alert.jsx';

export default function StockValue() {
  const [rows,    setRows]    = useState([]);
  const [totals,  setTotals]  = useState({ total_onhand: 0, total_value: 0 });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [sort,    setSort]    = useState({ key: null, dir: 'asc' });

  const toggleSort = (key) => setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

  const sortedRows = sort.key ? [...rows].sort((a, b) => {
    const av = a[sort.key], bv = b[sort.key];
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
    return sort.dir === 'asc' ? cmp : -cmp;
  }) : rows;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await authFetch('/stock-value');
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.detail || 'Failed to load stock data.');
      setLoading(false);
      return;
    }
    const data = await res.json();
    setRows(data.rows || []);
    setTotals({ total_onhand: data.total_onhand, total_value: data.total_value });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const thStyle = {
    padding: '.6rem .75rem', fontSize: '.72rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '.07em',
    color: 'var(--muted)', borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap', textAlign: 'right'
  };
  const thLeft = { ...thStyle, textAlign: 'left' };
  const tdStyle = {
    padding: '.55rem .75rem', borderBottom: '1px solid var(--border)',
    fontSize: '.9rem', textAlign: 'right', whiteSpace: 'nowrap'
  };
  const tdLeft = { ...tdStyle, textAlign: 'left' };

  return (
    <div>
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>Stock Value</h1>
          <p style={S.sub}>Live inventory from Bosta — quantity × price per product</p>
        </div>
        <Btn onClick={load} disabled={loading}>
          {loading ? 'Loading…' : '↺ Refresh'}
        </Btn>
      </div>

      {error && (
        <Alert type="error">
          {error}
          {error.includes('API key') && (
            <span> Go to <a href="/settings" style={{ color: 'var(--accent)' }}>Settings</a> to add it.</span>
          )}
        </Alert>
      )}

      <Card>
        <CardTitle>Products — live from Bosta</CardTitle>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Spinner />
          </div>
        ) : rows.length === 0 && !error ? (
          <p style={{ color: 'var(--muted)', padding: '1rem 0' }}>
            No products found in Bosta inventory.
          </p>
        ) : !error && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[
                    { key: 'sku',         label: 'SKU',             style: thLeft },
                    { key: 'name',        label: 'Product Name',    style: thLeft },
                    { key: 'on_hand',     label: 'On Hand',         style: thStyle },
                    { key: 'reserved',    label: 'Reserved',        style: thStyle },
                    { key: 'price',       label: 'Price (EGP)',     style: thStyle },
                    { key: 'stock_value', label: 'Stock Value (EGP)', style: { ...thStyle, color: 'var(--accent)' } },
                  ].map(({ key, label, style }) => (
                    <th key={key} style={{ ...style, cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort(key)}>
                      {label} {sort.key === key ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row, i) => (
                  <tr key={`${row.sku}-${i}`}
                      style={{ transition: 'background .1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.03)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ ...tdLeft, fontFamily: 'monospace', fontSize: '.82rem', color: 'var(--accent)' }}>
                      {row.sku}
                    </td>
                    <td style={{ ...tdLeft, fontWeight: 600, color: '#fafafa' }}>
                      {row.name}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text)' }}>
                      {fmtN(row.on_hand)}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--muted)' }}>
                      {fmtN(row.reserved)}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text)' }}>
                      {fmt(row.price)}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--accent)', fontWeight: 600 }}>
                      {fmt(row.stock_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(249,115,22,.06)' }}>
                  <td style={{ ...tdLeft, fontWeight: 700, color: '#fafafa' }} colSpan={2}>Total</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{fmtN(totals.total_onhand)}</td>
                  <td style={tdStyle} />
                  <td style={tdStyle} />
                  <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--accent)' }}>{fmt(totals.total_value)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {!loading && !error && rows.length > 0 && (
        <Card>
          <CardTitle>Summary</CardTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Total SKUs',       value: fmtN(rows.length) },
              { label: 'Total On Hand',    value: fmtN(totals.total_onhand) },
              { label: 'Total Stock Value', value: fmt(totals.total_value), accent: true },
            ].map(({ label, value, accent }) => (
              <div key={label} style={{
                background: 'var(--bg, #0c0a09)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '1rem 1.25rem'
              }}>
                <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', marginBottom: '.4rem' }}>
                  {label}
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: accent ? 'var(--accent)' : '#fafafa', fontVariantNumeric: 'tabular-nums' }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
