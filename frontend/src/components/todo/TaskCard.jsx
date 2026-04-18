import { actColor, deadlineBadge } from './todoHelpers.jsx';

export default function TaskCard({ task, isDone, onToggleDone, onEdit, onDragStart, onDragEnd }) {
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
