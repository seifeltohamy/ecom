import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const features = [
  { icon: '📦', label: 'Stock inventory' },
  { icon: '💰', label: 'Finances & cashflow' },
  { icon: '📊', label: 'Ads analytics' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('username', email);
      fd.append('password', password);
      const res  = await fetch('/auth/login', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Login failed');
      login(data.access_token);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inp = {
    width: '100%', padding: '.7rem 1rem',
    background: 'var(--surface)', border: '1px solid var(--border2)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
    fontSize: '.9rem', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexWrap: 'wrap' }}>

      {/* Left hero panel */}
      <div className="login-hero">
        <div style={{ maxWidth: 400 }}>
          {/* Logo */}
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #f97316, #f59e0b)',
            display: 'grid', placeItems: 'center',
            color: '#0c0a09', fontWeight: 800, fontSize: '1.1rem',
            letterSpacing: '-.02em', marginBottom: '2rem',
          }}>HQ</div>

          {/* Headline */}
          <h1 style={{
            fontSize: '2.4rem', fontWeight: 800, lineHeight: 1.15,
            margin: '0 0 .75rem',
            background: 'linear-gradient(135deg, var(--text) 40%, var(--muted))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Your Ecommerce HQ
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '1rem', margin: '0 0 2.5rem', lineHeight: 1.6 }}>
            One place to manage your brand, end to end.
          </p>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {features.map(f => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: '.85rem' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  display: 'grid', placeItems: 'center', fontSize: '1.1rem', flexShrink: 0,
                }}>
                  {f.icon}
                </div>
                <span style={{ color: 'var(--text)', fontSize: '.95rem', fontWeight: 500 }}>
                  {f.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="login-form-panel">
        <div style={{ width: '100%', maxWidth: 360 }}>

          {/* Mobile-only logo (hidden on desktop via CSS) */}
          <div className="login-mobile-logo" style={{ marginBottom: '2rem' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'linear-gradient(135deg, #f97316, #f59e0b)',
              display: 'grid', placeItems: 'center',
              color: '#0c0a09', fontWeight: 800, fontSize: '1rem',
            }}>HQ</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>EcomHQ</div>
              <div style={{ color: 'var(--muted)', fontSize: '.8rem' }}>Your Ecommerce HQ</div>
            </div>
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 .35rem' }}>Sign in</h2>
          <p style={{ color: 'var(--muted)', fontSize: '.875rem', margin: '0 0 1.75rem' }}>
            Enter your credentials to continue.
          </p>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{
                fontSize: '.72rem', color: 'var(--muted)',
                textTransform: 'uppercase', letterSpacing: '.06em',
                display: 'block', marginBottom: '.35rem',
              }}>Email</label>
              <input
                type="email" required autoFocus style={inp}
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label style={{
                fontSize: '.72rem', color: 'var(--muted)',
                textTransform: 'uppercase', letterSpacing: '.06em',
                display: 'block', marginBottom: '.35rem',
              }}>Password</label>
              <input
                type="password" required style={inp}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div style={{
                color: 'var(--danger)', fontSize: '.85rem',
                background: 'rgba(239,68,68,.08)', padding: '.6rem .85rem',
                borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,.2)',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '.75rem',
                background: loading ? 'var(--border2)' : 'var(--accent)',
                border: 'none', borderRadius: 'var(--radius-sm)',
                color: loading ? 'var(--muted)' : '#0c0a09',
                fontWeight: 700, fontSize: '.95rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background .15s', marginTop: '.25rem',
              }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
