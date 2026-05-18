import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sidebar,
  X,
  BookMarked,
  History,
  Search,
  MoreHorizontal,
} from 'lucide-react';
import { faviconUrl, hostname } from '@/lib/favicon';
import { useT } from '@/i18n';
import { useSettings } from '@/stores/settings';
import { useEscKey } from '@/lib/hooks/useEscKey';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { formatRelative } from '@/lib/relative-time';
import { BookmarkActionMenu } from './BookmarkActionMenu';
import { BookmarkEditDialog } from './BookmarkEditDialog';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { updateBookmarkByUrl } from '@/lib/chrome-bookmarks';

type Tab = 'tree' | 'history';

type ListItem = {
  /** Bookmark id; undefined for history rows. */
  id?: string;
  title: string;
  url: string;
  dateAdded?: number;
  lastVisitTime?: number;
};

type PendingDelete = {
  kind: 'bookmark' | 'history';
  item: ListItem;
};

export function Drawer() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('tree');
  const [query, setQuery] = useState('');
  const [tree, setTree] = useState<ListItem[]>([]);
  const [history, setHistory] = useState<ListItem[]>([]);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  // Per-row action menu (right-click or more-button) + edit dialog state.
  const [menu, setMenu] = useState<
    | {
        kind: 'bookmark' | 'history';
        item: ListItem;
        anchor: { x: number; y: number };
      }
    | null
  >(null);
  const [editing, setEditing] = useState<ListItem | null>(null);

  const skipDeleteConfirm = useSettings(s => s.skipDeleteConfirm);
  const setSkipDeleteConfirm = useSettings(s => s.setSkipDeleteConfirm);

  // ESC ordering: dialog/menu/edit eat ESC first; then drawer closes.
  useEscKey(open && !pendingDelete && !menu && !editing, () => setOpen(false));
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    if (typeof chrome === 'undefined') return;

    if (chrome.bookmarks?.getTree) {
      chrome.bookmarks.getTree(roots => {
        const flat: ListItem[] = [];
        const walk = (nodes: chrome.bookmarks.BookmarkTreeNode[]) => {
          for (const n of nodes) {
            if (n.url) {
              flat.push({
                id: n.id,
                title: n.title || hostname(n.url),
                url: n.url,
                dateAdded: n.dateAdded,
              });
            }
            if (n.children) walk(n.children);
          }
        };
        walk(roots);
        flat.sort((a, b) => (b.dateAdded ?? 0) - (a.dateAdded ?? 0));
        setTree(flat);
      });
    }
    if (chrome.history?.search) {
      chrome.history.search({ text: '', maxResults: 200, startTime: 0 }, items => {
        setHistory(
          items
            .filter(i => i.url)
            .map(i => ({
              title: i.title || hostname(i.url!),
              url: i.url!,
              lastVisitTime: i.lastVisitTime,
            }))
        );
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const sourceList = tab === 'tree' ? tree : history;
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sourceList;
    return sourceList.filter(
      it =>
        it.title.toLowerCase().includes(q) || it.url.toLowerCase().includes(q)
    );
  }, [sourceList, query]);

  // Actually perform deletion against the Chrome API + remove from local list.
  const performDelete = (target: PendingDelete) => {
    if (target.kind === 'bookmark') {
      if (target.item.id && chrome.bookmarks?.remove) {
        chrome.bookmarks.remove(target.item.id, () => {
          // Swallow chrome.runtime.lastError — item may already be gone.
          void chrome.runtime.lastError;
        });
      }
      setTree(prev => prev.filter(x => x.id !== target.item.id));
    } else {
      if (chrome.history?.deleteUrl) {
        chrome.history.deleteUrl({ url: target.item.url });
      }
      setHistory(prev => prev.filter(x => x.url !== target.item.url));
    }
  };

  const requestDelete = (target: PendingDelete) => {
    if (skipDeleteConfirm) {
      performDelete(target);
    } else {
      setPendingDelete(target);
    }
  };

  // Save an edited bookmark title (and url, if changed) back into Chrome.
  // History items aren't editable, so this is only wired up for bookmarks.
  const handleEdit = async (
    originalUrl: string,
    newTitle: string,
    newUrl: string
  ) => {
    if (typeof chrome === 'undefined' || !chrome.bookmarks) return;
    try {
      await updateBookmarkByUrl(originalUrl, {
        title: newTitle,
        url: newUrl === originalUrl ? undefined : newUrl,
      });
    } catch (e) {
      console.warn('[drawer edit] failed', e);
    }
    // Optimistic refresh of the in-drawer list.
    setTree(prev =>
      prev.map(x =>
        x.url === originalUrl ? { ...x, title: newTitle, url: newUrl } : x
      )
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass glass-hover flex h-10 w-10 items-center justify-center rounded-full text-white/85"
        aria-label={t('drawer_open')}
      >
        <Sidebar size={18} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            />
            <motion.div
              key="panel"
              initial={{ x: '110%' }}
              animate={{ x: 0 }}
              exit={{ x: '110%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="glass-strong fixed right-4 top-4 bottom-4 z-50 flex w-[420px] max-w-[92vw] flex-col rounded-3xl"
            >
              <div className="flex items-center justify-between p-5 pb-3">
                <div className="text-base font-medium text-white/90">{t('library')}</div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mx-5 mb-2 flex items-center gap-2 rounded-2xl bg-black/25 px-3 py-2 ring-1 ring-white/10 focus-within:ring-white/30">
                <Search size={14} className="text-white/55" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={t('library_search_placeholder')}
                  className="flex-1 bg-transparent text-sm text-white placeholder-white/40 outline-none"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="text-white/45 hover:text-white/80"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="mx-5 mb-3 flex gap-1 rounded-2xl bg-black/20 p-1">
                <TabBtn
                  active={tab === 'tree'}
                  onClick={() => setTab('tree')}
                  icon={<BookMarked size={14} />}
                  label={t('all_bookmarks')}
                />
                <TabBtn
                  active={tab === 'history'}
                  onClick={() => setTab('history')}
                  icon={<History size={14} />}
                  label={t('history')}
                />
              </div>

              <div className="flex-1 overflow-y-auto px-3 pb-5">
                {list.length === 0 && (
                  <div className="px-3 py-12 text-center text-sm text-white/40">
                    {query ? t('no_results') : t('empty_hint')}
                  </div>
                )}
                {list.map(it => (
                  <LibraryRow
                    key={`${tab}-${it.id ?? it.url}`}
                    item={it}
                    kind={tab === 'tree' ? 'bookmark' : 'history'}
                    onMenu={(anchor) =>
                      setMenu({
                        kind: tab === 'tree' ? 'bookmark' : 'history',
                        item: it,
                        anchor,
                      })
                    }
                  />
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {menu && (
          <BookmarkActionMenu
            anchor={menu.anchor}
            url={menu.item.url}
            title={menu.item.title}
            onEdit={
              // History rows can't be renamed — hide the Edit item by
              // omitting onEdit altogether.
              menu.kind === 'bookmark'
                ? () => {
                    setEditing(menu.item);
                    setMenu(null);
                  }
                : undefined
            }
            onDelete={() => {
              requestDelete({ kind: menu.kind, item: menu.item });
              setMenu(null);
            }}
            onClose={() => setMenu(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editing && (
          <BookmarkEditDialog
            initialTitle={editing.title}
            initialUrl={editing.url}
            onSave={(newTitle, newUrl) => {
              void handleEdit(editing.url, newTitle, newUrl);
              setEditing(null);
            }}
            onClose={() => setEditing(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingDelete && (
          <ConfirmDeleteDialog
            title={
              pendingDelete.kind === 'bookmark'
                ? t('delete_bookmark_title')
                : t('delete_history_title')
            }
            warning={
              pendingDelete.kind === 'bookmark'
                ? t('delete_warn_bookmark')
                : t('delete_warn_history')
            }
            itemTitle={pendingDelete.item.title}
            itemUrl={pendingDelete.item.url}
            onConfirm={remember => {
              if (remember) setSkipDeleteConfirm(true);
              performDelete(pendingDelete);
              setPendingDelete(null);
            }}
            onClose={() => setPendingDelete(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function LibraryRow(props: {
  item: ListItem;
  kind: 'bookmark' | 'history';
  onMenu: (anchor: { x: number; y: number }) => void;
}) {
  const t = useT();
  const locale = useSettings(s => s.locale);
  const ts = props.kind === 'bookmark' ? props.item.dateAdded : props.item.lastVisitTime;
  const time = formatRelative(ts, locale);

  return (
    <a
      href={props.item.url}
      onContextMenu={e => {
        e.preventDefault();
        props.onMenu({ x: e.clientX, y: e.clientY });
      }}
      className="group flex items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-white/10"
    >
      <img
        src={faviconUrl(props.item.url, 32)}
        alt=""
        className="h-4 w-4 shrink-0 rounded"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-white/90">{props.item.title}</div>
        <div className="truncate text-[11px] text-white/45">
          {hostname(props.item.url)}
        </div>
      </div>
      {time && (
        <div className="shrink-0 text-[10px] tabular-nums text-white/40">{time}</div>
      )}
      <button
        type="button"
        aria-label={t('bookmark_more')}
        title={t('bookmark_more')}
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          props.onMenu({ x: rect.right - 4, y: rect.bottom + 4 });
        }}
        // Always reserved on the right; fades in on row hover or button
        // focus, so the title doesn't reflow when the cursor enters.
        className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/55 opacity-0 transition-opacity hover:bg-white/15 hover:text-white group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100"
      >
        <MoreHorizontal size={14} />
      </button>
    </a>
  );
}

function TabBtn(props: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs transition ${
        props.active
          ? 'bg-white/15 text-white shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]'
          : 'text-white/60 hover:text-white/85'
      }`}
    >
      {props.icon}
      {props.label}
    </button>
  );
}
