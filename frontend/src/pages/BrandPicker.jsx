import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/auth.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alert from '../components/Alert.jsx';

export default function BrandPicker() {
  const { login, userRole } = useAuth();
  const navigate = useNavigate();

  const [brands,       setBrands]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [newBrand,     setNewBrand]     = useState('');
  const [creating,     setCreating]     = useState(false);
  const [createError,  setCreateError]  = useState('');
  const [selectingId,  setSelectingId]  = useState(null);

  useEffect(() => {
    if (userRole && userRole !== 'admin') {
      navigate('/', { replace: true });
      return;
    }
    authFetch('/brands')
      .then(r => r.json())
      .then(d => { setBrands(d); setLoading(false); })
      .catch(() => { setError('Failed to load brands.'); setLoading(false); });
  }, [userRole, navigate]);

  async function selectBrand(brandId) {
    setSelectingId(brandId);
    const res = await authFetch('/auth/select-brand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_id: brandId }),
    });
    if (!res.ok) { setSelectingId(null); return; }
    const { access_token } = await res.json();
    login(access_token);
    navigate('/', { replace: true });
  }

  async function handleCreate(e) {
    e.preventDefault();
    const name = newBrand.trim();
    if (!name) return;
    setCreating(true); setCreateError('');
    const res = await authFetch('/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const brand = await res.json();
      setBrands(prev => [...prev, brand]);
      setNewBrand('');
    } else {
      const d = await res.json().catch(() => ({}));
      setCreateError(d.detail || 'Failed to create brand.');
    }
    setCreating(false);
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem',
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--accent)', color: '#fff',
            fontSize: '1.6rem', fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '1rem',
          }}>Z</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Select a Brand
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '.85rem', marginTop: '.4rem' }}>
            Choose which brand portal to enter
          </p>
        </div>

        {/* Brand list */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1rem',
        }}>
          {loading && <Alert type="loading">Loading brands…</Alert>}
          {error   && <Alert type="error">{error}</Alert>}
          {!loading && !error && brands.length === 0 && (
            <p style={{ color: 'var(--muted)', textAlign: 'center', margin: 0 }}>
              No brands yet. Create one below.
            </p>
          )}
          {!loading && brands.map(b => (
            <button
              key={b.id}
              onClick={() => selectBrand(b.id)}
              disabled={selectingId !== null}
              style={{
                display: 'flex', alignItems: 'center', gap: '.75rem',
                width: '100%', padding: '.85rem 1rem',
                background: selectingId === b.id ? 'var(--surface2)' : 'none',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text)', cursor: selectingId !== null ? 'not-allowed' : 'pointer',
                fontSize: '1rem', fontWeight: 500,
                marginBottom: '.5rem', transition: 'border-color .15s, background .15s',
              }}
              onMouseEnter={e => { if (!selectingId) e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--accent)', color: '#fff',
                fontSize: '.85rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {b.name[0].toUpperCase()}
              </div>
              <span>{b.name}</span>
              {selectingId === b.id && (
                <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: '.8rem' }}>
                  Entering…
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Create brand form */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '1.25rem',
        }}>
          <p style={{ color: 'var(--muted)', fontSize: '.8rem', marginBottom: '.75rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            New brand
          </p>
          {createError && <Alert type="error" style={{ marginBottom: '.75rem' }}>{createError}</Alert>}
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: '.5rem' }}>
            <input
              value={newBrand}
              onChange={e => setNewBrand(e.target.value)}
              placeholder="Brand name"
              style={{
                flex: 1, padding: '.55rem .75rem',
                background: 'var(--surface2)', border: '1px solid var(--border2)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text)',
                fontSize: '.9rem', outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={creating || !newBrand.trim()}
              style={{
                padding: '.55rem 1rem',
                background: 'var(--accent)', border: 'none',
                borderRadius: 'var(--radius-sm)', color: '#fff',
                fontSize: '.9rem', fontWeight: 600, cursor: 'pointer',
                opacity: creating || !newBrand.trim() ? 0.6 : 1,
              }}
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
