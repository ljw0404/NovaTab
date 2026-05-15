import { useState } from 'react';
import { motion } from 'framer-motion';
import { Folder } from 'lucide-react';
import { useT } from '@/i18n';
import { useEscKey } from '@/lib/hooks/useEscKey';
import { useSpeedDial } from '@/stores/speedDial';

type Props = {
  mode: 'create' | { kind: 'edit'; id: string; title: string };
  onClose: () => void;
};

export function FolderDialog({ mode, onClose }: Props) {
  const t = useT();
  const addFolder = useSpeedDial(s => s.addFolder);
  const updateEntry = useSpeedDial(s => s.updateEntry);

  const editing = mode !== 'create' ? mode : null;
  const [title, setTitle] = useState(editing?.title ?? '');

  useEscKey(true, onClose);

  const submit = async () => {
    const t = title.trim();
    if (!t) return;
    if (editing) {
      await updateEntry(editing.id, { title: t });
    } else {
      await addFolder(t);
    }
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 12 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        onClick={e => e.stopPropagation()}
        className="glass-strong w-[400px] max-w-[92vw] rounded-3xl p-6"
      >
        <div className="mb-4 flex items-center gap-2">
          <Folder size={16} className="text-white/85" />
          <h2 className="text-lg font-medium text-white">
            {editing ? t('pin_edit_folder_title') : t('pin_add_folder')}
          </h2>
        </div>
        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={t('pin_folder_default_name')}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
            }
          }}
          className="w-full rounded-xl bg-white/10 px-4 py-2.5 text-white placeholder-white/40 outline-none ring-1 ring-white/15 focus:ring-white/40"
        />

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/10"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim()}
            className="rounded-xl bg-white/90 px-4 py-2 text-sm font-medium text-black hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('confirm')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
