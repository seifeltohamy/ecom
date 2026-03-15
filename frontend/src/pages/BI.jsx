import { useState, useEffect, useRef } from 'react';
import { authFetch } from '../utils/auth.js';
import { S } from '../styles.js';
import Alert from '../components/Alert.jsx';
import Card, { CardTitle } from '../components/Card.jsx';

export default function BI() {
  const [history,   setHistory]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [asking,    setAsking]    = useState(false);
  const [error,     setError]     = useState('');
  const [question,  setQuestion]  = useState('');
  const [selected,  setSelected]  = useState(null);   // { question, answer, created_at }
  const textareaRef = useRef(null);

  useEffect(() => {
    authFetch('/bi/history')
      .then(r => r.json())
      .then(d => { setHistory(d); setLoading(false); })
      .catch(() => { setError('Failed to load history.'); setLoading(false); });
  }, []);

  async function handleAsk(e) {
    e.preventDefault();
    if (!question.trim() || asking) return;
    setAsking(true);
    setError('');
    try {
      const res = await authFetch('/bi/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'Request failed.'); return; }
      const entry = { id: data.id, question: question.trim(), answer: data.answer, created_at: data.created_at };
      setHistory(h => [entry, ...h]);
      setSelected(entry);
      setQuestion('');
    } catch {
      setError('Request failed.');
    } finally {
      setAsking(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk(e);
    }
  }

  const fmtDate = (iso) => {
    try { return new Date(iso).toLocaleString('en-EG', { dateStyle: 'medium', timeStyle: 'short' }); }
    catch { return iso; }
  };

  return (
    <div>
      {loading && <Alert type="loading">Loading…</Alert>}
      {error   && <Alert type="error">{error}</Alert>}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1rem', alignItems: 'start' }}>

          {/* History sidebar */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1rem .5rem', borderBottom: '1px solid var(--border)' }}>
              <CardTitle>History</CardTitle>
            </div>
            {history.length === 0 ? (
              <p style={{ padding: '1rem', color: 'var(--muted)', fontSize: '.85rem' }}>No questions yet.</p>
            ) : (
              <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {history.map(h => (
                  <button
                    key={h.id}
                    onClick={() => setSelected(h)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '.75rem 1rem', background: selected?.id === h.id ? 'var(--surface2)' : 'none',
                      border: 'none', borderBottom: '1px solid var(--border)',
                      color: 'var(--text)', cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: '.83rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.question}
                    </div>
                    <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: '.2rem' }}>
                      {fmtDate(h.created_at)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Chat panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Selected Q/A */}
            {selected && (
              <Card>
                <div style={{
                  fontSize: '.78rem', color: 'var(--accent)', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.5rem',
                }}>You</div>
                <p style={{ marginBottom: '1rem', color: 'var(--text)' }}>{selected.question}</p>
                <div style={{
                  fontSize: '.78rem', color: 'var(--muted)', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '.5rem',
                }}>Assistant</div>
                <pre style={{
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  fontFamily: 'inherit', fontSize: '.9rem',
                  color: 'var(--text)', margin: 0,
                }}>
                  {selected.answer}
                </pre>
              </Card>
            )}

            {/* Composer */}
            <Card>
              <form onSubmit={handleAsk} style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                <textarea
                  ref={textareaRef}
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question about your data… (Enter to send, Shift+Enter for newline)"
                  rows={3}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'var(--surface2)', border: '1px solid var(--border2)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                    padding: '.6rem .75rem', fontSize: '.9rem',
                    resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={asking || !question.trim()}
                    style={{ ...S.btnBase, ...S.btnPrimary, opacity: (asking || !question.trim()) ? .5 : 1 }}
                  >
                    {asking ? 'Thinking…' : 'Ask'}
                  </button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
