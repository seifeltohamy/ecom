import { useState } from 'react';
import { S } from '../../styles.js';
import { actColor } from './todoHelpers.jsx';

export default function ActivitiesPanel({ activities, onAdd, onRename, onDelete }) {
  const [newName, setNewName]   = useState('');
  const [editId, setEditId]     = useState(null);
  const [editName, setEditName] = useState('');
  const [adding, setAdding]     = useState(false);

  async function handleAdd() {
    if (!newName.trim()) return;
    setAdding(true);
    await onAdd(newName.trim());
    setNewName('');
    setAdding(false);
  }
  async function handleRename(id) {
    if (!editName.trim()) return;
    await onRename(id, editName.trim());
    setEditId(null);
  }

  return (
    <div style={{ ...S.card, marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
      <div style={{ ...S.cardTitle }}>Manage Activities</div>
      {activities.length === 0 && <p style={{ fontSize: '.85rem', color: 'var(--muted)', margin: 0 }}>No activities yet. Add one below.</p>}
      {activities.map(a => {
        const c = actColor(a.id);
        return (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <span style={{ background: c.bg, color: c.text, borderRadius: 4, padding: '2px 8px', fontSize: '.75rem', fontWeight: 600, flex: 1 }}>
              {editId === a.id
                ? <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(a.id); if (e.key === 'Escape') setEditId(null); }}
                    style={{ background: 'transparent', border: 'none', outline: 'none', color: c.text, fontWeight: 600, fontSize: '.75rem', width: '100%' }} />
                : a.name}
            </span>
            {editId === a.id
              ? <>
                  <button onClick={() => handleRename(a.id)} style={{ ...S.btnBase, ...S.btnPrimary, padding: '2px 8px', fontSize: '.75rem' }}>Save</button>
                  <button onClick={() => setEditId(null)} style={{ ...S.btnBase, ...S.btnOutline, padding: '2px 8px', fontSize: '.75rem' }}>Cancel</button>
                </>
              : <>
                  <button onClick={() => { setEditId(a.id); setEditName(a.name); }} title="Rename"
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '.85rem', padding: '2px 4px' }}>✎</button>
                  <button onClick={() => onDelete(a.id)} title="Delete"
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '.85rem', padding: '2px 4px' }}>✕</button>
                </>}
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: '.5rem' }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder="New activity name…"
          style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '.4rem .75rem', fontSize: '.85rem', outline: 'none' }} />
        <button onClick={handleAdd} disabled={!newName.trim() || adding}
          style={{ ...S.btnBase, ...S.btnPrimary, ...(!newName.trim() || adding ? S.btnDisabled : {}) }}>+ Add</button>
      </div>
    </div>
  );
}
