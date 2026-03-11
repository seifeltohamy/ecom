/**
 * Evaluate a P&L formula string against a row context.
 * input: raw string ("88.5" | "=price*0.25" | null)
 * ctx:   { price, qty, revenue }
 * returns: number | null
 */
export function evalFormula(input, ctx) {
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
