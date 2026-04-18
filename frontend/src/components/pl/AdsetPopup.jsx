import { useState, useEffect } from 'react';
import { authFetch } from '../../utils/auth.js';
import { fmt } from '../../utils/format.js';
import Btn from '../Btn.jsx';
import Spinner from '../Spinner.jsx';

/**
 * AdsetPopup — select which Meta adsets a product (or group of products) belongs to.
 *
 * Props:
 *   skus          — [string] — one or more SKUs to assign
 *   skuNames      — {sku: name} — for display
 *   dateFrom      — default date_from from report
 *   dateTo        — default date_to from report
 *   initialAdsets — {sku: [adset_id]} — current assignments
 *   qtyBySku      — {sku: number} — quantity sold per SKU (for CPP calc)
 *   onSave        — (skus, adsetIds) => void — called after save
 *   onClose       — () => void
 */
export default function AdsetPopup({ skus, skuNames, dateFrom: defaultFrom, dateTo: defaultTo, initialAdsets, qtyBySku, onSave, onClose }) {
  const [adsets, setAdsets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFrom, setDateFrom] = useState(defaultFrom || '');
  const [dateTo, setDateTo] = useState(defaultTo || '');
  const [saving, setSaving] = useState(false);

  // Which adset IDs are checked
  const [checked, setChecked] = useState(new Set());

  // Load initial checked state from first SKU's assignments
  useEffect(() => {
    const first = skus[0];
    const ids = initialAdsets?.[first] || [];
    setChecked(new Set(ids));
  }, [skus, initialAdsets]);

  // Fetch adset data from Meta
  const fetchAdsets = async (from, to) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (from) params.set('date_from', from);
      if (to) params.set('date_to', to);
      const res = await authFetch(`/meta/adsets?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to load adsets');
      if (!data.connected) throw new Error('Meta Ads not connected');
      setAdsets(data.rows || []);
      if (data.date_from) setDateFrom(data.date_from);
      if (data.date_to) setDateTo(data.date_to);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAdsets(dateFrom, dateTo); }, []);

  const toggleAdset = (adsetId) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(adsetId)) next.delete(adsetId);
      else next.add(adsetId);
      return next;
    });
  };

  // Count how many products share each checked adset (for equal split calc)
  // For now, we use the number of SKUs passed to this popup
  const numProducts = skus.length;

  // Calculate totals for checked adsets
  const checkedAdsets = adsets.filter(a => checked.has(a.adset_id));
  const totalSpend = checkedAdsets.reduce((s, a) => s + a.spend, 0);
  const productSpend = numProducts > 0 ? totalSpend / numProducts : 0;
  const totalQty = skus.reduce((s, sku) => s + (qtyBySku?.[sku] || 0), 0);
  const cpp = totalQty > 0 ? productSpend / totalQty : 0;
  const roas = productSpend > 0 ? (skus.reduce((s, sku) => s + (qtyBySku?.[sku] || 0), 0) * cpp > 0 ? totalQty : 0) : 0;

  const handleSave = async () => {
    setSaving(true);
    const adsetIds = Array.from(checked);
    try {
      if (skus.length === 1) {
        await authFetch(`/meta/product-adsets/${encodeURIComponent(skus[0])}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adset_ids: adsetIds }),
        });
      } else {
        await authFetch('/meta/product-adsets-bulk', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skus, adset_ids: adsetIds }),
        });
      }
      onSave?.(skus, adsetIds);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const iStyle = {
    padding: '.3rem .5rem', borderRadius: 4,
    border: '1px solid var(--border2)', background: 'var(--surface2)',
    color: 'var(--text)', fontSize: '.85rem', outline: 'none',
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 'var(--radius)',
        padding: '1.5rem', maxWidth: 640, width: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,.6)',
      }}>
        {/* Header */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>
            {skus.length === 1
              ? `Adsets — ${skuNames?.[skus[0]] || skus[0]}`
              : `Group Adsets — ${skus.length} products`}
          </div>
          <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: '.2rem' }}>
            {skus.length === 1 && <span style={{ fontFamily: 'monospace' }}>{skus[0]}</span>}
            {skus.length > 1 && skus.map(s => skuNames?.[s] || s).join(', ')}
          </div>
        </div>

        {/* Date range */}
        <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', fontWeight: 600 }}>Date Range</div>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={iStyle} />
          <span style={{ color: 'var(--muted)' }}>→</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={iStyle} />
          <Btn variant="outline" onClick={() => fetchAdsets(dateFrom, dateTo)} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </Btn>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
          {loading && <div style={{ textAlign: 'center', padding: '2rem' }}><Spinner size={24} /></div>}
          {error && <div style={{ color: 'var(--danger)', fontSize: '.85rem', padding: '.5rem' }}>{error}</div>}

          {!loading && !error && adsets.length === 0 && (
            <div style={{ color: 'var(--muted)', fontSize: '.85rem', padding: '1rem', textAlign: 'center' }}>
              No adsets found for this date range.
            </div>
          )}

          {!loading && adsets.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border2)' }}>
                  <th style={{ width: 32, padding: '.4rem' }} />
                  <th style={{ textAlign: 'left', padding: '.4rem .6rem', color: 'var(--muted)', fontWeight: 600, fontSize: '.72rem', textTransform: 'uppercase' }}>Adset Name</th>
                  <th style={{ textAlign: 'right', padding: '.4rem .6rem', color: 'var(--muted)', fontWeight: 600, fontSize: '.72rem', textTransform: 'uppercase' }}>ROAS</th>
                  <th style={{ textAlign: 'right', padding: '.4rem .6rem', color: 'var(--muted)', fontWeight: 600, fontSize: '.72rem', textTransform: 'uppercase' }}>Spend</th>
                </tr>
              </thead>
              <tbody>
                {adsets.map(a => {
                  const isChecked = checked.has(a.adset_id);
                  return (
                    <tr
                      key={a.adset_id}
                      onClick={() => toggleAdset(a.adset_id)}
                      style={{
                        cursor: 'pointer', borderBottom: '1px solid var(--border)',
                        background: isChecked ? 'rgba(249,115,22,.06)' : 'transparent',
                        transition: 'background .1s',
                      }}
                    >
                      <td style={{ padding: '.5rem .4rem', textAlign: 'center' }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: 4,
                          border: isChecked ? 'none' : '2px solid var(--border2)',
                          background: isChecked ? 'var(--accent)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all .1s',
                        }}>
                          {isChecked && <span style={{ color: '#fff', fontSize: '.65rem', fontWeight: 700 }}>✓</span>}
                        </div>
                      </td>
                      <td style={{ padding: '.5rem .6rem', color: 'var(--text)' }}>{a.adset_name}</td>
                      <td style={{ padding: '.5rem .6rem', textAlign: 'right', color: a.roas != null ? (a.roas >= 2 ? 'var(--success)' : a.roas >= 1 ? 'var(--accent)' : 'var(--danger)') : 'var(--muted)' }}>
                        {a.roas != null ? `${a.roas}x` : '—'}
                      </td>
                      <td style={{ padding: '.5rem .6rem', textAlign: 'right', color: 'var(--text)', fontFamily: 'monospace' }}>
                        EGP {fmt(a.spend)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Summary metrics */}
        {checkedAdsets.length > 0 && (
          <div style={{
            display: 'flex', gap: '1.5rem', padding: '.75rem 1rem', marginBottom: '1rem',
            background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
            fontSize: '.85rem', flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: '.15rem' }}>Ads Spent</div>
              <div style={{ fontWeight: 700, color: 'var(--accent)' }}>EGP {fmt(productSpend)}</div>
            </div>
            <div>
              <div style={{ fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: '.15rem' }}>Cost / Purchase</div>
              <div style={{ fontWeight: 700, color: 'var(--text)' }}>EGP {fmt(cpp)}</div>
            </div>
            <div>
              <div style={{ fontSize: '.65rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: '.15rem' }}>Adsets Selected</div>
              <div style={{ fontWeight: 700, color: 'var(--text)' }}>{checkedAdsets.length}</div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.5rem' }}>
          <Btn variant="outline" onClick={onClose}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Adsets'}
          </Btn>
        </div>
      </div>
    </div>
  );
}
