import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../utils/auth.js';
import Card, { CardTitle } from '../components/Card.jsx';
import Btn from '../components/Btn.jsx';
import Alert from '../components/Alert.jsx';
import Spinner from '../components/Spinner.jsx';

const DEFAULTS = {
  in:  ['Kashier', 'Bosta', 'Instapay'],
  out: [],
};

// ─── Single editable category item ───────────────────────────────────────────
function CategoryItem({ cat, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(cat.name);
  const [busy,    setBusy]    = useState(false);

  async function save() {
    const name = draft.trim();
    if (!name || name === cat.name) { setEditing(false); setDraft(cat.name); return; }
    setBusy(true);
    await onRename(cat.id, cat.type, name);
    setBusy(false);
    setEditing(false);
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '.5rem',
      padding: '.45rem .65rem',
      borderRadius: 'var(--radius-sm)',
      background: 'var(--surface2, #1c1917)',
      border: '1px solid var(--border)',
    }}>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); setDraft(cat.name); } }}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text)', fontSize: '.9rem', fontFamily: 'inherit',
          }}
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          title="Click to rename"
          style={{ flex: 1, fontSize: '.9rem', cursor: 'text', color: 'var(--text)' }}
        >
          {cat.name}
        </span>
      )}
      {busy
        ? <Spinner size={13} />
        : (
          <button
            onClick={() => onDelete(cat.id)}
            title="Delete"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', fontSize: '1rem', lineHeight: 1,
              padding: '0 2px', borderRadius: 3,
              transition: 'color .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--danger, #ef4444)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
          >
            ×
          </button>
        )
      }
    </div>
  );
}

// ─── Column for one type (in / out) ──────────────────────────────────────────
function CategoryColumn({ type, label, accent, categories, onAdd, onRename, onDelete }) {
  const [newName, setNewName] = useState('');
  const [adding,  setAdding]  = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    await onAdd(type, name);
    setNewName('');
    setAdding(false);
  }

  async function handleLoadDefaults() {
    setAdding(true);
    for (const name of DEFAULTS[type]) {
      await onAdd(type, name);
    }
    setAdding(false);
  }

  const list = categories.filter(c => c.type === type);

  return (
    <div style={{ flex: 1, minWidth: 260 }}>
      {/* Column header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '.5rem',
        marginBottom: '1rem',
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: accent, flexShrink: 0,
        }} />
        <span style={{ fontWeight: 700, fontSize: '.85rem', textTransform: 'uppercase', letterSpacing: '.07em', color: accent }}>
          {label}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '.78rem', color: 'var(--muted)' }}>
          {list.length} {list.length === 1 ? 'category' : 'categories'}
        </span>
      </div>

      {/* Category list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem', marginBottom: '1rem' }}>
        {list.length === 0 && (
          <>
            <div style={{ fontSize: '.85rem', color: 'var(--muted)', padding: '.5rem .65rem' }}>
              No categories yet — add one below.
            </div>
            {DEFAULTS[type].length > 0 && (
              <Btn onClick={handleLoadDefaults} disabled={adding}>Load defaults</Btn>
            )}
          </>
        )}
        {list.map(cat => (
          <CategoryItem key={cat.id} cat={cat} onRename={onRename} onDelete={onDelete} />
        ))}
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: '.5rem' }}>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder={`Add ${label.toLowerCase()} category…`}
          style={{
            flex: 1, background: 'var(--surface2, #1c1917)',
            color: 'var(--text)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '.4rem .65rem',
            fontSize: '.9rem', fontFamily: 'inherit', outline: 'none',
          }}
          onFocus={e => e.currentTarget.style.borderColor = accent}
          onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
        />
        <Btn type="submit" disabled={adding || !newName.trim()}>
          {adding ? <Spinner size={13} /> : 'Add'}
        </Btn>
      </form>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await authFetch('/categories');
      const data = await res.json();
      if (res.ok) setCategories(data);
      else setError(data.detail || 'Failed to load categories');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (type, name) => {
    const res  = await authFetch('/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, name }),
    });
    const data = await res.json();
    if (res.ok) setCategories(prev => [...prev, data]);
    else if (res.status === 409) {/* silently ignore duplicate */}
  };

  const handleRename = async (id, type, name) => {
    const res  = await authFetch(`/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, name }),
    });
    const data = await res.json();
    if (res.ok) setCategories(prev => prev.map(c => c.id === id ? data : c));
  };

  const handleDelete = async (id) => {
    const res = await authFetch(`/categories/${id}`, { method: 'DELETE' });
    if (res.ok) setCategories(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div>
      <Card>
        <CardTitle>Cashflow Categories</CardTitle>
        <p style={{ margin: '-.25rem 0 1.5rem', fontSize: '.875rem', color: 'var(--muted)' }}>
          Define the categories available when logging cashflow entries. Each brand has its own lists.
          Click a category name to rename it.
        </p>

        {loading && <Alert type="loading">Loading…</Alert>}
        {error   && <Alert type="error">{error}</Alert>}

        {!loading && !error && (
          <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <CategoryColumn
              type="in"
              label="Money In"
              accent="var(--accent)"
              categories={categories}
              onAdd={handleAdd}
              onRename={handleRename}
              onDelete={handleDelete}
            />
            {/* Divider */}
            <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', flexShrink: 0 }} />
            <CategoryColumn
              type="out"
              label="Money Out"
              accent="var(--danger, #ef4444)"
              categories={categories}
              onAdd={handleAdd}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
