import { useState, useEffect, useCallback, useMemo } from 'react';
import { authFetch } from '../utils/auth.js';
import { fmt } from '../utils/format.js';
import { S } from '../styles.js';
import Card, { CardTitle } from '../components/Card.jsx';
import Alert from '../components/Alert.jsx';

export default function Analytics() {
  const defaultMonth = new Date().toLocaleString('en-GB', { month: 'short', year: 'numeric' });
  const [months,      setMonths]      = useState([]);
  const [activeMonth, setActiveMonth] = useState(defaultMonth);
  const [rows,        setRows]        = useState([]);
  const [loading,     setLoading]     = useState(true);

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

  useEffect(() => { loadMonths(); }, [loadMonths]);
  useEffect(() => { loadRows(activeMonth); }, [activeMonth, loadRows]);

  const totals = useMemo(() => {
    let totalIn = 0, totalOut = 0;
    const outByCategory = {};
    rows.forEach(r => {
      if (r.type === 'in') totalIn += r.amount;
      if (r.type === 'out') {
        totalOut += r.amount;
        outByCategory[r.category] = (outByCategory[r.category] || 0) + r.amount;
      }
    });
    const dist = Object.entries(outByCategory)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
    return { totalIn, totalOut, dist };
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
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div style={{ flex: '1', minWidth: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem' }}>
              <div style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)' }}>Total Money In</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '.35rem', color: 'var(--success)' }}>EGP {fmt(totals.totalIn)}</div>
            </div>
            <div style={{ flex: '1', minWidth: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem' }}>
              <div style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)' }}>Total Money Out</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '.35rem', color: 'var(--danger)' }}>EGP {fmt(totals.totalOut)}</div>
            </div>
          </div>

          <Card>
            <CardTitle>Money Out Distribution</CardTitle>
            {totals.dist.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: '.9rem' }}>No money-out entries yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: '.65rem' }}>
                {totals.dist.map(d => (
                  <div key={d.category} className="zen-dist-row">
                    <div style={{ fontWeight: 600 }}>{d.category}</div>
                    <div style={{ height: 10, background: 'var(--surface2)', borderRadius: 999 }}>
                      <div style={{
                        height: '100%', borderRadius: 999,
                        width: `${Math.max(6, (d.amount / totals.totalOut) * 100)}%`,
                        background: 'linear-gradient(90deg, #f97316, #f59e0b)'
                      }} />
                    </div>
                    <div style={{ textAlign: 'right', ...S.mono, color: 'var(--muted)' }}>EGP {fmt(d.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
