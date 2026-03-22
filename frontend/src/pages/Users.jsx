import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../utils/auth.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDialog } from '../utils/useDialog.js';
import { PERMISSIONED_PAGES } from '../App.jsx';
import Card, { CardTitle } from '../components/Card.jsx';
import Btn from '../components/Btn.jsx';
import Alert from '../components/Alert.jsx';
import Dialog from '../components/Dialog.jsx';

export default function Users() {
  const { currentUserEmail } = useAuth();
  const { dialogProps, confirm } = useDialog();
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState('viewer');
  // null = unrestricted; array = allowed pages for viewer
  const [selectedPages, setSelectedPages] = useState(null);
  const [alert,    setAlert]    = useState(null);
  const [editingId,   setEditingId]   = useState(null);
  const [editingName, setEditingName] = useState('');
  // page editing per-user
  const [editPagesId,   setEditPagesId]   = useState(null);
  const [editPagesVal,  setEditPagesVal]  = useState(null);
  const [newReadOnly,   setNewReadOnly]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await authFetch('/users');
    const data = await res.json();
    if (res.ok) setUsers(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const togglePage = (path, current, setter) => {
    if (current === null) {
      // switch from unrestricted → restrict to all except this one
      setter(PERMISSIONED_PAGES.map(p => p.path).filter(p => p !== path));
    } else {
      setter(current.includes(path) ? current.filter(p => p !== path) : [...current, path]);
    }
  };

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
    if (role === 'viewer' && selectedPages !== null) {
      fd.append('allowed_pages', JSON.stringify(selectedPages));
    }
    if (newReadOnly) fd.append('read_only', 'true');
    const res  = await authFetch('/auth/register', { method: 'POST', body: fd });
    const data = await res.json();
    const errMsg = typeof data.detail === 'string' ? data.detail : 'Failed to create user.';
    if (!res.ok) { setAlert({ type: 'error', msg: errMsg }); return; }
    setAlert({ type: 'success', msg: `User ${email.trim()} created.` });
    setName(''); setEmail(''); setPassword(''); setRole('viewer'); setSelectedPages(null); setNewReadOnly(false);
    load();
    setTimeout(() => setAlert(null), 2500);
  };

  const saveName = async (id) => {
    const res = await authFetch(`/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingName })
    });
    if (res.ok) setUsers(prev => prev.map(u => u.id === id ? { ...u, name: editingName.trim() } : u));
    setEditingId(null);
  };

  const savePages = async (id) => {
    const res = await authFetch(`/users/${id}/pages`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowed_pages: editPagesVal }),
    });
    if (res.ok) setUsers(prev => prev.map(u => u.id === id ? { ...u, allowed_pages: editPagesVal } : u));
    setEditPagesId(null);
  };

  const toggleReadOnly = async (id, current) => {
    await authFetch(`/users/${id}/readonly`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read_only: !current }),
    });
    setUsers(prev => prev.map(u => u.id === id ? { ...u, read_only: !current } : u));
  };

  const del = async (id, userEmail) => {
    if (!await confirm('Delete User', `Delete ${userEmail}? This cannot be undone.`)) return;
    const res = await authFetch(`/users/${id}`, { method: 'DELETE' });
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
  const checkLabel = { display: 'flex', alignItems: 'center', gap: '.3rem', fontSize: '.82rem', color: 'var(--text)', cursor: 'pointer' };

  return (
    <div>
      <Card>
        <CardTitle>Create New User</CardTitle>
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          <input style={inp} type="text"     placeholder="Name (optional)" value={name}     onChange={e => setName(e.target.value)}     onKeyDown={e => e.key === 'Enter' && create()} />
          <input style={inp} type="email"    placeholder="Email"           value={email}    onChange={e => setEmail(e.target.value)}    onKeyDown={e => e.key === 'Enter' && create()} />
          <input style={inp} type="password" placeholder="Password"        value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()} />
          <select value={role} onChange={e => { setRole(e.target.value); setSelectedPages(null); }}
            style={{ padding: '.5rem .7rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text)' }}>
            <option value="viewer">User</option>
          </select>
          <Btn onClick={create}>Create</Btn>
        </div>

        {/* Page permissions for viewer */}
        <div style={{ marginTop: '1rem' }}>
          <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: '.5rem', fontWeight: 600 }}>
            Page access — {selectedPages === null ? 'all pages (unrestricted)' : `${selectedPages.length} page(s) selected`}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem .75rem' }}>
            {PERMISSIONED_PAGES.map(({ path, label }) => {
              const checked = selectedPages === null ? true : selectedPages.includes(path);
              return (
                <label key={path} style={checkLabel}>
                  <input type="checkbox" checked={checked}
                    onChange={() => togglePage(path, selectedPages, setSelectedPages)} />
                  {label}
                </label>
              );
            })}
            {selectedPages !== null && (
              <button onClick={() => setSelectedPages(null)}
                style={{ fontSize: '.75rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Reset to unrestricted
              </button>
            )}
          </div>
        </div>

        <div style={{ marginTop: '.75rem' }}>
          <label style={{ ...checkLabel, gap: '.4rem' }}>
            <input type="checkbox" checked={newReadOnly} onChange={e => setNewReadOnly(e.target.checked)} />
            <span style={{ fontWeight: 600 }}>Read Only</span>
            <span style={{ color: 'var(--muted)', fontSize: '.78rem' }}>— can view pages but cannot make any changes</span>
          </label>
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
                      <th style={thStyle}>Pages</th>
                      <th style={thStyle}>Read Only</th>
                      <th style={thStyle}>Created</th>
                      <th style={{ ...thStyle, textAlign: 'right' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        {/* Name cell */}
                        <td style={tdStyle}>
                          {editingId === u.id ? (
                            <div style={{ display: 'flex', gap: '.35rem' }}>
                              <input autoFocus value={editingName}
                                onChange={e => setEditingName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveName(u.id); if (e.key === 'Escape') setEditingId(null); }}
                                style={{ flex: 1, minWidth: 0, padding: '.25rem .45rem', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text)', fontSize: '.85rem', outline: 'none' }}
                                placeholder="Name" />
                              <button onClick={() => saveName(u.id)} style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, color: '#0c0a09', fontWeight: 700, fontSize: '.75rem', padding: '0 .5rem', cursor: 'pointer' }}>✓</button>
                              <button onClick={() => setEditingId(null)} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--muted)', fontSize: '.75rem', padding: '0 .4rem', cursor: 'pointer' }}>✕</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                              <span style={{ color: u.name ? 'var(--text)' : 'var(--muted)', fontStyle: u.name ? 'normal' : 'italic' }}>{u.name || '—'}</span>
                              <button onClick={() => { setEditingId(u.id); setEditingName(u.name || ''); }} title="Edit name"
                                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '.85rem', padding: 0, lineHeight: 1 }}>✎</button>
                            </div>
                          )}
                        </td>
                        <td style={tdStyle}>{u.email}</td>
                        {/* Role badge */}
                        <td style={tdStyle}>
                          <span style={{
                            display: 'inline-block', padding: '.15rem .5rem', borderRadius: 6,
                            fontSize: '.72rem', fontWeight: 600,
                            background: u.role === 'admin' ? 'rgba(249,115,22,.15)' : 'var(--surface2)',
                            color: u.role === 'admin' ? 'var(--accent)' : 'var(--muted)',
                            border: u.role === 'admin' ? '1px solid rgba(249,115,22,.3)' : '1px solid var(--border)'
                          }}>{u.role === 'viewer' ? 'User' : u.role}</span>
                        </td>
                        {/* Page permissions cell */}
                        <td style={{ ...tdStyle, minWidth: 200 }}>
                          {u.role === 'admin' ? (
                            <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>—</span>
                          ) : editPagesId === u.id ? (
                            <div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.3rem .6rem', marginBottom: '.5rem' }}>
                                {PERMISSIONED_PAGES.map(({ path, label }) => {
                                  const checked = editPagesVal === null ? true : editPagesVal.includes(path);
                                  return (
                                    <label key={path} style={{ ...checkLabel, fontSize: '.78rem' }}>
                                      <input type="checkbox" checked={checked}
                                        onChange={() => togglePage(path, editPagesVal, setEditPagesVal)} />
                                      {label}
                                    </label>
                                  );
                                })}
                              </div>
                              <div style={{ display: 'flex', gap: '.35rem' }}>
                                <button onClick={() => savePages(u.id)} style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, color: '#0c0a09', fontWeight: 700, fontSize: '.75rem', padding: '.2rem .5rem', cursor: 'pointer' }}>Save</button>
                                <button onClick={() => setEditPagesId(null)} style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--muted)', fontSize: '.75rem', padding: '.2rem .4rem', cursor: 'pointer' }}>Cancel</button>
                                {editPagesVal !== null && (
                                  <button onClick={() => setEditPagesVal(null)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '.72rem', cursor: 'pointer', padding: 0 }}>Unrestricted</button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                              <span style={{ fontSize: '.8rem', color: 'var(--muted)' }}>
                                {u.allowed_pages === null ? 'All pages' : `${u.allowed_pages.length} page(s)`}
                              </span>
                              <button onClick={() => { setEditPagesId(u.id); setEditPagesVal(u.allowed_pages ?? null); }} title="Edit permissions"
                                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '.85rem', padding: 0, lineHeight: 1 }}>✎</button>
                            </div>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {u.role === 'admin' ? (
                            <span style={{ color: 'var(--muted)', fontSize: '.8rem' }}>—</span>
                          ) : (
                            <button
                              onClick={() => toggleReadOnly(u.id, u.read_only)}
                              title={u.read_only ? 'Click to allow writes' : 'Click to make read-only'}
                              style={{
                                padding: '.2rem .55rem', borderRadius: 999, fontSize: '.72rem', fontWeight: 700,
                                cursor: 'pointer', border: 'none',
                                background: u.read_only ? 'rgba(249,115,22,.15)' : 'var(--surface2)',
                                color: u.read_only ? 'var(--accent)' : 'var(--muted)',
                                outline: '1px solid ' + (u.read_only ? 'rgba(249,115,22,.3)' : 'var(--border)'),
                              }}
                            >
                              {u.read_only ? 'Read Only' : 'Read & Write'}
                            </button>
                          )}
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
      <Dialog {...dialogProps} />
    </div>
  );
}
