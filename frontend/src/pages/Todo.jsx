import { useState, useEffect } from 'react';
import { authFetch } from '../utils/auth.js';
import { useDialog } from '../utils/useDialog.js';
import { S } from '../styles.js';
import Alert from '../components/Alert.jsx';
import Dialog from '../components/Dialog.jsx';
import { actColor, InsertLine } from '../components/todo/todoHelpers.jsx';
import TaskModal from '../components/todo/TaskModal.jsx';
import ActivitiesPanel from '../components/todo/ActivitiesPanel.jsx';
import TaskCard from '../components/todo/TaskCard.jsx';

export default function Todo() {
  const { dialogProps, confirm, info } = useDialog();
  const [columns, setColumns]           = useState([]);
  const [unassigned, setUnassigned]     = useState([]);
  const [activities, setActivities]     = useState([]);
  const [viewMode, setViewMode]         = useState('kanban');
  const [activeFilter, setActiveFilter] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [editTask, setEditTask]         = useState(null);
  const [showActPanel, setShowActPanel] = useState(false);
  const [newColName, setNewColName]     = useState('');
  const [addingCol, setAddingCol]       = useState(false);
  const [renamingCol, setRenamingCol]   = useState(null);
  const [renameColVal, setRenameColVal] = useState('');
  const [showDone, setShowDone]         = useState({});
  const [dragOverCol, setDragOverCol]   = useState(null);
  // { zoneKey: string, taskId: number|null }
  // taskId = the task to insert BEFORE; null = append at end of zone
  const [insertBefore, setInsertBefore] = useState(null);

  function loadBoard(data) {
    setColumns(data.columns);
    setActivities(data.activities);
    setUnassigned(data.unassigned || []);
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

  // ── Drag helpers ─────────────────────────────────────────────────────────────

  function taskDragProps(task) {
    return {
      onDragStart: e => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('taskId', String(task.id));
      },
      onDragEnd: () => {
        setDragOverCol(null);
        setInsertBefore(null);
      },
    };
  }

  // Drop zone on a column container.
  // colId: the actual column id (0 = unassign), used for handleDrop
  // zoneKey: unique string for this zone, used for insertBefore matching
  // highlightKey: what to set dragOverCol to (defaults to colId, use zoneKey for activity cells)
  function dropZoneProps(colId, zoneKey, highlightKey) {
    const hKey = highlightKey !== undefined ? highlightKey : colId;
    return {
      onDragOver: e => {
        e.preventDefault();
        setDragOverCol(hKey);
        // Only set insertBefore when cursor is over empty column space (not a task card)
        if (e.target === e.currentTarget) {
          setInsertBefore({ zoneKey, taskId: null });
        }
      },
      onDragLeave: e => {
        // Only clear when truly leaving the column (not just entering a child element)
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setDragOverCol(null);
        }
      },
      onDrop: e => {
        e.preventDefault();
        setDragOverCol(null);
        const taskId = parseInt(e.dataTransfer.getData('taskId'));
        if (taskId) handleDrop(taskId, colId);
      },
    };
  }

  // onDragOver for a task wrapper — detects top/bottom half to set insert position
  function taskWrapperDragOver(e, zoneKey, task, nextTask, highlightKey) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const isTopHalf = e.clientY < rect.top + rect.height / 2;
    setInsertBefore({ zoneKey, taskId: isTopHalf ? task.id : (nextTask?.id ?? null) });
    setDragOverCol(highlightKey);
  }

  // Render a list of tasks with insertion indicators between them
  function renderTaskList(tasks, zoneKey, highlightKey, onEditFn) {
    return (
      <>
        {tasks.map((task, idx) => {
          const nextTask = tasks[idx + 1];
          const showLine = insertBefore?.zoneKey === zoneKey && insertBefore?.taskId === task.id;
          return (
            <div key={task.id}
              onDragOver={e => taskWrapperDragOver(e, zoneKey, task, nextTask, highlightKey)}
            >
              {showLine && <InsertLine />}
              <TaskCard task={task} isDone={task.done}
                onToggleDone={handleToggleDone}
                onEdit={onEditFn}
                {...taskDragProps(task)} />
            </div>
          );
        })}
        {insertBefore?.zoneKey === zoneKey && insertBefore?.taskId === null && <InsertLine />}
      </>
    );
  }

  // Optimistic state update — immediately reflects new order in UI before server responds
  function applyOptimisticReorder(task, targetColId, newZoneOrder) {
    const newColId = targetColId === 0 ? null : targetColId;
    const newZoneWithOrder = newZoneOrder.map((t, i) => ({
      ...t, column_id: newColId, sort_order: i,
    }));
    if (targetColId === 0) {
      setUnassigned(prev => [
        ...newZoneWithOrder,
        ...prev.filter(t => t.done && t.id !== task.id),
      ]);
      setColumns(prev => prev.map(col => ({
        ...col, tasks: col.tasks.filter(t => t.id !== task.id),
      })));
    } else {
      setColumns(prev => prev.map(col => {
        if (col.id === targetColId) {
          const doneTasks = col.tasks.filter(t => t.done);
          return { ...col, tasks: [...newZoneWithOrder, ...doneTasks] };
        }
        return { ...col, tasks: col.tasks.filter(t => t.id !== task.id) };
      }));
      setUnassigned(prev => prev.filter(t => t.id !== task.id));
    }
  }

  // Handles drop: optimistic update first, then sync with POST /todo/reorder
  async function handleDrop(taskId, targetColId) {
    const allTasks = [...columns.flatMap(c => c.tasks), ...unassigned];
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    const isCrossColumn = (task.column_id ?? 0) !== targetColId;

    // Active tasks in target zone excluding dragged task
    const zoneTasksWithout = (
      targetColId === 0
        ? unassigned
        : (columns.find(c => c.id === targetColId)?.tasks ?? [])
    ).filter(t => !t.done && t.id !== taskId);

    // Compute insert index from insertBefore state
    const ib = insertBefore;
    let insertIdx = zoneTasksWithout.length; // default: append
    if (ib?.taskId != null) {
      const found = zoneTasksWithout.findIndex(t => t.id === ib.taskId);
      if (found !== -1) insertIdx = found;
    }

    const newZoneOrder = [
      ...zoneTasksWithout.slice(0, insertIdx),
      task,
      ...zoneTasksWithout.slice(insertIdx),
    ];

    // Snapshot for rollback on error
    const prevColumns = columns;
    const prevUnassigned = unassigned;

    // Apply immediately — instant UI response
    applyOptimisticReorder(task, targetColId, newZoneOrder);
    setInsertBefore(null);
    setDragOverCol(null);

    // Sync with server
    try {
      loadBoard(await apiCall('/todo/reorder', 'POST', {
        task_ids: newZoneOrder.map(t => t.id),
        ...(isCrossColumn && { moved_task_id: taskId, new_column_id: targetColId }),
      }));
    } catch (e) {
      setColumns(prevColumns);
      setUnassigned(prevUnassigned);
      info('Error', e.message);
    }
  }

  // ── CRUD handlers ─────────────────────────────────────────────────────────────

  async function handleAddActivity(name) {
    try { loadBoard(await apiCall('/todo/activities', 'POST', { name })); }
    catch (e) { info('Error', e.message); }
  }
  async function handleRenameActivity(id, name) {
    try { loadBoard(await apiCall(`/todo/activities/${id}`, 'PUT', { name })); }
    catch (e) { info('Error', e.message); }
  }
  async function handleDeleteActivity(id) {
    const act = activities.find(a => a.id === id);
    if (!await confirm('Delete Activity', `Delete "${act?.name}"? Tasks tagged with it will keep their data.`)) return;
    try {
      loadBoard(await apiCall(`/todo/activities/${id}`, 'DELETE'));
      if (activeFilter === id) setActiveFilter(null);
    } catch (e) { info('Error', e.message); }
  }

  async function handleAddCol() {
    if (!newColName.trim()) return;
    try {
      loadBoard(await apiCall('/todo/columns', 'POST', { name: newColName.trim() }));
      setNewColName(''); setAddingCol(false);
    } catch (e) { info('Error', e.message); }
  }
  async function handleRenameCol(id) {
    if (!renameColVal.trim()) return;
    try {
      loadBoard(await apiCall(`/todo/columns/${id}`, 'PUT', { name: renameColVal.trim() }));
      setRenamingCol(null);
    } catch (e) { info('Error', e.message); }
  }
  async function handleDeleteCol(id, name) {
    if (!await confirm('Delete Person', `Delete "${name}" and all their tasks? This cannot be undone.`)) return;
    try { loadBoard(await apiCall(`/todo/columns/${id}`, 'DELETE')); }
    catch (e) { info('Error', e.message); }
  }

  async function handleSaveTask({ title, deadline, notes, activity_id, done }) {
    try {
      if (editTask.isNew) {
        if (editTask.columnId === null) {
          loadBoard(await apiCall('/todo/tasks', 'POST', { title, deadline, notes, activity_id }));
        } else {
          loadBoard(await apiCall(`/todo/columns/${editTask.columnId}/tasks`, 'POST', { title, deadline, notes, activity_id }));
        }
      } else {
        loadBoard(await apiCall(`/todo/tasks/${editTask.task.id}`, 'PUT', { title, deadline, notes, activity_id, done }));
      }
      setEditTask(null);
    } catch (e) { info('Error', e.message); }
  }
  async function handleDeleteTask() {
    if (!await confirm('Delete Task', 'Delete this task? This cannot be undone.')) return;
    try {
      loadBoard(await apiCall(`/todo/tasks/${editTask.task.id}`, 'DELETE'));
      setEditTask(null);
    } catch (e) { info('Error', e.message); }
  }
  async function handleToggleDone(task) {
    try {
      loadBoard(await apiCall(`/todo/tasks/${task.id}`, 'PUT', {
        title: task.title, deadline: task.deadline, notes: task.notes,
        activity_id: task.activity_id, done: !task.done,
      }));
    } catch (e) { info('Error', e.message); }
  }

  if (loading) return <Alert type="loading">Loading board…</Alert>;
  if (error)   return <Alert type="error">{error}</Alert>;

  // ── Kanban View ───────────────────────────────────────────────────────────────
  function renderKanban() {
    return (
      <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem', alignItems: 'flex-start' }}>
        {columns.map(col => {
          const visibleTasks = activeFilter ? col.tasks.filter(t => t.activity_id === activeFilter) : col.tasks;
          const activeTasks  = visibleTasks.filter(t => !t.done);
          const doneTasks    = visibleTasks.filter(t => t.done);
          const doneOpen     = !!showDone[col.id];
          const zoneKey      = `col-${col.id}`;
          const isOver       = dragOverCol === col.id;

          return (
            <div key={col.id}
              {...dropZoneProps(col.id, zoneKey, col.id)}
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

              <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>
                {activeTasks.length} task{activeTasks.length !== 1 ? 's' : ''}
                {doneTasks.length > 0 ? ` · ${doneTasks.length} done` : ''}
              </div>

              {renderTaskList(activeTasks, zoneKey, col.id, t => setEditTask({ isNew: false, columnId: col.id, task: t }))}

              <button onClick={() => setEditTask({ isNew: true, columnId: col.id, task: null })}
                style={{ ...S.btnBase, ...S.btnOutline, width: '100%', justifyContent: 'center', fontSize: '.82rem', borderStyle: 'dashed' }}>
                + Add task
              </button>

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

  // ── Activity View ─────────────────────────────────────────────────────────────
  function renderActivityView() {
    const allTasks = [...columns.flatMap(c => c.tasks), ...unassigned];

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
      return <p style={{ color: 'var(--muted)', fontSize: '.9rem' }}>No activities yet. Add one via ⚙ Activities.</p>;
    }

    const gridCols = [{ id: 0, name: 'Unassigned', isUnassigned: true }, ...columns];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {sections.map(section => {
          const sectionUnassigned = unassigned.filter(t =>
            section.id !== null ? t.activity_id === section.id : !t.activity_id
          );

          return (
            <div key={section.id ?? 'untagged'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '.75rem' }}>
                <span style={{ background: section.color.bg, color: section.color.text, borderRadius: 6, padding: '3px 12px', fontSize: '.82rem', fontWeight: 700 }}>
                  {section.name}
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${gridCols.length}, minmax(200px, 1fr))`,
                gap: '1px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
              }}>
                {/* Column headers */}
                {gridCols.map(col => (
                  <div key={col.id} style={{
                    background: col.isUnassigned ? 'rgba(168,162,158,0.08)' : 'var(--surface2)',
                    padding: '.5rem .75rem',
                    fontWeight: 700, fontSize: '.82rem',
                    color: col.isUnassigned ? 'var(--muted)' : 'var(--text)',
                    borderBottom: '1px solid var(--border)',
                    textAlign: 'center',
                    fontStyle: col.isUnassigned ? 'italic' : 'normal',
                  }}>
                    {col.name}
                  </div>
                ))}

                {/* Task cells */}
                {gridCols.map(col => {
                  const cellKey = `act-${section.id}-${col.id}`;
                  const isOver  = dragOverCol === cellKey;
                  const cellTasks = col.isUnassigned
                    ? sectionUnassigned.filter(t => !t.done)
                    : section.tasks.filter(t => t.column_id === col.id && !t.done);

                  return (
                    <div key={col.id}
                      {...dropZoneProps(col.id, cellKey, cellKey)}
                      style={{
                        background: isOver
                          ? (col.isUnassigned ? 'rgba(168,162,158,0.1)' : 'rgba(249,115,22,0.06)')
                          : (col.isUnassigned ? 'rgba(168,162,158,0.04)' : 'var(--surface)'),
                        padding: '.6rem',
                        display: 'flex', flexDirection: 'column', gap: '.5rem',
                        minHeight: 80,
                        border: isOver
                          ? `1px solid ${col.isUnassigned ? 'var(--border2)' : 'var(--accent)'}`
                          : '1px solid transparent',
                        transition: 'background .15s, border-color .15s',
                      }}
                    >
                      {renderTaskList(
                        cellTasks,
                        cellKey,
                        cellKey,
                        t => setEditTask({ isNew: false, columnId: col.isUnassigned ? null : col.id, task: t })
                      )}

                      {col.isUnassigned && (
                        <button
                          onClick={() => setEditTask({
                            isNew: true,
                            columnId: null,
                            prefillActivityId: section.id ?? undefined,
                          })}
                          style={{
                            ...S.btnBase, ...S.btnOutline,
                            width: '100%', justifyContent: 'center',
                            fontSize: '.75rem', borderStyle: 'dashed', opacity: 0.7,
                          }}
                        >
                          + Add task
                        </button>
                      )}

                      {cellTasks.length === 0 && !col.isUnassigned && (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '.7rem', color: 'var(--border2)' }}>drop here</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
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

        <button onClick={() => setShowActPanel(p => !p)} title="Manage Activities"
          style={{ ...S.btnBase, ...S.btnOutline, padding: '4px 10px', fontSize: '.85rem', marginLeft: 'auto' }}>
          ⚙ Activities
        </button>
      </div>

      {showActPanel && (
        <ActivitiesPanel activities={activities} onAdd={handleAddActivity} onRename={handleRenameActivity} onDelete={handleDeleteActivity} />
      )}

      {viewMode === 'kanban' ? renderKanban() : renderActivityView()}

      {editTask && (
        <TaskModal
          task={editTask.task}
          activities={activities}
          prefillActivityId={editTask.prefillActivityId}
          onClose={() => setEditTask(null)}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
        />
      )}
      <Dialog {...dialogProps} />
    </div>
  );
}
