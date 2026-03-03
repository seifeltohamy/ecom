export default function Spinner({ size = 16 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      borderRadius: '50%', border: '2px solid var(--border2)',
      borderTopColor: 'var(--accent)', animation: 'spin .6s linear infinite',
      flexShrink: 0
    }} />
  );
}
