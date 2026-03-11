/**
 * Table cell wrapper that glows and becomes clickable when formula mode is active.
 * Clicking inserts the variable name into the active formula input.
 */
export default function RefTd({ varName, formulaActive, rowSku, children, style }) {
  const active = formulaActive?.sku === rowSku;
  return (
    <td
      style={{
        ...style,
        position: 'relative',
        outline:       active ? '2px solid #3b82f6' : 'none',
        outlineOffset: active ? -2 : 0,
        background:    active ? 'rgba(59,130,246,.09)' : style?.background ?? 'transparent',
        cursor:        active ? 'cell' : style?.cursor ?? 'default',
        transition: 'outline .1s, background .1s',
      }}
      onMouseDown={active ? e => { e.preventDefault(); formulaActive.insert(varName); } : undefined}
      title={active ? `Click to insert "${varName}"` : undefined}
    >
      {children}
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
