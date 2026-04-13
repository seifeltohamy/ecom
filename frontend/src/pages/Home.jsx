import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/auth.js';
import { fmt, fmtN } from '../utils/format.js';
import Card, { CardTitle } from '../components/Card.jsx';
import Btn from '../components/Btn.jsx';
import Alert from '../components/Alert.jsx';
import Badge from '../components/Badge.jsx';

// Color palette
const C = {
  in:      'var(--accent)',  // orange
  out:     'var(--accent)',  // orange
  net:     'var(--accent)',  // orange
  netNeg:  'var(--accent)',  // orange (consistent)
  meta:    '#1877f2',        // facebook blue
  balance: '#34d399',        // emerald
};

function KpiCard({ label, value, color, sub }) {
  return (
    <div style={{
      flex: '1', minWidth: 180,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      animation: 'fadeIn .3s ease',
    }}>
      {/* accent bar */}
      <div style={{ height: 3, background: color, opacity: .9 }} />
      <div style={{ padding: '1rem 1.25rem' }}>
        <div style={{ fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', fontWeight: 600, marginBottom: '.4rem' }}>
          {label}
        </div>
        <div style={{ fontSize: '1.45rem', fontWeight: 700, color, lineHeight: 1.15 }}>
          <span style={{ fontSize: '.7em', fontWeight: 500, opacity: .75, marginRight: '.2rem' }}>EGP</span>
          {fmt(value)}
        </div>
        {sub && <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: '.35rem' }}>{sub}</div>}
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '.1em', color: 'var(--muted)',
      marginBottom: '.5rem', marginTop: '.25rem',
    }}>
      {children}
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [summary,       setSummary]       = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [months,        setMonths]        = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [metaData,      setMetaData]      = useState(null);

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
    setMetaData(null);
    authFetch(`/meta/summary?month=${encodeURIComponent(selectedMonth)}`)
      .then(async r => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          return { error: j.detail || `HTTP ${r.status}` };
        }
        return r.json();
      })
      .then(d => {
        if (d?.error) setMetaData({ error: d.error });
        else setMetaData(d?.connected ? d : false);
      })
      .catch(e => setMetaData({ error: e.message || 'Network error' }));
  }, [selectedMonth]);


  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '.75rem' }}>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          style={{
            padding: '.45rem .75rem', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border2)', background: 'var(--surface2)',
            color: 'var(--text)', fontSize: '.875rem', cursor: 'pointer',
          }}
        >
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {loading && <Alert type="loading">Loading dashboard…</Alert>}
      {!loading && !summary && <Alert type="error">Failed to load summary.</Alert>}
      {!loading && summary && (
        <>
          {/* Monthly */}
          <SectionLabel>{selectedMonth}</SectionLabel>
          <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <KpiCard label="Money In"  value={summary.this_month_in}  color={C.in} />
            <KpiCard label="Money Out" value={summary.this_month_out} color={C.out} />
            <KpiCard label="Net"       value={summary.this_month_net} color={C.net} />
          </div>

          {/* YTD */}
          <SectionLabel>Year to Date</SectionLabel>
          <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <KpiCard label="Total In"  value={summary.total_in_ytd}  color={C.in} />
            <KpiCard label="Total Out" value={summary.total_out_ytd} color={C.out} />
          </div>

          {/* Meta Ads */}
          <SectionLabel>Meta Ads — {selectedMonth}</SectionLabel>
          {metaData === null && (
            <div style={{ marginBottom: '1.25rem' }}>
              <Alert type="loading">Loading Meta Ads data…</Alert>
            </div>
          )}
          {metaData === false && (
            <div style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem', background: 'var(--surface)', border: '1px dashed var(--border2)', borderRadius: 'var(--radius)', color: 'var(--muted)', fontSize: '.85rem' }}>
              Meta Ads is not connected for this brand. <a href="/settings" style={{ color: 'var(--accent)' }}>Connect in Settings →</a>
            </div>
          )}
          {metaData?.error && (
            <div style={{ marginBottom: '1.25rem' }}>
              <Alert type="error">Meta Ads error: {metaData.error}</Alert>
            </div>
          )}
          {metaData && !metaData.error && metaData.connected && (
            <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              <KpiCard label="Ad Spend This Month" value={metaData.spend}   color={C.meta}    sub="Facebook & Instagram" />
              <KpiCard label="Balance Remaining"   value={metaData.balance} color={C.balance} sub="Available ad budget" />
            </div>
          )}

          {/* Last report */}
          {summary.last_report && (
            <Card style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.75rem' }}>
                <div style={{ width: 3, height: 18, borderRadius: 2, background: 'var(--accent)', flexShrink: 0 }} />
                <CardTitle style={{ margin: 0 }}>Last Bosta Report</CardTitle>
              </div>
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', fontSize: '.875rem' }}>
                <div>
                  <span style={{ color: 'var(--muted)', fontSize: '.75rem', display: 'block', marginBottom: '.1rem' }}>Uploaded</span>
                  <strong>{new Date(summary.last_report.uploaded_at).toLocaleString('en-GB')}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', fontSize: '.75rem', display: 'block', marginBottom: '.1rem' }}>Orders</span>
                  <strong>{fmtN(summary.last_report.order_count)}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', fontSize: '.75rem', display: 'block', marginBottom: '.1rem' }}>Revenue</span>
                  <strong style={{ color: 'var(--accent)', fontSize: '1rem' }}>EGP {fmt(summary.last_report.grand_revenue)}</strong>
                </div>
              </div>
              {summary.top_sku && (
                <div style={{
                  marginTop: '.85rem', fontSize: '.82rem', color: 'var(--muted)',
                  paddingTop: '.75rem', borderTop: '1px solid var(--border)',
                }}>
                  Top SKU: <Badge>{summary.top_sku.sku}</Badge>{' '}
                  <span style={{ color: 'var(--text)' }}>{summary.top_sku.name}</span>
                  <span style={{ marginLeft: '.4rem' }}>— {fmtN(summary.top_sku.total_quantity)} units</span>
                </div>
              )}
            </Card>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
            <Btn variant="outline" onClick={() => navigate('/cashflow')}>→ Cashflow</Btn>
            <Btn variant="outline" onClick={() => navigate('/bosta')}>→ Bosta Orders</Btn>
            <Btn variant="outline" onClick={() => navigate('/analytics')}>→ Analytics</Btn>
          </div>
        </>
      )}
    </div>
  );
}
