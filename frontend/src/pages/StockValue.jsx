import { useState, useEffect, useCallback, useRef } from 'react';
import { authFetch } from '../utils/auth.js';
import { fmt, fmtN } from '../utils/format.js';
import { S } from '../styles.js';
import Card, { CardTitle } from '../components/Card.jsx';
import Btn from '../components/Btn.jsx';
import Spinner from '../components/Spinner.jsx';
import Alert from '../components/Alert.jsx';

export default function StockValue() {
  const [rows,         setRows]         = useState([]);
  const [totals,       setTotals]       = useState({ total_onhand: 0, total_consumer_value: 0, total_purchase_value: 0, capital_trapped: 0 });
  const [gmroi,        setGmroi]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [sort,         setSort]         = useState({ key: null, dir: 'asc' });
  const [purchasePrices, setPurchasePrices] = useState({});
  const savingRef = useRef({});
  const [source,           setSource]           = useState('auto');
  const [activeSource,     setActiveSource]     = useState('');
  const [availableSources, setAvailableSources] = useState([]);

  const toggleSort = (key) => setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

  const sortedRows = sort.key ? [...rows].sort((a, b) => {
    const av = a[sort.key] ?? -Infinity, bv = b[sort.key] ?? -Infinity;
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
    return sort.dir === 'asc' ? cmp : -cmp;
  }) : rows;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [stockRes, bosRes] = await Promise.all([
      authFetch(`/stock-value?source=${source}`),
      authFetch('/dashboard/bosta-summary'),
    ]);
    if (!stockRes.ok) {
      const j = await stockRes.json().catch(() => ({}));
      setError(j.detail || 'Failed to load stock data.');
      setLoading(false);
      return;
    }
    const data = await stockRes.json();
    setRows(data.rows || []);
    setActiveSource(data.source || '');
    setAvailableSources(data.available_sources || []);
    setTotals({
      total_onhand:         data.total_onhand,
      total_consumer_value: data.total_consumer_value,
      total_purchase_value: data.total_purchase_value,
      capital_trapped:      data.capital_trapped ?? 0,
    });
    const pp = {};
    (data.rows || []).forEach(r => { pp[r.sku] = String(r.purchase_price || ''); });
    setPurchasePrices(pp);

    // GMROI = gross_profit / total_purchase_value
    if (bosRes.ok) {
      const bos = await bosRes.json().catch(() => null);
      if (bos && bos.gross_profit != null && data.total_purchase_value > 0) {
        setGmroi(bos.gross_profit / data.total_purchase_value);
      } else {
        setGmroi(null);
      }
    }

    setLoading(false);
  }, [source]);

  useEffect(() => { load(); }, [load]);

  const handlePurchasePriceChange = (sku, val) => {
    setPurchasePrices(prev => ({ ...prev, [sku]: val }));
  };

  const savePurchasePrice = async (sku) => {
    const raw   = purchasePrices[sku] ?? '';
    const price = parseFloat(raw);
    if (isNaN(price) || price < 0) return;
    if (savingRef.current[sku]) return;
    savingRef.current[sku] = true;
    await authFetch('/stock-value/purchase-price', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, price }),
    });
    savingRef.current[sku] = false;
    setRows(prev => prev.map(r => r.sku === sku
      ? { ...r, purchase_price: price, purchase_value: round2(r.on_hand * price) }
      : r
    ));
    setTotals(prev => {
      const newRows = rows.map(r => r.sku === sku
        ? { ...r, purchase_price: price, purchase_value: round2(r.on_hand * price) }
        : r
      );
      return { ...prev, total_purchase_value: round2(newRows.reduce((s, r) => s + r.purchase_value, 0)) };
    });
  };

  const round2 = (n) => Math.round(n * 100) / 100;

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

  const sellThroughColor = (v) => {
    if (v == null) return 'var(--muted)';
    if (v >= 60)  return 'var(--success)';
    if (v >= 20)  return 'var(--text)';
    return 'var(--danger)';
  };
  const daysColor = (v) => {
    if (v == null) return 'var(--muted)';
    if (v >= 30)  return 'var(--success)';
    if (v >= 7)   return '#f59e0b';
    return 'var(--danger)';
  };

  const cols = [
    { key: 'sku',            label: 'SKU',               style: thLeft },
    { key: 'name',           label: 'Product Name',      style: thLeft },
    { key: 'on_hand',        label: 'On Hand',           style: thStyle },
    { key: 'reserved',       label: 'Reserved',          style: thStyle },
    { key: 'units_sold',     label: 'Sold',              style: thStyle },
    { key: 'sell_through',   label: 'Sell-Through',      style: thStyle },
    { key: 'days_remaining', label: 'Days Left',         style: thStyle },
    { key: 'consumer_price', label: 'Consumer Price',    style: thStyle },
    { key: 'consumer_value', label: 'Consumer Value',    style: { ...thStyle, color: 'var(--accent)' } },
    { key: 'purchase_price', label: 'Purchase Price',    style: { ...thStyle, color: '#60a5fa' }, sortable: false },
    { key: 'purchase_value', label: 'Purchase Value',    style: { ...thStyle, color: '#60a5fa' } },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.6rem', marginBottom: '1rem', alignItems: 'center' }}>
        {availableSources.length > 1 && (
          <select
            value={source}
            onChange={e => setSource(e.target.value)}
            style={{ padding: '.45rem .7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '.85rem', cursor: 'pointer' }}
          >
            {availableSources.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        )}
        <Btn onClick={load} disabled={loading}>
          {loading ? 'Loading…' : '↺ Refresh'}
        </Btn>
      </div>

      {error && (
        <Alert type="error">
          {error}
          {(error.includes('API key') || error.includes('configured')) && (
            <span> Go to <a href="/settings" style={{ color: 'var(--accent)' }}>Settings</a> to set it up.</span>
          )}
        </Alert>
      )}

      <Card>
        <CardTitle>
          Products — live from {activeSource ? activeSource.charAt(0).toUpperCase() + activeSource.slice(1) : '…'}
        </CardTitle>

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
                  {cols.map(({ key, label, style, sortable = true }) => (
                    <th
                      key={key}
                      style={{ ...style, cursor: sortable ? 'pointer' : 'default', userSelect: 'none' }}
                      onClick={() => sortable && toggleSort(key)}
                    >
                      {label} {sortable && (sort.key === key ? (sort.dir === 'asc' ? '↑' : '↓') : '↕')}
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
                    <td style={{ ...tdStyle, color: 'var(--muted)' }}>
                      {row.units_sold > 0 ? fmtN(row.units_sold) : '—'}
                    </td>
                    <td style={{ ...tdStyle, color: sellThroughColor(row.sell_through), fontWeight: 600 }}>
                      {row.sell_through != null ? `${row.sell_through}%` : '—'}
                    </td>
                    <td style={{ ...tdStyle, color: daysColor(row.days_remaining), fontWeight: 600 }}>
                      {row.days_remaining != null ? fmtN(row.days_remaining) : '—'}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text)' }}>
                      {fmt(row.consumer_price)}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--accent)', fontWeight: 600 }}>
                      {fmt(row.consumer_value)}
                    </td>
                    <td style={{ ...tdStyle, padding: '.3rem .75rem' }}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={purchasePrices[row.sku] ?? ''}
                        onChange={e => handlePurchasePriceChange(row.sku, e.target.value)}
                        onBlur={() => savePurchasePrice(row.sku)}
                        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                        style={{
                          width: '90px', textAlign: 'right',
                          background: 'rgba(96,165,250,.08)', border: '1px solid rgba(96,165,250,.25)',
                          borderRadius: '4px', color: '#60a5fa', padding: '.3rem .5rem',
                          fontSize: '.88rem', outline: 'none',
                        }}
                        onFocus={e => e.target.style.borderColor = 'rgba(96,165,250,.7)'}
                      />
                    </td>
                    <td style={{ ...tdStyle, color: '#60a5fa', fontWeight: 600 }}>
                      {fmt(row.purchase_value)}
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
                  <td style={tdStyle} />
                  <td style={tdStyle} />
                  <td style={tdStyle} />
                  <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--accent)' }}>{fmt(totals.total_consumer_value)}</td>
                  <td style={tdStyle} />
                  <td style={{ ...tdStyle, fontWeight: 700, color: '#60a5fa' }}>{fmt(totals.total_purchase_value)}</td>
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
              { label: 'Total SKUs',          value: fmtN(rows.length) },
              { label: 'Total On Hand',        value: fmtN(totals.total_onhand) },
              { label: 'Total Consumer Value', value: `EGP ${fmt(totals.total_consumer_value)}`, color: 'var(--accent)' },
              { label: 'Total Purchase Value', value: `EGP ${fmt(totals.total_purchase_value)}`, color: '#60a5fa' },
              ...(totals.capital_trapped > 0 ? [{
                label: 'Slow Mover Capital',
                value: `EGP ${fmt(totals.capital_trapped)}`,
                color: 'var(--danger)',
                hint: 'Stock with < 20% sell-through',
              }] : []),
              ...(gmroi != null ? [{
                label: 'GMROI',
                value: `${gmroi.toFixed(2)}×`,
                color: gmroi >= 1 ? 'var(--success)' : 'var(--danger)',
                hint: 'Gross Profit / Purchase Value',
              }] : []),
            ].map(({ label, value, color, hint }) => (
              <div key={label} style={{
                background: 'var(--bg, #0c0a09)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '1rem 1.25rem'
              }}>
                <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', marginBottom: '.4rem' }}>
                  {label}
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: color || '#fafafa', fontVariantNumeric: 'tabular-nums' }}>
                  {value}
                </div>
                {hint && <div style={{ fontSize: '.68rem', color: 'var(--muted)', marginTop: '.25rem' }}>{hint}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
