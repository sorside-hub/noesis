import { useEffect, useRef } from 'react';

// In-memory store of scroll positions across views and documents
const scrollPositions = new Map<string, number>();
const activeScrollElements = new Map<string, HTMLElement>();

export function getScrollPosition(key: string): number {
  return scrollPositions.get(key) || 0;
}

export function saveScrollPosition(key: string, pos: number) {
  scrollPositions.set(key, Math.max(0, pos));
}

export function clearScrollPosition(key: string) {
  scrollPositions.delete(key);
}

export function scrollToTop(key: string, smooth = true) {
  scrollPositions.set(key, 0);
  const el = activeScrollElements.get(key);
  if (el) {
    el.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
  }
}

/**
 * Hook to retain and restore vertical scroll position of a scrollable container.
 *
 * - Immediately restores saved scrollTop on mount without visual jumps.
 * - Confirms position after layout reflow via requestAnimationFrame.
 * - Passively tracks scroll changes and saves position on scroll & unmount.
 */
export function useScrollRestoration<T extends HTMLElement = HTMLDivElement>(
  key: string | null | undefined
) {
  const elementRef = useRef<T | null>(null);

  useEffect(() => {
    if (!key) return;
    const el = elementRef.current;
    if (!el) return;

    activeScrollElements.set(key, el);

    const savedPos = scrollPositions.get(key);
    if (typeof savedPos === 'number' && savedPos > 0) {
      // Set immediately
      el.scrollTop = savedPos;

      // Confirm in next frame in case child components / fonts reflowed
      const raf = requestAnimationFrame(() => {
        if (elementRef.current && elementRef.current.scrollTop !== savedPos) {
          elementRef.current.scrollTop = savedPos;
        }
      });
      return () => {
        cancelAnimationFrame(raf);
        activeScrollElements.delete(key);
      };
    }

    return () => {
      activeScrollElements.delete(key);
    };
  }, [key]);

  useEffect(() => {
    if (!key) return;
    const el = elementRef.current;
    if (!el) return;

    const onScroll = () => {
      scrollPositions.set(key, el.scrollTop);
    };

    el.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      if (elementRef.current) {
        scrollPositions.set(key, elementRef.current.scrollTop);
      }
      el.removeEventListener('scroll', onScroll);
    };
  }, [key]);

  return elementRef;
}
