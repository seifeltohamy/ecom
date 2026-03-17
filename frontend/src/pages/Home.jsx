import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/auth.js';
import { fmt, fmtN } from '../utils/format.js';
import Card, { CardTitle } from '../components/Card.jsx';
import Btn from '../components/Btn.jsx';
import Alert from '../components/Alert.jsx';
import Badge from '../components/Badge.jsx';

export default function Home() {
  const navigate = useNavigate();
  const [summary,       setSummary]       = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [months,        setMonths]        = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [metaData,      setMetaData]      = useState(null); // null = loading, false = not connected

  // Fetch Meta spend for current month
  useEffect(() => {
    const today     = new Date();
    const date_from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const date_to   = today.toISOString().slice(0, 10);
    authFetch(`/meta/summary?date_from=${date_from}&date_to=${date_to}`)
      .then(r => r.json())
      .then(d => setMetaData(d?.connected ? d : false))
      .catch(() => setMetaData(false));
  }, []);

  useEffect(() => {
    authFetch('/cashflow/months')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setMonths(data);
          const currentMonth = new Date().toLocaleString('en-GB', { month: 'short', year: 'numeric' });
          setSelectedMonth(data.includes(currentMonth) ? currentMonth : data[data.length - 1]);
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedMonth) return;
    setLoading(true);
    authFetch(`/dashboard/summary?month=${encodeURIComponent(selectedMonth)}`)
      .then(r => r.json())
      .then(d => { setSummary(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedMonth]);

  const cs = { flex: '1', minWidth: 180, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.1rem 1.25rem', animation: 'fadeIn .3s ease' };
  const ls = { fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', fontWeight: 600 };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ color: 'var(--muted)', fontSize: '.85rem' }}>Period:</div>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          style={{ padding: '.45rem .7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '.875rem' }}
        >
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {loading && <Alert type="loading">Loading dashboard…</Alert>}
      {!loading && !summary && <Alert type="error">Failed to load summary.</Alert>}
      {!loading && summary && (
        <>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div style={cs}>
              <div style={ls}>{selectedMonth} — In</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '.3rem', color: 'var(--success)' }}>EGP {fmt(summary.this_month_in)}</div>
            </div>
            <div style={cs}>
              <div style={ls}>{selectedMonth} — Out</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '.3rem', color: 'var(--danger)' }}>EGP {fmt(summary.this_month_out)}</div>
            </div>
            <div style={cs}>
              <div style={ls}>{selectedMonth} — Net</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '.3rem', color: summary.this_month_net >= 0 ? 'var(--success)' : 'var(--danger)' }}>EGP {fmt(summary.this_month_net)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div style={cs}>
              <div style={ls}>YTD — Total In</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '.3rem', color: 'var(--success)' }}>EGP {fmt(summary.total_in_ytd)}</div>
            </div>
            <div style={cs}>
              <div style={ls}>YTD — Total Out</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '.3rem', color: 'var(--danger)' }}>EGP {fmt(summary.total_out_ytd)}</div>
            </div>
          </div>

          {metaData && (
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <div style={cs}>
                <div style={ls}>Meta Ads — Spend This Month</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '.3rem', color: 'var(--danger)' }}>EGP {fmt(metaData.spend)}</div>
              </div>
              <div style={cs}>
                <div style={ls}>Meta Ads — Balance Remaining</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '.3rem', color: 'var(--success)' }}>EGP {fmt(metaData.balance)}</div>
              </div>
            </div>
          )}

          {summary.last_report && (
            <Card>
              <CardTitle>Last Bosta Report</CardTitle>
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', fontSize: '.9rem' }}>
                <div><span style={{ color: 'var(--muted)' }}>Uploaded </span><strong>{new Date(summary.last_report.uploaded_at).toLocaleString('en-GB')}</strong></div>
                <div><span style={{ color: 'var(--muted)' }}>Orders </span><strong>{fmtN(summary.last_report.order_count)}</strong></div>
                <div><span style={{ color: 'var(--muted)' }}>Revenue </span><strong style={{ color: 'var(--accent)' }}>EGP {fmt(summary.last_report.grand_revenue)}</strong></div>
              </div>
              {summary.top_sku && (
                <div style={{ marginTop: '.75rem', fontSize: '.85rem', color: 'var(--muted)' }}>
                  Top SKU: <Badge>{summary.top_sku.sku}</Badge>{' '}
                  <span style={{ color: 'var(--text)' }}>{summary.top_sku.name}</span> — {fmtN(summary.top_sku.total_quantity)} units
                </div>
              )}
            </Card>
          )}

          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginTop: '.5rem' }}>
            <Btn variant="outline" onClick={() => navigate('/cashflow')}>→ Cashflow</Btn>
            <Btn variant="outline" onClick={() => navigate('/bosta')}>→ Bosta Orders</Btn>
            <Btn variant="outline" onClick={() => navigate('/analytics')}>→ Analytics</Btn>
          </div>
        </>
      )}
    </div>
  );
}
