import { useState } from 'react';
import { motion } from 'framer-motion';
import { Pencil } from 'lucide-react';
import { useT } from '@/i18n';
import { useEscKey } from '@/lib/hooks/useEscKey';

export function BookmarkEditDialog(props: {
  initialTitle: string;
  initialUrl: string;
  onSave: (title: string, url: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const t = useT();
  const [title, setTitle] = useState(props.initialTitle);
  const [url, setUrl] = useState(props.initialUrl);
  const [busy, setBusy] = useState(false);

  useEscKey(true, () => {
    if (!busy) props.onClose();
  });

  const submit = async () => {
    if (!url.trim()) return;
    setBusy(true);
    try {
      await props.onSave(title.trim() || url.trim(), url.trim());
      props.onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={busy ? undefined : props.onClose}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 12 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        onClick={e => e.stopPropagation()}
        className="glass-strong w-[440px] max-w-[92vw] rounded-3xl p-6"
      >
        <div className="mb-4 flex items-center gap-2">
          <Pencil size={16} className="text-white/85" />
          <h2 className="text-lg font-medium text-white">
            {t('bookmark_edit_title')}
          </h2>
        </div>

        <label className="mb-1 block text-xs text-white/55">
          {t('bookmark_title_label')}
        </label>
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="mb-3 w-full rounded-xl bg-white/10 px-4 py-2.5 text-white outline-none ring-1 ring-white/15 focus:ring-white/40"
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
            }
          }}
        />

        <label className="mb-1 block text-xs text-white/55">
          {t('bookmark_url_label')}
        </label>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          className="w-full rounded-xl bg-white/10 px-4 py-2.5 text-white outline-none ring-1 ring-white/15 focus:ring-white/40"
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
            }
          }}
        />

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={props.onClose}
            disabled={busy}
            className="rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/10 disabled:opacity-50"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !url.trim()}
            className="rounded-xl bg-white/90 px-4 py-2 text-sm font-medium text-black hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('bookmark_edit_save')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
