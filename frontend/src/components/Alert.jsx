import Spinner from './Spinner.jsx';

export default function Alert({ type, children }) {
  const colors = {
    error:   { bg: 'rgba(239,68,68,.1)',  border: 'rgba(239,68,68,.3)',  text: 'var(--danger)'  },
    loading: { bg: 'var(--surface2)',     border: 'var(--border)',       text: 'var(--muted)'   },
    success: { bg: 'rgba(34,197,94,.1)',  border: 'rgba(34,197,94,.3)', text: 'var(--success)' }
  }[type] || {};
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '.5rem',
      padding: '.65rem 1rem', borderRadius: 'var(--radius-sm)',
      background: colors.bg, border: `1px solid ${colors.border}`,
      color: colors.text, fontSize: '.875rem', marginTop: '.75rem',
      animation: 'fadeIn .2s ease'
    }}>
      {type === 'loading' && <Spinner />}
      <span>{children}</span>
    </div>
  );
}
