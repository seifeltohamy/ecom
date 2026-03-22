import Btn from './Btn.jsx';

/**
 * Styled dialog — covers both info (OK only) and confirm (Cancel + action) modes.
 *
 * Props:
 *   open         – boolean
 *   title        – string
 *   body         – string | ReactNode
 *   confirmLabel – string  (default "OK")
 *   cancelLabel  – string  (default "Cancel")
 *   variant      – "primary" | "danger"  (confirm button colour)
 *   onConfirm    – () => void
 *   onCancel     – () => void | null  (omit → no Cancel button)
 */
export default function Dialog({
  open, title, body,
  confirmLabel = 'OK',
  cancelLabel  = 'Cancel',
  variant      = 'primary',
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2000,
      }}
      onMouseDown={e => { if (e.target === e.currentTarget && onCancel) onCancel(); }}
    >
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border2)',
        borderRadius: 'var(--radius)',
        padding: '1.75rem',
        maxWidth: 420, width: '90%',
        boxShadow: '0 8px 32px rgba(0,0,0,.45)',
      }}>
        <h3 style={{ margin: '0 0 .6rem', color: 'var(--text)', fontSize: '1.05rem', fontWeight: 600 }}>
          {title}
        </h3>
        <p style={{ margin: '0 0 1.5rem', color: 'var(--muted)', fontSize: '.9rem', lineHeight: 1.55 }}>
          {body}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem' }}>
          {onCancel && (
            <Btn variant="outline" onClick={onCancel}>{cancelLabel}</Btn>
          )}
          <Btn variant={variant} onClick={onConfirm}>{confirmLabel}</Btn>
        </div>
      </div>
    </div>
  );
}
