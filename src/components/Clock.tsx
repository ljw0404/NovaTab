import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '@/stores/settings';
import { localeForDate } from '@/i18n';

export function Clock() {
  const [now, setNow] = useState(() => new Date());
  const locale = useSettings(s => s.locale);
  const showSeconds = useSettings(s => s.showSeconds);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const dateStr = now.toLocaleDateString(localeForDate(locale), {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="select-none text-center text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.35)]">
      <div className="flex items-baseline justify-center text-7xl font-extralight leading-none tracking-tight tabular-nums sm:text-8xl">
        <FlipDigit value={hh[0]} />
        <FlipDigit value={hh[1]} />
        <span className="mx-1 animate-pulse opacity-70">:</span>
        <FlipDigit value={mm[0]} />
        <FlipDigit value={mm[1]} />
        {showSeconds && (
          <>
            <span className="mx-1 opacity-50">:</span>
            <span className="text-5xl font-light opacity-75 sm:text-6xl">
              <FlipDigit value={ss[0]} />
              <FlipDigit value={ss[1]} />
            </span>
          </>
        )}
      </div>
      <div className="mt-2 text-sm font-light tracking-wide text-white/70 sm:text-base">
        {dateStr}
      </div>
    </div>
  );
}

/**
 * A single digit slot. When `value` changes, the old digit slides down out of
 * view while the new one slides in from above — like a flip-board clock.
 *
 *  ─ The outer inline-block holds an invisible copy of the digit to reserve
 *    width + line height. It deliberately has NO `overflow-hidden`, because
 *    that would force the browser to use the box's bottom edge as the
 *    element baseline (CSS 2.1 §10.8.1), which would break `items-baseline`
 *    on the parent flex when mixing font sizes (e.g. hours vs. seconds).
 *  ─ The animation/clipping layer is an absolute child — being out of flow
 *    it does not contribute to the outer span's baseline, so the invisible
 *    digit alone determines it.
 *  ─ AnimatePresence's default concurrent mode keeps old + new digits both
 *    rendered briefly so they swap in a single smooth motion (slot-machine).
 */
function FlipDigit({ value }: { value: string }) {
  return (
    <span className="relative inline-block align-baseline">
      <span aria-hidden="true" className="invisible">
        {value}
      </span>
      <span className="absolute inset-0 overflow-hidden">
        <AnimatePresence initial={false}>
          <motion.span
            key={value}
            initial={{ y: '-100%' }}
            animate={{ y: '0%' }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              stiffness: 280,
              damping: 28,
              mass: 0.7,
            }}
            className="absolute inset-x-0 top-0"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
