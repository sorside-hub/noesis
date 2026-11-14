import { useEffect, useId, useRef } from 'react';
import { useNoesis } from '../context/NoesisContext';

/**
 * Registers an ephemeral UI overlay (modal, bottom sheet, drawer, dropdown, menu)
 * into the centralized PWA Back-button LIFO stack.
 *
 * - Pressing hardware/OS Back pops only the top-most active overlay and invokes `onClose`.
 * - Closing via UI (`X`, `Done`, `Cancel`, backdrop) cleanly pops its history marker
 *   unless another navigation already replaced/dismissed it in the same tick.
 */
export function useBackOverlay(
  isOpen: boolean,
  onClose: () => void,
  debugPrefix = 'overlay'
) {
  const { registerOverlay, unregisterOverlay } = useNoesis();
  const rawId = useId();
  const overlayId = `${debugPrefix}:${rawId}`;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const registerRef = useRef(registerOverlay);
  registerRef.current = registerOverlay;

  const unregisterRef = useRef(unregisterOverlay);
  unregisterRef.current = unregisterOverlay;

  useEffect(() => {
    if (!isOpen) return;

    registerRef.current(overlayId, () => onCloseRef.current());
    return () => {
      unregisterRef.current(overlayId);
    };
  }, [isOpen, overlayId]);
}
