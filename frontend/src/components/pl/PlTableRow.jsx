import { useState } from 'react';
import { fmt, fmtN } from '../../utils/format.js';
import RefTd from './RefTd.jsx';

const tdPl     = { padding: '.45rem .75rem', borderBottom: '1px solid var(--border)', fontSize: '.9rem', textAlign: 'right', whiteSpace: 'nowrap' };
const tdPlLeft = { ...tdPl, textAlign: 'left' };

/**
 * Single row in the P&L table.
 *
 * Props:
 *   row             — { sku, name, price, qty, revenue, adsCol, expense, profit, pct }
 *   idx             — row index (for fill-drag range)
 *   pl              — { [sku]: { cost, extra_cost } }
 *   costItems       — { [sku]: [{name, amount}] }
 *   fillDrag        — current drag state { field, value, fromIdx, costItemsCopy? } | null
 *   setFillDrag     — setter
 *   fillHoverIdx    — currently hovered row index during drag | null
 *   setFillHoverIdx — setter
 *   formulaActive   — { sku, insert } | null
 *   handleFormulaMode — (sku, insertFn|null) => void
 *   namingSkus      — Set<string>
 *   setNamingSkus   — setter
 *   nameInputs      — { [sku]: string }
 *   setNameInputs   — setter
 *   updatePl        — (sku, field, val) => void
 *   setCostPopup    — ({ sku, name }) => void
 *   saveProductName — async (sku) => void
 */
export default function PlTableRow({
  row, idx,
  pl, costItems,
  fillDrag, setFillDrag, fillHoverIdx, setFillHoverIdx,
  formulaActive, handleFormulaMode,
  namingSkus, setNamingSkus, nameInputs, setNameInputs,
  updatePl, setCostPopup, saveProductName, onPriceEdit,
}) {
  const profitColor = row.profit >= 0 ? 'var(--accent)' : 'var(--danger, #ef4444)';
  const isFormulaRow = formulaActive?.sku === row.sku;
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState('');
  const hasCostItems = costItems[row.sku]?.length > 0;
  const isUnknown    = row.name === 'Unknown Product';
  const isNaming     = namingSkus.has(row.sku);
  const rowCtx       = { price: row.price, qty: row.qty, revenue: row.revenue };

  // Fill-drag range highlight
  const rowHl = fillDrag && fillHoverIdx !== null
    ? idx >= Math.min(fillDrag.fromIdx, fillHoverIdx) && idx <= Math.max(fillDrag.fromIdx, fillHoverIdx)
    : false;

  const [costHovered, setCostHovered] = useState(false);

  const costSum = hasCostItems
    ? costItems[row.sku].reduce((a, i) => a + i.amount, 0)
    : null;

  const isCostFillDrag = fillDrag?.costItemsCopy !== undefined;
  const isInCostFill   = isCostFillDrag && rowHl;

  return (
    <tr
      key={row.sku}
      onMouseEnter={() => fillDrag && setFillHoverIdx(idx)}
      style={{ background: rowHl ? 'rgba(249,115,22,.06)' : 'transparent', transition: 'background .05s' }}
    >
      {/* Product name */}
      <td style={tdPlLeft}>
        <div style={{ fontWeight: 600, color: '#fafafa' }}>
          {isUnknown && isNaming ? (
            <input
              autoFocus
              value={nameInputs[row.sku] ?? ''}
              placeholder="Enter product name"
              onChange={e => setNameInputs(prev => ({ ...prev, [row.sku]: e.target.value }))}
              onBlur={() => saveProductName(row.sku)}
              onKeyDown={e => {
                if (e.key === 'Enter')  { e.preventDefault(); saveProductName(row.sku); }
                if (e.key === 'Escape') { setNamingSkus(prev => { const s = new Set(prev); s.delete(row.sku); return s; }); }
              }}
              style={{
                background: 'var(--surface2, #1c1917)', color: 'var(--text)',
                border: '1px solid var(--accent)', borderRadius: 4,
                padding: '3px 8px', fontSize: '.875rem',
                fontFamily: 'inherit', outline: 'none', width: '100%',
              }}
            />
          ) : isUnknown ? (
            <span
              onClick={() => setNamingSkus(prev => new Set([...prev, row.sku]))}
              title="Click to name this product"
              style={{ color: 'var(--muted)', cursor: 'pointer', textDecoration: 'underline dotted', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              Unknown Product <span style={{ fontSize: '.7rem', opacity: .7 }}>✎</span>
            </span>
          ) : row.name}
        </div>
        <div style={{ fontSize: '.73rem', color: 'var(--muted)', fontFamily: 'monospace', marginTop: 2 }}>{row.sku}</div>
      </td>

      {/* Price — editable */}
      <td
        style={{ ...tdPl, color: 'var(--accent)', cursor: 'pointer', minWidth: 70 }}
        onClick={() => { if (!editingPrice) { setEditingPrice(true); setPriceInput(String(row.price || '')); } }}
      >
        {editingPrice ? (
          <input
            autoFocus
            type="text"
            inputMode="decimal"
            value={priceInput}
            onChange={e => setPriceInput(e.target.value)}
            onBlur={() => {
              setEditingPrice(false);
              const val = parseFloat(priceInput);
              if (!isNaN(val) && val !== row.price && onPriceEdit) onPriceEdit(row.sku, row.name, val);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') e.target.blur();
              if (e.key === 'Escape') setEditingPrice(false);
            }}
            style={{ width: 70, padding: '.2rem .4rem', background: 'var(--surface2)', border: '1px solid var(--accent)', borderRadius: 4, color: 'var(--text)', fontSize: '.85rem', textAlign: 'right', outline: 'none' }}
          />
        ) : (
          <span title="Click to edit price">{fmtN(row.price)}</span>
        )}
      </td>

      {/* Cost — always opens popup on click; fill handle on hover */}
      <td style={tdPl}
        onMouseEnter={() => setCostHovered(true)}
        onMouseLeave={() => setCostHovered(false)}
      >
        <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
          {hasCostItems ? (
            <span
              onClick={() => !fillDrag && setCostPopup({ sku: row.sku, name: isUnknown ? null : row.name })}
              title="Cost breakdown — click to edit"
              style={{
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                gap: 4, padding: '3px 8px', borderRadius: 4, color: 'var(--text)',
                background: isInCostFill ? 'rgba(249,115,22,.18)' : 'rgba(255,255,255,.03)',
                border: isInCostFill ? '1px solid var(--accent)' : '1px solid var(--border)',
                minWidth: 60, transition: 'background .05s, border .05s',
              }}
            >
              <span style={{ fontSize: '.7rem', color: 'var(--accent)', opacity: .8 }}>⊞</span>
              {fmtN(costSum)}
            </span>
          ) : (
            <span
              onClick={() => !fillDrag && setCostPopup({ sku: row.sku, name: isUnknown ? null : row.name })}
              title="Click to add cost breakdown"
              style={{
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                padding: '3px 8px', borderRadius: 4,
                color: isInCostFill ? 'var(--text)' : 'var(--muted)',
                background: isInCostFill ? 'rgba(249,115,22,.18)' : 'transparent',
                border: isInCostFill ? '1px solid var(--accent)' : '1px dashed var(--border)',
                minWidth: 60, fontSize: '.85rem', transition: 'background .05s, border .05s',
              }}
            >
              —
            </span>
          )}

          {/* Fill handle — only show when this row has cost items and user is hovering or dragging */}
          {hasCostItems && (costHovered || isCostFillDrag) && (
            <div
              onMouseDown={e => {
                e.preventDefault();
                e.stopPropagation();
                setFillDrag({
                  field: 'cost',
                  value: null,
                  fromIdx: idx,
                  costItemsCopy: (costItems[row.sku] ?? []).map(i => ({ ...i })),
                });
              }}
              title="Drag to fill cost breakdown down"
              style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 8, height: 8,
                background: 'var(--accent)',
                border: '1.5px solid var(--bg, #0c0a09)',
                cursor: 'crosshair', zIndex: 10, borderRadius: 1,
                boxShadow: '0 0 0 1px var(--accent)',
              }}
            />
          )}
        </div>
      </td>

      {/* Ads — auto-computed (price × 5%) + CPP, read-only */}
      <td style={tdPl}>
        <span style={{ color: 'var(--muted)', fontSize: '.85rem' }}>{fmtN(row.adsCol)}</span>
      </td>

      {/* Qty — formula reference */}
      <RefTd varName="qty" formulaActive={isFormulaRow ? formulaActive : null} rowSku={row.sku}
        style={{ ...tdPl, color: 'var(--text)' }}>
        {fmtN(row.qty)}
      </RefTd>

      {/* Revenue — formula reference */}
      <RefTd varName="revenue" formulaActive={isFormulaRow ? formulaActive : null} rowSku={row.sku}
        style={{ ...tdPl, color: 'var(--text)', fontWeight: 600 }}>
        {fmt(row.revenue)}
      </RefTd>

      <td style={{ ...tdPl, color: 'var(--muted)' }}>{fmt(row.expense)}</td>
      <td style={{ ...tdPl, color: profitColor, fontWeight: 700 }}>{fmt(row.profit)}</td>
      <td style={{ ...tdPl, color: profitColor, fontWeight: 700 }}>{row.pct.toFixed(2)}%</td>
    </tr>
  );
}
