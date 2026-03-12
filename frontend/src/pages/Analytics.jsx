import { useState, useEffect, useCallback, useMemo } from 'react';
import { authFetch } from '../utils/auth.js';
import { fmt } from '../utils/format.js';
import { S } from '../styles.js';
import Card, { CardTitle } from '../components/Card.jsx';
import Alert from '../components/Alert.jsx';
import Btn from '../components/Btn.jsx';

export default function Analytics() {
  const defaultMonth = new Date().toLocaleString('en-GB', { month: 'short', year: 'numeric' });
  const [months,      setMonths]      = useState([]);
  const [activeMonth, setActiveMonth] = useState(defaultMonth);
  const [rows,        setRows]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [trend,       setTrend]       = useState([]);
  const [bostaSummary, setBostaSummary] = useState(undefined); // undefined = not loaded, null = no report
  const [stockData,   setStockData]   = useState(null);
  const [stockLoading, setStockLoading] = useState(false);

  const loadMonths = useCallback(async () => {
    const res  = await authFetch('/cashflow/months');
    const data = await res.json();
    if (data.length > 0) {
      setMonths(data);
      if (!data.includes(activeMonth)) setActiveMonth(data[data.length - 1]);
    }
  }, [defaultMonth]);

  const loadRows = useCallback(async (month) => {
    if (!month) return;
    setLoading(true);
    const res  = await authFetch(`/cashflow/${encodeURIComponent(month)}`);
    const data = await res.json();
    setRows(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMonths();
    authFetch('/dashboard/trend').then(r => r.json()).then(d => { if (Array.isArray(d)) setTrend(d); }).catch(() => {});
    authFetch('/dashboard/bosta-summary').then(r => r.json()).then(d => setBostaSummary(d ?? null)).catch(() => setBostaSummary(null));
  }, [loadMonths]);

  useEffect(() => { loadRows(activeMonth); }, [activeMonth, loadRows]);

  const loadStock = async () => {
    setStockLoading(true);
    const res = await authFetch('/stock-value');
    if (res.ok) {
      const d = await res.json();
      setStockData(d);
    }
    setStockLoading(false);
  };

  const totals = useMemo(() => {
    let totalIn = 0, totalOut = 0;
    const outByCategory = {};
    const inByCategory  = {};
    rows.forEach(r => {
      if (r.type === 'in') {
        totalIn += r.amount;
        inByCategory[r.category] = (inByCategory[r.category] || 0) + r.amount;
      }
      if (r.type === 'out') {
        totalOut += r.amount;
        outByCategory[r.category] = (outByCategory[r.category] || 0) + r.amount;
      }
    });
    const outDist = Object.entries(outByCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
    const inDist = Object.entries(inByCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
    return { totalIn, totalOut, net: totalIn - totalOut, outDist, inDist };
  }, [rows]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select
          value={activeMonth}
          onChange={e => setActiveMonth(e.target.value)}
          style={{ padding: '.5rem .7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)' }}
        >
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {loading && <Alert type="loading">Loading analytics…</Alert>}

      {!loading && (
        <>
          {/* ── Stat cards ── */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div style={{ flex: '1', minWidth: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem' }}>
              <div style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)' }}>Total Money In</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '.35rem', color: 'var(--success)' }}>EGP {fmt(totals.totalIn)}</div>
            </div>
            <div style={{ flex: '1', minWidth: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem' }}>
              <div style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)' }}>Total Money Out</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '.35rem', color: 'var(--danger)' }}>EGP {fmt(totals.totalOut)}</div>
            </div>
            <div style={{ flex: '1', minWidth: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem' }}>
              <div style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)' }}>Net</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '.35rem', color: totals.net >= 0 ? 'var(--success)' : 'var(--danger)' }}>EGP {fmt(totals.net)}</div>
            </div>
          </div>

          {/* ── Money Out Distribution ── */}
          <Card>
            <CardTitle>Money Out Distribution</CardTitle>
            {totals.outDist.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: '.9rem' }}>No money-out entries yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: '.65rem' }}>
                {totals.outDist.map(d => (
                  <div key={d.category} className="zen-dist-row">
                    <div style={{ fontWeight: 600 }}>{d.category}</div>
                    <div style={{ height: 10, background: 'var(--surface2)', borderRadius: 999 }}>
                      <div style={{
                        height: '100%', borderRadius: 999,
                        width: `${Math.max(0.5, (d.amount / totals.totalOut) * 100)}%`,
                        background: 'linear-gradient(90deg, #f97316, #f59e0b)',
                      }} />
                    </div>
                    <div style={{ textAlign: 'right', ...S.mono, color: 'var(--muted)' }}>EGP {fmt(d.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ── Money In by Source ── */}
          {totals.inDist.length > 0 && (
            <Card>
              <CardTitle>Money In by Source</CardTitle>
              <div style={{ display: 'grid', gap: '.65rem' }}>
                {totals.inDist.map(d => (
                  <div key={d.category} className="zen-dist-row">
                    <div style={{ fontWeight: 600 }}>{d.category}</div>
                    <div style={{ height: 10, background: 'var(--surface2)', borderRadius: 999 }}>
                      <div style={{
                        height: '100%', borderRadius: 999,
                        width: `${Math.max(0.5, (d.amount / totals.totalIn) * 100)}%`,
                        background: 'linear-gradient(90deg, #22c55e, #4ade80)',
                      }} />
                    </div>
                    <div style={{ textAlign: 'right', ...S.mono, color: 'var(--muted)' }}>EGP {fmt(d.amount)}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── Bosta P&L Summary ── */}
          <Card>
            <CardTitle>Bosta P&amp;L Summary</CardTitle>
            {bostaSummary === undefined && <div style={{ color: 'var(--muted)', fontSize: '.9rem' }}>Loading…</div>}
            {bostaSummary === null && <div style={{ color: 'var(--muted)', fontSize: '.9rem' }}>No Bosta report uploaded yet.</div>}
            {bostaSummary && (
              <div>
                <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: '.75rem' }}>
                  {bostaSummary.date_from && bostaSummary.date_to
                    ? `${bostaSummary.date_from} → ${bostaSummary.date_to}`
                    : new Date(bostaSummary.uploaded_at).toLocaleDateString('en-GB')
                  } · {bostaSummary.order_count} orders
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Revenue',      value: `EGP ${fmt(bostaSummary.grand_revenue)}`,  color: 'var(--text)' },
                    { label: 'Gross Profit', value: `EGP ${fmt(bostaSummary.gross_profit)}`,   color: bostaSummary.gross_profit >= 0 ? 'var(--success)' : 'var(--danger)' },
                    { label: 'Profit %',     value: `${bostaSummary.profit_pct?.toFixed(1)}%`, color: bostaSummary.gross_profit >= 0 ? 'var(--success)' : 'var(--danger)' },
                    ...(bostaSummary.roas != null ? [{ label: 'ROAS', value: `${bostaSummary.roas}×`, color: 'var(--accent)' }] : []),
                    ...(bostaSummary.ads_spent ? [{ label: 'Ads Spent', value: `EGP ${fmt(bostaSummary.ads_spent)}`, color: 'var(--muted)' }] : []),
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ flex: '1', minWidth: 130, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '.75rem 1rem' }}>
                      <div style={{ fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '.25rem', color }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* ── Potential Revenue from Stock ── */}
          <Card>
            <CardTitle>Potential Revenue from Stock</CardTitle>
            {!stockData && (
              <Btn onClick={loadStock} disabled={stockLoading}>
                {stockLoading ? 'Loading…' : 'Load Stock Metrics'}
              </Btn>
            )}
            {stockData && (() => {
              const potentialProfit  = stockData.total_consumer_value - stockData.total_purchase_value;
              const potentialMargin  = stockData.total_consumer_value > 0
                ? (potentialProfit / stockData.total_consumer_value * 100).toFixed(1)
                : '0.0';
              return (
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Stock at Cost',       value: `EGP ${fmt(stockData.total_purchase_value)}`,  color: '#60a5fa' },
                    { label: 'Potential Revenue',    value: `EGP ${fmt(stockData.total_consumer_value)}`,  color: 'var(--accent)' },
                    { label: 'Potential Profit',     value: `EGP ${fmt(potentialProfit)}`,                 color: potentialProfit >= 0 ? 'var(--success)' : 'var(--danger)' },
                    { label: 'Potential Margin',     value: `${potentialMargin}%`,                          color: potentialProfit >= 0 ? 'var(--success)' : 'var(--danger)' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ flex: '1', minWidth: 150, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '.75rem 1rem' }}>
                      <div style={{ fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '.25rem', color }}>{value}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>

          {/* ── All-months trend table ── */}
          {trend.length > 0 && (
            <Card>
              <CardTitle>All-Months Trend</CardTitle>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.88rem' }}>
                  <thead>
                    <tr>
                      {['Month', 'Money In', 'Money Out', 'Net'].map(h => (
                        <th key={h} style={{ padding: '.55rem .75rem', textAlign: h === 'Month' ? 'left' : 'right', fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...trend].reverse().map(t => (
                      <tr key={t.month}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.03)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          style={{ transition: 'background .1s' }}>
                        <td style={{ padding: '.55rem .75rem', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{t.month}</td>
                        <td style={{ padding: '.55rem .75rem', borderBottom: '1px solid var(--border)', textAlign: 'right', color: 'var(--success)', ...S.mono }}>EGP {fmt(t.money_in)}</td>
                        <td style={{ padding: '.55rem .75rem', borderBottom: '1px solid var(--border)', textAlign: 'right', color: 'var(--danger)',  ...S.mono }}>EGP {fmt(t.money_out)}</td>
                        <td style={{ padding: '.55rem .75rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 700, color: t.net >= 0 ? 'var(--success)' : 'var(--danger)', ...S.mono }}>EGP {fmt(t.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
