import { fmt, fmtN } from '../utils/format.js';
import { S } from '../styles.js';
import Card, { CardTitle } from './Card.jsx';
import Alert from './Alert.jsx';
import Btn from './Btn.jsx';

const thStyle = {
  padding: '.6rem .85rem', fontSize: '.7rem', textTransform: 'uppercase',
  letterSpacing: '.06em', color: 'var(--muted)', textAlign: 'left',
  borderBottom: '1px solid var(--border)',
};
const tdStyle = { padding: '.65rem .85rem', borderBottom: '1px solid var(--border)', fontSize: '.875rem' };

/** Bosta report history table card. */
export default function ReportHistory({ history, loading, onView }) {
  return (
    <Card>
      <CardTitle>Report History ({history.length})</CardTitle>
      {loading ? (
        <Alert type="loading">Loading history…</Alert>
      ) : history.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: '.9rem' }}>No reports saved yet. Upload one above.</div>
      ) : (
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
                  <td style={{ ...tdStyle, color: 'var(--muted)' }}>{h.date_from || '—'} → {h.date_to || '—'}</td>
                  <td style={tdStyle}>{fmtN(h.order_count)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', ...S.mono, color: 'var(--accent)' }}>EGP {fmt(h.grand_revenue)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <Btn variant="outline" onClick={() => onView(h.id)}>View</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
