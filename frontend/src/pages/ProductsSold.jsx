import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../utils/auth.js';
import { fmt, fmtN } from '../utils/format.js';
import { S } from '../styles.js';
import Card, { CardTitle } from '../components/Card.jsx';
import Spinner from '../components/Spinner.jsx';
import Alert from '../components/Alert.jsx';

function calcProfit(row) {
  const rev  = row.revenue || 0;
  const cost = (row.cost || 0) * (row.qty || 0);
  const ec   = row.extra_cost || 0;
  const exp  = row.expense || 0;
  const profit = rev - cost - ec - exp;
  const pct    = rev ? profit / rev * 100 : 0;
  return { profit: Math.round(profit * 100) / 100, profit_pct: Math.round(pct * 100) / 100 };
}

const MANUAL_FIELDS = ['price', 'new_price', 'cost', 'extra_cost', 'expense'];

function EditCell({ value, field, sku, month, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value ?? '');

  function startEdit() { setDraft(value ?? ''); setEditing(true); }

  async function save() {
    setEditing(false);
    const num = draft === '' ? null : parseFloat(draft);
    if (num === value) return;
    onSaved(sku, field, isNaN(num) ? null : num);
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        step="0.01"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        style={{
          width: '100%', background: 'var(--surface2, #1c1917)',
          color: 'var(--text)', border: '1px solid var(--accent)',
          borderRadius: 4, padding: '2px 6px', fontSize: '.9rem',
          fontFamily: 'inherit', outline: 'none'
        }}
      />
    );
  }

  return (
    <span
      onClick={startEdit}
      title="Click to edit"
      style={{
        cursor: 'text', display: 'block', minWidth: 60,
        padding: '2px 4px', borderRadius: 4,
        color: value == null ? 'var(--muted)' : 'var(--text)',
        borderBottom: '1px dashed var(--border2, #44403c)'
      }}
    >
      {value == null ? '—' : fmtN(value)}
    </span>
  );
}

export default function ProductsSold() {
  const defaultMonth = new Date().toLocaleString('en-GB', { month: 'short', year: 'numeric' });
  const [months,      setMonths]      = useState([]);
  const [activeMonth, setActiveMonth] = useState(defaultMonth);
  const [rows,        setRows]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');

  const loadMonths = useCallback(async () => {
    const res  = await authFetch('/cashflow/months');
    const data = await res.json();
    setMonths(data);
    if (data.length && !data.includes(activeMonth)) setActiveMonth(data[data.length - 1]);
  }, []);

  const loadRows = useCallback(async (month) => {
    if (!month) return;
    setLoading(true);
    setError('');
    const res = await authFetch(`/products-sold/${encodeURIComponent(month)}`);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.detail || 'Failed to load data.');
      setRows([]);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setRows(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadMonths(); }, [loadMonths]);
  useEffect(() => { loadRows(activeMonth); }, [activeMonth, loadRows]);

  async function handleSaved(sku, field, newVal) {
    // Build updated row payload from current state
    const row = rows.find(r => r.sku === sku);
    if (!row) return;

    const payload = {};
    MANUAL_FIELDS.forEach(f => { payload[f] = f === field ? newVal : (row[f] ?? null); });

    const res = await authFetch(
      `/products-sold/${encodeURIComponent(activeMonth)}/${encodeURIComponent(sku)}`,
      { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
    );
    if (!res.ok) return;

    setRows(prev => prev.map(r => {
      if (r.sku !== sku) return r;
      const updated = { ...r, [field]: newVal };
      const { profit, profit_pct } = calcProfit(updated);
      return { ...updated, profit, profit_pct };
    }));
  }

  // Totals
  const totals = rows.reduce(
    (acc, r) => {
      const { profit } = calcProfit(r);
      const rowExpense = (r.cost || 0) * (r.qty || 0) + (r.extra_cost || 0) + (r.expense || 0);
      acc.qty      += r.qty || 0;
      acc.revenue  += r.revenue || 0;
      acc.expenses += rowExpense;
      acc.profit   += profit;
      return acc;
    },
    { qty: 0, revenue: 0, expenses: 0, profit: 0 }
  );
  const totalProfitPct = totals.revenue ? totals.profit / totals.revenue * 100 : 0;

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
          <h1 style={S.h1}>Products Sold</h1>
          <p style={S.sub}>Monthly performance by product — Bosta qty & revenue auto-filled</p>
        </div>
        <select
          value={activeMonth}
          onChange={e => setActiveMonth(e.target.value)}
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            color: 'var(--text)', borderRadius: 'var(--radius-sm)',
            padding: '.45rem .75rem', fontSize: '.9rem', cursor: 'pointer'
          }}
        >
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <Card>
        <CardTitle>
          {activeMonth} — click any orange cell to edit
        </CardTitle>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <p style={{ color: 'var(--muted)', padding: '1rem 0' }}>
            No products found. Add products in the Products page first.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={thLeft}>Product</th>
                  <th style={thStyle}>Price</th>
                  <th style={thStyle}>NEW Price</th>
                  <th style={thStyle}>Cost</th>
                  <th style={thStyle}>Extra Cost</th>
                  <th style={{ ...thStyle, color: 'var(--accent)' }}>Qty</th>
                  <th style={{ ...thStyle, color: 'var(--accent)' }}>Revenue (EGP)</th>
                  <th style={thStyle}>Expense</th>
                  <th style={thStyle}>Profit</th>
                  <th style={thStyle}>Profit %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const { profit, profit_pct } = calcProfit(row);
                  const profitColor = profit >= 0 ? 'var(--accent)' : 'var(--danger, #ef4444)';
                  return (
                    <tr key={row.sku} style={{ transition: 'background .1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.03)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={tdLeft}>
                        <div style={{ fontWeight: 600, color: '#fafafa' }}>{row.name}</div>
                        <div style={{ fontSize: '.75rem', color: 'var(--muted)', fontFamily: 'monospace' }}>{row.sku}</div>
                      </td>
                      {['price', 'new_price', 'cost', 'extra_cost'].map(f => (
                        <td key={f} style={{ ...tdStyle, color: 'var(--text)' }}>
                          <EditCell value={row[f]} field={f} sku={row.sku} month={activeMonth} onSaved={handleSaved} />
                        </td>
                      ))}
                      <td style={{ ...tdStyle, color: 'var(--accent)', fontWeight: 600 }}>
                        {fmtN(row.qty)}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--accent)', fontWeight: 600 }}>
                        {fmt(row.revenue)}
                      </td>
                      <td style={tdStyle}>
                        <EditCell value={row.expense} field="expense" sku={row.sku} month={activeMonth} onSaved={handleSaved} />
                      </td>
                      <td style={{ ...tdStyle, color: profitColor, fontWeight: 600 }}>
                        {fmt(profit)}
                      </td>
                      <td style={{ ...tdStyle, color: profitColor, fontWeight: 600 }}>
                        {profit_pct.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(249,115,22,.06)' }}>
                  <td style={{ ...tdLeft, fontWeight: 700, color: '#fafafa' }} colSpan={5}>Total</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--accent)' }}>{fmtN(totals.qty)}</td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--accent)' }}>{fmt(totals.revenue)}</td>
                  <td style={tdStyle} />
                  <td style={{ ...tdStyle, fontWeight: 700, color: totals.profit >= 0 ? 'var(--accent)' : 'var(--danger, #ef4444)' }}>
                    {fmt(totals.profit)}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: totals.profit >= 0 ? 'var(--accent)' : 'var(--danger, #ef4444)' }}>
                    {totalProfitPct.toFixed(2)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {!loading && rows.length > 0 && (
        <Card>
          <CardTitle>Summary — {activeMonth}</CardTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Unit Items',          value: fmtN(totals.qty),                        color: 'var(--text)' },
              { label: 'Total Revenue',        value: fmt(totals.revenue),                     color: 'var(--accent)' },
              { label: 'Total Expenses',       value: fmt(totals.expenses),                    color: 'var(--danger, #ef4444)' },
              { label: 'NET PROFIT / (LOSS)',  value: fmt(totals.profit),                      color: totals.profit >= 0 ? 'var(--accent)' : 'var(--danger, #ef4444)' },
              { label: 'Profit %',             value: `${totalProfitPct.toFixed(2)}%`,         color: totals.profit >= 0 ? 'var(--accent)' : 'var(--danger, #ef4444)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: 'var(--bg, #0c0a09)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '1rem 1.25rem'
              }}>
                <div style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', marginBottom: '.4rem' }}>
                  {label}
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
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
