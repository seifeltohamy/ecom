// Activity pill colour palette — cycles by activity id
const ACT_COLORS = [
  { bg: 'rgba(249,115,22,0.15)', text: 'var(--accent)' },
  { bg: 'rgba(34,197,94,0.15)',  text: 'var(--success)' },
  { bg: 'rgba(96,165,250,0.15)', text: '#60a5fa' },
  { bg: 'rgba(168,85,247,0.15)', text: '#c084fc' },
  { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24' },
];

export function actColor(id) {
  return ACT_COLORS[(id - 1) % ACT_COLORS.length];
}

export function deadlineBadge(deadline) {
  if (!deadline) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(deadline + 'T00:00:00');
  if (isNaN(due.getTime())) return null;
  const diff = Math.round((due - today) / 86400000);
  let color = 'var(--muted)';
  if (diff < 0) color = 'var(--danger)';
  else if (diff <= 7) color = 'var(--accent)';
  const label = diff < 0 ? `${Math.abs(diff)}d overdue` : diff === 0 ? 'Today' : `${diff}d left`;
  return <span style={{ fontSize: '.7rem', color, fontWeight: 600 }}>{label}</span>;
}

export const InsertLine = () => (
  <div style={{ height: 2, background: 'var(--accent)', borderRadius: 2, margin: '2px 0', flexShrink: 0 }} />
);
