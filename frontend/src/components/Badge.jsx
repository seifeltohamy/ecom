export default function Badge({ children }) {
  return (
    <span style={{
      display: 'inline-block', padding: '.15rem .5rem', borderRadius: 6,
      fontSize: '.72rem', fontWeight: 600,
      background: 'var(--accent)', color: '#0c0a09',
      fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
      letterSpacing: '.02em'
    }}>{children}</span>
  );
}
