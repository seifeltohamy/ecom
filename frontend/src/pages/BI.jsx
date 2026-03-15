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
  fontSize: '.72rem', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '.07em',
  marginBottom: '.4rem',
};

export default function BI() {
  const [history,   setHistory]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [asking,    setAsking]    = useState(false);
  const [error,     setError]     = useState('');
  const [question,  setQuestion]  = useState('');
  // messages = [{role:'user'|'assistant', text, id?, created_at?, pending?}]
  const [messages,     setMessages]     = useState([]);
  const [showHistory,  setShowHistory]  = useState(false);
  const textareaRef = useRef(null);
  const bottomRef   = useRef(null);

  useEffect(() => {
    authFetch('/bi/history')
      .then(r => r.json())
      .then(d => { setHistory(d); setLoading(false); })
      .catch(() => { setError('Failed to load history.'); setLoading(false); });
  }, []);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, asking]);

  async function handleAsk(e) {
    e.preventDefault();
    if (!question.trim() || asking) return;
    const q = question.trim();
    setAsking(true);
    setError('');
    setQuestion('');

    // Append user message immediately
    setMessages(prev => [...prev, { role: 'user', text: q, id: `u-${Date.now()}` }]);

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
      // Append assistant answer
      setMessages(prev => [...prev, { role: 'assistant', text: data.answer, id: data.id, created_at: data.created_at }]);
    } catch {
      setError('Request failed.');
    } finally {
      setAsking(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAsk(e);
    }
  }

  function handleNewChat() {
    setMessages([]);
    setError('');
    setQuestion('');
    setAsking(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function handleHistoryClick(h) {
    setMessages([
      { role: 'user',      text: h.question,   id: `u-${h.id}`, created_at: h.created_at },
      { role: 'assistant', text: h.answer,      id: h.id,        created_at: h.created_at },
    ]);
    setError('');
    setAsking(false);
    setQuestion('');
    setShowHistory(false);
  }

  const fmtDate = (iso) => {
    try { return new Date(iso).toLocaleString('en-EG', { dateStyle: 'medium', timeStyle: 'short' }); }
    catch { return iso; }
  };

  // Derive active history id (last assistant message)
  const activeId = messages.findLast?.(m => m.role === 'assistant' && !String(m.id).startsWith('u-'))?.id ?? null;

  return (
    <div className="bi-page" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 150px)' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.75rem', flexShrink: 0 }}>
        <button
          className="bi-history-toggle"
          onClick={() => setShowHistory(v => !v)}
          style={{ ...S.btnBase, ...S.btnOutline, alignItems: 'center', gap: '.4rem', fontSize: '.85rem' }}
        >
          {showHistory ? '✕ Close' : '☰ History'}
        </button>
        <button
          onClick={handleNewChat}
          style={{ ...S.btnBase, ...S.btnOutline, display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.85rem' }}
        >
          <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>+</span> New Chat
        </button>
      </div>

      {error && <div style={{ flexShrink: 0, marginBottom: '.5rem' }}><Alert type="error">{error}</Alert></div>}

      {loading ? (
        <Alert type="loading">Loading…</Alert>
      ) : (
        <div className="bi-layout">

          {/* ── History sidebar ── */}
          <div className={`bi-sidebar${showHistory ? ' open' : ''}`} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', overflow: 'hidden',
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
                    onClick={() => handleHistoryClick(h)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '.75rem 1rem',
                      background: activeId === h.id ? 'var(--surface2)' : 'none',
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

            {/* Scrollable messages area */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '.25rem' }}>

              {messages.length === 0 ? (
                <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  color: 'var(--muted)', fontSize: '.9rem', gap: '.5rem',
                }}>
                  <span style={{ fontSize: '2rem' }}>💬</span>
                  <span>Ask anything about your data</span>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={msg.id ?? i} style={{ animation: 'fadeIn .2s ease' }}>
                    {msg.role === 'user' ? (
                      /* User bubble */
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div className="bi-user-bubble" style={{
                          maxWidth: '70%',
                          background: 'var(--accent)',
                          color: '#fff',
                          borderRadius: '16px 16px 4px 16px',
                          padding: '.65rem 1rem',
                          fontSize: '.92rem',
                          lineHeight: 1.55,
                        }}>
                          {msg.text}
                        </div>
                      </div>
                    ) : (
                      /* Assistant bubble */
                      <div style={{ display: 'flex', gap: '.6rem', alignItems: 'flex-start' }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'var(--surface2)', border: '1px solid var(--border2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '.7rem', fontWeight: 700, color: 'var(--muted)',
                          flexShrink: 0, marginTop: 2,
                        }}>AI</div>
                        <div style={{
                          flex: 1,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '4px 16px 16px 16px',
                          padding: '.75rem 1rem',
                        }}>
                          <div style={{ ...LABEL, color: 'var(--muted)' }}>Assistant</div>
                          <div className="bi-answer">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Thinking indicator */}
              {asking && (
                <div style={{ display: 'flex', gap: '.6rem', alignItems: 'flex-start', animation: 'fadeIn .2s ease' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'var(--surface2)', border: '1px solid var(--border2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '.7rem', fontWeight: 700, color: 'var(--muted)',
                    flexShrink: 0, marginTop: 2,
                  }}>AI</div>
                  <div style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: '4px 16px 16px 16px', padding: '.75rem 1rem',
                  }}>
                    <ThinkingDots />
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Composer */}
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
                    {asking && <span style={{ fontSize: '.8rem', color: 'var(--muted)' }}>Thinking…</span>}
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
