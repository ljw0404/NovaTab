import { useEffect } from 'react';

// Module-level counter so stacked modals only restore the original style when
// the last one unmounts.
let lockCount = 0;
let originalOverflow = '';
let originalPaddingRight = '';

export function useBodyScrollLock(active: boolean = true) {
  useEffect(() => {
    if (!active) return;

    if (lockCount === 0) {
      // Reserve space for the (now-hidden) scrollbar so the page behind
      // doesn't shift when we lock.
      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      originalOverflow = document.body.style.overflow;
      originalPaddingRight = document.body.style.paddingRight;
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }
    lockCount++;

    return () => {
      lockCount--;
      if (lockCount === 0) {
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
      }
    };
  }, [active]);
}
