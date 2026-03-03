import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../utils/auth.js';
import { fmt } from '../utils/format.js';
import { moneyInCategories, moneyOutCategories } from '../utils/constants.js';
import { S } from '../styles.js';
import Card, { CardTitle } from '../components/Card.jsx';
import Btn from '../components/Btn.jsx';
import Alert from '../components/Alert.jsx';

export default function Cashflow() {
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
  const [loading,     setLoading]     = useState(true);

  const loadMonths = useCallback(async () => {
    const res  = await authFetch('/cashflow/months');
    const data = await res.json();
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

    if (editRow) {
      const res  = await authFetch(`/cashflow/${encodeURIComponent(activeMonth)}/entries/${editRow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: date || editRow.date, type, amount: Number(amount), category, notes: notes.trim() })
      });
      const data = await res.json();
      if (data.rows) setRows(data.rows);
    } else {
      const today = new Date();
      const autoDate = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric' });
      const res  = await authFetch(`/cashflow/${encodeURIComponent(activeMonth)}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: Date.now(), date: autoDate, type, amount: Number(amount), category, notes: notes.trim() })
      });
      const data = await res.json();
      if (data.rows) setRows(data.rows);
    }
    reset();
    setOpen(false);
  };

  const deleteRow = async (row) => {
    const res  = await authFetch(`/cashflow/${encodeURIComponent(activeMonth)}/entries/${row.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.rows) setRows(data.rows);
  };

  const addMonth = async (month) => {
    const res  = await authFetch('/cashflow/months', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month })
    });
    const data = await res.json();
    if (data.months) setMonths(data.months);
    setActiveMonth(month);
  };

  const categories = type === 'in' ? moneyInCategories : moneyOutCategories;

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

      {!loading && rows.length > 0 && (() => {
        const totalIn  = rows.filter(r => r.type === 'in').reduce((s, r) => s + r.amount, 0);
        const totalOut = rows.filter(r => r.type === 'out').reduce((s, r) => s + r.amount, 0);
        const net = totalIn - totalOut;
        const cs = { flex: '1', minWidth: 150, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem 1.25rem', animation: 'fadeIn .3s ease' };
        const ls = { fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', fontWeight: 600 };
        return (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div style={cs}><div style={ls}>Total In</div><div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '.3rem', color: 'var(--success)' }}>EGP {fmt(totalIn)}</div></div>
            <div style={cs}><div style={ls}>Total Out</div><div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '.3rem', color: 'var(--danger)' }}>EGP {fmt(totalOut)}</div></div>
            <div style={cs}><div style={ls}>Net</div><div style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: '.3rem', color: net >= 0 ? 'var(--success)' : 'var(--danger)' }}>EGP {fmt(net)}</div></div>
          </div>
        );
      })()}

      {!loading && <Card>
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
                const allOrdered = [...rows].sort((a, b) => a.id - b.id);
                let running = 0;
                return allOrdered
                  .map(r => { running += (r.type === 'in' ? r.amount : -r.amount); return { ...r, running }; })
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
      </Card>}

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
                <label style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)' }}>Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  style={{ padding: '.55rem .7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)' }}>
                  <option value="">Select category</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
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
    </div>
  );
}
