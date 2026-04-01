import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/auth.js';
import { useDialog } from '../utils/useDialog.js';
import { fmt } from '../utils/format.js';
import { S } from '../styles.js';
import Card, { CardTitle } from '../components/Card.jsx';
import Btn from '../components/Btn.jsx';
import Alert from '../components/Alert.jsx';
import Dialog from '../components/Dialog.jsx';

export default function Cashflow() {
  const navigate = useNavigate();
  const defaultMonth = new Date().toLocaleString('en-GB', { month: 'short', year: 'numeric' });
  const [months,      setMonths]      = useState([]);
  const [activeMonth, setActiveMonth] = useState(defaultMonth);
  const [rows,        setRows]        = useState([]);
  const [newMonth,    setNewMonth]    = useState('');
  const [open,        setOpen]        = useState(false);
  const [date,        setDate]        = useState('');
  const [type,        setType]        = useState('in');
  const [amount,      setAmount]      = useState('');
  const [category,    setCategory]    = useState('');
  const [notes,       setNotes]       = useState('');
  const [error,       setError]       = useState('');
  const [confirmRow,  setConfirmRow]  = useState(null);
  const [editRow,     setEditRow]     = useState(null);
  const [search,      setSearch]      = useState('');
  const [durFilter,   setDurFilter]   = useState('all');
  const [loading,     setLoading]     = useState(true);
  const [allCats,     setAllCats]     = useState([]);

  // SMS suggestions
  const [suggestions,      setSuggestions]     = useState([]);
  const [showSuggestions,  setShowSuggestions] = useState(false);
  const [acceptingId,      setAcceptingId]     = useState(null);
  const [acceptForm,       setAcceptForm]      = useState({ month: '', category: '', notes: '', amount: '' });
  const [checkingPayouts,  setCheckingPayouts] = useState(false);
  const [wallet,           setWallet]          = useState({ balance: 0, history: [] });
  const [showWalletHistory, setShowWalletHistory] = useState(false);
  const { dialogProps, confirm, info } = useDialog();

  const loadMonths = useCallback(async () => {
    try {
      const res  = await authFetch('/cashflow/months');
      const data = await res.json();
      if (!Array.isArray(data)) return;
      if (data.length === 0) {
        await authFetch('/cashflow/months', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month: defaultMonth })
        });
        setMonths([defaultMonth]);
        setActiveMonth(defaultMonth);
        return;
      }
      setMonths(data);
      if (!data.includes(activeMonth)) setActiveMonth(data[data.length - 1]);
    } catch { /* ignore */ }
  }, [defaultMonth]);

  const loadRows = useCallback(async (month) => {
    if (!month) return;
    setLoading(true);
    const res  = await authFetch(`/cashflow/${encodeURIComponent(month)}`);
    const data = await res.json();
    setRows(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadMonths(); }, [loadMonths]);
  useEffect(() => { loadRows(activeMonth); }, [activeMonth, loadRows]);
  const loadWallet = useCallback(() => {
    authFetch('/cashflow/wallet').then(r => r.json()).then(d => { if (d.history !== undefined) setWallet(d); });
  }, []);

  useEffect(() => {
    authFetch('/categories').then(r => r.json()).then(data => { if (Array.isArray(data)) setAllCats(data); });
    authFetch('/cashflow/sms-suggestions').then(r => r.json()).then(data => { if (Array.isArray(data)) setSuggestions(data); }).catch(() => {});
    loadWallet();
  }, [loadWallet]);

  const dismissSuggestion = async (id) => {
    if (!await confirm('Dismiss Suggestion', 'It will be hidden but kept in records.')) return;
    setSuggestions(s => s.filter(x => x.id !== id));
    await authFetch(`/cashflow/sms-suggestions/${id}/dismiss`, { method: 'POST' });
  };

  const openAccept = (s) => {
    setAcceptingId(s.id);
    setAcceptForm({ month: activeMonth, category: s.category || '', notes: s.description || '', amount: String(s.amount) });
  };

  const checkBostaPayouts = async () => {
    setCheckingPayouts(true);
    try {
      const res  = await authFetch('/sms/check-bosta-payouts', { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        info('Check Failed', data.error);
      } else if (data.new > 0) {
        const updated = await authFetch('/cashflow/sms-suggestions').then(r => r.json());
        if (Array.isArray(updated)) { setSuggestions(updated); setShowSuggestions(true); }
      } else {
        const days = data.payout_days ?? 2;
        const matched = data.subject_matched ?? 0;
        const detail = data.emails_found > 0 && matched === 0
          ? `${data.emails_found} email${data.emails_found !== 1 ? 's' : ''} from no-reply@bosta.co found but none had a "Cashout" subject.`
          : `${data.emails_found} Bosta email${data.emails_found !== 1 ? 's' : ''} from the last ${days} day${days !== 1 ? 's' : ''} — none were new Cashout receipts.`;
        info('No New Payouts', detail);
      }
    } catch (e) {
      info('Error', e.message);
    } finally {
      setCheckingPayouts(false);
    }
  };

  const submitAccept = async () => {
    if (!acceptForm.month || !acceptForm.category) return;
    const res = await authFetch(`/cashflow/sms-suggestions/${acceptingId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        month:    acceptForm.month,
        category: acceptForm.category,
        notes:    acceptForm.notes,
        amount:   Number(acceptForm.amount),
      }),
    });
    if (res.ok) {
      setSuggestions(s => s.filter(x => x.id !== acceptingId));
      setAcceptingId(null);
      loadRows(activeMonth);
      loadWallet();
    }
  };

  const reset = () => {
    setDate(''); setType('in'); setAmount(''); setCategory(''); setNotes(''); setError('');
    setEditRow(null);
  };

  const openEdit = (r) => {
    setEditRow(r);
    setDate(r.date);
    setType(r.type);
    setAmount(String(r.amount));
    setCategory(r.category);
    setNotes(r.notes || '');
    setError('');
    setOpen(true);
  };

  const submit = async () => {
    if (!amount || Number(amount) <= 0) return setError('Amount must be greater than zero.');
    if (!category) return setError('Category is required.');

    try {
      let res, data;
      if (editRow) {
        res  = await authFetch(`/cashflow/${encodeURIComponent(activeMonth)}/entries/${editRow.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: date || editRow.date, type, amount: Number(amount), category, notes: notes.trim() })
        });
      } else {
        const today = new Date();
        const autoDate = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric' });
        res  = await authFetch(`/cashflow/${encodeURIComponent(activeMonth)}/entries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: Date.now(), date: autoDate, type, amount: Number(amount), category, notes: notes.trim() })
        });
      }
      data = await res.json();
      if (!res.ok) return setError(data.detail || 'Failed to save entry.');
      if (data.rows) setRows(data.rows);
      loadWallet();
      reset();
      setOpen(false);
    } catch {
      setError('Network error — please try again.');
    }
  };

  const deleteRow = async (row) => {
    try {
      const res  = await authFetch(`/cashflow/${encodeURIComponent(activeMonth)}/entries/${row.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.rows) setRows(data.rows);
      loadWallet();
    } catch { /* ignore */ }
  };

  const addMonth = async (month) => {
    const res  = await authFetch('/cashflow/months', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month })
    });
    const data = await res.json();
    if (data.months) setMonths(data.months);
    loadWallet();
    setActiveMonth(month);
  };

  const categories = allCats.filter(c => c.type === type).map(c => c.name);

  const thStyle = {
    padding: '.7rem .85rem',
    fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.06em',
    color: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)'
  };
  const tdStyle = {
    padding: '.7rem .85rem', borderBottom: '1px solid var(--border)', fontSize: '.9rem'
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '.75rem' }}>
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={activeMonth}
            onChange={e => setActiveMonth(e.target.value)}
            style={{ padding: '.5rem .7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)' }}
          >
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input
            value={newMonth}
            onChange={e => setNewMonth(e.target.value)}
            placeholder="New month (e.g. Feb 2026)"
            style={{ padding: '.5rem .7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)' }}
          />
          <Btn variant="outline" onClick={() => { if (!newMonth.trim()) return; addMonth(newMonth.trim()); setNewMonth(''); }}>Add Month</Btn>
          <Btn onClick={() => setOpen(true)}>+ New Entry</Btn>
        </div>
      </div>

      {loading && <Alert type="loading">Loading cashflow…</Alert>}

      {/* ── SMS / Bosta Suggestions panel ── */}
      <div style={{ marginBottom: '1rem' }}>
        {/* Check Bosta Payouts button — always visible for admin */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: suggestions.length > 0 ? '.5rem' : 0 }}>
          <button
            onClick={checkBostaPayouts}
            disabled={checkingPayouts}
            style={{ background: 'transparent', border: '1px solid var(--border2)', color: 'var(--muted)', borderRadius: 'var(--radius-sm)', padding: '.3rem .75rem', cursor: 'pointer', fontSize: '.8rem' }}
          >
            {checkingPayouts ? 'Checking…' : '📧 Check Bosta Payouts'}
          </button>
        </div>

        {suggestions.length > 0 && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <button
              onClick={() => setShowSuggestions(v => !v)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.65rem 1rem', background: 'var(--surface)', border: 'none', cursor: 'pointer', color: 'var(--text)' }}
            >
              <span style={{ fontSize: '.88rem', fontWeight: 600 }}>
                💳 {suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''}
              </span>
              <span style={{ fontSize: '.8rem', color: 'var(--muted)' }}>{showSuggestions ? '▲ Hide' : '▼ Show'}</span>
            </button>

            {showSuggestions && (
              <div style={{ borderTop: '1px solid var(--border)' }}>
                {suggestions.map(s => {
                  const amountColor = s.type === 'in' ? 'var(--success)' : 'var(--danger)';
                  return (
                    <div key={s.id} style={{ padding: '.75rem 1rem', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                      {acceptingId === s.id ? (
                        /* Accept form */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <strong style={{ color: amountColor }}>EGP {s.amount.toLocaleString()}</strong>
                            <span style={{ color: 'var(--muted)', fontSize: '.85rem' }}>{s.description}</span>
                            {s.category && <span style={{ fontSize: '.78rem', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 4, padding: '1px 6px', color: 'var(--accent)' }}>{s.category}</span>}
                          </div>
                          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                            <select
                              value={acceptForm.month}
                              onChange={e => setAcceptForm(f => ({ ...f, month: e.target.value }))}
                              style={{ padding: '.4rem .6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', fontSize: '.85rem' }}
                            >
                              <option value="">Month…</option>
                              {months.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            {/* Only show category dropdown for non-pre-assigned suggestions */}
                            {!s.category && (
                              <select
                                value={acceptForm.category}
                                onChange={e => setAcceptForm(f => ({ ...f, category: e.target.value }))}
                                style={{ padding: '.4rem .6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', fontSize: '.85rem' }}
                              >
                                <option value="">Category…</option>
                                {allCats.filter(c => c.type === s.type).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                              </select>
                            )}
                            <input
                              type="number"
                              value={acceptForm.amount}
                              onChange={e => setAcceptForm(f => ({ ...f, amount: e.target.value }))}
                              style={{ width: 90, padding: '.4rem .6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', fontSize: '.85rem' }}
                            />
                            <input
                              value={acceptForm.notes}
                              onChange={e => setAcceptForm(f => ({ ...f, notes: e.target.value }))}
                              placeholder="Notes…"
                              style={{ flex: 1, minWidth: 100, padding: '.4rem .6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', fontSize: '.85rem' }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '.4rem' }}>
                            <Btn onClick={submitAccept} disabled={!acceptForm.month || (!s.category && !acceptForm.category)}>Confirm</Btn>
                            <Btn variant="outline" onClick={() => setAcceptingId(null)}>Cancel</Btn>
                          </div>
                        </div>
                      ) : (
                        /* Summary row */
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.5rem' }}>
                          <div>
                            <span style={{ fontWeight: 600, color: amountColor, marginRight: '.5rem' }}>EGP {s.amount.toLocaleString()}</span>
                            <span style={{ fontSize: '.88rem', color: 'var(--text)' }}>{s.description}</span>
                            <span style={{ fontSize: '.78rem', color: 'var(--muted)', marginLeft: '.5rem' }}>
                              {s.tx_date ? new Date(s.tx_date).toLocaleString('en-EG', { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '.4rem' }}>
                            <Btn onClick={() => openAccept(s)}>Accept</Btn>
                            <button
                              onClick={() => dismissSuggestion(s.id)}
                              style={{ background: 'transparent', border: '1px solid var(--border2)', color: 'var(--muted)', borderRadius: 'var(--radius-sm)', padding: '.3rem .6rem', cursor: 'pointer', fontSize: '.85rem' }}
                              title="Dismiss"
                            >✕</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {!loading && rows.length > 0 && (() => {
        // Compute rows with running balance (chronological), then apply duration filter
        const allOrdered = [...rows].sort((a, b) => a.id - b.id);
        let running = 0;
        const withBalance = allOrdered.map(r => {
          running += r.type === 'in' ? r.amount : -r.amount;
          return { ...r, running };
        });
        const durRows = (() => {
          if (durFilter === 'all') return withBalance;
          const days = durFilter === '7d' ? 7 : durFilter === '14d' ? 14 : 30;
          const cutoff = new Date(Date.now() - days * 86400000);
          const yr = parseInt(activeMonth.split(' ')[1]);
          return withBalance.filter(r => {
            const [d, m] = r.date.split('/').map(Number);
            return new Date(yr, m - 1, d) >= cutoff;
          });
        })();

        const totalIn  = durRows.filter(r => r.type === 'in').reduce((s, r) => s + r.amount, 0);
        const totalOut = durRows.filter(r => r.type === 'out').reduce((s, r) => s + r.amount, 0);
        const net = totalIn - totalOut;
        const cs = { flex: '1', minWidth: 150, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem 1.25rem', animation: 'fadeIn .3s ease' };
        const ls = { fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', fontWeight: 600 };
        const durBtnStyle = (key) => ({
          padding: '.35rem .75rem', fontSize: '.78rem', fontWeight: 500, cursor: 'pointer',
          borderRadius: 'var(--radius-sm)', border: '1px solid',
          borderColor: durFilter === key ? 'var(--accent)' : 'var(--border)',
          background:  durFilter === key ? 'var(--accent)' : 'none',
          color:       durFilter === key ? '#fff' : 'var(--muted)',
          transition: 'all .12s',
        });
        return (
          <>
            {/* Duration filter */}
            <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginBottom: '.75rem' }}>
              {[['all','All'],['7d','Last 7 days'],['14d','Last 14 days'],['30d','Last 30 days']].map(([key, label]) => (
                <button key={key} style={durBtnStyle(key)} onClick={() => setDurFilter(key)}>{label}</button>
              ))}
            </div>
            {/* Summary cards */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <div style={cs}><div style={ls}>Total In</div><div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '.3rem', color: 'var(--success)' }}>EGP {fmt(totalIn)}</div></div>
              <div style={cs}><div style={ls}>Total Out</div><div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '.3rem', color: 'var(--danger)' }}>EGP {fmt(totalOut)}</div></div>
              <div style={cs}><div style={ls}>Net</div><div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '.3rem', color: net >= 0 ? 'var(--success)' : 'var(--danger)' }}>EGP {fmt(net)}</div></div>
              <div style={{ ...cs, borderTop: '3px solid var(--accent)' }}>
                <div style={ls}>Master Wallet</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '.3rem', color: wallet.balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>EGP {fmt(wallet.balance)}</div>
                <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: '.2rem' }}>Live balance across all months</div>
                {wallet.history.length > 0 && (
                  <button onClick={() => setShowWalletHistory(true)} style={{ marginTop: '.4rem', fontSize: '.78rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    View history →
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <Card>
              <CardTitle>Cashflow Table</CardTitle>
              <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem', alignItems: 'center' }}>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by category or notes…"
                  style={{ flex: 1, padding: '.5rem .8rem', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '.875rem', outline: 'none' }}
                />
                {search && (
                  <button onClick={() => setSearch('')} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--muted)', padding: '.45rem .75rem', fontSize: '.82rem', cursor: 'pointer' }}>Clear</button>
                )}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Date</th>
                      <th style={thStyle}>Money In</th>
                      <th style={thStyle}>Money Out</th>
                      <th style={thStyle}>Reason</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Balance</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const q = search.toLowerCase().trim();
                      // Newest first; balance already computed chronologically above
                      return [...durRows]
                        .reverse()
                        .filter(r => !q || r.category.toLowerCase().includes(q) || (r.notes || '').toLowerCase().includes(q))
                        .map(r => (
                    <tr key={r.id}>
                      <td style={tdStyle}>{r.date}</td>
                      <td style={{ ...tdStyle, color: r.type === 'in' ? 'var(--success)' : 'var(--muted)' }}>
                        {r.type === 'in' ? `EGP ${fmt(r.amount)}` : ''}
                      </td>
                      <td style={{ ...tdStyle, color: r.type === 'out' ? 'var(--danger)' : 'var(--muted)' }}>
                        {r.type === 'out' ? `EGP ${fmt(r.amount)}` : ''}
                      </td>
                      <td style={tdStyle}>
                        {r.notes || r.category}
                        {r.notes && r.category && <span style={{ color: 'var(--muted)' }}> · {r.category}</span>}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', ...S.mono, color: r.running >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        EGP {fmt(r.running)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '.35rem' }}>
                          <button onClick={() => openEdit(r)} style={{ background: 'transparent', border: '1px solid var(--border2)', color: 'var(--muted)', width: 28, height: 28, borderRadius: 6, cursor: 'pointer', fontSize: '.85rem' }} title="Edit entry">✎</button>
                          <button onClick={() => setConfirmRow(r)} style={{ background: 'transparent', border: '1px solid var(--border2)', color: 'var(--muted)', width: 28, height: 28, borderRadius: 6, cursor: 'pointer', fontSize: '1rem' }} title="Delete entry">×</button>
                        </div>
                      </td>
                    </tr>
                        ));
                    })()}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        );
      })()}

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'grid', placeItems: 'center', zIndex: 200 }}>
          <div style={{ width: 'min(560px, 92vw)', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: '1.4rem', boxShadow: '0 20px 60px rgba(0,0,0,.6)', animation: 'riseIn .2s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{editRow ? 'Edit Cashflow Entry' : 'New Cashflow Entry'}</div>
                <div style={{ color: 'var(--muted)', fontSize: '.82rem' }}>Money in or money out</div>
              </div>
              <button onClick={() => { reset(); setOpen(false); }} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: '1.3rem', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'grid', gap: '.75rem' }}>
              <div style={{ display: 'grid', gap: '.4rem' }}>
                <label style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)' }}>Type</label>
                <div style={{ display: 'flex', gap: '.5rem' }}>
                  <Btn variant={type === 'in' ? 'primary' : 'outline'} onClick={() => setType('in')}>Money In</Btn>
                  <Btn variant={type === 'out' ? 'primary' : 'outline'} onClick={() => setType('out')}>Money Out</Btn>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '.4rem' }}>
                <label style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)' }}>Amount (EGP)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
                  style={{ padding: '.55rem .7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)' }} />
              </div>

              <div style={{ display: 'grid', gap: '.4rem' }}>
                <label style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)' }}>
                  Category
                  {categories.length === 0 && (
                    <span style={{ marginLeft: '.4rem', color: 'var(--muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                      — <span onClick={() => { reset(); setOpen(false); navigate('/categories'); }} style={{ color: 'var(--accent)', cursor: 'pointer' }}>set up categories</span> or type one below
                    </span>
                  )}
                </label>
                {categories.length > 0 ? (
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    style={{ padding: '.55rem .7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)' }}>
                    <option value="">Select category</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <input value={category} onChange={e => setCategory(e.target.value)}
                    placeholder={type === 'in' ? 'e.g. Kashier, Bosta, Instapay…' : 'e.g. Ads, Salary...'}
                    style={{ padding: '.55rem .7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)' }} />
                )}
              </div>

              <div style={{ display: 'grid', gap: '.4rem' }}>
                <label style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)' }}>Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reason or details" rows={3}
                  style={{ padding: '.55rem .7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)', resize: 'vertical' }} />
              </div>
            </div>

            {error && <Alert type="error">{error}</Alert>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', marginTop: '1rem' }}>
              <Btn variant="outline" onClick={() => { reset(); setOpen(false); }}>Cancel</Btn>
              <Btn onClick={submit}>{editRow ? 'Save Changes' : 'Add Entry'}</Btn>
            </div>
          </div>
        </div>
      )}

      {confirmRow && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'grid', placeItems: 'center', zIndex: 220 }}>
          <div style={{ width: 'min(440px, 92vw)', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: '1.4rem', boxShadow: '0 20px 60px rgba(0,0,0,.6)', animation: 'riseIn .2s ease' }}>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Delete transaction?</div>
            <div style={{ color: 'var(--muted)', fontSize: '.85rem', marginTop: '.4rem' }}>
              Are you sure you want to delete this transaction?
            </div>
            <div style={{ marginTop: '.8rem', fontSize: '.9rem' }}>
              <div><strong>Date:</strong> {confirmRow.date}</div>
              <div><strong>Type:</strong> {confirmRow.type === 'in' ? 'Money In' : 'Money Out'}</div>
              <div><strong>Amount:</strong> EGP {fmt(confirmRow.amount)}</div>
              <div><strong>Category:</strong> {confirmRow.category}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem', marginTop: '1rem' }}>
              <Btn variant="outline" onClick={() => setConfirmRow(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={() => { deleteRow(confirmRow); setConfirmRow(null); }}>Delete</Btn>
            </div>
          </div>
        </div>
      )}

      <Dialog {...dialogProps} />

      {/* ── Wallet History Modal ── */}
      {showWalletHistory && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
          onMouseDown={e => { if (e.target === e.currentTarget) setShowWalletHistory(false); }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)', padding: '1.75rem', maxWidth: 520, width: '95%', boxShadow: '0 8px 32px rgba(0,0,0,.45)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 1.25rem', color: 'var(--text)', fontSize: '1.05rem', fontWeight: 600 }}>Master Wallet History</h3>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border2)' }}>
                    <th style={{ textAlign: 'left', padding: '.5rem .75rem', color: 'var(--muted)', fontWeight: 600 }}>Month</th>
                    <th style={{ textAlign: 'right', padding: '.5rem .75rem', color: 'var(--muted)', fontWeight: 600 }}>Net</th>
                    <th style={{ textAlign: 'right', padding: '.5rem .75rem', color: 'var(--muted)', fontWeight: 600 }}>Balance After</th>
                  </tr>
                </thead>
                <tbody>
                  {wallet.history.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '.55rem .75rem', color: 'var(--text)' }}>{row.month_name}</td>
                      <td style={{ padding: '.55rem .75rem', textAlign: 'right', color: row.month_net >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                        {row.month_net >= 0 ? '+' : ''}EGP {fmt(row.month_net)}
                      </td>
                      <td style={{ padding: '.55rem .75rem', textAlign: 'right', color: row.balance_after >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        EGP {fmt(row.balance_after)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <Btn onClick={() => setShowWalletHistory(false)}>Close</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
