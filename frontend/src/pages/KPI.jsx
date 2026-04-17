import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../utils/auth.js';
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
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '.35rem', height: 100 }}>
      {history.map((d, i) => {
        const h = Math.max(4, (d.pct / 100) * 90);
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

// ── Format time ─────────────────────────────────────────────────────────────
function fmtTime(slot) {
  if (!slot) return '';
  const [h, m] = slot.split(':');
  const hr = parseInt(h);
  const ampm = hr < 12 ? 'AM' : 'PM';
  return `${hr % 12 || 12}:${m} ${ampm}`;
}

// ── Time Presets ────────────────────────────────────────────────────────────
const TIME_PRESETS = [
  { label: 'Every 2h (9–21)', times: ['09:00','11:00','13:00','15:00','17:00','19:00','21:00'] },
  { label: 'Every 3h (9–21)', times: ['09:00','12:00','15:00','18:00','21:00'] },
  { label: 'Every 4h (9–21)', times: ['09:00','13:00','17:00','21:00'] },
  { label: 'Morning + Evening', times: ['09:00','18:00'] },
  { label: 'Once at 1 PM', times: ['13:00'] },
];

export default function KPI() {
  const [board, setBoard] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifEmail, setNotifEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState(null);
  const [testingSend, setTestingSend] = useState(false);
  const [testMsg, setTestMsg] = useState(null);

  // Category management
  const [newCatName, setNewCatName] = useState('');

  // Item creation
  const [addingItem, setAddingItem] = useState(null); // category id
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemTimes, setNewItemTimes] = useState([]);
  const [timeInput, setTimeInput] = useState('');

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

  const toggleCheck = async (itemId, timeSlot, checked) => {
    // Optimistic UI
    setBoard(prev => {
      if (!prev) return prev;
      const cats = prev.categories.map(cat => ({
        ...cat,
        items: cat.items.map(it =>
          it.id === itemId && it.time_slot === timeSlot ? { ...it, checked: !checked } : it
        ),
      }));
      const total = cats.reduce((s, c) => s + c.items.length, 0);
      const completed = cats.reduce((s, c) => s + c.items.filter(i => i.checked).length, 0);
      return { ...prev, categories: cats, total, completed, pct: total > 0 ? Math.round(completed / total * 1000) / 10 : 0 };
    });
    const params = timeSlot ? `?time_slot=${encodeURIComponent(timeSlot)}` : '';
    await authFetch(`/kpi/items/${itemId}/check${params}`, { method: checked ? 'DELETE' : 'POST' });
  };

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    await authFetch('/kpi/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName.trim() }),
    });
    setNewCatName('');
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
      body: JSON.stringify({ title: newItemTitle.trim(), times: newItemTimes.length > 0 ? newItemTimes : null }),
    });
    setNewItemTitle(''); setNewItemTimes([]); setAddingItem(null); setTimeInput('');
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

  const testSend = async () => {
    setTestingSend(true); setTestMsg(null);
    try {
      const res = await authFetch('/kpi/test-send', { method: 'POST' });
      const data = await res.json();
      setTestingSend(false);
      if (res.ok) {
        setTestMsg({ type: 'success', text: `Sent to ${data.sent_to} — ${data.pending_count} pending items` });
      } else {
        setTestMsg({ type: 'error', text: data.detail || 'Failed to send' });
      }
    } catch (e) {
      setTestingSend(false);
      setTestMsg({ type: 'error', text: e.message });
    }
  };

  const addTimeSlot = () => {
    const t = timeInput.trim();
    if (t && /^\d{2}:\d{2}$/.test(t) && !newItemTimes.includes(t)) {
      setNewItemTimes(prev => [...prev, t].sort());
      setTimeInput('');
    }
  };

  const removeTimeSlot = (t) => {
    setNewItemTimes(prev => prev.filter(x => x !== t));
  };

  const inputStyle = {
    padding: '.45rem .65rem', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border2)', background: 'var(--surface2)',
    color: 'var(--text)', fontSize: '.85rem', outline: 'none',
  };

  // Group consecutive slots of the same item for display
  const getUniqueItems = (items) => {
    const seen = new Map();
    for (const it of items) {
      if (!seen.has(it.id)) seen.set(it.id, { ...it, slots: [] });
      seen.get(it.id).slots.push({ time_slot: it.time_slot, checked: it.checked });
    }
    return Array.from(seen.values());
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
                <div style={{ color: 'var(--muted)', fontSize: '.85rem' }}>No history yet.</div>
              )}
            </Card>
          </div>

          {/* ── Notification email + test send ── */}
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
              <Btn variant="outline" onClick={testSend} disabled={testingSend || !notifEmail}>
                {testingSend ? 'Sending…' : 'Test Send'}
              </Btn>
              {emailMsg && <span style={{ fontSize: '.8rem', color: emailMsg.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>{emailMsg.text}</span>}
              {testMsg && <span style={{ fontSize: '.8rem', color: testMsg.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>{testMsg.text}</span>}
            </div>
          </Card>

          {/* ── Category cards with checklist items ── */}
          {board.categories.map(cat => {
            const uniqueItems = getUniqueItems(cat.items);
            return (
              <Card key={cat.id} style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.75rem' }}>
                  <CardTitle style={{ margin: 0 }}>{cat.name}</CardTitle>
                  <button
                    onClick={() => deleteCategory(cat.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '.9rem' }}
                    title="Delete category"
                  >×</button>
                </div>

                {uniqueItems.map(item => (
                  <div key={item.id} style={{ marginBottom: '.75rem' }}>
                    {/* Item header with title + time pills + delete */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.3rem' }}>
                      <span style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--text)' }}>{item.title}</span>
                      {item.times && item.times.length > 0 && (
                        <div style={{ display: 'flex', gap: '.25rem', flexWrap: 'wrap' }}>
                          {item.times.map(t => (
                            <span key={t} style={{
                              fontSize: '.65rem', color: 'var(--accent)', background: 'rgba(249,115,22,.1)',
                              border: '1px solid rgba(249,115,22,.2)', borderRadius: 10, padding: '0 6px',
                            }}>{fmtTime(t)}</span>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={() => deleteItem(item.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '.75rem', opacity: 0.5, marginLeft: 'auto' }}
                      >×</button>
                    </div>
                    {/* Checkbox rows — one per time slot */}
                    {item.slots.map((slot, si) => (
                      <div
                        key={si}
                        onClick={() => toggleCheck(item.id, slot.time_slot, slot.checked)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.4rem .5rem .4rem 1.25rem',
                          borderBottom: '1px solid var(--border)', cursor: 'pointer',
                          opacity: slot.checked ? 0.5 : 1, transition: 'opacity .15s',
                        }}
                      >
                        <div style={{
                          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                          border: slot.checked ? 'none' : '2px solid var(--border2)',
                          background: slot.checked ? 'var(--success)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all .15s',
                        }}>
                          {slot.checked && <span style={{ color: '#fff', fontSize: '.6rem', fontWeight: 700 }}>✓</span>}
                        </div>
                        <span style={{
                          fontSize: '.82rem',
                          textDecoration: slot.checked ? 'line-through' : 'none',
                          color: slot.checked ? 'var(--muted)' : 'var(--text)',
                        }}>
                          {slot.time_slot ? fmtTime(slot.time_slot) : 'Daily'}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}

                {/* Add item */}
                {addingItem === cat.id ? (
                  <div style={{ marginTop: '.75rem', padding: '.75rem', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    <input
                      autoFocus
                      value={newItemTitle}
                      onChange={e => setNewItemTitle(e.target.value)}
                      placeholder="Task name…"
                      style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: '.5rem' }}
                    />

                    {/* Time slot picker */}
                    <div style={{ fontSize: '.75rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '.35rem' }}>
                      Schedule (times to complete)
                    </div>

                    {/* Presets */}
                    <div style={{ display: 'flex', gap: '.3rem', flexWrap: 'wrap', marginBottom: '.5rem' }}>
                      {TIME_PRESETS.map(p => (
                        <button key={p.label} onClick={() => setNewItemTimes(p.times)}
                          style={{
                            fontSize: '.7rem', padding: '.2rem .5rem', borderRadius: 12, cursor: 'pointer',
                            border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--muted)',
                          }}>{p.label}</button>
                      ))}
                    </div>

                    {/* Manual time input */}
                    <div style={{ display: 'flex', gap: '.35rem', alignItems: 'center', marginBottom: '.5rem' }}>
                      <input
                        type="time"
                        value={timeInput}
                        onChange={e => setTimeInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addTimeSlot()}
                        style={{ ...inputStyle, width: 120 }}
                      />
                      <button onClick={addTimeSlot}
                        style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--accent)', cursor: 'pointer', padding: '.3rem .6rem', fontSize: '.8rem' }}>
                        + Add time
                      </button>
                    </div>

                    {/* Selected times pills */}
                    {newItemTimes.length > 0 && (
                      <div style={{ display: 'flex', gap: '.3rem', flexWrap: 'wrap', marginBottom: '.6rem' }}>
                        {newItemTimes.map(t => (
                          <span key={t} style={{
                            fontSize: '.75rem', padding: '.15rem .5rem', borderRadius: 12,
                            background: 'rgba(249,115,22,.15)', color: 'var(--accent)',
                            border: '1px solid rgba(249,115,22,.3)', display: 'flex', alignItems: 'center', gap: '.25rem',
                          }}>
                            {fmtTime(t)}
                            <button onClick={() => removeTimeSlot(t)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '.7rem', padding: 0 }}>×</button>
                          </span>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '.4rem' }}>
                      <Btn onClick={() => addItem(cat.id)} disabled={!newItemTitle.trim()}>Add Task</Btn>
                      <Btn variant="outline" onClick={() => { setAddingItem(null); setNewItemTitle(''); setNewItemTimes([]); setTimeInput(''); }}>Cancel</Btn>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingItem(cat.id); setNewItemTitle(''); setNewItemTimes([]); setTimeInput(''); }}
                    style={{
                      display: 'block', width: '100%', marginTop: '.5rem', padding: '.4rem',
                      background: 'none', border: '1px dashed var(--border2)', borderRadius: 'var(--radius-sm)',
                      color: 'var(--muted)', cursor: 'pointer', fontSize: '.8rem', textAlign: 'center',
                    }}
                  >+ Add task</button>
                )}
              </Card>
            );
          })}

          {/* ── Add category ── */}
          <Card>
            <CardTitle>Add Category</CardTitle>
            <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
              <input
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCategory()}
                placeholder="Category name (e.g. Customer Support)"
                style={{ ...inputStyle, flex: 1 }}
              />
              <Btn onClick={addCategory} disabled={!newCatName.trim()}>Add</Btn>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
