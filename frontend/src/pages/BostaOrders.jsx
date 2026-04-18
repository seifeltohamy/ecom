import { useState, useEffect, useCallback, useRef } from 'react';
import { authFetch } from '../utils/auth.js';
import { evalFormula } from '../utils/evalFormula.js';
import { fmt } from '../utils/format.js';
import Card, { CardTitle } from '../components/Card.jsx';
import Btn from '../components/Btn.jsx';
import Alert from '../components/Alert.jsx';
import Spinner from '../components/Spinner.jsx';
import DropZone from '../components/DropZone.jsx';
import StatBar from '../components/StatBar.jsx';
import AutomateModal from '../components/AutomateModal.jsx';
import DiscountsPanel from '../components/DiscountsPanel.jsx';
import CostPopup from '../components/pl/CostPopup.jsx';
import AdsetPopup from '../components/pl/AdsetPopup.jsx';
import PlTableRow from '../components/pl/PlTableRow.jsx';
import ReportHistory from '../components/ReportHistory.jsx';

// ── P&L table header/footer styles ──────────────────────────────────────────
const thPl     = { padding: '.55rem .75rem', fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', textAlign: 'right', verticalAlign: 'bottom' };
const thPlLeft = { ...thPl, textAlign: 'left' };
const tdPl     = { padding: '.45rem .75rem', borderBottom: '1px solid var(--border)', fontSize: '.9rem', textAlign: 'right', whiteSpace: 'nowrap' };
const tdPlLeft = { ...tdPl, textAlign: 'left' };

export default function BostaOrders() {
  // ── Fulfillment provider toggle ─────────────────────────────────────────────
  const [provider, setProvider] = useState('bosta');

  // ── Upload state ───────────────────────────────────────────────────────────
  const [file,    setFile]    = useState(null);
  const [status,  setStatus]  = useState(null);
  const [report,  setReport]  = useState(null);
  const [loading, setLoading] = useState(false);

  // ── Automation modal ───────────────────────────────────────────────────────
  const [automateOpen, setAutomateOpen] = useState(false);

  // ── Discounts / Offers ─────────────────────────────────────────────────────
  const [offers,        setOffers]        = useState([]);
  const [discountsOpen, setDiscountsOpen] = useState(false);
  // Reset offers whenever a new report loads
  useEffect(() => { setOffers([]); }, [report]);

  // ── Upload date-confirm phase ──────────────────────────────────────────────
  // { fileId, dateFrom, dateTo } while waiting for user to confirm dates; null otherwise
  const [uploadPending, setUploadPending] = useState(null);

  // ── History ────────────────────────────────────────────────────────────────
  const [history,        setHistory]        = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // ── P&L state ──────────────────────────────────────────────────────────────
  const [pl,        setPl]        = useState({});   // { [sku]: { cost, extra_cost } }
  const [adsSpent,  setAdsSpent]  = useState('');
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved'

  // ── Cost items (global per brand/SKU) ──────────────────────────────────────
  const [costItems, setCostItems] = useState({});  // { [sku]: [{name,amount}] }
  const [costPopup, setCostPopup] = useState(null); // { sku, name } | null

  // ── Adset tracking ────────────────────────────────────────────────────────
  const [productAdsets, setProductAdsets] = useState({});  // { sku: [adset_id] }
  const [adsetData, setAdsetData] = useState([]);          // [{adset_id, spend, ...}]
  const [adsetPopupSkus, setAdsetPopupSkus] = useState(null); // [sku] or null
  const [selectedSkus, setSelectedSkus] = useState(new Set()); // for Group Adsets multi-select

  // ── Unknown-product inline naming ─────────────────────────────────────────
  const [namingSkus, setNamingSkus] = useState(new Set());
  const [nameInputs, setNameInputs] = useState({});

  // ── Fill-drag ──────────────────────────────────────────────────────────────
  const [fillDrag,     setFillDrag]     = useState(null); // { field, value, fromIdx, costItemsCopy? }
  const [fillHoverIdx, setFillHoverIdx] = useState(null);
  const plRowsRef = useRef([]);

  // ── Formula mode ──────────────────────────────────────────────────────────
  const [formulaActive, setFormulaActive] = useState(null); // { sku, insert } | null
  const handleFormulaMode = useCallback((sku, insertFn) => {
    setFormulaActive(sku && insertFn ? { sku, insert: insertFn } : null);
  }, []);

  // ── Autosave refs (avoid stale closures) ──────────────────────────────────
  const plRef       = useRef(pl);
  const adsSpentRef = useRef(adsSpent);
  plRef.current       = pl;
  adsSpentRef.current = adsSpent;
  const skipAutosaveRef = useRef(false);

  const reportId = report?.report_id ?? report?.id ?? null;

  // ── Effects ───────────────────────────────────────────────────────────────

  // Fill drag: apply on mouseup
  useEffect(() => {
    if (!fillDrag) return;
    function handleMouseUp() {
      if (fillHoverIdx !== null && fillHoverIdx !== fillDrag.fromIdx) {
        const lo = Math.min(fillDrag.fromIdx, fillHoverIdx);
        const hi = Math.max(fillDrag.fromIdx, fillHoverIdx);

        if (fillDrag.costItemsCopy) {
          const sum      = fillDrag.costItemsCopy.reduce((a, i) => a + i.amount, 0);
          const affected = plRowsRef.current.filter((_, i) => i >= lo && i <= hi);
          setCostItems(prev => {
            const next = { ...prev };
            affected.forEach(row => { next[row.sku] = fillDrag.costItemsCopy.map(i => ({ ...i })); });
            return next;
          });
          setPl(prev => {
            const next = { ...prev };
            affected.forEach(row => { next[row.sku] = { ...next[row.sku], cost: String(Math.round(sum * 100) / 100) }; });
            return next;
          });
          affected.forEach(row => authFetch(`/sku-cost-items/${encodeURIComponent(row.sku)}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: fillDrag.costItemsCopy }),
          }));
        } else {
          setPl(prev => {
            const next = { ...prev };
            plRowsRef.current.forEach((row, i) => {
              if (i >= lo && i <= hi)
                next[row.sku] = { ...next[row.sku], [fillDrag.field]: fillDrag.value };
            });
            return next;
          });
        }
      }
      setFillDrag(null);
      setFillHoverIdx(null);
    }
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [fillDrag, fillHoverIdx]);

  // Fetch cost items + product-adset assignments on mount
  useEffect(() => {
    authFetch('/sku-cost-items').then(async res => {
      if (res.ok) setCostItems(await res.json());
    });
    authFetch('/meta/product-adsets').then(async res => {
      if (res.ok) setProductAdsets(await res.json());
    });
  }, []);

  // Fetch adset-level spend when report loads (scoped to report date range)
  useEffect(() => {
    if (!report?.date_from || !report?.date_to) { setAdsetData([]); return; }
    authFetch(`/meta/adsets?date_from=${report.date_from}&date_to=${report.date_to}`)
      .then(async res => {
        if (res.ok) {
          const d = await res.json();
          setAdsetData(d.rows || []);
        }
      })
      .catch(() => {});
  }, [report?.date_from, report?.date_to]);

  // Load P&L when report changes
  useEffect(() => {
    if (!report) { setPl({}); setAdsSpent(''); return; }
    skipAutosaveRef.current = true;
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
      if (data.ads_spent != null) {
        setAdsSpent(String(data.ads_spent));
      } else if (report.date_from && report.date_to) {
        // Auto-fill from Meta if no ads_spent saved yet
        authFetch(`/meta/summary?date_from=${report.date_from}&date_to=${report.date_to}`)
          .then(r => r.json())
          .then(m => { if (m?.connected && m.spend > 0) setAdsSpent(String(m.spend)); })
          .catch(() => {});
      }
      if (data.items?.length) {
        setPl(prev => {
          const next = { ...prev };
          data.items.forEach(item => {
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

  // Autosave P&L — debounced 1.5s
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
      return { sku: row.sku, price: null, ...toItem(p.cost, 'cost'), extra_cost: null, extra_cost_formula: null };
    });
    const res = await authFetch(`/reports/${id}/pl`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ads_spent: null, items }),
    });
    setSaveState(res.ok ? 'saved' : 'idle');
    if (res.ok) setTimeout(() => setSaveState('idle'), 2500);
  }, []);

  useEffect(() => {
    if (!reportId) return;
    if (skipAutosaveRef.current) { skipAutosaveRef.current = false; return; }
    const timer = setTimeout(() => doSave(reportId), 1500);
    return () => clearTimeout(timer);
  }, [pl, reportId, doSave]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const updatePl = (sku, field, val) =>
    setPl(prev => ({ ...prev, [sku]: { ...prev[sku], [field]: val } }));

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res  = await authFetch('/reports');
      const data = await res.json();
      if (res.ok) setHistory(data);
    } finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => {
    authFetch('/settings').then(r => r.json()).then(d => {
      if (d.fulfillment_provider) setProvider(d.fulfillment_provider);
    }).catch(() => {});
  }, []);

  // Phase 1: upload file → detect date range
  const upload = async () => {
    if (!file) return;
    setLoading(true);
    setStatus({ type: 'loading', msg: 'Sorting rows…' });
    const fd = new FormData();
    fd.append('file', file);
    fd.append('provider', provider);
    try {
      const res  = await authFetch('/upload/prepare', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      setStatus(null);
      setUploadPending({ fileId: data.file_id, dateFrom: data.date_from, dateTo: data.date_to });
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    } finally { setLoading(false); }
  };

  // Phase 2: confirm date range → run report
  const confirmUpload = async () => {
    if (!uploadPending) return;
    setLoading(true);
    setStatus({ type: 'loading', msg: 'Processing…' });
    try {
      const res  = await authFetch(`/automation/upload/${uploadPending.fileId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date_from: uploadPending.dateFrom, date_to: uploadPending.dateTo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Processing failed');
      setStatus(null); setReport(data); setUploadPending(null); loadHistory();
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    } finally { setLoading(false); }
  };

  const clear = () => { setFile(null); setReport(null); setStatus(null); setUploadPending(null); };

  const deleteReport = async (id) => {
    await authFetch(`/reports/${id}`, { method: 'DELETE' });
    setHistory(prev => prev.filter(h => h.id !== id));
    if (report?.id === id || report?.report_id === id) { setReport(null); }
  };

  const viewReport = async (id) => {
    const res  = await authFetch(`/reports/${id}`);
    const data = await res.json();
    if (res.ok) setReport(data);
  };

  async function saveProductName(sku) {
    const name = (nameInputs[sku] ?? '').trim();
    if (!name) { setNamingSkus(prev => { const s = new Set(prev); s.delete(sku); return s; }); return; }
    const res = await authFetch('/products', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, name }),
    });
    if (res.ok) setReport(prev => ({ ...prev, rows: prev.rows.map(r => r.sku === sku ? { ...r, name } : r) }));
    setNamingSkus(prev => { const s = new Set(prev); s.delete(sku); return s; });
  }

  function handleCostPopupSave(sku, items) {
    setCostItems(prev => ({ ...prev, [sku]: items }));
    const sum = items.reduce((a, i) => a + i.amount, 0);
    updatePl(sku, 'cost', String(Math.round(sum * 100) / 100));
    setCostPopup(null);
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  // Build adset spend lookup: {adset_id: spend}
  const adsetSpendMap = {};
  adsetData.forEach(a => { adsetSpendMap[a.adset_id] = a.spend; });

  // Count how many products share each adset (for equal split)
  const adsetProductCount = {};
  Object.entries(productAdsets).forEach(([, ids]) => {
    ids.forEach(id => { adsetProductCount[id] = (adsetProductCount[id] || 0) + 1; });
  });

  const plRows = report ? report.rows.map(row => {
    const p       = pl[row.sku] || {};
    const price   = row.prices?.[0]?.price ?? 0;
    const qty     = row.total_quantity;
    const revenue = price * qty;
    const ctx     = { price, qty, revenue };

    const items  = costItems[row.sku];
    const cost   = items?.length ? items.reduce((a, i) => a + i.amount, 0) : (evalFormula(p.cost, ctx) ?? 0);

    // CPP from assigned adsets (equal split per product)
    const assignedAdsets = productAdsets[row.sku] || [];
    let productAdsSpent = 0;
    assignedAdsets.forEach(adId => {
      const spend = adsetSpendMap[adId] || 0;
      const count = adsetProductCount[adId] || 1;
      productAdsSpent += spend / count;
    });
    const cpp = qty > 0 ? productAdsSpent / qty : 0;

    const expense = (cost + cpp) * qty;
    const profit  = revenue - expense;
    const pct     = revenue ? profit / revenue * 100 : 0;
    return { sku: row.sku, name: row.name, price, qty, revenue, cpp: Math.round(cpp * 100) / 100, adsSpent: Math.round(productAdsSpent * 100) / 100, expense, profit, pct };
  }) : [];

  plRowsRef.current = plRows;

  const plTotals   = plRows.reduce((a, r) => ({ revenue: a.revenue + r.revenue, expense: a.expense + r.expense, profit: a.profit + r.profit }), { revenue: 0, expense: 0, profit: 0 });
  const plTotalPct = plTotals.revenue ? plTotals.profit / plTotals.revenue * 100 : 0;
  const totalAdsSpent = plRows.reduce((s, r) => s + (r.adsSpent || 0), 0);
  const totalRoas     = totalAdsSpent > 0 ? plTotals.revenue / totalAdsSpent : null;

  // ── Offer-adjusted totals ──────────────────────────────────────────────────
  const offerTotals = offers.length > 0 ? plRows.reduce((acc, row) => {
    const offer = offers.find(o => o.skus.includes(row.sku));
    let revenue = row.revenue;
    if (offer) {
      if (offer.type === 'b2g1') {
        revenue = (row.qty - Math.floor(row.qty / 3)) * row.price;
      } else {
        revenue = row.revenue * (1 - offer.discountPct / 100);
      }
    }
    const profit = revenue - row.expense;
    return { revenue: acc.revenue + revenue, expense: acc.expense + row.expense, profit: acc.profit + profit };
  }, { revenue: 0, expense: 0, profit: 0 }) : null;
  const offerTotalPct = offerTotals?.revenue ? offerTotals.profit / offerTotals.revenue * 100 : 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ userSelect: fillDrag ? 'none' : 'auto' }}>

      {costPopup && (
        <CostPopup
          sku={costPopup.sku}
          name={costPopup.name}
          initialItems={costItems[costPopup.sku] ?? []}
          onSave={handleCostPopupSave}
          onClose={() => setCostPopup(null)}
        />
      )}

      {adsetPopupSkus && (
        <AdsetPopup
          skus={adsetPopupSkus}
          skuNames={Object.fromEntries((report?.rows || []).map(r => [r.sku, r.name]))}
          dateFrom={report?.date_from || ''}
          dateTo={report?.date_to || ''}
          initialAdsets={productAdsets}
          qtyBySku={Object.fromEntries((report?.rows || []).map(r => [r.sku, r.total_quantity]))}
          onSave={(skus, adsetIds) => {
            setProductAdsets(prev => {
              const next = { ...prev };
              skus.forEach(s => { next[s] = adsetIds; });
              return next;
            });
            setAdsetPopupSkus(null);
            setSelectedSkus(new Set());
          }}
          onClose={() => setAdsetPopupSkus(null)}
        />
      )}

      {/* Provider toggle */}
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
        {['bosta', 'chainz'].map(p => (
          <button
            key={p}
            onClick={() => {
              setProvider(p);
              authFetch('/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fulfillment_provider: p }),
              });
            }}
            style={{
              padding: '.5rem 1.25rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              border: provider === p ? '1px solid var(--accent)' : '1px solid var(--border2)',
              background: provider === p ? 'var(--accent)' : 'transparent',
              color: provider === p ? '#fff' : 'var(--muted)',
              fontWeight: 600, fontSize: '.85rem', transition: 'all .15s',
            }}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {automateOpen && (
        <AutomateModal
          provider={provider}
          onDone={data => { setReport(data); loadHistory(); setAutomateOpen(false); }}
          onClose={() => setAutomateOpen(false)}
        />
      )}

      {/* Upload */}
      <Card>
        <CardTitle>Upload New Report</CardTitle>
        <DropZone onFile={f => { setFile(f); setUploadPending(null); }} file={file} />

        {/* Phase 2: date confirmation */}
        {uploadPending && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--surface2, var(--bg))', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '.85rem', fontWeight: 600, marginBottom: '.75rem', color: 'var(--text)' }}>
              Detected date range — adjust if needed:
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ fontSize: '.82rem', color: 'var(--muted)' }}>
                From&nbsp;
                <input type="date" value={uploadPending.dateFrom}
                  onChange={e => setUploadPending(p => ({ ...p, dateFrom: e.target.value }))}
                  style={{ marginLeft: '.25rem', padding: '.25rem .4rem', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '.85rem' }} />
              </label>
              <label style={{ fontSize: '.82rem', color: 'var(--muted)' }}>
                To&nbsp;
                <input type="date" value={uploadPending.dateTo}
                  onChange={e => setUploadPending(p => ({ ...p, dateTo: e.target.value }))}
                  style={{ marginLeft: '.25rem', padding: '.25rem .4rem', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '.85rem' }} />
              </label>
              <Btn disabled={loading} onClick={confirmUpload}>
                {loading ? <><Spinner size={13} /> Processing…</> : 'Process'}
              </Btn>
              <Btn variant="outline" onClick={() => setUploadPending(null)}>Cancel</Btn>
            </div>
          </div>
        )}

        {!uploadPending && (
          <div style={{ display: 'flex', gap: '.6rem', marginTop: '1rem', alignItems: 'center' }}>
            <Btn disabled={!file || loading} onClick={upload}>
              {loading ? <><Spinner size={13} /> Sorting…</> : 'Run Report'}
            </Btn>
            <Btn variant="outline" onClick={() => setAutomateOpen(true)}>
              Automate {provider === 'chainz' ? 'Chainz' : 'Bosta'} Export
            </Btn>
            {report && <Btn variant="outline" onClick={clear}>Clear</Btn>}
          </div>
        )}
        {status && <Alert type={status.type}>{status.msg}</Alert>}
      </Card>

      {/* P&L */}
      {report && (
        <>
          <Card>
            {/* P&L header: title + ads controls + save */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <CardTitle style={{ margin: 0 }}>P&L</CardTitle>
                <p style={{ margin: '.25rem 0 0', fontSize: '.78rem', color: 'var(--muted)' }}>
                  Double-click Cost for itemised breakdown.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap' }}>
                {selectedSkus.size >= 2 && (
                  <Btn onClick={() => setAdsetPopupSkus(Array.from(selectedSkus))}>
                    Group Adsets ({selectedSkus.size})
                  </Btn>
                )}
                <Btn onClick={() => doSave(reportId)} disabled={saveState === 'saving'} variant={saveState === 'saved' ? 'outline' : 'primary'}>
                  {saveState === 'saving' ? <><Spinner size={13} /> Saving…</> : saveState === 'saved' ? '✓ Saved' : 'Save P&L'}
                </Btn>
                {saveState === 'saved' && <span style={{ fontSize: '.75rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>Autosaved</span>}
                <Btn variant="outline" onClick={() => setDiscountsOpen(true)}>
                  Discounts{offers.length > 0 ? ` (${offers.length})` : ''}
                </Btn>
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ ...thPl, width: 28, padding: '.4rem' }}>
                      <input
                        type="checkbox"
                        checked={plRows.length > 0 && selectedSkus.size === plRows.length}
                        onChange={e => {
                          if (e.target.checked) setSelectedSkus(new Set(plRows.map(r => r.sku)));
                          else setSelectedSkus(new Set());
                        }}
                        style={{ cursor: 'pointer' }}
                        title="Select all for Group Adsets"
                      />
                    </th>
                    <th style={thPlLeft}>Product</th>
                    <th style={{ ...thPl, color: 'var(--muted)' }}>Price</th>
                    <th style={{ ...thPl, color: 'var(--accent)' }}>Cost</th>
                    <th style={{ ...thPl, color: 'var(--accent)' }} title="Cost Per Purchase from assigned adsets">CPP</th>
                    <th style={thPl}>Qty Sold</th>
                    <th style={thPl}>Revenue</th>
                    <th style={thPl}>Expense</th>
                    <th style={thPl}>Profit</th>
                    <th style={thPl}>Profit %</th>
                  </tr>
                </thead>
                <tbody>
                  {plRows.map((row, idx) => (
                    <PlTableRow
                      key={row.sku}
                      row={row} idx={idx}
                      pl={pl} costItems={costItems}
                      fillDrag={fillDrag} setFillDrag={setFillDrag}
                      fillHoverIdx={fillHoverIdx} setFillHoverIdx={setFillHoverIdx}
                      formulaActive={formulaActive} handleFormulaMode={handleFormulaMode}
                      namingSkus={namingSkus} setNamingSkus={setNamingSkus}
                      nameInputs={nameInputs} setNameInputs={setNameInputs}
                      updatePl={updatePl} setCostPopup={setCostPopup}
                      saveProductName={saveProductName}
                      onPriceEdit={async (sku, name, price) => {
                        await authFetch('/products', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ sku, name, price }),
                        });
                        setReport(prev => {
                          if (!prev?.rows) return prev;
                          const rows = prev.rows.map(r => {
                            if (r.sku !== sku) return r;
                            const qty = r.total_quantity;
                            const rev = price * qty;
                            return { ...r, prices: [{ price, quantity: qty, total: rev }], total_revenue: rev };
                          });
                          const grand_revenue = rows.reduce((s, r) => s + r.total_revenue, 0);
                          return { ...prev, rows, grand_revenue };
                        });
                      }}
                      onCppClick={(sku) => setAdsetPopupSkus([sku])}
                      selected={selectedSkus.has(row.sku)}
                      onSelectToggle={(sku) => setSelectedSkus(prev => {
                        const next = new Set(prev);
                        if (next.has(sku)) next.delete(sku); else next.add(sku);
                        return next;
                      })}
                    />
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'rgba(249,115,22,.07)', borderTop: '2px solid var(--accent)' }}>
                    <td style={{ ...tdPlLeft, fontWeight: 700, color: '#fafafa' }} colSpan={4}>Total</td>
                    <td style={{ ...tdPl, fontWeight: 700, color: 'var(--accent)', fontSize: '.75rem' }}>{totalAdsSpent > 0 ? `EGP ${fmt(totalAdsSpent)}` : ''}</td>
                    <td style={tdPl} />
                    <td style={{ ...tdPl, fontWeight: 700, color: 'var(--accent)' }}>{fmt(plTotals.revenue)}</td>
                    <td style={{ ...tdPl, fontWeight: 700 }}>{fmt(plTotals.expense)}</td>
                    <td style={{ ...tdPl, fontWeight: 700, color: plTotals.profit >= 0 ? 'var(--accent)' : 'var(--danger, #ef4444)' }}>{fmt(plTotals.profit)}</td>
                    <td style={{ ...tdPl, fontWeight: 700, color: plTotals.profit >= 0 ? 'var(--accent)' : 'var(--danger, #ef4444)' }}>{plTotalPct.toFixed(2)}%</td>
                  </tr>
                  {totalRoas != null && (
                    <tr style={{ background: 'rgba(249,115,22,.04)' }}>
                      <td style={{ ...tdPlLeft, fontSize: '.78rem', color: 'var(--muted)' }} colSpan={4}>ROAS</td>
                      <td style={{ ...tdPl, fontWeight: 700, color: totalRoas >= 2 ? 'var(--success)' : totalRoas >= 1 ? 'var(--accent)' : 'var(--danger)' }} colSpan={6}>
                        {totalRoas.toFixed(2)}×
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          </Card>

          {discountsOpen && (
            <DiscountsPanel
              report={report}
              offers={offers}
              onOffersChange={setOffers}
              onClose={() => setDiscountsOpen(false)}
            />
          )}

          {/* Stats — below P&L table */}
          <StatBar
            orderCount={report.order_count}
            revenue={plTotals.revenue}
            expense={plTotals.expense}
            profit={plTotals.profit}
            profitPct={plTotalPct}
          />

          {/* Analytics after offers — only shown when offers are active */}
          {offerTotals && (
            <StatBar
              title="Analytics after offers"
              orderCount={report.order_count}
              revenue={offerTotals.revenue}
              expense={offerTotals.expense}
              profit={offerTotals.profit}
              profitPct={offerTotalPct}
            />
          )}
        </>
      )}

      <ReportHistory history={history} loading={historyLoading} onView={viewReport} onDelete={deleteReport} />
    </div>
  );
}
