import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../utils/auth.js';
import { useDialog } from '../utils/useDialog.js';
import { S } from '../styles.js';
import Card, { CardTitle } from '../components/Card.jsx';
import Btn from '../components/Btn.jsx';
import Alert from '../components/Alert.jsx';
import Badge from '../components/Badge.jsx';
import Dialog from '../components/Dialog.jsx';

export default function Products() {
  const { dialogProps, confirm } = useDialog();
  const [products, setProducts] = useState({});
  const [sku,     setSku]     = useState('');
  const [name,    setName]    = useState('');
  const [alert,   setAlert]   = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await authFetch('/products');
    const data = await res.json();
    setProducts(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!sku.trim() || !name.trim()) {
      setAlert({ type: 'error', msg: 'Both SKU and name are required.' });
      return;
    }
    const res  = await authFetch('/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: sku.trim(), name: name.trim() })
    });
    const data = await res.json();
    if (!res.ok) { setAlert({ type: 'error', msg: data.detail }); return; }
    setSku(''); setName('');
    setAlert({ type: 'success', msg: `"${data.name}" added.` });
    load();
    setTimeout(() => setAlert(null), 2500);
  };

  const del = async (s) => {
    if (!await confirm('Remove Product', `Remove SKU "${s}"? This cannot be undone.`)) return;
    await authFetch(`/products/${encodeURIComponent(s)}`, { method: 'DELETE' });
    load();
  };

  const inputStyle = {
    flex: 1, minWidth: 140,
    padding: '.5rem .8rem',
    background: 'var(--surface2)',
    border: '1px solid var(--border2)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text)',
    fontSize: '.875rem',
    outline: 'none'
  };

  const entries = Object.entries(products);

  const thStyle = {
    padding: '.6rem .85rem',
    fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.06em',
    color: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)'
  };
  const tdStyle = {
    padding: '.7rem .85rem', borderBottom: '1px solid var(--border)', fontSize: '.9rem'
  };

  return (
    <div>
      <Card>
        <CardTitle>Add / Update Product</CardTitle>
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          <input
            style={inputStyle}
            placeholder="SKU  (e.g. BO-2159519)"
            value={sku}
            onChange={e => setSku(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
          />
          <input
            style={inputStyle}
            placeholder="Product name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
          />
          <Btn onClick={add}>Add</Btn>
        </div>
        {alert && <Alert type={alert.type}>{alert.msg}</Alert>}
      </Card>

      <Card>
        <CardTitle>Stored Products ({entries.length})</CardTitle>
        {loading ? (
          <Alert type="loading">Loading products…</Alert>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: '.9rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '.5rem' }}>📦</div>
            No products yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>SKU</th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle} />
                </tr>
              </thead>
              <tbody>
                {entries.map(([s, n]) => (
                  <tr key={s} style={{ transition: 'background .1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ ...tdStyle, ...S.mono }}><Badge>{s}</Badge></td>
                    <td style={tdStyle}>{n}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <Btn variant="danger" onClick={() => del(s)}>Remove</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Dialog {...dialogProps} />
    </div>
  );
}
