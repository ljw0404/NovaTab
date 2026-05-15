import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Check, Pencil } from 'lucide-react';
import { useT } from '@/i18n';
import { useEscKey } from '@/lib/hooks/useEscKey';
import { faviconUrl } from '@/lib/favicon';
import type { Category } from '@/stores/bookmarkClassification';

export function ClassifyPreviewDialog(props: {
  categories: Category[];
  onApply: (cats: Category[]) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [cats, setCats] = useState<Category[]>(() =>
    // structuredClone to avoid mutating the caller's array
    JSON.parse(JSON.stringify(props.categories))
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  useEscKey(true, props.onCancel);

  const totalItems = useMemo(
    () => cats.reduce((sum, c) => sum + c.items.length, 0),
    [cats]
  );

  const renameCategory = (id: string, name: string) =>
    setCats(prev => prev.map(c => (c.id === id ? { ...c, name } : c)));

  const removeCategory = (id: string) =>
    setCats(prev => prev.filter(c => c.id !== id));

  const removeItem = (catId: string, url: string) =>
    setCats(prev =>
      prev.map(c =>
        c.id === catId ? { ...c, items: c.items.filter(i => i.url !== url) } : c
      )
    );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-6 backdrop-blur-sm"
      onClick={props.onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        onClick={e => e.stopPropagation()}
        className="glass-strong flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl"
      >
        <div className="flex items-start justify-between p-5 pb-3">
          <div>
            <h2 className="text-lg font-medium text-white">{t('ai_preview_title')}</h2>
            <p className="mt-1 text-xs text-white/55">
              {t('ai_preview_subtitle', {
                cats: String(cats.length),
                items: String(totalItems),
              })}
            </p>
            <p className="mt-0.5 text-[11px] text-white/40">{t('ai_preview_hint')}</p>
          </div>
          <button
            type="button"
            onClick={props.onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {cats.map(cat => (
              <div key={cat.id} className="rounded-2xl bg-white/5 p-3.5">
                <div className="mb-2 flex items-center gap-2">
                  {editingId === cat.id ? (
                    <input
                      autoFocus
                      value={cat.name}
                      onChange={e => renameCategory(cat.id, e.target.value)}
                      onBlur={() => setEditingId(null)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === 'Escape') {
                          setEditingId(null);
                          e.stopPropagation();
                        }
                      }}
                      className="flex-1 rounded-lg bg-black/30 px-2 py-1 text-sm text-white outline-none ring-1 ring-white/30"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingId(cat.id)}
                      title={t('click_to_rename')}
                      className="group flex flex-1 items-center gap-1.5 truncate rounded text-left text-sm font-medium text-white/90 hover:text-white"
                    >
                      <span className="truncate">{cat.name}</span>
                      <Pencil
                        size={10}
                        className="opacity-0 transition group-hover:opacity-50"
                      />
                    </button>
                  )}
                  <span className="text-[10px] text-white/40">{cat.items.length}</span>
                  <button
                    type="button"
                    onClick={() => removeCategory(cat.id)}
                    title={t('remove_category')}
                    className="flex h-5 w-5 items-center justify-center rounded text-white/45 transition hover:bg-white/10 hover:text-white/90"
                  >
                    <X size={11} />
                  </button>
                </div>
                <div className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
                  {cat.items.map(item => (
                    <div
                      key={item.url}
                      className="group flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/10"
                    >
                      <img
                        src={faviconUrl(item.url, 32)}
                        alt=""
                        className="h-3.5 w-3.5 shrink-0 rounded"
                      />
                      <span className="flex-1 truncate text-xs text-white/75">
                        {item.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(cat.id, item.url)}
                        className="text-white/40 opacity-0 transition hover:text-white/90 group-hover:opacity-100"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/10 p-5 pt-3">
          <button
            type="button"
            onClick={props.onCancel}
            className="rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/10"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={() => props.onApply(cats)}
            disabled={cats.length === 0}
            className="flex items-center gap-1.5 rounded-xl bg-white/90 px-4 py-2 text-sm font-medium text-black hover:bg-white disabled:opacity-40"
          >
            <Check size={14} />
            {t('apply')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
