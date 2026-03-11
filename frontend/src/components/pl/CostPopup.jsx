import { useState } from 'react';
import { authFetch } from '../../utils/auth.js';
import { fmtN } from '../../utils/format.js';
import Btn from '../Btn.jsx';
import Spinner from '../Spinner.jsx';

/**
 * Modal popup for editing the itemised cost breakdown of a SKU.
 * Items are saved globally per brand/SKU (not per report).
 * onSave(sku, items) — called after successful PUT /sku-cost-items/{sku}
 */
export default function CostPopup({ sku, name, initialItems, onSave, onClose }) {
  const [items,  setItems]  = useState(
    initialItems?.length ? initialItems.map(i => ({ ...i })) : []
  );
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState(null);

  function addItem()              { setItems(prev => [...prev, { name: '', amount: 0 }]); }
  function removeItem(idx)        { setItems(prev => prev.filter((_, i) => i !== idx)); }
  function updateItem(idx, f, v)  { setItems(prev => prev.map((item, i) => i === idx ? { ...item, [f]: v } : item)); }

  const total = items.reduce((a, i) => a + (parseFloat(i.amount) || 0), 0);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const payload = items
        .filter(i => i.name.trim())
        .map(i => ({ name: i.name.trim(), amount: parseFloat(i.amount) || 0 }));
      const res = await authFetch(`/sku-cost-items/${encodeURIComponent(sku)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload }),
      });
      if (!res.ok) throw new Error('Save failed');
      onSave(sku, payload);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    background: 'var(--bg, #0c0a09)', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: 5,
    padding: '.35rem .6rem', fontSize: '.9rem',
    fontFamily: 'inherit', outline: 'none',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--surface, #1c1917)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '1.5rem',
        minWidth: 360, maxWidth: 480, width: '90vw',
        boxShadow: '0 8px 40px rgba(0,0,0,.6)',
      }}>
        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem', color: 'var(--text)' }}>
          Cost breakdown —{' '}
          <span style={{ color: 'var(--accent)' }}>{name || sku}</span>
          {name && <span style={{ fontFamily: 'monospace', fontSize: '.75rem', color: 'var(--muted)', marginLeft: 6 }}>{sku}</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', marginBottom: '1rem' }}>
          {items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
              <input
                placeholder="Item name" value={item.name}
                onChange={e => updateItem(idx, 'name', e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                type="number" step="0.01" placeholder="0" value={item.amount}
                onChange={e => updateItem(idx, 'amount', e.target.value)}
                style={{ ...inputStyle, width: 90 }}
              />
              <button
                onClick={() => removeItem(idx)}
                style={{ background: 'none', border: 'none', color: 'var(--danger, #ef4444)', cursor: 'pointer', fontSize: '1.1rem', padding: '0 .25rem', lineHeight: 1 }}
              >×</button>
            </div>
          ))}
        </div>

        <button
          onClick={addItem}
          style={{
            background: 'none', border: '1px dashed var(--border)',
            color: 'var(--muted)', cursor: 'pointer', borderRadius: 5,
            padding: '.3rem .75rem', fontSize: '.85rem', width: '100%',
            fontFamily: 'inherit', marginBottom: '1rem',
          }}
        >+ Add item</button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '.75rem' }}>
          <div style={{ fontSize: '.9rem', fontWeight: 700, color: 'var(--text)' }}>
            Total: <span style={{ color: 'var(--accent)' }}>{fmtN(Math.round(total * 100) / 100)} EGP</span>
          </div>
          <div style={{ display: 'flex', gap: '.5rem' }}>
            <Btn variant="outline" onClick={onClose}>Cancel</Btn>
            <Btn disabled={saving} onClick={save}>
              {saving ? <><Spinner size={13} /> Saving…</> : 'Save'}
            </Btn>
          </div>
        </div>
        {err && <div style={{ color: 'var(--danger, #ef4444)', fontSize: '.8rem', marginTop: '.5rem' }}>{err}</div>}
      </div>
    </div>
  );
}
