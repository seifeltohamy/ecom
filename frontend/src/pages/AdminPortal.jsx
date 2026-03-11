import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/auth.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alert from '../components/Alert.jsx';

function fmt(n) {
  if (n == null) return '—';
  return 'EGP ' + n.toLocaleString('en-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function AdminPortal() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [brands,      setBrands]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [selectingId, setSelectingId] = useState(null);

  useEffect(() => {
    authFetch('/admin/overview')
      .then(r => r.json())
      .then(d => { setBrands(d); setLoading(false); })
      .catch(() => { setError('Failed to load overview.'); setLoading(false); });
  }, []);

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

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      padding: '2rem',
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Back link */}
        <button
          onClick={() => navigate('/select-brand')}
          style={{
            background: 'none', border: 'none', color: 'var(--muted)',
            fontSize: '.85rem', cursor: 'pointer', padding: 0,
            marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '.4rem',
          }}
        >
          ← Back to brand picker
        </button>

        {/* Header */}
        <div style={{ marginBottom: '1.75rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Admin Overview
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '.875rem', marginTop: '.3rem' }}>
            Numbers across all brands
          </p>
        </div>

        {loading && <Alert type="loading">Loading…</Alert>}
        {error   && <Alert type="error">{error}</Alert>}

        {!loading && !error && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  {['Brand', 'Users', 'Products', 'Entries', 'This Month Net', 'Reports', 'Last Report', ''].map(h => (
                    <th key={h} style={{
                      padding: '.65rem 1rem', textAlign: h === '' ? 'right' : 'left',
                      color: 'var(--muted)', fontWeight: 600, fontSize: '.78rem',
                      textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {brands.map((b, i) => (
                  <tr
                    key={b.brand_id}
                    style={{
                      borderBottom: i < brands.length - 1 ? '1px solid var(--border)' : 'none',
                      transition: 'background .12s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '.75rem 1rem', fontWeight: 600, color: 'var(--text)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'var(--accent)', color: '#fff',
                          fontSize: '.8rem', fontWeight: 700, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {b.brand_name[0].toUpperCase()}
                        </div>
                        {b.brand_name}
                      </div>
                    </td>
                    <td style={{ padding: '.75rem 1rem', color: 'var(--text)' }}>{b.users_count}</td>
                    <td style={{ padding: '.75rem 1rem', color: 'var(--text)' }}>{b.products_count}</td>
                    <td style={{ padding: '.75rem 1rem', color: 'var(--text)' }}>{b.cashflow_entries_total}</td>
                    <td style={{ padding: '.75rem 1rem', color: b.current_month_net > 0 ? 'var(--success)' : b.current_month_net < 0 ? 'var(--danger)' : 'var(--muted)', fontWeight: 600 }}>
                      {b.cashflow_entries_total === 0 ? '—' : fmt(b.current_month_net)}
                    </td>
                    <td style={{ padding: '.75rem 1rem', color: 'var(--text)' }}>{b.bosta_reports_count}</td>
                    <td style={{ padding: '.75rem 1rem', color: 'var(--muted)' }}>{b.last_report_date || '—'}</td>
                    <td style={{ padding: '.75rem 1rem', textAlign: 'right' }}>
                      <button
                        onClick={() => selectBrand(b.brand_id)}
                        disabled={selectingId !== null}
                        style={{
                          padding: '.4rem .85rem',
                          background: 'var(--accent)', border: 'none',
                          borderRadius: 'var(--radius-sm)', color: '#fff',
                          fontSize: '.8rem', fontWeight: 600, cursor: selectingId !== null ? 'not-allowed' : 'pointer',
                          opacity: selectingId !== null && selectingId !== b.brand_id ? 0.5 : 1,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {selectingId === b.brand_id ? 'Entering…' : 'Select →'}
                      </button>
                    </td>
                  </tr>
                ))}
                {brands.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                      No brands found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
