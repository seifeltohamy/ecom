import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

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
    width: '100%', padding: '.65rem .9rem',
    background: 'var(--surface2)', border: '1px solid var(--border2)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
    fontSize: '.9rem', outline: 'none'
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{
        width: 360, background: 'var(--surface)',
        borderRadius: 'var(--radius)', border: '1px solid var(--border)',
        padding: '2.5rem 2rem', animation: 'riseIn .25s ease'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '2rem' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'linear-gradient(135deg, #f97316, #f59e0b)',
            display: 'grid', placeItems: 'center', color: '#0c0a09', fontWeight: 700, fontSize: '1.1rem'
          }}>Z</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Zen Finance</div>
            <div style={{ color: 'var(--muted)', fontSize: '.8rem' }}>Sign in to continue</div>
          </div>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '.9rem' }}>
          <div>
            <label style={{ fontSize: '.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: '.3rem' }}>Email</label>
            <input type="email" required autoFocus style={inp} value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: '.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: '.3rem' }}>Password</label>
            <input type="password" required style={inp} value={password} onChange={e => setPassword(e.target.value)} />
          </div>

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: '.85rem', background: 'var(--danger-bg)', padding: '.5rem .75rem', borderRadius: 'var(--radius-sm)' }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', padding: '.7rem',
              background: loading ? 'var(--border2)' : 'var(--accent)',
              border: 'none', borderRadius: 'var(--radius-sm)',
              color: loading ? 'var(--muted)' : '#0c0a09',
              fontWeight: 700, fontSize: '.95rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background .15s', marginTop: '.25rem'
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
