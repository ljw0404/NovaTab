import { motion } from 'framer-motion';
import { AlertTriangle, RotateCcw, Plus } from 'lucide-react';
import { useT } from '@/i18n';
import { useSpeedDial } from '@/stores/speedDial';
import { declineRestore, restoreFromMirror } from '@/lib/hub-engine';

export function HubMissingDialog() {
  const t = useT();
  const mirror = useSpeedDial(s => s.missingMirror);

  if (!mirror) return null;

  // Count total items in mirror (pins at top level + pins inside folders).
  let count = 0;
  for (const e of mirror) {
    if (e.kind === 'pin') count++;
    else count += e.children.length;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="glass-strong w-[460px] max-w-[92vw] rounded-3xl p-6"
      >
        <div className="mb-3 flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
            <AlertTriangle size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-medium text-white">
              {t('hub_missing_title')}
            </div>
            <div className="mt-1 text-xs leading-relaxed text-white/65">
              {t('hub_missing_desc', { n: String(count) })}
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => void declineRestore()}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/10"
          >
            <Plus size={13} />
            {t('hub_missing_decline')}
          </button>
          <button
            type="button"
            onClick={() => void restoreFromMirror()}
            className="flex items-center gap-1.5 rounded-xl bg-white/90 px-4 py-2 text-sm font-medium text-black hover:bg-white"
          >
            <RotateCcw size={13} />
            {t('hub_missing_restore')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
