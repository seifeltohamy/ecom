import { useState, useEffect, useRef } from 'react';
import Btn from './Btn.jsx';

export default function DateRangeButton({ onApply, activeFrom, activeTo }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(activeFrom || '');
  const [to,   setTo]   = useState(activeTo   || '');
  const ref = useRef();

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleFrom = val => {
    setFrom(val);
    if (to) { onApply(val, to); setOpen(false); }
  };
  const handleTo = val => {
    setTo(val);
    if (from) { onApply(from, val); setOpen(false); }
  };
  const clear = () => { setFrom(''); setTo(''); onApply('', ''); setOpen(false); };

  const fmtD = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '…';
  const label = (activeFrom || activeTo)
    ? `📅 ${fmtD(activeFrom)} – ${fmtD(activeTo)}`
    : '📅 Filter by date';

  const inputStyle = {
    padding: '.45rem .7rem', background: 'var(--bg)',
    border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)',
    color: 'var(--text)', fontSize: '.875rem', outline: 'none', colorScheme: 'dark',
    cursor: 'pointer', width: '100%'
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', alignSelf: 'flex-start' }}>
      <Btn variant={activeFrom || activeTo ? 'primary' : 'outline'} onClick={() => setOpen(o => !o)}>
        {label}
      </Btn>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          background: 'var(--surface)', border: '1px solid var(--border2)',
          borderRadius: 'var(--radius)', padding: '1rem', zIndex: 100,
          minWidth: 220, boxShadow: '0 8px 24px rgba(0,0,0,.5)',
          animation: 'fadeIn .15s ease'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
            <label style={{ fontSize: '.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>From</label>
            <input type="date" style={inputStyle} value={from} onChange={e => handleFrom(e.target.value)} />
            <label style={{ fontSize: '.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: '.25rem' }}>To</label>
            <input type="date" style={inputStyle} value={to} onChange={e => handleTo(e.target.value)} />
          </div>
          {(from || to) && (
            <button onClick={clear} style={{
              marginTop: '.75rem', width: '100%', padding: '.4rem',
              background: 'none', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--muted)',
              fontSize: '.8rem', cursor: 'pointer'
            }}>
              Clear filter
            </button>
          )}
        </div>
      )}
    </div>
  );
}
