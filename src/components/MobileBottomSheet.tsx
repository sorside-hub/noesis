import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

export interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  ariaLabel: string;
  disableDismiss?: boolean;
  /**
   * Breakpoint below which the fixed top-anchored bottom sheet layout is used:
   * - 'md' (default): < 768px
   * - 'lg': < 1024px (includes tablets where sidebars are hidden)
   */
  mobileBreakpoint?: 'md' | 'lg';
  /**
   * How the container renders on desktop (>= mobileBreakpoint):
   * - 'hidden': Mobile-only sheet (hidden on desktop)
   * - 'modal': Centered dialog on desktop
   * - 'side-right': Docked full-height right panel on desktop
   */
  desktopVariant?: 'hidden' | 'modal' | 'side-right';
  backdropPointerEventsNoneOnDesktop?: boolean;
  desktopClassName?: string;
  header?: React.ReactNode;
  children: React.ReactNode;
}

const useIsMobileViewport = (breakpoint: 'md' | 'lg'): boolean => {
  const maxPx = breakpoint === 'lg' ? 1023 : 767;
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth <= maxPx : true
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width: ${maxPx}px)`);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [maxPx]);

  return isMobile;
};

export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  isOpen,
  onClose,
  ariaLabel,
  disableDismiss = false,
  mobileBreakpoint = 'md',
  desktopVariant = 'hidden',
  backdropPointerEventsNoneOnDesktop = false,
  desktopClassName = '',
  header,
  children,
}) => {
  const isMobile = useIsMobileViewport(mobileBreakpoint);

  // If this sheet is mobile-only and we're on desktop, render nothing
  const shouldRender = isOpen && (isMobile || desktopVariant !== 'hidden');

  const desktopWrapperClass =
    desktopVariant === 'side-right'
      ? `${mobileBreakpoint === 'lg' ? 'lg:items-stretch lg:justify-end' : 'md:items-stretch md:justify-end'} ${
          backdropPointerEventsNoneOnDesktop ? 'md:pointer-events-none' : ''
        }`
      : desktopVariant === 'modal'
      ? mobileBreakpoint === 'lg'
        ? 'lg:items-center lg:justify-center lg:p-4'
        : 'md:items-center md:justify-center md:p-4'
      : mobileBreakpoint === 'lg'
      ? 'lg:hidden'
      : 'md:hidden';

  const sheetMotionProps = isMobile
    ? {
        initial: { y: '100%' },
        animate: { y: 0 },
        exit: { y: '100%' },
        transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const },
      }
    : desktopVariant === 'side-right'
    ? {
        initial: { x: '100%' },
        animate: { x: 0 },
        exit: { x: '100%' },
        transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const },
      }
    : {
        initial: { opacity: 0, scale: 0.96, y: 10 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.97, y: 6 },
        transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] as const },
      };

  const backdropColorClass =
    !isMobile && desktopVariant === 'side-right' && backdropPointerEventsNoneOnDesktop
      ? 'bg-transparent'
      : 'bg-black/45 backdrop-blur-[2px]';

  // On mobile: fixed ~93-94% height anchored from a static top gap (6svh), so the sheet's
  // top edge & header NEVER move when the virtual keyboard opens — only the inner content area adjusts.
  const sheetSurfaceClass = isMobile
    ? 'w-full flex-1 min-h-0 rounded-t-2xl border-t border-[#E8E2D8] dark:border-[#2F2B28]'
    : desktopVariant === 'side-right'
    ? `h-full border-l border-[#E8E2D8] dark:border-[#2F2B28] ${
        desktopClassName || 'md:w-[400px] lg:w-[440px]'
      }`
    : `w-full rounded-2xl border border-[#E8E2D8] dark:border-[#2F2B28] max-h-[86vh] ${
        desktopClassName || 'md:max-w-xl'
      }`;

  return (
    <AnimatePresence>
      {shouldRender && (
        <div
          style={
            isMobile
              ? {
                  height: 'var(--noesis-vv-height, 100svh)',
                  paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 14px), 6svh)',
                }
              : undefined
          }
          className={`fixed top-0 left-0 right-0 z-50 flex flex-col justify-end ${
            isMobile ? 'items-stretch' : 'bottom-0 items-center'
          } ${desktopWrapperClass}`}
        >
          {/* Backdrop */}
          <motion.div
            key="sheet-backdrop"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            onClick={() => {
              if (!disableDismiss) onClose();
            }}
            className={`fixed inset-0 ${backdropColorClass} ${
              !isMobile && backdropPointerEventsNoneOnDesktop ? 'pointer-events-none' : ''
            }`}
          />

          {/* Fixed-Top Sheet Surface */}
          <motion.div
            key={isMobile ? 'mobile-sheet' : 'desktop-sheet'}
            role="dialog"
            aria-modal={
              !isMobile && backdropPointerEventsNoneOnDesktop ? undefined : 'true'
            }
            aria-label={ariaLabel}
            onClick={(e) => e.stopPropagation()}
            className={`relative z-10 pointer-events-auto bg-[#FAF7F2] dark:bg-[#1E1C1A] shadow-2xl flex flex-col overflow-hidden will-change-transform ${sheetSurfaceClass}`}
            {...sheetMotionProps}
          >
            {header}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
