import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Mail, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { authFetch } from '../utils/auth.js';
import { S } from '../styles.js';
import Alert from '../components/Alert.jsx';

const PRIORITY_BADGE = {
  high:   { label: 'HIGH',   bg: 'var(--danger-bg)',  color: 'var(--danger)',  border: 'rgba(239,68,68,.25)' },
  medium: { label: 'MED',    bg: 'rgba(249,115,22,.12)', color: 'var(--accent)', border: 'rgba(249,115,22,.25)' },
  low:    { label: 'LOW',    bg: 'var(--surface2, #1e1e1e)', color: 'var(--muted)', border: 'var(--border)' },
};

function PriorityBadge({ priority }) {
  const p = PRIORITY_BADGE[priority] || PRIORITY_BADGE.low;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 7px',
      borderRadius: 4,
      fontSize: '.68rem',
      fontWeight: 700,
      letterSpacing: '.07em',
      background: p.bg,
      color: p.color,
      border: `1px solid ${p.border}`,
      flexShrink: 0,
    }}>
      {p.label}
    </span>
  );
}

function ActionItem({ item }) {
  return (
    <div style={{
      display: 'flex',
      gap: '0.75rem',
      padding: '0.75rem 0',
      borderBottom: '1px solid var(--border)',
      alignItems: 'flex-start',
    }}>
      <div style={{ paddingTop: 2 }}>
        <PriorityBadge priority={item.priority} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '.9rem', color: 'var(--text)', marginBottom: '.15rem' }}>
          {item.subject}
        </div>
        <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: '.2rem' }}>
          From: {item.from}
        </div>
        <div style={{ fontSize: '.82rem', color: 'var(--text)', opacity: 0.8 }}>
          {item.reason}
        </div>
      </div>
    </div>
  );
}

function timeAgo(isoStr) {
  if (!isoStr) return null;
  const diffMs  = Date.now() - new Date(isoStr + 'Z').getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)  return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

export default function Emails() {
  const [data,     setData]     = useState(null);   // GET /emails/summary response
  const [scanning, setScanning] = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    authFetch('/emails/summary')
      .then(r => r.json())
      .then(setData)
      .catch(() => setError('Failed to load email summary.'));
  }, []);

  async function handleScan() {
    setScanning(true);
    setError('');
    try {
      const r = await authFetch('/emails/scan', { method: 'POST' });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(body.detail || 'Scan failed.');
        return;
      }
      const d = await r.json();
      setData(d);
    } catch {
      setError('Network error — could not reach server.');
    } finally {
      setScanning(false);
    }
  }

  const actionItems = data?.action_items ?? [];
  const highCount   = actionItems.filter(x => x.priority === 'high').length;

  return (
    <div>
      {/* Header */}
      <div style={{ ...S.header, marginBottom: '1.5rem' }}>
        <div>
          <h1 style={S.h1}>Emails</h1>
          <p style={S.sub}>Gmail inbox summary and action items — last 7 days.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {data?.fetched_at && (
            <span style={{ fontSize: '.82rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '.3rem' }}>
              <Clock size={13} />
              Last scanned {timeAgo(data.fetched_at)}
            </span>
          )}
          <button
            style={{
              ...S.btnBase,
              ...S.btnPrimary,
              ...(scanning ? S.btnDisabled : {}),
              gap: '.5rem',
            }}
            onClick={handleScan}
            disabled={scanning}
          >
            <RefreshCw size={15} style={{ animation: scanning ? 'spin 1s linear infinite' : 'none' }} />
            {scanning ? 'Reading inbox…' : 'Scan Inbox'}
          </button>
        </div>
      </div>

      {error && (
        <Alert type="error" style={{ marginBottom: '1rem' }}>{error}</Alert>
      )}

      {/* Not configured */}
      {data && !data.configured && (
        <div style={{
          ...S.card,
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          color: 'var(--muted)', fontSize: '.9rem',
        }}>
          <Mail size={20} style={{ flexShrink: 0, opacity: 0.5 }} />
          Gmail credentials not configured. Add your Gmail address and App Password in{' '}
          <a href="/settings" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
            Settings → Bosta Integration
          </a>.
        </div>
      )}

      {/* Empty state */}
      {data?.configured && !data.fetched_at && !scanning && (
        <div style={{
          ...S.card,
          textAlign: 'center',
          padding: '3rem 1.5rem',
          color: 'var(--muted)',
        }}>
          <Mail size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
          <div style={{ fontSize: '.95rem' }}>Click <strong>Scan Inbox</strong> to analyze your last 7 days of email.</div>
        </div>
      )}

      {/* Scanning state */}
      {scanning && (
        <div style={{ ...S.card, textAlign: 'center', padding: '2rem 1.5rem', color: 'var(--muted)' }}>
          <div style={{ marginBottom: '0.5rem', fontSize: '.9rem' }}>Connecting to Gmail and analyzing with Gemini…</div>
          <div style={{ fontSize: '.8rem' }}>This may take 20–40 seconds.</div>
        </div>
      )}

      {/* Results */}
      {data?.fetched_at && !scanning && (
        <>
          {/* Action Items card */}
          <div style={S.card}>
            <div style={{
              ...S.cardTitle,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                <AlertCircle size={13} />
                Action Items
              </span>
              {highCount > 0 && (
                <span style={{
                  fontSize: '.72rem', fontWeight: 700,
                  color: 'var(--danger)',
                  background: 'var(--danger-bg)',
                  border: '1px solid rgba(239,68,68,.25)',
                  borderRadius: 4,
                  padding: '1px 8px',
                }}>
                  {highCount} high priority
                </span>
              )}
            </div>

            {actionItems.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', color: 'var(--muted)', fontSize: '.9rem', padding: '.5rem 0' }}>
                <CheckCircle size={16} />
                No action items found — inbox looks clear.
              </div>
            ) : (
              <div>
                {actionItems.map((item, i) => (
                  <ActionItem key={i} item={item} />
                ))}
              </div>
            )}
          </div>

          {/* Summary card */}
          {data.summary && (
            <div style={S.card}>
              <div style={{ ...S.cardTitle, display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                <Mail size={13} />
                Inbox Summary
              </div>
              <div style={{ fontSize: '.9rem', lineHeight: 1.7 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {data.summary}
                </ReactMarkdown>
              </div>
              <div style={{
                marginTop: '1rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border)',
                fontSize: '.78rem',
                color: 'var(--muted)',
              }}>
                Scanned {data.email_count} emails from the last 7 days
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
