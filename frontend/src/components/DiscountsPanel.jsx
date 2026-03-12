import { useState } from 'react';

const sel = {
  padding: '.45rem .7rem', borderRadius: 6,
  border: '1px solid var(--border2)', background: 'var(--surface2)',
  color: 'var(--text)', fontSize: '.875rem', outline: 'none',
};
const checkLabel = {
  display: 'flex', alignItems: 'center', gap: '.4rem',
  fontSize: '.85rem', color: 'var(--text)', cursor: 'pointer', padding: '.15rem 0',
};

export default function DiscountsPanel({ report, offers, onOffersChange, onClose }) {
  const [type,         setType]         = useState('b2g1');
  const [discountPct,  setDiscountPct]  = useState('');
  const [selectedSkus, setSelectedSkus] = useState(new Set());

  const rows = report?.rows ?? [];

  const toggleSku = (sku) => {
    setSelectedSkus(prev => {
      const next = new Set(prev);
      next.has(sku) ? next.delete(sku) : next.add(sku);
      return next;
    });
  };

  const addOffer = () => {
    if (!selectedSkus.size) return;
    if (type === 'discount' && !parseFloat(discountPct)) return;
    onOffersChange([...offers, {
      id: crypto.randomUUID(),
      type,
      skus: [...selectedSkus],
      discountPct: type === 'discount' ? parseFloat(discountPct) : 0,
    }]);
    setSelectedSkus(new Set());
    setDiscountPct('');
  };

  const deleteOffer = (id) => onOffersChange(offers.filter(o => o.id !== id));

  const skuName = (sku) => rows.find(r => r.sku === sku)?.name || sku;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 199 }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
        background: 'var(--surface)', borderLeft: '1px solid var(--border)',
        zIndex: 200, display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,.25)',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.1rem 1.25rem', borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1,
        }}>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>
            Discounts / Offers
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--muted)',
            fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1, padding: 0,
          }}>✕</button>
        </div>

        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* ── Add offer form ── */}
          <div>
            <div style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: '.75rem' }}>
              Add Offer
            </div>

            {/* Type + % */}
            <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: '.85rem', flexWrap: 'wrap' }}>
              <select value={type} onChange={e => setType(e.target.value)} style={sel}>
                <option value="b2g1">Buy 2 Get 1 Free</option>
                <option value="discount">Discount %</option>
              </select>
              {type === 'discount' && (
                <input
                  type="number" min="1" max="99" placeholder="e.g. 20"
                  value={discountPct} onChange={e => setDiscountPct(e.target.value)}
                  style={{ ...sel, width: 90 }}
                />
              )}
            </div>

            {/* SKU checkboxes */}
            <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: '.4rem' }}>
              Select products:
            </div>
            <div style={{
              maxHeight: 220, overflowY: 'auto',
              border: '1px solid var(--border)', borderRadius: 6, padding: '.5rem .75rem',
              background: 'var(--surface2)',
            }}>
              {rows.length === 0 && (
                <div style={{ color: 'var(--muted)', fontSize: '.82rem' }}>No products in report.</div>
              )}
              {rows.map(row => (
                <label key={row.sku} style={checkLabel}>
                  <input
                    type="checkbox"
                    checked={selectedSkus.has(row.sku)}
                    onChange={() => toggleSku(row.sku)}
                  />
                  <span>{row.name}</span>
                  <span style={{ color: 'var(--muted)', fontSize: '.75rem', fontFamily: 'monospace' }}>
                    {row.sku}
                  </span>
                </label>
              ))}
            </div>

            <button
              onClick={addOffer}
              disabled={!selectedSkus.size || (type === 'discount' && !parseFloat(discountPct))}
              style={{
                marginTop: '.85rem', padding: '.5rem 1.1rem',
                background: 'var(--accent)', border: 'none', borderRadius: 6,
                color: '#fff', fontWeight: 600, fontSize: '.85rem',
                cursor: 'pointer', opacity: (!selectedSkus.size || (type === 'discount' && !parseFloat(discountPct))) ? 0.45 : 1,
              }}
            >
              Add Offer
            </button>
          </div>

          {/* ── Existing offers ── */}
          <div>
            <div style={{ fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: '.75rem' }}>
              Active Offers ({offers.length})
            </div>

            {offers.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: '.85rem' }}>No offers added yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
                {offers.map(o => (
                  <div key={o.id} style={{
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '.75rem 1rem',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '.5rem',
                  }}>
                    <div>
                      <span style={{
                        display: 'inline-block', padding: '.15rem .45rem',
                        background: o.type === 'b2g1' ? 'rgba(249,115,22,.15)' : 'rgba(99,102,241,.15)',
                        color: o.type === 'b2g1' ? 'var(--accent)' : '#818cf8',
                        border: `1px solid ${o.type === 'b2g1' ? 'rgba(249,115,22,.3)' : 'rgba(99,102,241,.3)'}`,
                        borderRadius: 5, fontSize: '.72rem', fontWeight: 700, marginBottom: '.4rem',
                      }}>
                        {o.type === 'b2g1' ? 'B2G1' : `${o.discountPct}% OFF`}
                      </span>
                      <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>
                        {o.skus.map(skuName).join(', ')}
                      </div>
                    </div>
                    <button onClick={() => deleteOffer(o.id)} style={{
                      background: 'none', border: 'none', color: 'var(--muted)',
                      cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: 0, flexShrink: 0,
                    }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
