import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../utils/auth.js';
import { S } from '../styles.js';
import Card, { CardTitle } from '../components/Card.jsx';
import Btn from '../components/Btn.jsx';
import Alert from '../components/Alert.jsx';

// ── SVG Donut Chart ─────────────────────────────────────────────────────────
function DonutChart({ completed, total, size = 160 }) {
  const pct = total > 0 ? completed / total : 0;
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  const color = pct >= 0.8 ? 'var(--success)' : pct >= 0.5 ? 'var(--accent)' : 'var(--danger)';
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={10} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .4s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '1.8rem', fontWeight: 700, color }}>{Math.round(pct * 100)}%</div>
        <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>{completed}/{total}</div>
      </div>
    </div>
  );
}

// ── Bar Chart ───────────────────────────────────────────────────────────────
function BarChart({ history }) {
  if (!history.length) return null;
  const maxPct = 100;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '.35rem', height: 100 }}>
      {history.map((d, i) => {
        const h = Math.max(4, (d.pct / maxPct) * 90);
        const color = d.pct >= 80 ? 'var(--success)' : d.pct >= 50 ? 'var(--accent)' : 'var(--danger)';
        const dayLabel = new Date(d.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' });
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <div style={{ fontSize: '.65rem', color: 'var(--muted)', marginBottom: '.2rem' }}>{Math.round(d.pct)}%</div>
            <div style={{ width: '100%', maxWidth: 32, height: h, background: color, borderRadius: '4px 4px 0 0', transition: 'height .3s ease' }} />
            <div style={{ fontSize: '.6rem', color: 'var(--muted)', marginTop: '.25rem' }}>{dayLabel}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function KPI() {
  const [board, setBoard] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifEmail, setNotifEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState(null);

  // Category management
  const [newCatName, setNewCatName] = useState('');
  const [newCatSchedule, setNewCatSchedule] = useState('');
  const [addingItem, setAddingItem] = useState(null); // category id
  const [newItemTitle, setNewItemTitle] = useState('');

  const loadBoard = useCallback(async () => {
    const [todayRes, histRes, emailRes] = await Promise.all([
      authFetch('/kpi/today'),
      authFetch('/kpi/history?days=7'),
      authFetch('/kpi/notification-email'),
    ]);
    if (todayRes.ok) setBoard(await todayRes.json());
    if (histRes.ok) setHistory(await histRes.json());
    if (emailRes.ok) {
      const d = await emailRes.json();
      setNotifEmail(d.notification_email || '');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  const toggleCheck = async (itemId, checked) => {
    // Optimistic UI
    setBoard(prev => {
      if (!prev) return prev;
      const cats = prev.categories.map(cat => ({
        ...cat,
        items: cat.items.map(it => it.id === itemId ? { ...it, checked: !checked } : it),
      }));
      const total = cats.reduce((s, c) => s + c.items.length, 0);
      const completed = cats.reduce((s, c) => s + c.items.filter(i => i.checked).length, 0);
      return { ...prev, categories: cats, total, completed, pct: total > 0 ? Math.round(completed / total * 1000) / 10 : 0 };
    });
    await authFetch(`/kpi/items/${itemId}/check`, { method: checked ? 'DELETE' : 'POST' });
  };

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    await authFetch('/kpi/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName.trim(), schedule: newCatSchedule.trim() || null }),
    });
    setNewCatName(''); setNewCatSchedule('');
    loadBoard();
  };

  const deleteCategory = async (catId) => {
    await authFetch(`/kpi/categories/${catId}`, { method: 'DELETE' });
    loadBoard();
  };

  const addItem = async (catId) => {
    if (!newItemTitle.trim()) return;
    await authFetch(`/kpi/categories/${catId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newItemTitle.trim() }),
    });
    setNewItemTitle(''); setAddingItem(null);
    loadBoard();
  };

  const deleteItem = async (itemId) => {
    await authFetch(`/kpi/items/${itemId}`, { method: 'DELETE' });
    loadBoard();
  };

  const saveEmail = async () => {
    setSavingEmail(true); setEmailMsg(null);
    const res = await authFetch('/kpi/notification-email', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notification_email: notifEmail.trim() }),
    });
    setSavingEmail(false);
    setEmailMsg(res.ok ? { type: 'success', text: 'Saved.' } : { type: 'error', text: 'Failed.' });
  };

  const inputStyle = {
    padding: '.45rem .65rem', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border2)', background: 'var(--surface2)',
    color: 'var(--text)', fontSize: '.85rem', outline: 'none',
  };

  return (
    <div>
      {loading && <Alert type="loading">Loading KPI dashboard…</Alert>}

      {!loading && board && (
        <>
          {/* ── Summary row: donut + bar chart ── */}
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <Card style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem 2rem' }}>
              <CardTitle>Today</CardTitle>
              <DonutChart completed={board.completed} total={board.total} />
              <div style={{ marginTop: '.75rem', fontSize: '.85rem', color: 'var(--muted)' }}>
                {board.completed} of {board.total} tasks completed
              </div>
            </Card>

            <Card style={{ flex: 1, minWidth: 260 }}>
              <CardTitle>Last 7 Days</CardTitle>
              {history.length > 0 ? <BarChart history={history} /> : (
                <div style={{ color: 'var(--muted)', fontSize: '.85rem' }}>No history yet — check back tomorrow.</div>
              )}
            </Card>
          </div>

          {/* ── Notification email ── */}
          <Card style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)' }}>
                Reminder Email
              </label>
              <input
                value={notifEmail}
                onChange={e => setNotifEmail(e.target.value)}
                placeholder="your@email.com"
                style={{ ...inputStyle, flex: 1, minWidth: 200 }}
              />
              <Btn onClick={saveEmail} disabled={savingEmail}>
                {savingEmail ? 'Saving…' : 'Save'}
              </Btn>
              {emailMsg && <span style={{ fontSize: '.8rem', color: emailMsg.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>{emailMsg.text}</span>}
            </div>
          </Card>

          {/* ── Category cards with checklist items ── */}
          {board.categories.map(cat => (
            <Card key={cat.id} style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                  <CardTitle style={{ margin: 0 }}>{cat.name}</CardTitle>
                  {cat.schedule && (
                    <span style={{
                      fontSize: '.7rem', color: 'var(--accent)', background: 'rgba(249,115,22,.1)',
                      border: '1px solid rgba(249,115,22,.25)', borderRadius: 12, padding: '1px 8px',
                    }}>
                      {cat.schedule.startsWith('*/') ? `Every ${cat.schedule.slice(2)}h` : `${cat.schedule}:00`}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => deleteCategory(cat.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '.9rem' }}
                  title="Delete category"
                >×</button>
              </div>

              {cat.items.map(item => (
                <div
                  key={item.id}
                  onClick={() => toggleCheck(item.id, item.checked)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '.65rem', padding: '.55rem .5rem',
                    borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    opacity: item.checked ? 0.6 : 1, transition: 'opacity .15s',
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    border: item.checked ? 'none' : '2px solid var(--border2)',
                    background: item.checked ? 'var(--success)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .15s',
                  }}>
                    {item.checked && <span style={{ color: '#fff', fontSize: '.7rem', fontWeight: 700 }}>✓</span>}
                  </div>
                  <span style={{
                    flex: 1, fontSize: '.88rem',
                    textDecoration: item.checked ? 'line-through' : 'none',
                    color: item.checked ? 'var(--muted)' : 'var(--text)',
                  }}>
                    {item.title}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteItem(item.id); }}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '.8rem', opacity: 0.5 }}
                    title="Delete item"
                  >×</button>
                </div>
              ))}

              {/* Add item */}
              {addingItem === cat.id ? (
                <div style={{ display: 'flex', gap: '.4rem', marginTop: '.5rem' }}>
                  <input
                    autoFocus
                    value={newItemTitle}
                    onChange={e => setNewItemTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addItem(cat.id)}
                    placeholder="New item…"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <Btn onClick={() => addItem(cat.id)}>Add</Btn>
                  <Btn variant="outline" onClick={() => { setAddingItem(null); setNewItemTitle(''); }}>Cancel</Btn>
                </div>
              ) : (
                <button
                  onClick={() => { setAddingItem(cat.id); setNewItemTitle(''); }}
                  style={{
                    display: 'block', width: '100%', marginTop: '.5rem', padding: '.4rem',
                    background: 'none', border: '1px dashed var(--border2)', borderRadius: 'var(--radius-sm)',
                    color: 'var(--muted)', cursor: 'pointer', fontSize: '.8rem', textAlign: 'center',
                  }}
                >
                  + Add item
                </button>
              )}
            </Card>
          ))}

          {/* ── Add category ── */}
          <Card>
            <CardTitle>Add Category</CardTitle>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                placeholder="Category name"
                style={{ ...inputStyle, flex: 1, minWidth: 150 }}
              />
              <input
                value={newCatSchedule}
                onChange={e => setNewCatSchedule(e.target.value)}
                placeholder="Schedule (e.g. */3 or 13)"
                title="*/3 = every 3 hours, 13 = at 1pm"
                style={{ ...inputStyle, width: 160 }}
              />
              <Btn onClick={addCategory} disabled={!newCatName.trim()}>Add</Btn>
            </div>
            <p style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: '.5rem' }}>
              Schedule: <code style={{ background: 'var(--surface2)', padding: '1px 4px', borderRadius: 3 }}>*/3</code> = every 3 hours, <code style={{ background: 'var(--surface2)', padding: '1px 4px', borderRadius: 3 }}>13</code> = at 1pm. Leave empty for no reminders.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
