export const S = {
  app: { display: 'flex', minHeight: '100vh' },
  sidebar: {
    width: 250,
    background: 'var(--sidebar)',
    borderRight: '1px solid var(--border)',
    padding: '1.5rem 1.25rem',
    position: 'sticky', top: 0, height: '100vh',
    display: 'flex', flexDirection: 'column', gap: '1.25rem'
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: '.75rem',
    paddingBottom: '1rem', borderBottom: '1px solid var(--border)'
  },
  logo: {
    width: 36, height: 36, borderRadius: 10,
    background: 'linear-gradient(135deg, #f97316, #f59e0b)',
    display: 'grid', placeItems: 'center', color: '#0c0a09', fontWeight: 700
  },
  navItem: (active) => ({
    display: 'flex', alignItems: 'center', gap: '.6rem',
    padding: '.6rem .75rem',
    borderRadius: 'var(--radius-sm)',
    color: active ? '#0c0a09' : 'var(--text)',
    background: active ? 'var(--accent)' : 'transparent',
    cursor: 'pointer', fontWeight: 600, fontSize: '.95rem',
    transition: 'background .15s, color .15s',
    textDecoration: 'none'
  }),
  main: { flex: 1, padding: '2rem 2.25rem 2.5rem' },
  header: {
    marginBottom: '1.5rem',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
    gap: '1rem', flexWrap: 'wrap'
  },
  h1: {
    fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.5px', color: '#fafafa'
  },
  sub: {
    fontSize: '.9rem', color: 'var(--muted)', marginTop: '.2rem'
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '1.5rem',
    marginBottom: '1rem',
    animation: 'fadeIn .2s ease'
  },
  cardTitle: {
    fontSize: '.7rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '.08em',
    color: 'var(--muted)',
    marginBottom: '1rem',
    paddingBottom: '.75rem',
    borderBottom: '1px solid var(--border)'
  },
  btnBase: {
    display: 'inline-flex', alignItems: 'center', gap: '.4rem',
    padding: '.5rem 1rem',
    borderRadius: 'var(--radius-sm)',
    fontSize: '.9rem', fontWeight: 600,
    cursor: 'pointer', border: 'none',
    transition: 'background .15s, opacity .15s',
    outline: 'none'
  },
  btnPrimary:  { background: 'var(--accent)',    color: '#0c0a09' },
  btnOutline:  { background: 'transparent',      color: 'var(--text)', border: '1px solid var(--border2)' },
  btnDanger:   { background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,.25)' },
  btnDisabled: { opacity: .4, cursor: 'not-allowed' },
  mono: { fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace' }
};
