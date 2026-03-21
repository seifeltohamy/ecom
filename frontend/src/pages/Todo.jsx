import { useState, useEffect } from 'react';
import { authFetch } from '../utils/auth.js';
import { S } from '../styles.js';
import Alert from '../components/Alert.jsx';

// Activity pill colour palette — cycles by activity id, CSS vars only
const ACT_COLORS = [
  { bg: 'rgba(249,115,22,0.15)', text: 'var(--accent)' },
  { bg: 'rgba(34,197,94,0.15)',  text: 'var(--success)' },
  { bg: 'rgba(96,165,250,0.15)', text: '#60a5fa' },
  { bg: 'rgba(168,85,247,0.15)', text: '#c084fc' },
  { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24' },
];

function actColor(id) {
  return ACT_COLORS[(id - 1) % ACT_COLORS.length];
}

function deadlineBadge(deadline) {
  if (!deadline) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(deadline + 'T00:00:00');
  if (isNaN(due.getTime())) return null;
  const diff = Math.round((due - today) / 86400000);
  let color = 'var(--muted)';
  if (diff < 0) color = 'var(--danger)';
  else if (diff <= 7) color = 'var(--accent)';
  const label = diff < 0 ? `${Math.abs(diff)}d overdue` : diff === 0 ? 'Today' : `${diff}d left`;
  return <span style={{ fontSize: '.7rem', color, fontWeight: 600 }}>{label}</span>;
}

// ── Task Modal ────────────────────────────────────────────────────────────────
function TaskModal({ task, activities, onClose, onSave, onDelete }) {
  const [title, setTitle]           = useState(task?.title || '');
  const [deadline, setDeadline]     = useState(task?.deadline || '');
  const [notes, setNotes]           = useState(task?.notes || '');
  const [activityId, setActivityId] = useState(task?.activity_id ?? '');
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
          {task && <button onClick={() => { if (window.confirm('Delete this task?')) onDelete(); }} style={{ ...S.btnBase, ...S.btnDanger, marginRight: 'auto' }}>Delete</button>}
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

// ── Activities Panel ──────────────────────────────────────────────────────────
function ActivitiesPanel({ activities, onAdd, onRename, onDelete }) {
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
                  <button onClick={() => { if (window.confirm(`Delete activity "${a.name}"? Tasks tagged with it will keep their data.`)) onDelete(a.id); }} title="Delete"
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

// ── Task Card (shared across both views) ──────────────────────────────────────
function TaskCard({ task, isDone, onToggleDone, onEdit, onDragStart, onDragEnd }) {
  const c = task.activity_id ? actColor(task.activity_id) : null;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onEdit(task)}
      style={{
        background: 'var(--surface2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', padding: '.6rem .75rem',
        cursor: 'grab', display: 'flex', gap: '.6rem', alignItems: 'flex-start',
        opacity: isDone ? 0.55 : 1, transition: 'border-color .15s, opacity .15s',
        userSelect: 'none',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {/* Checkbox circle */}
      <button
        onMouseDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onToggleDone(task); }}
        title={isDone ? 'Mark as active' : 'Mark as done'}
        style={{
          flexShrink: 0, width: 18, height: 18, marginTop: 2,
          borderRadius: '50%',
          border: `2px solid ${isDone ? 'var(--success)' : 'var(--border2)'}`,
          background: isDone ? 'var(--success)' : 'transparent',
          color: isDone ? '#0c0a09' : 'transparent',
          fontSize: '.65rem', fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0, transition: 'all .15s',
        }}
      >{isDone ? '✓' : ''}</button>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
        {task.activity_name && c && (
          <span style={{ alignSelf: 'flex-start', background: c.bg, color: c.text, borderRadius: 4, padding: '1px 7px', fontSize: '.7rem', fontWeight: 600 }}>
            {task.activity_name}
          </span>
        )}
        <span style={{ fontSize: '.88rem', fontWeight: 600, color: 'var(--text)', textDecoration: isDone ? 'line-through' : 'none' }}>
          {task.title}
        </span>
        {task.deadline && deadlineBadge(task.deadline)}
        {task.notes && (
          <span style={{ fontSize: '.75rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.notes}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Todo() {
  const [columns, setColumns]           = useState([]);
  const [activities, setActivities]     = useState([]);
  const [viewMode, setViewMode]         = useState('kanban');   // 'kanban' | 'activity'
  const [activeFilter, setActiveFilter] = useState(null);       // kanban filter
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [editTask, setEditTask]         = useState(null);        // { isNew, columnId, task? }
  const [showActPanel, setShowActPanel] = useState(false);
  const [newColName, setNewColName]     = useState('');
  const [addingCol, setAddingCol]       = useState(false);
  const [renamingCol, setRenamingCol]   = useState(null);
  const [renameColVal, setRenameColVal] = useState('');
  const [showDone, setShowDone]         = useState({});          // { [colId]: bool }
  const [dragOverCol, setDragOverCol]   = useState(null);       // colId being hovered

  function loadBoard(data) {
    setColumns(data.columns);
    setActivities(data.activities);
  }

  useEffect(() => {
    authFetch('/todo')
      .then(r => r.json())
      .then(data => { loadBoard(data); setLoading(false); })
      .catch(() => { setError('Failed to load board.'); setLoading(false); });
  }, []);

  async function apiCall(url, method, body) {
    const res = await authFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Request failed');
    }
    return res.json();
  }

  // Drag-and-drop — move task to a different column
  async function handleDrop(taskId, targetColId) {
    const task = columns.flatMap(c => c.tasks).find(t => t.id === taskId);
    if (!task || task.column_id === targetColId) return;
    try {
      loadBoard(await apiCall(`/todo/tasks/${taskId}`, 'PUT', {
        title: task.title, deadline: task.deadline, notes: task.notes,
        activity_id: task.activity_id, done: task.done,
        column_id: targetColId,
      }));
    } catch (e) { alert(e.message); }
  }

  function dropZoneProps(colId) {
    return {
      onDragOver: e => { e.preventDefault(); setDragOverCol(colId); },
      onDragLeave: () => setDragOverCol(null),
      onDrop: e => {
        e.preventDefault();
        setDragOverCol(null);
        const taskId = parseInt(e.dataTransfer.getData('taskId'));
        if (taskId) handleDrop(taskId, colId);
      },
    };
  }

  function taskDragProps(task) {
    return {
      onDragStart: e => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('taskId', String(task.id));
      },
      onDragEnd: () => setDragOverCol(null),
    };
  }

  // Activities
  async function handleAddActivity(name) {
    try { loadBoard(await apiCall('/todo/activities', 'POST', { name })); }
    catch (e) { alert(e.message); }
  }
  async function handleRenameActivity(id, name) {
    try { loadBoard(await apiCall(`/todo/activities/${id}`, 'PUT', { name })); }
    catch (e) { alert(e.message); }
  }
  async function handleDeleteActivity(id) {
    try {
      loadBoard(await apiCall(`/todo/activities/${id}`, 'DELETE'));
      if (activeFilter === id) setActiveFilter(null);
    } catch (e) { alert(e.message); }
  }

  // Columns
  async function handleAddCol() {
    if (!newColName.trim()) return;
    try {
      loadBoard(await apiCall('/todo/columns', 'POST', { name: newColName.trim() }));
      setNewColName(''); setAddingCol(false);
    } catch (e) { alert(e.message); }
  }
  async function handleRenameCol(id) {
    if (!renameColVal.trim()) return;
    try {
      loadBoard(await apiCall(`/todo/columns/${id}`, 'PUT', { name: renameColVal.trim() }));
      setRenamingCol(null);
    } catch (e) { alert(e.message); }
  }
  async function handleDeleteCol(id, name) {
    if (!window.confirm(`Delete "${name}" and all their tasks?`)) return;
    try { loadBoard(await apiCall(`/todo/columns/${id}`, 'DELETE')); }
    catch (e) { alert(e.message); }
  }

  // Tasks
  async function handleSaveTask({ title, deadline, notes, activity_id, done }) {
    try {
      if (editTask.isNew) {
        loadBoard(await apiCall(`/todo/columns/${editTask.columnId}/tasks`, 'POST', { title, deadline, notes, activity_id }));
      } else {
        loadBoard(await apiCall(`/todo/tasks/${editTask.task.id}`, 'PUT', { title, deadline, notes, activity_id, done }));
      }
      setEditTask(null);
    } catch (e) { alert(e.message); }
  }
  async function handleDeleteTask() {
    try {
      loadBoard(await apiCall(`/todo/tasks/${editTask.task.id}`, 'DELETE'));
      setEditTask(null);
    } catch (e) { alert(e.message); }
  }
  async function handleToggleDone(task) {
    try {
      loadBoard(await apiCall(`/todo/tasks/${task.id}`, 'PUT', {
        title: task.title, deadline: task.deadline, notes: task.notes,
        activity_id: task.activity_id, done: !task.done,
      }));
    } catch (e) { alert(e.message); }
  }

  if (loading) return <Alert type="loading">Loading board…</Alert>;
  if (error)   return <Alert type="error">{error}</Alert>;

  // ── Kanban View ──────────────────────────────────────────────────────────────
  function renderKanban() {
    return (
      <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem', alignItems: 'flex-start' }}>
        {columns.map(col => {
          const visibleTasks = activeFilter ? col.tasks.filter(t => t.activity_id === activeFilter) : col.tasks;
          const activeTasks  = visibleTasks.filter(t => !t.done);
          const doneTasks    = visibleTasks.filter(t => t.done);
          const doneOpen     = !!showDone[col.id];
          const isOver       = dragOverCol === col.id;

          return (
            <div key={col.id}
              {...dropZoneProps(col.id)}
              style={{
                ...S.card,
                minWidth: 260, maxWidth: 260, flexShrink: 0,
                display: 'flex', flexDirection: 'column', gap: '.75rem',
                alignSelf: 'flex-start',
                border: isOver ? '1px solid var(--accent)' : '1px solid var(--border)',
                transition: 'border-color .15s',
              }}
            >
              {/* Column header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                {renamingCol === col.id ? (
                  <>
                    <input autoFocus value={renameColVal} onChange={e => setRenameColVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRenameCol(col.id); if (e.key === 'Escape') setRenamingCol(null); }}
                      style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '.3rem .5rem', fontSize: '.9rem', outline: 'none' }} />
                    <button onClick={() => handleRenameCol(col.id)} style={{ ...S.btnBase, ...S.btnPrimary, padding: '3px 8px', fontSize: '.75rem' }}>✓</button>
                    <button onClick={() => setRenamingCol(null)} style={{ ...S.btnBase, ...S.btnOutline, padding: '3px 8px', fontSize: '.75rem' }}>✕</button>
                  </>
                ) : (
                  <>
                    <span style={{ fontWeight: 700, fontSize: '.95rem', flex: 1 }}>{col.name}</span>
                    <button onClick={() => { setRenamingCol(col.id); setRenameColVal(col.name); }} title="Rename"
                      style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '.85rem' }}>✎</button>
                    <button onClick={() => handleDeleteCol(col.id, col.name)} title="Delete"
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '.85rem' }}>✕</button>
                  </>
                )}
              </div>

              {/* Task count */}
              <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>
                {activeTasks.length} task{activeTasks.length !== 1 ? 's' : ''}
                {doneTasks.length > 0 ? ` · ${doneTasks.length} done` : ''}
              </div>

              {/* Active tasks */}
              {activeTasks.map(task => (
                <TaskCard key={task.id} task={task} isDone={false}
                  onToggleDone={handleToggleDone}
                  onEdit={t => setEditTask({ isNew: false, columnId: col.id, task: t })}
                  {...taskDragProps(task)} />
              ))}

              {/* Add task */}
              <button onClick={() => setEditTask({ isNew: true, columnId: col.id, task: null })}
                style={{ ...S.btnBase, ...S.btnOutline, width: '100%', justifyContent: 'center', fontSize: '.82rem', borderStyle: 'dashed' }}>
                + Add task
              </button>

              {/* Done section */}
              {doneTasks.length > 0 && (
                <>
                  <button onClick={() => setShowDone(p => ({ ...p, [col.id]: !doneOpen }))}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '.78rem', cursor: 'pointer', textAlign: 'left', padding: '2px 0', display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                    <span style={{ fontSize: '.65rem' }}>{doneOpen ? '▾' : '▸'}</span>
                    Done ({doneTasks.length})
                  </button>
                  {doneOpen && doneTasks.map(task => (
                    <TaskCard key={task.id} task={task} isDone={true}
                      onToggleDone={handleToggleDone}
                      onEdit={t => setEditTask({ isNew: false, columnId: col.id, task: t })}
                      {...taskDragProps(task)} />
                  ))}
                </>
              )}
            </div>
          );
        })}

        {/* Add person column */}
        <div style={{ minWidth: 200, flexShrink: 0, alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          {addingCol ? (
            <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: '.5rem', minWidth: 200 }}>
              <input autoFocus value={newColName} onChange={e => setNewColName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddCol(); if (e.key === 'Escape') { setAddingCol(false); setNewColName(''); } }}
                placeholder="Person's name…"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', padding: '.4rem .75rem', fontSize: '.9rem', outline: 'none' }} />
              <div style={{ display: 'flex', gap: '.4rem' }}>
                <button onClick={handleAddCol} style={{ ...S.btnBase, ...S.btnPrimary, flex: 1, justifyContent: 'center' }}>Add</button>
                <button onClick={() => { setAddingCol(false); setNewColName(''); }} style={{ ...S.btnBase, ...S.btnOutline }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingCol(true)}
              style={{ ...S.btnBase, ...S.btnOutline, width: '100%', justifyContent: 'center', borderStyle: 'dashed', padding: '.75rem' }}>
              + Add Person
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Activity View ────────────────────────────────────────────────────────────
  function renderActivityView() {
    const allTasks = columns.flatMap(c => c.tasks);

    // Build sections: one per activity + one for untagged tasks
    const sections = [
      ...activities.map(a => ({
        id: a.id,
        name: a.name,
        color: actColor(a.id),
        tasks: allTasks.filter(t => t.activity_id === a.id),
      })),
      {
        id: null,
        name: 'Untagged',
        color: { bg: 'rgba(168,162,158,0.15)', text: 'var(--muted)' },
        tasks: allTasks.filter(t => !t.activity_id),
      },
    ].filter(s => s.tasks.length > 0 || s.id !== null);

    if (sections.length === 0) {
      return <p style={{ color: 'var(--muted)', fontSize: '.9rem' }}>No activities yet. Add one via ⚙ Activities, then add tasks and tag them.</p>;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {sections.map(section => (
          <div key={section.id ?? 'untagged'}>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '.75rem' }}>
              <span style={{ background: section.color.bg, color: section.color.text, borderRadius: 6, padding: '3px 12px', fontSize: '.82rem', fontWeight: 700 }}>
                {section.name}
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {/* Person columns grid */}
            {columns.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: '.85rem' }}>No people added yet.</p>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${columns.length}, minmax(200px, 1fr))`,
                gap: '1px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
              }}>
                {/* Column headers */}
                {columns.map(col => (
                  <div key={col.id} style={{
                    background: 'var(--surface2)', padding: '.5rem .75rem',
                    fontWeight: 700, fontSize: '.82rem', color: 'var(--text)',
                    borderBottom: '1px solid var(--border)',
                    textAlign: 'center',
                  }}>
                    {col.name}
                  </div>
                ))}

                {/* Task cells */}
                {columns.map(col => {
                  const cellTasks = section.tasks.filter(t => t.column_id === col.id);
                  const isOver = dragOverCol === `act-${section.id}-${col.id}`;
                  return (
                    <div key={col.id}
                      onDragOver={e => { e.preventDefault(); setDragOverCol(`act-${section.id}-${col.id}`); }}
                      onDragLeave={() => setDragOverCol(null)}
                      onDrop={e => {
                        e.preventDefault();
                        setDragOverCol(null);
                        const taskId = parseInt(e.dataTransfer.getData('taskId'));
                        if (taskId) handleDrop(taskId, col.id);
                      }}
                      style={{
                        background: isOver ? 'rgba(249,115,22,0.06)' : 'var(--surface)',
                        padding: '.6rem',
                        display: 'flex', flexDirection: 'column', gap: '.5rem',
                        minHeight: 80,
                        border: isOver ? '1px solid var(--accent)' : '1px solid transparent',
                        transition: 'background .15s, border-color .15s',
                      }}
                    >
                      {cellTasks.map(task => (
                        <TaskCard key={task.id} task={task} isDone={task.done}
                          onToggleDone={handleToggleDone}
                          onEdit={t => setEditTask({ isNew: false, columnId: col.id, task: t })}
                          {...taskDragProps(task)} />
                      ))}
                      {cellTasks.length === 0 && (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '.7rem', color: 'var(--border2)' }}>drop here</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Top bar: view toggle + activity filters (kanban only) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
        {/* View toggle */}
        <div style={{ display: 'flex', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', flexShrink: 0 }}>
          {[['kanban', '☰ Kanban'], ['activity', '⊞ Activity']].map(([mode, label]) => (
            <button key={mode} onClick={() => setViewMode(mode)}
              style={{
                ...S.btnBase, borderRadius: 0, padding: '4px 12px', fontSize: '.82rem',
                ...(viewMode === mode ? S.btnPrimary : { background: 'transparent', color: 'var(--muted)', border: 'none' }),
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Activity filter pills — kanban only */}
        {viewMode === 'kanban' && (
          <>
            <button onClick={() => setActiveFilter(null)}
              style={{ ...S.btnBase, ...(activeFilter === null ? S.btnPrimary : S.btnOutline), padding: '4px 14px', fontSize: '.8rem' }}>
              All
            </button>
            {activities.map(a => {
              const c = actColor(a.id);
              const active = activeFilter === a.id;
              return (
                <button key={a.id} onClick={() => setActiveFilter(active ? null : a.id)}
                  style={{ ...S.btnBase, background: active ? c.bg : 'transparent', color: c.text, border: `1px solid ${active ? c.text : 'var(--border2)'}`, padding: '4px 14px', fontSize: '.8rem' }}>
                  {a.name}
                </button>
              );
            })}
          </>
        )}

        {/* Manage Activities gear */}
        <button onClick={() => setShowActPanel(p => !p)} title="Manage Activities"
          style={{ ...S.btnBase, ...S.btnOutline, padding: '4px 10px', fontSize: '.85rem', marginLeft: 'auto' }}>
          ⚙ Activities
        </button>
      </div>

      {/* Activities management panel */}
      {showActPanel && (
        <ActivitiesPanel activities={activities} onAdd={handleAddActivity} onRename={handleRenameActivity} onDelete={handleDeleteActivity} />
      )}

      {/* Main board */}
      {viewMode === 'kanban' ? renderKanban() : renderActivityView()}

      {/* Task modal */}
      {editTask && (
        <TaskModal
          task={editTask.task}
          activities={activities}
          onClose={() => setEditTask(null)}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
        />
      )}
    </div>
  );
}
