import { useEffect, useState } from 'react';

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'radio',
  'submit',
  'reset',
  'file',
  'color',
  'range',
  'hidden',
  'image',
]);

const isTextEditableElement = (el: Element | null): boolean => {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
    return true;
  }
  if (el.tagName === 'TEXTAREA') {
    const ta = el as HTMLTextAreaElement;
    return !ta.readOnly && !ta.disabled;
  }
  if (el.tagName === 'INPUT') {
    const input = el as HTMLInputElement;
    const type = (input.type || 'text').toLowerCase();
    return !NON_TEXT_INPUT_TYPES.has(type) && !input.readOnly && !input.disabled;
  }
  return false;
};

const syncKeyboardOffsetCssVar = (offsetPx: number) => {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty(
    '--noesis-kb-offset',
    `${Math.max(0, Math.round(offsetPx))}px`
  );
};

// Shared singleton state so all consumers (App, MobileNav, TiptapEditor) stay in lockstep
// and share a consistent full-screen baseline height even when components mount later.
let currentKeyboardOpen = false;
let baselineHeight = 0;
let lastKnownWidth = 0;
let initialized = false;
let blurTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<(open: boolean) => void>();

const setKeyboardState = (next: boolean) => {
  if (currentKeyboardOpen === next) return;
  currentKeyboardOpen = next;
  if (!next) {
    syncKeyboardOffsetCssVar(0);
  }
  listeners.forEach((cb) => cb(next));
};

const updateOffset = () => {
  if (typeof window === 'undefined') return;
  const vv = window.visualViewport;
  if (!vv || window.innerWidth >= 768 || !currentKeyboardOpen) {
    syncKeyboardOffsetCssVar(0);
    return;
  }
  const gap = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
  syncKeyboardOffsetCssVar(gap);
};

const evaluateVisualViewport = () => {
  if (typeof window === 'undefined') return;
  const width = window.innerWidth;

  if (width >= 768) {
    setKeyboardState(false);
    syncKeyboardOffsetCssVar(0);
    return;
  }

  const vv = window.visualViewport;
  const currentHeight = vv?.height ?? window.innerHeight;

  // Reset baseline on orientation change or significant width change
  if (baselineHeight === 0 || Math.abs(width - lastKnownWidth) > 80) {
    lastKnownWidth = width;
    baselineHeight = Math.max(window.innerHeight, currentHeight);
    setKeyboardState(false);
    syncKeyboardOffsetCssVar(0);
    return;
  }

  if (currentHeight > baselineHeight) {
    baselineHeight = currentHeight;
  }

  const shrink = baselineHeight - currentHeight;
  // Require both >=150px and >=20% viewport shrink so browser URL bar collapse/expand on scroll never triggers
  const openThreshold = Math.max(150, baselineHeight * 0.2);
  const closeThreshold = Math.max(80, baselineHeight * 0.1);

  if (shrink >= openThreshold) {
    setKeyboardState(true);
    updateOffset();
  } else if (shrink < closeThreshold) {
    setKeyboardState(false);
    syncKeyboardOffsetCssVar(0);
  } else if (currentKeyboardOpen) {
    updateOffset();
  }
};

const initGlobalListeners = () => {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  lastKnownWidth = window.innerWidth;
  baselineHeight = Math.max(window.innerHeight, window.visualViewport?.height || 0);

  const vv = window.visualViewport;
  if (vv) {
    // VisualViewport is the Single Source of Truth on modern mobile browsers (immune to scroll gestures)
    vv.addEventListener('resize', evaluateVisualViewport);
    vv.addEventListener('scroll', updateOffset);
    window.addEventListener('resize', evaluateVisualViewport);
  } else {
    // Legacy fallback only when visualViewport is unavailable
    const handleFocusIn = (e: FocusEvent) => {
      if (window.innerWidth >= 768) return;
      if (blurTimer) {
        clearTimeout(blurTimer);
        blurTimer = null;
      }
      if (isTextEditableElement(e.target as Element | null)) {
        setKeyboardState(true);
      }
    };
    const handleFocusOut = () => {
      if (window.innerWidth >= 768) return;
      if (blurTimer) clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        if (!isTextEditableElement(document.activeElement)) {
          setKeyboardState(false);
        }
      }, 100);
    };
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    window.addEventListener('resize', evaluateVisualViewport);
  }
};

/**
 * Detects whether a mobile virtual keyboard is genuinely open using `visualViewport` height deltas
 * (immune to scroll gestures and browser address bar animations) and keeps `--noesis-kb-offset`
 * synced so mobile toolbars sit flush above the keyboard and bottom navigation hides only while typing.
 */
export function useVirtualKeyboardOpen(): boolean {
  const [isOpen, setIsOpen] = useState<boolean>(currentKeyboardOpen);

  useEffect(() => {
    initGlobalListeners();
    evaluateVisualViewport();
    setIsOpen(currentKeyboardOpen);

    listeners.add(setIsOpen);
    return () => {
      listeners.delete(setIsOpen);
    };
  }, []);

  return isOpen;
}
