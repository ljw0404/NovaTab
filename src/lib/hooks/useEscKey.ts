import { useEffect, useRef } from 'react';

// Centralized ESC stack — only the topmost active handler fires per key press.
// This lets nested overlays (dialog inside drawer) close one at a time.
const stack: Array<() => void> = [];
let listenerInstalled = false;

function installListener() {
  if (listenerInstalled || typeof window === 'undefined') return;
  listenerInstalled = true;
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const top = stack[stack.length - 1];
    if (top) {
      e.preventDefault();
      top();
    }
  });
}

export function useEscKey(active: boolean, onEscape: () => void) {
  const ref = useRef(onEscape);
  ref.current = onEscape;

  useEffect(() => {
    if (!active) return;
    installListener();
    const handler = () => ref.current();
    stack.push(handler);
    return () => {
      const i = stack.lastIndexOf(handler);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}
