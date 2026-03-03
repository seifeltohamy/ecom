import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../utils/auth.js';
import { useAuth } from '../context/AuthContext.jsx';
import Card, { CardTitle } from '../components/Card.jsx';
import Btn from '../components/Btn.jsx';
import Alert from '../components/Alert.jsx';

export default function Users() {
  const { currentUserEmail } = useAuth();
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState('viewer');
  const [alert,    setAlert]    = useState(null);
  const [editingId,   setEditingId]   = useState(null);
  const [editingName, setEditingName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await authFetch('/users');
    const data = await res.json();
    if (res.ok) setUsers(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!email.trim() || !password.trim()) {
      setAlert({ type: 'error', msg: 'Email and password are required.' });
      return;
    }
    const fd = new FormData();
    fd.append('name', name.trim());
    fd.append('email', email.trim());
    fd.append('password', password.trim());
    fd.append('role', role);
    const res  = await authFetch('/auth/register', { method: 'POST', body: fd });
    const data = await res.json();
    const errMsg = typeof data.detail === 'string' ? data.detail : 'Failed to create user.';
    if (!res.ok) { setAlert({ type: 'error', msg: errMsg }); return; }
    setAlert({ type: 'success', msg: `User ${email.trim()} created.` });
    setName(''); setEmail(''); setPassword(''); setRole('viewer');
    load();
    setTimeout(() => setAlert(null), 2500);
  };

  const saveName = async (id) => {
    const res = await authFetch(`/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingName })
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, name: editingName.trim() } : u));
    }
    setEditingId(null);
  };

  const del = async (id, userEmail) => {
    if (!confirm(`Delete user ${userEmail}?`)) return;
    const res  = await authFetch(`/users/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      setAlert({ type: 'error', msg: data.detail || 'Failed to delete.' });
      return;
    }
    load();
  };

  const thStyle = {
    padding: '.6rem .85rem',
    fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.06em',
    color: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)'
  };
  const tdStyle = { padding: '.7rem .85rem', borderBottom: '1px solid var(--border)', fontSize: '.9rem' };
  const inp = {
    flex: 1, minWidth: 140, padding: '.5rem .8rem',
    background: 'var(--surface2)', border: '1px solid var(--border2)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: '.875rem', outline: 'none'
  };

  return (
    <div>
      <Card>
        <CardTitle>Create New User</CardTitle>
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          <input style={inp} type="text" placeholder="Name (optional)" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()} />
          <input style={inp} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()} />
          <input style={inp} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()} />
          <select value={role} onChange={e => setRole(e.target.value)} style={{ padding: '.5rem .7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)' }}>
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
          <Btn onClick={create}>Create</Btn>
        </div>
        {alert && <Alert type={alert.type}>{alert.msg}</Alert>}
      </Card>

      <Card>
        <CardTitle>All Users ({users.length})</CardTitle>
        {loading
          ? <Alert type="loading">Loading users…</Alert>
          : users.length === 0
            ? <div style={{ color: 'var(--muted)', fontSize: '.9rem' }}>No users found.</div>
            : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Email</th>
                      <th style={thStyle}>Role</th>
                      <th style={thStyle}>Created</th>
                      <th style={{ ...thStyle, textAlign: 'right' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td style={tdStyle}>
                          {editingId === u.id ? (
                            <div style={{ display: 'flex', gap: '.35rem' }}>
                              <input
                                autoFocus
                                value={editingName}
                                onChange={e => setEditingName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveName(u.id); if (e.key === 'Escape') setEditingId(null); }}
                                style={{ flex: 1, minWidth: 0, padding: '.25rem .45rem', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text)', fontSize: '.85rem', outline: 'none' }}
                                placeholder="Name"
                              />
                              <button onClick={() => saveName(u.id)} style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, color: '#0c0a09', fontWeight: 700, fontSize: '.75rem', padding: '0 .5rem', cursor: 'pointer' }}>✓</button>
                              <button onClick={() => setEditingId(null)} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--muted)', fontSize: '.75rem', padding: '0 .4rem', cursor: 'pointer' }}>✕</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                              <span style={{ color: u.name ? 'var(--text)' : 'var(--muted)', fontStyle: u.name ? 'normal' : 'italic' }}>{u.name || '—'}</span>
                              <button onClick={() => { setEditingId(u.id); setEditingName(u.name || ''); }} title="Edit name" style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '.85rem', padding: 0, lineHeight: 1 }}>✎</button>
                            </div>
                          )}
                        </td>
                        <td style={tdStyle}>{u.email}</td>
                        <td style={tdStyle}>
                          <span style={{
                            display: 'inline-block', padding: '.15rem .5rem', borderRadius: 6,
                            fontSize: '.72rem', fontWeight: 600,
                            background: u.role === 'admin' ? 'rgba(249,115,22,.15)' : 'var(--surface2)',
                            color: u.role === 'admin' ? 'var(--accent)' : 'var(--muted)',
                            border: u.role === 'admin' ? '1px solid rgba(249,115,22,.3)' : '1px solid var(--border)'
                          }}>{u.role}</span>
                        </td>
                        <td style={{ ...tdStyle, color: 'var(--muted)', fontSize: '.82rem' }}>
                          {u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB') : '—'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          {u.email !== currentUserEmail && (
                            <Btn variant="danger" onClick={() => del(u.id, u.email)}>Delete</Btn>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      </Card>
    </div>
  );
}
