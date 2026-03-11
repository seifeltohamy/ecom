import { useState, useEffect, useRef } from 'react';
import { evalFormula } from '../../utils/evalFormula.js';
import { fmtN } from '../../utils/format.js';

/**
 * Editable table cell with formula support.
 * value:         raw string ("88.5" | "=price*0.25" | null)
 * rowCtx:        { price, qty, revenue }
 * onFormulaMode: (sku, insertFn | null) → notify parent when formula mode toggles
 */
export default function PlEditCell({ value, onChange, rowCtx, rowSku, onFormulaMode, onFillStart, isDragging, isInFill }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const isFormulaDraft = draft.trimStart().startsWith('=');

  function insertAtCursor(varName) {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const next  = draftRef.current.slice(0, start) + varName + draftRef.current.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      if (!inputRef.current) return;
      inputRef.current.focus();
      inputRef.current.setSelectionRange(start + varName.length, start + varName.length);
    });
  }

  useEffect(() => {
    if (!editing) { onFormulaMode(null, null); return; }
    if (isFormulaDraft) onFormulaMode(rowSku, insertAtCursor);
    else                onFormulaMode(null, null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, isFormulaDraft]);

  useEffect(() => () => onFormulaMode(null, null), []); // eslint-disable-line react-hooks/exhaustive-deps

  function start() {
    if (isDragging) return;
    setDraft(value ?? '');
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const str = draft.trim();
    if (str === '') { onChange(null); return; }
    if (str.startsWith('=')) { onChange(str); return; }
    const n = parseFloat(str);
    onChange(isNaN(n) ? null : String(n));
  }

  const computed     = evalFormula(value, rowCtx);
  const isFormulaVal = value != null && String(value).trimStart().startsWith('=');
  const isError      = isFormulaVal && computed === null;

  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter')  { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { setEditing(false); }
        }}
        style={{
          width: '100%', boxSizing: 'border-box',
          background:  isFormulaDraft ? 'rgba(59,130,246,.13)' : 'var(--surface2, #1c1917)',
          color:       isFormulaDraft ? '#93c5fd' : 'var(--text)',
          border:      `1px solid ${isFormulaDraft ? '#3b82f6' : 'var(--accent)'}`,
          borderRadius: 4, padding: '3px 8px', fontSize: '.9rem',
          fontFamily:  isFormulaDraft ? 'monospace' : 'inherit',
          outline: 'none',
        }}
      />
    );
  }

  return (
    <div
      style={{ position: 'relative', display: 'inline-block', width: '100%' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        onClick={start}
        title={isFormulaVal ? `Formula: ${value}` : 'Click to edit'}
        style={{
          cursor: 'text', display: 'flex', alignItems: 'center', gap: 4,
          minWidth: 60, padding: '3px 8px', borderRadius: 4,
          color: isError
            ? 'var(--danger, #ef4444)'
            : value == null ? 'var(--muted)' : 'var(--text)',
          background: isInFill
            ? 'rgba(249,115,22,.18)'
            : hovered ? 'rgba(255,255,255,.05)' : 'transparent',
          border: isInFill ? '1px solid var(--accent)' : '1px solid transparent',
          transition: 'background .1s, border .1s',
        }}
      >
        {isFormulaVal && (
          <span style={{ fontSize: '.65rem', color: '#60a5fa', fontStyle: 'italic', fontFamily: 'monospace', lineHeight: 1 }}>
            ƒ
          </span>
        )}
        {value == null ? '—' : isError ? '#ERR' : fmtN(computed)}
      </span>

      {!editing && (hovered || isDragging) && (
        <div
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onFillStart(); }}
          title="Drag to fill down"
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
  );
}
