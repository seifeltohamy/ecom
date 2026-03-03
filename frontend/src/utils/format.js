export const fmt  = n => Number(n || 0).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtN = n => Number(n || 0).toLocaleString();
