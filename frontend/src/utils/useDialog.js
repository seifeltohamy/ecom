import { useState, useCallback, useRef } from 'react';

/**
 * Hook that provides branded confirm/info dialogs as promises.
 *
 * Usage:
 *   const { dialogProps, confirm, info } = useDialog();
 *   ...
 *   <Dialog {...dialogProps} />
 *
 *   // replaces window.confirm():
 *   if (!await confirm('Delete user?', 'This cannot be undone.')) return;
 *
 *   // replaces window.alert() / alert():
 *   await info('No results', 'Nothing matched your search.');
 */
export function useDialog() {
  const [state, setState] = useState({ open: false });
  const resolveRef = useRef(null);

  const _open = useCallback((opts) => {
    return new Promise(resolve => {
      resolveRef.current = resolve;
      setState({ open: true, ...opts });
    });
  }, []);

  const confirm = useCallback((title, body, { confirmLabel = 'Confirm', variant = 'danger' } = {}) =>
    _open({ title, body, confirmLabel, cancelLabel: 'Cancel', variant, hasCancel: true }),
  [_open]);

  const info = useCallback((title, body, { confirmLabel = 'OK' } = {}) =>
    _open({ title, body, confirmLabel, hasCancel: false, variant: 'primary' }),
  [_open]);

  const dialogProps = {
    open:         state.open,
    title:        state.title,
    body:         state.body,
    confirmLabel: state.confirmLabel,
    cancelLabel:  state.cancelLabel,
    variant:      state.variant,
    onConfirm: () => { setState(s => ({ ...s, open: false })); resolveRef.current?.(true); },
    onCancel:  state.hasCancel
      ? () => { setState(s => ({ ...s, open: false })); resolveRef.current?.(false); }
      : null,
  };

  return { dialogProps, confirm, info };
}
