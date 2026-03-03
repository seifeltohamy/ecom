import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../utils/auth.js';
import { fmt, fmtN } from '../utils/format.js';
import { S } from '../styles.js';
import Card, { CardTitle } from '../components/Card.jsx';
import Btn from '../components/Btn.jsx';
import Alert from '../components/Alert.jsx';
import Spinner from '../components/Spinner.jsx';
import DropZone from '../components/DropZone.jsx';
import StatBar from '../components/StatBar.jsx';
import ReportTable from '../components/ReportTable.jsx';
import DateRangeButton from '../components/DateRangeButton.jsx';

export default function BostaOrders() {
  const [file,           setFile]           = useState(null);
  const [status,         setStatus]         = useState(null);
  const [report,         setReport]         = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [dateFrom,       setDateFrom]       = useState('');
  const [dateTo,         setDateTo]         = useState('');
  const [history,        setHistory]        = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res  = await authFetch('/reports');
      const data = await res.json();
      if (res.ok) setHistory(data);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const runReport = async (from, to) => {
    if (!file) return;
    setLoading(true);
    setStatus({ type: 'loading', msg: 'Processing…' });
    const fd = new FormData();
    fd.append('file', file);
    if (from) fd.append('date_from', from);
    if (to)   fd.append('date_to',   to);
    try {
      const res  = await authFetch('/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      setStatus(null);
      setReport(data);
      loadHistory();
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  const upload = () => runReport('', '');

  const applyDates = (from, to) => {
    setDateFrom(from);
    setDateTo(to);
    runReport(from, to);
  };

  const clear = () => { setFile(null); setReport(null); setStatus(null); setDateFrom(''); setDateTo(''); };

  const viewReport = async (id) => {
    const res  = await authFetch(`/reports/${id}`);
    const data = await res.json();
    if (res.ok) setReport(data);
  };

  const thStyle = {
    padding: '.6rem .85rem',
    fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.06em',
    color: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)'
  };
  const tdStyle = {
    padding: '.65rem .85rem', borderBottom: '1px solid var(--border)', fontSize: '.875rem'
  };

  return (
    <div>
      <Card>
        <CardTitle>Upload New Report</CardTitle>
        <DropZone onFile={setFile} file={file} />
        <div style={{ display: 'flex', gap: '.6rem', marginTop: '1rem', alignItems: 'center' }}>
          <Btn disabled={!file || loading} onClick={upload}>
            {loading ? <><Spinner size={13} /> Processing…</> : 'Run Report'}
          </Btn>
          {report && <Btn variant="outline" onClick={clear}>Clear</Btn>}
        </div>
        {status && <Alert type={status.type}>{status.msg}</Alert>}
      </Card>

      {report && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '.5rem' }}>
            <StatBar {...report} />
            <DateRangeButton file={file} onApply={applyDates} activeFrom={dateFrom} activeTo={dateTo} />
          </div>
          <Card>
            <CardTitle>Sales Breakdown</CardTitle>
            <ReportTable data={report} />
          </Card>
        </>
      )}

      <Card>
        <CardTitle>Report History ({history.length})</CardTitle>
        {historyLoading
          ? <Alert type="loading">Loading history…</Alert>
          : history.length === 0
            ? <div style={{ color: 'var(--muted)', fontSize: '.9rem' }}>No reports saved yet. Upload one above.</div>
            : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Uploaded</th>
                      <th style={thStyle}>Date Range</th>
                      <th style={thStyle}>Orders</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Revenue</th>
                      <th style={{ ...thStyle, textAlign: 'right' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(h => (
                      <tr key={h.id}>
                        <td style={tdStyle}>{new Date(h.uploaded_at).toLocaleString('en-GB')}</td>
                        <td style={{ ...tdStyle, color: 'var(--muted)' }}>
                          {h.date_from || '—'} → {h.date_to || '—'}
                        </td>
                        <td style={tdStyle}>{fmtN(h.order_count)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', ...S.mono, color: 'var(--accent)' }}>
                          EGP {fmt(h.grand_revenue)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <Btn variant="outline" onClick={() => viewReport(h.id)}>View</Btn>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      </Card>
    </div>
  );
}
