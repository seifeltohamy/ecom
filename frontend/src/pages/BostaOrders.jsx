import { useState, useEffect, useCallback, useRef } from 'react';
import { authFetch } from '../utils/auth.js';
import { fmt, fmtN } from '../utils/format.js';
import { S } from '../styles.js';
import Card, { CardTitle } from '../components/Card.jsx';
import Btn from '../components/Btn.jsx';
import Alert from '../components/Alert.jsx';
import Spinner from '../components/Spinner.jsx';
import DropZone from '../components/DropZone.jsx';
import StatBar from '../components/StatBar.jsx';
import DateRangeButton from '../components/DateRangeButton.jsx';

// ─── Formula evaluator ────────────────────────────────────────────────────────
// input: raw string ("88.5" or "=price*0.25")
// ctx:   { price, qty, revenue }
// returns: number | null
function evalFormula(input, ctx) {
  if (input == null || input === '') return null;
  const str  = String(input).trim();
  const expr = str.startsWith('=') ? str.slice(1) : str;
  const safe = expr
    .replace(/\bprice\b/g,   String(ctx.price))
    .replace(/\bqty\b/g,     String(ctx.qty))
    .replace(/\brevenue\b/g, String(ctx.revenue));
  if (!/^[\d\s+\-*/.()\[\]]+$/.test(safe)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = Function('"use strict"; return (' + safe + ')')();
    return isFinite(result) ? Math.round(result * 100) / 100 : null;
  } catch { return null; }
}

// ─── Editable cell with formula support ──────────────────────────────────────
// value:        raw string ("88.5" | "=price*0.25" | null) stored in pl state
// rowCtx:       { price, qty, revenue } for evaluating formulas in display
// onFormulaMode(sku, insertFn | null): notify parent when formula mode toggles
function PlEditCell({ value, onChange, rowCtx, rowSku, onFormulaMode, onFillStart, isDragging, isInFill }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const isFormulaDraft = draft.trimStart().startsWith('=');

  // Insert varName at the current cursor position
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

  // Tell parent when formula mode flips so it can highlight reference cells
  useEffect(() => {
    if (!editing) { onFormulaMode(null, null); return; }
    if (isFormulaDraft) onFormulaMode(rowSku, insertAtCursor);
    else                onFormulaMode(null, null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, isFormulaDraft]);

  // Cleanup on unmount
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
    // Store formula string as-is; store number as string too for uniform handling
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

      {/* Fill handle — visible on hover or while any drag is active */}
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

// ─── Reference cell wrapper (highlights when in formula mode) ─────────────────
function RefTd({ varName, formulaActive, rowSku, children, style }) {
  const active = formulaActive?.sku === rowSku;
  return (
    <td
      style={{
        ...style,
        position: 'relative',
        outline:    active ? '2px solid #3b82f6' : 'none',
        outlineOffset: active ? -2 : 0,
        background: active ? 'rgba(59,130,246,.09)' : style?.background ?? 'transparent',
        cursor:     active ? 'cell' : style?.cursor ?? 'default',
        transition: 'outline .1s, background .1s',
      }}
      onMouseDown={active ? e => { e.preventDefault(); formulaActive.insert(varName); } : undefined}
      title={active ? `Click to insert "${varName}"` : undefined}
    >
      {children}
      {/* Floating label */}
      {active && (
        <div style={{
          position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)',
          fontSize: '.62rem', fontFamily: 'monospace', fontWeight: 700,
          background: '#3b82f6', color: '#fff',
          padding: '1px 5px', borderRadius: 3, whiteSpace: 'nowrap',
          pointerEvents: 'none', zIndex: 20,
          boxShadow: '0 1px 4px rgba(0,0,0,.4)',
        }}>
          {varName}
        </div>
      )}
    </td>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function BostaOrders() {
  const [file,           setFile]           = useState(null);
  const [status,         setStatus]         = useState(null);
  const [report,         setReport]         = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [dateFrom,       setDateFrom]       = useState('');
  const [dateTo,         setDateTo]         = useState('');
  const [history,        setHistory]        = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // { [sku]: { cost: string|null, extra_cost: string|null } }
  const [pl,        setPl]        = useState({});
  const [adsSpent,  setAdsSpent]  = useState('');
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved'

  // Refs so doSave always reads latest values without stale closures
  const plRef       = useRef(pl);
  const adsSpentRef = useRef(adsSpent);
  plRef.current       = pl;
  adsSpentRef.current = adsSpent;

  // Skip autosave on initial load (report change triggers setPl + setAdsSpent)
  const skipAutosaveRef = useRef(false);

  // Fill-drag state
  const [fillDrag,     setFillDrag]     = useState(null); // { field, value, fromIdx }
  const [fillHoverIdx, setFillHoverIdx] = useState(null);
  const plRowsRef = useRef([]);

  // Formula-mode state: which row's cell is active + its insertAtCursor fn
  const [formulaActive, setFormulaActive] = useState(null); // { sku, insert } | null

  const handleFormulaMode = useCallback((sku, insertFn) => {
    setFormulaActive(sku && insertFn ? { sku, insert: insertFn } : null);
  }, []);

  const reportId = report?.report_id ?? report?.id ?? null;

  // Apply fill on mouseup
  useEffect(() => {
    if (!fillDrag) return;
    function handleMouseUp() {
      if (fillHoverIdx !== null && fillHoverIdx !== fillDrag.fromIdx) {
        const lo = Math.min(fillDrag.fromIdx, fillHoverIdx);
        const hi = Math.max(fillDrag.fromIdx, fillHoverIdx);
        setPl(prev => {
          const next = { ...prev };
          plRowsRef.current.forEach((row, i) => {
            if (i >= lo && i <= hi)
              next[row.sku] = { ...next[row.sku], [fillDrag.field]: fillDrag.value };
          });
          return next;
        });
      }
      setFillDrag(null);
      setFillHoverIdx(null);
    }
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [fillDrag, fillHoverIdx]);

  // Load saved P&L when report changes
  useEffect(() => {
    if (!report) { setPl({}); setAdsSpent(''); return; }
    skipAutosaveRef.current = true; // don't autosave the initial load
    const init = {};
    report.rows.forEach(row => { init[row.sku] = { cost: null, extra_cost: null }; });
    setPl(init);
    setAdsSpent('');
    setSaveState('idle');

    const id = report.report_id ?? report.id;
    if (!id) return;
    authFetch(`/reports/${id}/pl`).then(async res => {
      if (!res.ok) return;
      const data = await res.json();
      if (data.ads_spent != null) setAdsSpent(String(data.ads_spent));
      if (data.items?.length) {
        setPl(prev => {
          const next = { ...prev };
          data.items.forEach(item => {
            // Prefer formula string; fall back to numeric value as string
            next[item.sku] = {
              cost:       item.cost_formula       ?? (item.cost       != null ? String(item.cost)       : null),
              extra_cost: item.extra_cost_formula ?? (item.extra_cost != null ? String(item.extra_cost) : null),
            };
          });
          return next;
        });
      }
    });
  }, [report]);

  const updatePl = (sku, field, val) =>
    setPl(prev => ({ ...prev, [sku]: { ...prev[sku], [field]: val } }));

  // Stable save function — always reads latest values via refs
  const doSave = useCallback(async (id) => {
    if (!id) return;
    setSaveState('saving');
    const currentPl = plRef.current;
    const items = plRowsRef.current.map(row => {
      const p   = currentPl[row.sku] || {};
      const ctx = { price: row.price, qty: row.qty, revenue: row.revenue };
      const toItem = (rawVal, field) => {
        if (rawVal == null) return { [field]: null, [`${field}_formula`]: null };
        const str = String(rawVal).trim();
        if (str.startsWith('='))
          return { [field]: evalFormula(str, ctx) ?? null, [`${field}_formula`]: str };
        return { [field]: parseFloat(str) || null, [`${field}_formula`]: null };
      };
      return { sku: row.sku, price: null, ...toItem(p.cost, 'cost'), ...toItem(p.extra_cost, 'extra_cost') };
    });
    const res = await authFetch(`/reports/${id}/pl`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ads_spent: parseFloat(adsSpentRef.current) || null, items }),
    });
    setSaveState(res.ok ? 'saved' : 'idle');
    if (res.ok) setTimeout(() => setSaveState('idle'), 2500);
  }, []);

  const savePl = () => doSave(reportId);

  // Autosave — debounced 1.5 s after any pl or adsSpent change
  useEffect(() => {
    if (!reportId) return;
    if (skipAutosaveRef.current) { skipAutosaveRef.current = false; return; }
    const timer = setTimeout(() => doSave(reportId), 1500);
    return () => clearTimeout(timer);
  }, [pl, adsSpent, reportId, doSave]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res  = await authFetch('/reports');
      const data = await res.json();
      if (res.ok) setHistory(data);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const runReport = async (from, to) => {
    if (!file) return;
    setLoading(true);
    setStatus({ type: 'loading', msg: 'Processing…' });
    const fd = new FormData();
    fd.append('file', file);
    if (from) fd.append('date_from', from);
    if (to)   fd.append('date_to',   to);
    try {
      const res  = await authFetch('/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      setStatus(null);
      setReport(data);
      loadHistory();
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    } finally {
      setLoading(false);
    }
  };

  const upload     = () => runReport('', '');
  const applyDates = (from, to) => { setDateFrom(from); setDateTo(to); runReport(from, to); };
  const clear      = () => { setFile(null); setReport(null); setStatus(null); setDateFrom(''); setDateTo(''); };
  const viewReport = async (id) => {
    const res  = await authFetch(`/reports/${id}`);
    const data = await res.json();
    if (res.ok) setReport(data);
  };

  // Compute P&L rows
  const plRows = report ? report.rows.map(row => {
    const p       = pl[row.sku] || {};
    const price   = row.prices?.[0]?.price ?? 0;
    const qty     = row.total_quantity;
    const revenue = price * qty;
    const ctx     = { price, qty, revenue };
    const cost    = evalFormula(p.cost,       ctx) ?? 0;
    const extra   = evalFormula(p.extra_cost, ctx) ?? 0;
    const expense = (cost + extra) * qty;
    const profit  = revenue - expense;
    const pct     = revenue ? profit / revenue * 100 : 0;
    return { sku: row.sku, name: row.name, price, qty, revenue, expense, profit, pct };
  }) : [];

  plRowsRef.current = plRows;

  const plTotals = plRows.reduce(
    (a, r) => ({ revenue: a.revenue + r.revenue, expense: a.expense + r.expense, profit: a.profit + r.profit }),
    { revenue: 0, expense: 0, profit: 0 }
  );
  const plTotalPct = plTotals.revenue ? plTotals.profit / plTotals.revenue * 100 : 0;

  const ads  = parseFloat(adsSpent) || 0;
  const cpp  = ads && report?.order_count ? ads / report.order_count : null;
  const roas = ads && plTotals.revenue    ? plTotals.revenue / ads   : null;

  const inFillRange = (idx) => {
    if (!fillDrag || fillHoverIdx === null) return false;
    return idx >= Math.min(fillDrag.fromIdx, fillHoverIdx) && idx <= Math.max(fillDrag.fromIdx, fillHoverIdx);
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const thStyle = {
    padding: '.6rem .85rem', fontSize: '.7rem', textTransform: 'uppercase',
    letterSpacing: '.06em', color: 'var(--muted)', textAlign: 'left',
    borderBottom: '1px solid var(--border)'
  };
  const tdStyle = { padding: '.65rem .85rem', borderBottom: '1px solid var(--border)', fontSize: '.875rem' };
  const thPl = {
    padding: '.55rem .75rem', fontSize: '.72rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '.07em',
    color: 'var(--muted)', borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap', textAlign: 'right', verticalAlign: 'bottom',
  };
  const thPlLeft = { ...thPl, textAlign: 'left' };
  const tdPl = {
    padding: '.45rem .75rem', borderBottom: '1px solid var(--border)',
    fontSize: '.9rem', textAlign: 'right', whiteSpace: 'nowrap'
  };
  const tdPlLeft = { ...tdPl, textAlign: 'left' };

  const fillColBg = (field) => fillDrag?.field === field ? 'rgba(249,115,22,.04)' : 'transparent';

  return (
    <div style={{ userSelect: fillDrag ? 'none' : 'auto' }}>
      {/* ── Upload ────────────────────────────────────────────────────────── */}
      <Card>
        <CardTitle>Upload New Report</CardTitle>
        <DropZone onFile={setFile} file={file} />
        <div style={{ display: 'flex', gap: '.6rem', marginTop: '1rem', alignItems: 'center' }}>
          <Btn disabled={!file || loading} onClick={upload}>
            {loading ? <><Spinner size={13} /> Processing…</> : 'Run Report'}
          </Btn>
          {report && <Btn variant="outline" onClick={clear}>Clear</Btn>}
        </div>
        {status && <Alert type={status.type}>{status.msg}</Alert>}
      </Card>

      {/* ── P&L Table ─────────────────────────────────────────────────────── */}
      {report && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '.5rem' }}>
            <StatBar {...report} />
            <DateRangeButton file={file} onApply={applyDates} activeFrom={dateFrom} activeTo={dateTo} />
          </div>

          <Card>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <CardTitle style={{ margin: 0 }}>P&L</CardTitle>
                <p style={{ margin: '.25rem 0 0', fontSize: '.78rem', color: 'var(--muted)' }}>
                  Click Cost / Extra Cost → type <code style={{ background: 'rgba(59,130,246,.15)', color: '#93c5fd', borderRadius: 3, padding: '0 4px' }}>=</code> → click a blue cell to reference it.
                  Drag <span style={{ display: 'inline-block', width: 7, height: 7, background: 'var(--accent)', borderRadius: 1, verticalAlign: 'middle', margin: '0 2px' }} /> to fill down.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                  <label style={{ fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    Ads Spent (EGP)
                  </label>
                  <input
                    type="number" step="0.01" placeholder="0" value={adsSpent}
                    onChange={e => setAdsSpent(e.target.value)}
                    style={{
                      width: 110, background: 'var(--surface2, #1c1917)',
                      color: 'var(--text)', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '.35rem .6rem',
                      fontSize: '.9rem', fontFamily: 'inherit', outline: 'none'
                    }}
                  />
                </div>
                {ads > 0 && (
                  <div style={{ display: 'flex', gap: '.75rem' }}>
                    {[
                      { label: 'Cost / Purchase', value: cpp  != null ? `EGP ${fmt(cpp)}`     : '—' },
                      { label: 'ROAS',             value: roas != null ? `${roas.toFixed(2)}×` : '—' },
                    ].map(({ label, value }) => (
                      <div key={label} style={{
                        background: 'var(--bg, #0c0a09)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', padding: '.5rem .9rem', minWidth: 110
                      }}>
                        <div style={{ fontSize: '.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)' }}>{label}</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--accent)', marginTop: '.2rem' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                )}
                <Btn onClick={savePl} disabled={saveState === 'saving'} variant={saveState === 'saved' ? 'outline' : 'primary'}>
                  {saveState === 'saving' ? <><Spinner size={13} /> Saving…</> : saveState === 'saved' ? '✓ Saved' : 'Save P&L'}
                </Btn>
                {saveState === 'saved' && (
                  <span style={{ fontSize: '.75rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>Autosaved</span>
                )}
              </div>
            </div>

            <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={thPlLeft}>Product</th>
                    <th style={{ ...thPl, color: 'var(--muted)' }}>Price</th>
                    <th style={{ ...thPl, color: 'var(--accent)' }}>Cost</th>
                    <th style={{ ...thPl, color: 'var(--accent)' }}>Extra Cost</th>
                    <th style={thPl}>Qty Sold</th>
                    <th style={thPl}>Revenue</th>
                    <th style={thPl}>Expense</th>
                    <th style={thPl}>Profit</th>
                    <th style={thPl}>Profit %</th>
                  </tr>
                </thead>
                <tbody>
                  {plRows.map((row, idx) => {
                    const p           = pl[row.sku] || {};
                    const profitColor = row.profit >= 0 ? 'var(--accent)' : 'var(--danger, #ef4444)';
                    const rowHl       = inFillRange(idx);
                    const rowCtx      = { price: row.price, qty: row.qty, revenue: row.revenue };
                    const isFormulaRow = formulaActive?.sku === row.sku;

                    return (
                      <tr
                        key={row.sku}
                        onMouseEnter={() => fillDrag && setFillHoverIdx(idx)}
                        style={{
                          background: rowHl ? 'rgba(249,115,22,.06)' : 'transparent',
                          transition: 'background .05s',
                        }}
                      >
                        {/* Product name */}
                        <td style={tdPlLeft}>
                          <div style={{ fontWeight: 600, color: '#fafafa' }}>{row.name}</div>
                          <div style={{ fontSize: '.73rem', color: 'var(--muted)', fontFamily: 'monospace', marginTop: 2 }}>{row.sku}</div>
                        </td>

                        {/* Price — locked, but clickable as reference */}
                        <RefTd varName="price" formulaActive={isFormulaRow ? formulaActive : null} rowSku={row.sku}
                          style={{ ...tdPl, color: 'var(--muted)' }}>
                          {fmtN(row.price)}
                        </RefTd>

                        {/* Cost — editable */}
                        <td style={{ ...tdPl, background: fillColBg('cost') }}>
                          <PlEditCell
                            value={p.cost}
                            onChange={v => updatePl(row.sku, 'cost', v)}
                            rowCtx={rowCtx}
                            rowSku={row.sku}
                            onFormulaMode={handleFormulaMode}
                            onFillStart={() => setFillDrag({ field: 'cost', value: p.cost, fromIdx: idx })}
                            isDragging={!!fillDrag}
                            isInFill={rowHl && fillDrag?.field === 'cost'}
                          />
                        </td>

                        {/* Extra Cost — editable */}
                        <td style={{ ...tdPl, background: fillColBg('extra_cost') }}>
                          <PlEditCell
                            value={p.extra_cost}
                            onChange={v => updatePl(row.sku, 'extra_cost', v)}
                            rowCtx={rowCtx}
                            rowSku={row.sku}
                            onFormulaMode={handleFormulaMode}
                            onFillStart={() => setFillDrag({ field: 'extra_cost', value: p.extra_cost, fromIdx: idx })}
                            isDragging={!!fillDrag}
                            isInFill={rowHl && fillDrag?.field === 'extra_cost'}
                          />
                        </td>

                        {/* Qty — clickable reference */}
                        <RefTd varName="qty" formulaActive={isFormulaRow ? formulaActive : null} rowSku={row.sku}
                          style={{ ...tdPl, color: 'var(--text)' }}>
                          {fmtN(row.qty)}
                        </RefTd>

                        {/* Revenue — clickable reference */}
                        <RefTd varName="revenue" formulaActive={isFormulaRow ? formulaActive : null} rowSku={row.sku}
                          style={{ ...tdPl, color: 'var(--text)', fontWeight: 600 }}>
                          {fmt(row.revenue)}
                        </RefTd>

                        <td style={{ ...tdPl, color: 'var(--muted)' }}>{fmt(row.expense)}</td>
                        <td style={{ ...tdPl, color: profitColor, fontWeight: 700 }}>{fmt(row.profit)}</td>
                        <td style={{ ...tdPl, color: profitColor, fontWeight: 700 }}>{row.pct.toFixed(2)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'rgba(249,115,22,.07)', borderTop: '2px solid var(--accent)' }}>
                    <td style={{ ...tdPlLeft, fontWeight: 700, color: '#fafafa' }} colSpan={5}>Total</td>
                    <td style={{ ...tdPl, fontWeight: 700, color: 'var(--accent)' }}>{fmt(plTotals.revenue)}</td>
                    <td style={{ ...tdPl, fontWeight: 700 }}>{fmt(plTotals.expense)}</td>
                    <td style={{ ...tdPl, fontWeight: 700, color: plTotals.profit >= 0 ? 'var(--accent)' : 'var(--danger, #ef4444)' }}>
                      {fmt(plTotals.profit)}
                    </td>
                    <td style={{ ...tdPl, fontWeight: 700, color: plTotals.profit >= 0 ? 'var(--accent)' : 'var(--danger, #ef4444)' }}>
                      {plTotalPct.toFixed(2)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ── History ───────────────────────────────────────────────────────── */}
      <Card>
        <CardTitle>Report History ({history.length})</CardTitle>
        {historyLoading
          ? <Alert type="loading">Loading history…</Alert>
          : history.length === 0
            ? <div style={{ color: 'var(--muted)', fontSize: '.9rem' }}>No reports saved yet. Upload one above.</div>
            : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Uploaded</th>
                      <th style={thStyle}>Date Range</th>
                      <th style={thStyle}>Orders</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>Revenue</th>
                      <th style={{ ...thStyle, textAlign: 'right' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(h => (
                      <tr key={h.id}>
                        <td style={tdStyle}>{new Date(h.uploaded_at).toLocaleString('en-GB')}</td>
                        <td style={{ ...tdStyle, color: 'var(--muted)' }}>{h.date_from || '—'} → {h.date_to || '—'}</td>
                        <td style={tdStyle}>{fmtN(h.order_count)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', ...S.mono, color: 'var(--accent)' }}>EGP {fmt(h.grand_revenue)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <Btn variant="outline" onClick={() => viewReport(h.id)}>View</Btn>
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
