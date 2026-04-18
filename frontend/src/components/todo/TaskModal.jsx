import { useState } from 'react';
import { S } from '../../styles.js';

export default function TaskModal({ task, activities, prefillActivityId, onClose, onSave, onDelete }) {
  const [title, setTitle]           = useState(task?.title || '');
  const [deadline, setDeadline]     = useState(task?.deadline || '');
  const [notes, setNotes]           = useState(task?.notes || '');
  const [activityId, setActivityId] = useState(task?.activity_id ?? prefillActivityId ?? '');
  const [saving, setSaving]         = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    await onSave({
      title: title.trim(),
      deadline: deadline || null,
      notes: notes || null,
      activity_id: activityId ? parseInt(activityId) : null,
      done: task?.done ?? false,
    });
    setSaving(false);
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ ...S.card, width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>{task ? 'Edit Task' : 'Add Task'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>

        {[
          { label: 'Title *', node: (
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} placeholder="Task title"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '.5rem .75rem', fontSize: '.9rem', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
          )},
          { label: 'Activity', node: (
            <select value={activityId} onChange={e => setActivityId(e.target.value)}
              style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '.5rem .75rem', fontSize: '.9rem', outline: 'none', width: '100%' }}>
              <option value="">— None —</option>
              {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )},
          { label: 'Deadline', node: (
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
              style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '.5rem .75rem', fontSize: '.9rem', outline: 'none', colorScheme: 'dark', width: '100%', boxSizing: 'border-box' }} />
          )},
          { label: 'Notes', node: (
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Optional notes…"
              style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '.5rem .75rem', fontSize: '.9rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }} />
          )},
        ].map(({ label, node }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
            <label style={{ fontSize: '.8rem', color: 'var(--muted)' }}>{label}</label>
            {node}
          </div>
        ))}

        <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
          {task && <button onClick={onDelete} style={{ ...S.btnBase, ...S.btnDanger, marginRight: 'auto' }}>Delete</button>}
          <button onClick={onClose} style={{ ...S.btnBase, ...S.btnOutline }}>Cancel</button>
          <button onClick={handleSave} disabled={!title.trim() || saving}
            style={{ ...S.btnBase, ...S.btnPrimary, ...((!title.trim() || saving) ? S.btnDisabled : {}) }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
