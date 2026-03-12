import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/auth.js';
import { useAuth } from '../context/AuthContext.jsx';
import Alert from '../components/Alert.jsx';

function fmt(n) {
  if (n == null) return '—';
  return 'EGP ' + n.toLocaleString('en-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const inp = {
  flex: 1, minWidth: 160, padding: '.5rem .8rem',
  background: 'var(--surface2)', border: '1px solid var(--border2)',
  borderRadius: 6, color: 'var(--text)', fontSize: '.875rem', outline: 'none',
};
const checkLabel = { display: 'flex', alignItems: 'center', gap: '.3rem', fontSize: '.82rem', color: 'var(--text)', cursor: 'pointer' };

export default function AdminPortal() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [brands,      setBrands]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [selectingId, setSelectingId] = useState(null);

  // Admin users list
  const [admins,        setAdmins]        = useState([]);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [editBrandsId,  setEditBrandsId]  = useState(null);   // admin user id being edited
  const [editBrandsVal, setEditBrandsVal] = useState(null);   // null = all brands

  // Create admin form
  const [adminName,         setAdminName]         = useState('');
  const [adminEmail,        setAdminEmail]        = useState('');
  const [adminPassword,     setAdminPassword]     = useState('');
  const [adminBrands,       setAdminBrands]       = useState(null); // null = all brands
  const [createLoading,     setCreateLoading]     = useState(false);
  const [createAlert,       setCreateAlert]       = useState(null);
  const [showCreateAdmin,   setShowCreateAdmin]   = useState(false);

  const loadAdmins = () => {
    setAdminsLoading(true);
    authFetch('/admin/admins')
      .then(r => r.json())
      .then(d => { setAdmins(Array.isArray(d) ? d : []); setAdminsLoading(false); })
      .catch(() => setAdminsLoading(false));
  };

  useEffect(() => {
    authFetch('/admin/overview')
      .then(r => r.json())
      .then(d => { setBrands(d); setLoading(false); })
      .catch(() => { setError('Failed to load overview.'); setLoading(false); });
    loadAdmins();
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

  const toggleAdminBrand = (id) => {
    if (adminBrands === null) {
      setAdminBrands(brands.map(b => b.brand_id).filter(bid => bid !== id));
    } else {
      setAdminBrands(adminBrands.includes(id)
        ? adminBrands.filter(bid => bid !== id)
        : [...adminBrands, id]);
    }
  };

  const createAdmin = async () => {
    if (!adminEmail.trim() || !adminPassword.trim()) {
      setCreateAlert({ type: 'error', msg: 'Email and password are required.' });
      return;
    }
    setCreateLoading(true);
    const res = await authFetch('/admin/create-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:             adminEmail.trim(),
        password:          adminPassword.trim(),
        name:              adminName.trim(),
        allowed_brand_ids: adminBrands,
      }),
    });
    const data = await res.json();
    setCreateLoading(false);
    if (!res.ok) {
      setCreateAlert({ type: 'error', msg: data.detail || 'Failed to create admin.' });
      return;
    }
    setCreateAlert({ type: 'success', msg: `Admin ${adminEmail.trim()} created.` });
    setAdminName(''); setAdminEmail(''); setAdminPassword(''); setAdminBrands(null);
    loadAdmins();
    setTimeout(() => { setCreateAlert(null); setShowCreateAdmin(false); }, 2000);
  };

  const saveBrands = async (userId) => {
    await authFetch(`/admin/admins/${userId}/brands`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowed_brand_ids: editBrandsVal }),
    });
    setAdmins(prev => prev.map(a => a.id === userId ? { ...a, allowed_brand_ids: editBrandsVal } : a));
    setEditBrandsId(null);
  };

  const deleteAdmin = async (userId, email) => {
    if (!confirm(`Delete admin ${email}?`)) return;
    const res = await authFetch(`/admin/admins/${userId}`, { method: 'DELETE' });
    if (res.ok) setAdmins(prev => prev.filter(a => a.id !== userId));
  };

  const toggleEditBrand = (brandId) => {
    if (editBrandsVal === null) {
      setEditBrandsVal(brands.map(b => b.brand_id).filter(bid => bid !== brandId));
    } else {
      setEditBrandsVal(editBrandsVal.includes(brandId)
        ? editBrandsVal.filter(bid => bid !== brandId)
        : [...editBrandsVal, brandId]);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '2rem' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Admin Overview</h1>
            <p style={{ color: 'var(--muted)', fontSize: '.875rem', marginTop: '.3rem' }}>Numbers across all brands</p>
          </div>
          <button
            onClick={() => setShowCreateAdmin(v => !v)}
            style={{
              padding: '.5rem 1rem', background: 'var(--accent)', border: 'none',
              borderRadius: 6, color: '#fff', fontWeight: 600, fontSize: '.85rem', cursor: 'pointer',
            }}
          >
            {showCreateAdmin ? 'Cancel' : '+ Create Admin'}
          </button>
        </div>

        {/* Create Admin form */}
        {showCreateAdmin && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.5rem',
          }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem', color: 'var(--text)' }}>
              New Admin User
            </div>
            <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <input style={inp} type="text"     placeholder="Name (optional)"  value={adminName}     onChange={e => setAdminName(e.target.value)} />
              <input style={inp} type="email"    placeholder="Email"             value={adminEmail}    onChange={e => setAdminEmail(e.target.value)} />
              <input style={inp} type="password" placeholder="Password"          value={adminPassword} onChange={e => setAdminPassword(e.target.value)} />
            </div>

            {/* Brand access */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: '.5rem', fontWeight: 600 }}>
                Brand access — {adminBrands === null ? 'all brands' : `${adminBrands.length} brand(s) selected`}
              </div>
              {!loading && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem .75rem' }}>
                  {brands.map(b => {
                    const checked = adminBrands === null ? true : adminBrands.includes(b.brand_id);
                    return (
                      <label key={b.brand_id} style={checkLabel}>
                        <input type="checkbox" checked={checked} onChange={() => toggleAdminBrand(b.brand_id)} />
                        {b.brand_name}
                      </label>
                    );
                  })}
                  {adminBrands !== null && (
                    <button onClick={() => setAdminBrands(null)}
                      style={{ fontSize: '.75rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      Grant all brands
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={createAdmin} disabled={createLoading}
              style={{
                padding: '.5rem 1.1rem', background: 'var(--accent)', border: 'none',
                borderRadius: 6, color: '#fff', fontWeight: 600, fontSize: '.85rem',
                cursor: createLoading ? 'not-allowed' : 'pointer', opacity: createLoading ? 0.7 : 1,
              }}
            >
              {createLoading ? 'Creating…' : 'Create Admin'}
            </button>
            {createAlert && (
              <div style={{ marginTop: '.75rem' }}>
                <Alert type={createAlert.type}>{createAlert.msg}</Alert>
              </div>
            )}
          </div>
        )}

        {/* Admin users table */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>
            Admin Users
          </h2>
          {adminsLoading
            ? <Alert type="loading">Loading admins…</Alert>
            : (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                      {['Name', 'Email', 'Brand Access', 'Created', ''].map(h => (
                        <th key={h} style={{ padding: '.65rem 1rem', textAlign: h === '' ? 'right' : 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((a, i) => (
                      <tr key={a.id} style={{ borderBottom: i < admins.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '.75rem 1rem', color: 'var(--text)', fontWeight: 600 }}>
                          {a.name || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>—</span>}
                          {a.is_self && <span style={{ marginLeft: '.4rem', fontSize: '.7rem', color: 'var(--accent)', fontWeight: 400 }}>(you)</span>}
                        </td>
                        <td style={{ padding: '.75rem 1rem', color: 'var(--muted)' }}>{a.email}</td>
                        <td style={{ padding: '.75rem 1rem', minWidth: 220 }}>
                          {editBrandsId === a.id ? (
                            <div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.3rem .6rem', marginBottom: '.5rem' }}>
                                {brands.map(b => {
                                  const checked = editBrandsVal === null ? true : editBrandsVal.includes(b.brand_id);
                                  return (
                                    <label key={b.brand_id} style={checkLabel}>
                                      <input type="checkbox" checked={checked} onChange={() => toggleEditBrand(b.brand_id)} />
                                      {b.brand_name}
                                    </label>
                                  );
                                })}
                              </div>
                              <div style={{ display: 'flex', gap: '.35rem' }}>
                                <button onClick={() => saveBrands(a.id)} style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, color: '#fff', fontWeight: 700, fontSize: '.75rem', padding: '.2rem .5rem', cursor: 'pointer' }}>Save</button>
                                <button onClick={() => setEditBrandsId(null)} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--muted)', fontSize: '.75rem', padding: '.2rem .4rem', cursor: 'pointer' }}>Cancel</button>
                                {editBrandsVal !== null && (
                                  <button onClick={() => setEditBrandsVal(null)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '.72rem', cursor: 'pointer', padding: 0 }}>All brands</button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                              <span style={{ fontSize: '.82rem', color: 'var(--muted)' }}>
                                {a.allowed_brand_ids === null ? 'All brands' : `${a.allowed_brand_ids.length} brand(s)`}
                              </span>
                              <button onClick={() => { setEditBrandsId(a.id); setEditBrandsVal(a.allowed_brand_ids ?? null); }}
                                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '.85rem', padding: 0, lineHeight: 1 }}>✎</button>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '.75rem 1rem', color: 'var(--muted)', fontSize: '.82rem' }}>
                          {new Date(a.created_at).toLocaleDateString('en-GB')}
                        </td>
                        <td style={{ padding: '.75rem 1rem', textAlign: 'right' }}>
                          {!a.is_self && (
                            <button onClick={() => deleteAdmin(a.id, a.email)} style={{ padding: '.35rem .7rem', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 6, color: '#ef4444', fontSize: '.78rem', fontWeight: 600, cursor: 'pointer' }}>
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {admins.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--muted)' }}>No admin users found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )
          }
        </div>

        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>
          Brands Overview
        </h2>

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
                    style={{ borderBottom: i < brands.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background .12s' }}
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
