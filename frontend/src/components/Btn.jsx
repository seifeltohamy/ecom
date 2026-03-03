import { S } from '../styles.js';

export default function Btn({ variant = 'primary', disabled, onClick, children, style }) {
  const v = variant === 'primary' ? S.btnPrimary
          : variant === 'danger'  ? S.btnDanger
          : S.btnOutline;
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{ ...S.btnBase, ...v, ...(disabled ? S.btnDisabled : {}), ...style }}
    >
      {children}
    </button>
  );
}
