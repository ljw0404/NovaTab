import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ChevronDown,
  BookMarked,
  History as HistoryIcon,
  ArrowRight,
  MoreHorizontal,
} from 'lucide-react';
import { SEARCH_ENGINES, getEngine } from '@/lib/search-engines';
import { useSettings } from '@/stores/settings';
import { useT } from '@/i18n';
import { fetchSuggestions, type Suggestion } from '@/lib/suggest';
import { faviconUrl, hostname } from '@/lib/favicon';
import { truncate } from '@/lib/truncate';
import { useEscKey } from '@/lib/hooks/useEscKey';
import { BookmarkActionMenu } from './BookmarkActionMenu';
import { BookmarkEditDialog } from './BookmarkEditDialog';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import {
  removeBookmarkByUrl,
  updateBookmarkByUrl,
} from '@/lib/chrome-bookmarks';

export function SearchBar() {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [openEngine, setOpenEngine] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const { searchEngineId, setSearchEngineId } = useSettings();
  const engine = getEngine(searchEngineId);

  // Row 0 is always the "search engine" action; rows 1..n are suggestions.
  const trimmed = query.trim();
  const totalRows = trimmed ? 1 + suggestions.length : 0;
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const [stuck, setStuck] = useState(false);
  // True when the search bar itself is pinned to the top of the viewport
  // (the parent has `sticky top-4`). The glass tint is too transparent against
  // a scrolled-up page, so we punch it darker in this state.
  const [pageStuck, setPageStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const el = formRef.current;
      if (!el) return;
      // sticky offset is top-4 (16px); 17px gives a 1-px slack so a hairline
      // sub-pixel offset doesn't flicker the state.
      setPageStuck(el.getBoundingClientRect().top <= 17);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Per-row action menu / edit / delete dialogs (right-click or "more" button
  // on a suggestion row).
  type MenuState = {
    kind: 'bookmark' | 'history';
    url: string;
    title: string;
    anchor: { x: number; y: number };
  };
  type DialogTarget = { kind: 'bookmark' | 'history'; url: string; title: string };
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [editing, setEditing] = useState<{ url: string; title: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DialogTarget | null>(null);

  // Keep the dropdown rendered while a per-row dialog/menu is open — without
  // this, the input's blur event would close the suggestions and the menu
  // would float over an empty space (or be anchored to a row that's gone).
  const dropdownOpen =
    (focused && totalRows > 0) || menu !== null || editing !== null;
  const skipDeleteConfirm = useSettings(s => s.skipDeleteConfirm);
  const setSkipDeleteConfirm = useSettings(s => s.setSkipDeleteConfirm);

  // ─── Per-row actions (mirrors the AiOrganizedBookmarks/Drawer flow) ──────

  const openMenuForSuggestion = (
    s: Suggestion,
    anchor: { x: number; y: number }
  ) => {
    setMenu({ kind: s.kind, url: s.url, title: s.title, anchor });
  };

  const handleEdit = async (originalUrl: string, newTitle: string, newUrl: string) => {
    try {
      await updateBookmarkByUrl(originalUrl, {
        title: newTitle,
        url: newUrl === originalUrl ? undefined : newUrl,
      });
    } catch (e) {
      console.warn('[search edit] failed', e);
    }
    // Reflect the change in-flight so the user sees their rename without
    // waiting for the next fetch.
    setSuggestions(prev =>
      prev.map(s =>
        s.url === originalUrl ? { ...s, title: newTitle, url: newUrl } : s
      )
    );
  };

  const requestDelete = (target: DialogTarget) => {
    if (skipDeleteConfirm) {
      void performDelete(target);
    } else {
      setPendingDelete(target);
    }
  };

  const performDelete = async (target: DialogTarget) => {
    if (typeof chrome === 'undefined') return;
    try {
      if (target.kind === 'bookmark') {
        await removeBookmarkByUrl(target.url);
      } else if (chrome.history?.deleteUrl) {
        chrome.history.deleteUrl({ url: target.url });
      }
    } catch (e) {
      console.warn('[search delete] failed', e);
    }
    // Optimistically drop the row from the dropdown.
    setSuggestions(prev => prev.filter(s => s.url !== target.url));
  };

  // Toggle the sticky header's glass background only when the row is
  // actually pinned to the top (scrollTop > 0).
  useEffect(() => {
    if (!dropdownOpen) {
      setStuck(false);
      return;
    }
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => setStuck(el.scrollTop > 0);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [dropdownOpen]);

  // Scroll the active row into view when keyboard nav changes selection.
  //
  // We deliberately avoid scrollIntoView() here. Three traps it falls into:
  //   1. Suggestion rows are framer-motion `motion.div`s with `layout="position"`,
  //      which means they can carry a CSS transform. scrollIntoView's spec
  //      uses the element's border-box (transform-affected), while offsetTop
  //      doesn't — the two coordinate systems disagree mid-animation.
  //   2. `block: 'nearest'` decides "is it already visible?" without knowing
  //      about our sticky header at row 0, so rows half-hidden behind it are
  //      considered visible and no scroll happens.
  //   3. `behavior: 'smooth'` queues animations; rapid keypresses read a
  //      mid-animation `scrollTop` and the next iteration's math drifts.
  //
  // Manual delta math against getBoundingClientRect avoids all three:
  // visual-coord-in, scrollTop-delta-out, instant by direct assignment.
  useLayoutEffect(() => {
    if (!dropdownOpen) return;
    const container = listRef.current;
    const target = rowRefs.current[activeIdx];
    if (!container || !target) return;

    // Wrapping to row 0 (sticky search action) — snap all the way to top.
    if (activeIdx === 0) {
      container.scrollTop = 0;
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const stickyHeight = rowRefs.current[0]?.offsetHeight ?? 56;
    const pad = 6;

    const visibleTop = containerRect.top + stickyHeight + pad;
    const visibleBottom = containerRect.bottom - pad;

    if (targetRect.top < visibleTop) {
      // Target's top is above (or hidden behind) the sticky header —
      // scroll up by exactly the overlap distance.
      container.scrollTop -= visibleTop - targetRect.top;
    } else if (targetRect.bottom > visibleBottom) {
      // Target's bottom is below the dropdown's visible bottom —
      // scroll down by the overshoot.
      container.scrollTop += targetRect.bottom - visibleBottom;
    }
  }, [activeIdx, dropdownOpen]);

  // Reset active row when query changes.
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // Debounced fetch of suggestions.
  //
  // The `cancelled` flag prevents stale results from overwriting newer ones:
  // chrome.bookmarks.search isn't cancellable, so when the user types fast,
  // an in-flight fetch for the old query can resolve AFTER the new query's
  // fetch and clobber its results. The cleanup closes over `cancelled` and
  // flips it when the query changes, so the old fetch's then-callback bails
  // before calling setSuggestions.
  useEffect(() => {
    if (!trimmed) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const id = setTimeout(() => {
      fetchSuggestions(trimmed).then(results => {
        if (!cancelled) setSuggestions(results);
      });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [trimmed]);

  // Global `/` to focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const goToEngineSearch = (q: string) => {
    window.location.href = engine.url(q);
  };

  const goToUrl = (url: string) => {
    window.location.href = url;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed) return;
    if (activeIdx > 0 && suggestions[activeIdx - 1]) {
      goToUrl(suggestions[activeIdx - 1].url);
    } else {
      goToEngineSearch(trimmed);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => (i + 1) % totalRows);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => (i - 1 + totalRows) % totalRows);
    }
  };

  // ESC closes the engine dropdown first; if that's not open, ESC clears
  // the query / suggestions; outer modals can still get ESC via the stack.
  useEscKey(openEngine, () => setOpenEngine(false));
  useEscKey(!openEngine && dropdownOpen, () => {
    setQuery('');
    setSuggestions([]);
  });

  const placeholder = useMemo(() => t('search_placeholder'), [t]);

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="relative z-20 w-full max-w-2xl"
    >
      <div
        className={`glass glass-hover flex items-center gap-3 rounded-full px-3 py-3 pr-5 transition-[background-color,box-shadow,border-color] duration-200 ${
          pageStuck
            ? '!bg-white/30 !border-white/30 !shadow-[0_12px_40px_rgba(0,0,0,0.38)] dark:!bg-black/60 dark:!border-white/15'
            : ''
        }`}
      >
        <button
          type="button"
          onClick={() => setOpenEngine(v => !v)}
          className="flex items-center gap-1.5 rounded-full bg-white/10 py-1.5 pl-2 pr-2.5 text-sm text-white/85 transition hover:bg-white/20"
        >
          <img
            src={faviconUrl(engine.origin, 32)}
            alt=""
            className="h-4 w-4 rounded-sm"
          />
          {engine.name}
          <ChevronDown
            size={14}
            className={`transition ${openEngine ? 'rotate-180' : ''}`}
          />
        </button>
        <Search size={18} className="shrink-0 text-white/60" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-base text-white placeholder-white/45 outline-none"
          autoFocus
        />
      </div>

      <AnimatePresence>
        {openEngine && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="glass-strong absolute left-0 top-full z-30 mt-2 w-44 overflow-hidden rounded-2xl p-1.5"
          >
            {SEARCH_ENGINES.map(eng => (
              <button
                key={eng.id}
                type="button"
                onClick={() => {
                  setSearchEngineId(eng.id);
                  setOpenEngine(false);
                  inputRef.current?.focus();
                }}
                className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition ${
                  eng.id === searchEngineId
                    ? 'bg-white/20 text-white'
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                <img
                  src={faviconUrl(eng.origin, 32)}
                  alt=""
                  className="h-4 w-4 shrink-0 rounded"
                />
                {eng.name}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {dropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="glass-strong absolute left-0 right-0 top-full z-30 mt-2 max-h-[60vh] overflow-y-auto rounded-3xl p-1.5"
            ref={listRef}
          >
            <div
              ref={el => (rowRefs.current[0] = el)}
              className={`sticky top-0 z-10 rounded-2xl transition-[background-color,box-shadow,backdrop-filter] duration-200 ${
                stuck
                  ? 'bg-white/25 backdrop-blur-xl backdrop-saturate-150 shadow-[0_4px_16px_rgba(0,0,0,0.18)] dark:bg-black/45'
                  : 'bg-transparent'
              }`}
            >
              <SuggestRow
                icon={
                  <img
                    src={faviconUrl(engine.origin, 32)}
                    alt=""
                    className="h-4 w-4 rounded"
                  />
                }
                title={t('suggestions_search_with', { engine: engine.name, q: trimmed })}
                active={activeIdx === 0}
                onMouseEnter={() => setActiveIdx(0)}
                onMouseDown={e => {
                  e.preventDefault();
                  goToEngineSearch(trimmed);
                }}
                hint={<ArrowRight size={12} className="text-white/40" />}
              />
            </div>
            {suggestions.length > 0 && (
              <div className="mt-1 border-t border-white/10 pt-1">
                <AnimatePresence initial={false} mode="popLayout">
                  {suggestions.map((s, i) => (
                    <motion.div
                      key={`${s.kind}-${s.url}`}
                      ref={el => (rowRefs.current[i + 1] = el)}
                      layout="position"
                      initial={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, filter: 'blur(2px)' }}
                      transition={{
                        opacity: { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] },
                        y: { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] },
                        filter: { duration: 0.2 },
                        // Cap stagger to first ~14 items so the tail doesn't
                        // wait forever when there are many results.
                        delay: Math.min(i, 14) * 0.022,
                      }}
                    >
                      <SuggestRow
                        icon={
                          <img
                            src={faviconUrl(s.url, 32)}
                            alt=""
                            className="h-4 w-4 rounded"
                          />
                        }
                        title={truncate(s.title, 60)}
                        subtitle={hostname(s.url)}
                        folderPath={s.folderPath}
                        badge={s.kind}
                        url={s.url}
                        active={activeIdx === i + 1}
                        onMouseEnter={() => setActiveIdx(i + 1)}
                        onMouseDown={e => {
                          e.preventDefault();
                          goToUrl(s.url);
                        }}
                        onContextMenu={e => {
                          e.preventDefault();
                          openMenuForSuggestion(s, {
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }}
                        onMenu={anchor => openMenuForSuggestion(s, anchor)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {menu && (
          <BookmarkActionMenu
            anchor={menu.anchor}
            url={menu.url}
            title={menu.title}
            onEdit={
              // History rows aren't renameable — hide the Edit item by
              // omitting onEdit entirely (BookmarkActionMenu treats undefined
              // as "no edit affordance").
              menu.kind === 'bookmark'
                ? () => {
                    setEditing({ url: menu.url, title: menu.title });
                    setMenu(null);
                  }
                : undefined
            }
            onDelete={() => {
              requestDelete({
                kind: menu.kind,
                url: menu.url,
                title: menu.title,
              });
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
            itemTitle={pendingDelete.title}
            itemUrl={pendingDelete.url}
            onConfirm={remember => {
              if (remember) setSkipDeleteConfirm(true);
              void performDelete(pendingDelete);
              setPendingDelete(null);
            }}
            onClose={() => setPendingDelete(null)}
          />
        )}
      </AnimatePresence>
    </form>
  );
}

function SuggestRow(props: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  folderPath?: string[];
  badge?: 'bookmark' | 'history';
  url?: string;
  active: boolean;
  hint?: React.ReactNode;
  onMouseEnter: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMenu?: (anchor: { x: number; y: number }) => void;
}) {
  const t = useT();

  const folderLine =
    props.folderPath && props.folderPath.length > 0
      ? '/' + props.folderPath.join('/')
      : null;

  return (
    <div
      role="option"
      aria-selected={props.active}
      onMouseEnter={props.onMouseEnter}
      onMouseDown={props.onMouseDown}
      onContextMenu={props.onContextMenu}
      className={`group flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 transition ${
        props.active ? 'bg-white/15' : 'hover:bg-white/8'
      }`}
    >
      <div className="flex h-6 w-6 shrink-0 items-center justify-center text-white/65">
        {props.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-white/90">{props.title}</div>
        {(props.subtitle || folderLine) && (
          <div className="truncate text-[11px] text-white/45">
            {props.subtitle}
            {props.subtitle && folderLine && (
              <span className="mx-1.5 text-white/25">·</span>
            )}
            {folderLine && (
              <span className="text-amber-200/65">{folderLine}</span>
            )}
          </div>
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
            <HistoryIcon size={10} />
          )}
          {props.badge === 'bookmark'
            ? t('suggestions_bookmarks')
            : t('suggestions_history')}
        </span>
      )}
      {props.url && props.onMenu && (
        <button
          type="button"
          aria-label={t('bookmark_more')}
          title={t('bookmark_more')}
          // `onMouseDown` (not `onClick`) + preventDefault keeps the search
          // input focused — otherwise blur would tear down the dropdown
          // before our menu had a chance to render.
          onMouseDown={e => {
            e.preventDefault();
            e.stopPropagation();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            props.onMenu!({ x: rect.right - 4, y: rect.bottom + 4 });
          }}
          className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/55 opacity-0 transition-opacity hover:bg-white/15 hover:text-white group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100"
        >
          <MoreHorizontal size={13} />
        </button>
      )}
      {props.hint}
    </div>
  );
}
