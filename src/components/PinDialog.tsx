import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, ArrowRight, BookMarked, History } from 'lucide-react';
import { useT } from '@/i18n';
import { useEscKey } from '@/lib/hooks/useEscKey';
import { useSpeedDial } from '@/stores/speedDial';
import { fetchSuggestions, type Suggestion } from '@/lib/suggest';
import { faviconUrl, hostname } from '@/lib/favicon';
import { truncate } from '@/lib/truncate';

type Props = {
  /** When set, pre-selects this folder as the destination. */
  initialFolderId?: string | null;
  /** When editing an existing pin: pin id + initial values. */
  editing?: { id: string; title: string; url: string } | null;
  onClose: () => void;
};

function looksLikeUrl(s: string): boolean {
  if (!s) return false;
  if (/\s/.test(s.trim())) return false;
  return /[.:]/.test(s);
}

export function PinDialog({ initialFolderId, editing, onClose }: Props) {
  const t = useT();
  const entries = useSpeedDial(s => s.entries);
  const addPin = useSpeedDial(s => s.addPin);
  const updateEntry = useSpeedDial(s => s.updateEntry);

  const folders = entries.filter(e => e.kind === 'folder');

  const [query, setQuery] = useState(editing?.title ?? '');
  const [url, setUrl] = useState(editing?.url ?? '');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [folderId, setFolderId] = useState<string | null>(initialFolderId ?? null);

  useEscKey(true, onClose);

  // Suggestions only when in "add" mode, not when editing an existing pin.
  useEffect(() => {
    if (editing) return;
    const q = query.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }
    const id = setTimeout(() => {
      fetchSuggestions(q).then(setSuggestions);
    }, 140);
    return () => clearTimeout(id);
  }, [query, editing]);

  const pickSuggestion = async (s: Suggestion) => {
    await addPin({ title: s.title, url: s.url, folderId });
    onClose();
  };

  const submitManual = async () => {
    if (editing) {
      await updateEntry(editing.id, { title: query.trim() || url.trim(), url: url.trim() });
      onClose();
      return;
    }
    // Determine URL — either explicit `url` field or the query if it looks like a URL.
    const raw = (url.trim() || query.trim()).trim();
    if (!raw) return;
    const finalTitle = query.trim() && query.trim() !== raw ? query.trim() : '';
    await addPin({ title: finalTitle, url: raw, folderId });
    onClose();
  };

  const showAddUrl = !editing && looksLikeUrl(query);

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
        className="glass-strong w-[520px] max-w-[92vw] rounded-3xl p-6"
      >
        <h2 className="mb-4 text-lg font-medium text-white">
          {editing ? t('edit_pin_title') : t('pin_add_site')}
        </h2>

        <div className="flex items-center gap-2 rounded-2xl bg-white/8 px-3 py-2 ring-1 ring-white/10 focus-within:ring-white/30">
          <Search size={14} className="text-white/55" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={
              editing ? t('title_optional') : t('pin_search_or_add_placeholder')
            }
            className="flex-1 bg-transparent text-sm text-white placeholder-white/40 outline-none"
            onKeyDown={e => {
              if (e.key === 'Enter' && (editing || showAddUrl)) {
                e.preventDefault();
                void submitManual();
              }
            }}
          />
        </div>

        {editing && (
          <div className="mt-2 flex items-center gap-2 rounded-2xl bg-white/8 px-3 py-2 ring-1 ring-white/10 focus-within:ring-white/30">
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder={t('url_placeholder')}
              className="flex-1 bg-transparent text-sm text-white placeholder-white/40 outline-none"
            />
          </div>
        )}

        <AnimatePresence initial={false}>
          {!editing && (suggestions.length > 0 || showAddUrl) && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-3 max-h-[36vh] overflow-y-auto rounded-2xl bg-white/4 p-1.5"
            >
              {showAddUrl && (
                <SuggestRow
                  icon={<Plus size={14} />}
                  title={t('pin_add_new_url')}
                  subtitle={query.trim()}
                  onClick={() => {
                    setUrl(query.trim());
                    void addPin({
                      title: '',
                      url: query.trim(),
                      folderId,
                    }).then(onClose);
                  }}
                  hint={<ArrowRight size={12} className="text-white/45" />}
                />
              )}
              {suggestions.map(s => (
                <SuggestRow
                  key={`${s.kind}-${s.url}`}
                  icon={
                    <img
                      src={faviconUrl(s.url, 32)}
                      alt=""
                      className="h-4 w-4 rounded"
                    />
                  }
                  title={truncate(s.title, 60)}
                  subtitle={hostname(s.url)}
                  badge={s.kind}
                  onClick={() => void pickSuggestion(s)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {!editing && folders.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <label className="text-xs text-white/55">{t('pin_pick_folder')}</label>
            <select
              value={folderId ?? ''}
              onChange={e => setFolderId(e.target.value || null)}
              className="flex-1 rounded-xl bg-white/10 px-3 py-1.5 text-xs text-white outline-none ring-1 ring-white/15 focus:ring-white/40"
            >
              <option value="">{t('pin_pick_folder_top')}</option>
              {folders.map(f => (
                <option key={f.id} value={f.id} className="bg-neutral-900">
                  {f.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/10"
          >
            {t('cancel')}
          </button>
          {editing ? (
            <button
              type="button"
              onClick={submitManual}
              className="rounded-xl bg-white/90 px-4 py-2 text-sm font-medium text-black hover:bg-white"
            >
              {t('confirm')}
            </button>
          ) : showAddUrl ? (
            <button
              type="button"
              onClick={submitManual}
              className="rounded-xl bg-white/90 px-4 py-2 text-sm font-medium text-black hover:bg-white"
            >
              {t('confirm')}
            </button>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}

function SuggestRow(props: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: 'bookmark' | 'history';
  hint?: React.ReactNode;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/10"
    >
      <div className="flex h-6 w-6 shrink-0 items-center justify-center text-white/65">
        {props.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-white/90">{props.title}</div>
        {props.subtitle && (
          <div className="truncate text-[11px] text-white/45">{props.subtitle}</div>
        )}
      </div>
      {props.badge && (
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
            props.badge === 'bookmark'
              ? 'bg-amber-400/15 text-amber-200/90'
              : 'bg-sky-400/15 text-sky-200/90'
          }`}
        >
          {props.badge === 'bookmark' ? (
            <BookMarked size={10} />
          ) : (
            <History size={10} />
          )}
          {props.badge === 'bookmark'
            ? t('suggestions_bookmarks')
            : t('suggestions_history')}
        </span>
      )}
      {props.hint}
    </button>
  );
}
