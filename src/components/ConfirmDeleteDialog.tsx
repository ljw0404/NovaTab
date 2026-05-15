import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Check } from 'lucide-react';
import { useT } from '@/i18n';
import { useEscKey } from '@/lib/hooks/useEscKey';
import { hostname } from '@/lib/favicon';

/**
 * Generic destructive-action confirmation modal.
 * - Shows a warning + the affected item's title/url
 * - Includes a "don't ask again" checkbox that the caller can wire to a setting
 * - Calls onConfirm(rememberSkip) — caller decides what to do with the flag
 */
export function ConfirmDeleteDialog(props: {
  title: string;
  warning: string;
  itemTitle: string;
  itemUrl?: string;
  rememberLabel?: string;
  confirmLabel?: string;
  onConfirm: (rememberSkip: boolean) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [remember, setRemember] = useState(false);

  useEscKey(true, props.onClose);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={props.onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 12 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        onClick={e => e.stopPropagation()}
        className="glass-strong w-[420px] max-w-[92vw] rounded-3xl p-6"
      >
        <div className="mb-3 flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-300/95">
            <AlertTriangle size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-medium text-white">{props.title}</div>
            <div className="mt-1 text-xs leading-relaxed text-white/65">
              {props.warning}
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-xl bg-white/5 px-3 py-2">
          <div className="truncate text-sm text-white/90">{props.itemTitle}</div>
          {props.itemUrl && (
            <div className="truncate text-[11px] text-white/45">
              {hostname(props.itemUrl)}
            </div>
          )}
        </div>

        <label className="mb-5 flex cursor-pointer select-none items-center gap-2 text-xs text-white/70 hover:text-white/90">
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
              remember
                ? 'border-white/85 bg-white/85 text-black'
                : 'border-white/30 bg-transparent'
            }`}
          >
            {remember && <Check size={11} strokeWidth={3} />}
          </span>
          <input
            type="checkbox"
            className="sr-only"
            checked={remember}
            onChange={e => setRemember(e.target.checked)}
          />
          <span>{props.rememberLabel ?? t('dont_ask_again')}</span>
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/10"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={() => props.onConfirm(remember)}
            className="rounded-xl bg-red-500/85 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
          >
            {props.confirmLabel ?? t('delete')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
