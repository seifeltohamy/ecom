import { useState, useEffect, useRef } from 'react';
import { authFetch, getToken } from '../utils/auth.js';
import Btn from './Btn.jsx';
import Spinner from './Spinner.jsx';

const inputStyle = {
  background: 'var(--surface2, #1c1917)', color: 'var(--text)',
  border: '1px solid var(--border2, #3a3733)', borderRadius: 6,
  padding: '.35rem .6rem', fontSize: '.9rem',
  fontFamily: 'inherit', outline: 'none', width: 130,
};

/**
 * Automate Export modal.
 * Phase 1 (streaming): shows live SSE log lines.
 * Phase 2 (ready):     shows date range pickers + Upload button.
 * Props: onDone(reportData), onClose
 */
export default function AutomateModal({ onDone, onClose }) {
  const [phase,    setPhase]    = useState('streaming');
  const [logs,     setLogs]     = useState([]);
  const [fileId,   setFileId]   = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [error,    setError]    = useState('');
  const logsEndRef = useRef(null);
  const ctrlRef    = useRef(null);

  // SSE via fetch (EventSource doesn't support custom auth headers)
  useEffect(() => {
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    (async () => {
      let res;
      try {
        res = await fetch('/automation/run-export', {
          headers: { Authorization: `Bearer ${getToken()}` },
          signal: ctrl.signal,
        });
      } catch (e) {
        if (e.name !== 'AbortError') { setError(String(e)); setPhase('error'); }
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.detail || `Error ${res.status}`);
        setPhase('error');
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const chunks = buf.split('\n\n');
          buf = chunks.pop();
          for (const chunk of chunks) {
            const msg = chunk.replace(/^data: /, '').trim();
            if (!msg) continue;
            if (msg.startsWith('LOG:')) {
              setLogs(prev => [...prev, msg.slice(4)]);
            } else if (msg.startsWith('READY:')) {
              const parts = msg.split(':');
              // READY:<file_id>:<date_from>:<date_to>
              setFileId(parts[1]);
              setDateFrom(parts[2]);
              setDateTo(parts[3]);
              setPhase('ready');
            } else if (msg.startsWith('ERROR:')) {
              setError(msg.slice(6));
              setPhase('error');
            }
          }
        }
      } catch (e) {
        if (e.name !== 'AbortError') { setError(String(e)); setPhase('error'); }
      }
    })();

    return () => ctrl.abort();
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  async function upload() {
    setPhase('uploading');
    try {
      const res = await authFetch(`/automation/upload/${fileId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date_from: dateFrom, date_to: dateTo }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Upload failed');
      }
      onDone(await res.json());
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  }

  function cancel() {
    ctrlRef.current?.abort();
    onClose();
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) cancel(); }}
    >
      <div style={{
        background: 'var(--surface, #151312)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius, 12px)',
        padding: '1.5rem',
        minWidth: 380, maxWidth: 520, width: '90vw',
        boxShadow: '0 8px 40px rgba(0,0,0,.6)',
      }}>
        {/* Header */}
        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1.25rem', color: 'var(--text)' }}>
          {phase === 'ready'     ? '✓ Export ready — confirm date range' :
           phase === 'uploading' ? 'Uploading report…' :
           phase === 'error'     ? 'Automation failed' :
           'Automating Bosta Export'}
        </div>

        {/* Streaming phase — log lines */}
        {(phase === 'streaming' || phase === 'ready') && logs.length > 0 && (
          <div style={{
            background: 'var(--bg, #0c0a09)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '.75rem 1rem',
            marginBottom: '1.25rem',
            maxHeight: 200,
            overflowY: 'auto',
            fontSize: '.8rem',
            fontFamily: 'monospace',
            color: 'var(--muted)',
            display: 'flex', flexDirection: 'column', gap: '.3rem',
          }}>
            {logs.map((line, i) => (
              <div key={i} style={{ color: i === logs.length - 1 ? 'var(--text)' : 'var(--muted)' }}>
                • {line}
              </div>
            ))}
            {phase === 'streaming' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', color: 'var(--accent)' }}>
                <Spinner size={11} /> waiting…
              </div>
            )}
            <div ref={logsEndRef} />
          </div>
        )}

        {/* Uploading spinner */}
        {phase === 'uploading' && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem 0' }}>
            <Spinner size={28} />
          </div>
        )}

        {/* Ready phase — date picker */}
        {phase === 'ready' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: '.3rem' }}>From</div>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ color: 'var(--muted)', marginTop: '1.1rem' }}>→</div>
            <div>
              <div style={{ fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: '.3rem' }}>To</div>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputStyle} />
            </div>
          </div>
        )}

        {/* Error message */}
        {phase === 'error' && error && (
          <div style={{ color: 'var(--danger, #ef4444)', fontSize: '.875rem', marginBottom: '1rem', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 6, padding: '.6rem .85rem' }}>
            {error}
          </div>
        )}

        {/* Footer buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem' }}>
          {phase === 'streaming' && (
            <Btn variant="outline" onClick={cancel}>Cancel</Btn>
          )}
          {phase === 'ready' && (
            <>
              <Btn variant="outline" onClick={cancel}>Cancel</Btn>
              <Btn onClick={upload} disabled={!dateFrom || !dateTo}>Upload</Btn>
            </>
          )}
          {phase === 'error' && (
            <Btn variant="outline" onClick={onClose}>Close</Btn>
          )}
        </div>
      </div>
    </div>
  );
}
