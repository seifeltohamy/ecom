import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { authFetch } from '../utils/auth.js';
import { S } from '../styles.js';
import Alert from '../components/Alert.jsx';
import Card, { CardTitle } from '../components/Card.jsx';

function ThinkingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center', padding: '6px 0' }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'var(--muted)',
          display: 'inline-block',
          animation: 'biDotBounce .9s ease-in-out infinite',
          animationDelay: `${i * 0.18}s`,
        }} />
      ))}
    </span>
  );
}

const LABEL = {
  fontSize: '.75rem', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '.07em',
  marginBottom: '.5rem',
};

export default function BI() {
  const [history,         setHistory]         = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [asking,          setAsking]          = useState(false);
  const [error,           setError]           = useState('');
  const [question,        setQuestion]        = useState('');
  const [selected,        setSelected]        = useState(null);
  const [pendingQuestion, setPendingQuestion] = useState('');
  const textareaRef  = useRef(null);
  const chatBodyRef  = useRef(null);

  useEffect(() => {
    authFetch('/bi/history')
      .then(r => r.json())
      .then(d => { setHistory(d); setLoading(false); })
      .catch(() => { setError('Failed to load history.'); setLoading(false); });
  }, []);

  // Scroll chat body to bottom when new content appears
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [selected?.id, asking]);

  async function handleAsk(e) {
    e.preventDefault();
    if (!question.trim() || asking) return;
    const q = question.trim();
    setAsking(true);
    setError('');
    setSelected(null);
    setPendingQuestion(q);
    setQuestion('');
    try {
      const res = await authFetch('/bi/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || 'Request failed.'); return; }
      const entry = { id: data.id, question: q, answer: data.answer, created_at: data.created_at };
      setHistory(h => [entry, ...h]);
      setSelected(entry);
    } catch {
      setError('Request failed.');
    } finally {
      setAsking(false);
      setPendingQuestion('');
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAsk(e);
    }
  }

  function handleNewChat() {
    setSelected(null);
    setPendingQuestion('');
    setAsking(false);
    setError('');
    setQuestion('');
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  const fmtDate = (iso) => {
    try { return new Date(iso).toLocaleString('en-EG', { dateStyle: 'medium', timeStyle: 'short' }); }
    catch { return iso; }
  };

  const showPending  = asking && pendingQuestion;
  const showSelected = !asking && selected;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 150px)' }}>

      {/* Top bar: New Chat button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '.75rem', flexShrink: 0 }}>
        <button
          onClick={handleNewChat}
          style={{
            ...S.btnBase, ...S.btnOutline,
            display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.85rem',
          }}
        >
          <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>+</span> New Chat
        </button>
      </div>

      {error && <div style={{ flexShrink: 0, marginBottom: '.5rem' }}><Alert type="error">{error}</Alert></div>}

      {loading ? (
        <Alert type="loading">Loading…</Alert>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: '260px 1fr',
          gap: '1rem', flex: 1, overflow: 'hidden',
        }}>

          {/* ── History sidebar ── */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '1rem 1rem .6rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <CardTitle>History</CardTitle>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {history.length === 0 ? (
                <p style={{ padding: '1rem', color: 'var(--muted)', fontSize: '.85rem' }}>No questions yet.</p>
              ) : (
                history.map(h => (
                  <button
                    key={h.id}
                    onClick={() => { setSelected(h); setAsking(false); setPendingQuestion(''); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '.75rem 1rem',
                      background: selected?.id === h.id ? 'var(--surface2)' : 'none',
                      border: 'none', borderBottom: '1px solid var(--border)',
                      color: 'var(--text)', cursor: 'pointer',
                      transition: 'background .15s',
                    }}
                  >
                    <div style={{ fontSize: '.83rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.question}
                    </div>
                    <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: '.2rem' }}>
                      {fmtDate(h.created_at)}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── Chat panel ── */}
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: '.75rem' }}>

            {/* Scrollable Q/A area */}
            <div ref={chatBodyRef} style={{ flex: 1, overflowY: 'auto', paddingRight: '.25rem' }}>
              {(showPending || showSelected) ? (
                <Card style={{ animation: 'fadeIn .25s ease' }}>
                  <div style={{ ...LABEL, color: 'var(--accent)' }}>You</div>
                  <p style={{ marginBottom: '1.25rem', color: 'var(--text)', lineHeight: 1.6, fontSize: '.95rem' }}>
                    {showPending ? pendingQuestion : selected.question}
                  </p>

                  <div style={{ borderTop: '1px solid var(--border)', marginBottom: '1.25rem' }} />

                  <div style={{ ...LABEL, color: 'var(--muted)' }}>Assistant</div>
                  {showPending ? (
                    <ThinkingDots />
                  ) : (
                    <div className="bi-answer" style={{ animation: 'fadeIn .3s ease' }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {selected.answer}
                      </ReactMarkdown>
                    </div>
                  )}
                </Card>
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: '100%', color: 'var(--muted)', fontSize: '.9rem', flexDirection: 'column', gap: '.5rem',
                }}>
                  <span style={{ fontSize: '2rem' }}>💬</span>
                  <span>Ask anything about your data</span>
                </div>
              )}
            </div>

            {/* Composer — pinned at bottom */}
            <div style={{ flexShrink: 0 }}>
              <Card>
                <form onSubmit={handleAsk} style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
                  <textarea
                    ref={textareaRef}
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask a question about your data… (Enter to send)"
                    rows={3}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'var(--surface2)', border: '1px solid var(--border2)',
                      borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                      padding: '.65rem .85rem', fontSize: '.9rem',
                      resize: 'none', outline: 'none', fontFamily: 'inherit',
                      transition: 'border-color .15s',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e  => e.target.style.borderColor = 'var(--border2)'}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '.75rem' }}>
                    {asking && (
                      <span style={{ fontSize: '.8rem', color: 'var(--muted)' }}>Thinking…</span>
                    )}
                    <button
                      type="submit"
                      disabled={asking || !question.trim()}
                      style={{
                        ...S.btnBase, ...S.btnPrimary,
                        opacity: (asking || !question.trim()) ? .45 : 1,
                        transition: 'opacity .15s',
                      }}
                    >
                      Ask
                    </button>
                  </div>
                </form>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
