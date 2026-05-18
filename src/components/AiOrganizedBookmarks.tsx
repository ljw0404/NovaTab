import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  RotateCcw,
  Loader2,
  Folder,
  MoreHorizontal,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { useT } from '@/i18n';
import {
  useBookmarkClassification,
  type Category,
} from '@/stores/bookmarkClassification';
import { ClassifyPreviewDialog } from './ClassifyPreviewDialog';
import { AiClassifyDialog } from './AiClassifyDialog';
import { BookmarkActionMenu } from './BookmarkActionMenu';
import { BookmarkEditDialog } from './BookmarkEditDialog';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { SiteTestDialog } from './SiteTestDialog';
import { faviconUrl, hostname } from '@/lib/favicon';
import { isExtensionContext } from '@/lib/permissions';
import { useSettings } from '@/stores/settings';
import {
  removeBookmarkByUrl,
  removeBookmarksByUrls,
  updateBookmarkByUrl,
} from '@/lib/chrome-bookmarks';
import { getProgress, useSiteTest } from '@/stores/siteTest';
import { isAiClassifyActive } from '@/lib/ai-classify-engine';

export function AiOrganizedBookmarks() {
  const t = useT();
  const aiCategories = useBookmarkClassification(s => s.categories);
  const showOriginal = useBookmarkClassification(s => s.showOriginal);
  const setCategories = useBookmarkClassification(s => s.setCategories);
  const showOriginalView = useBookmarkClassification(s => s.showOriginalView);
  const restoreAiView = useBookmarkClassification(s => s.restoreAiView);
  const pendingPreview = useBookmarkClassification(s => s.pendingPreview);
  const setPendingPreview = useBookmarkClassification(s => s.setPendingPreview);

  const skipDeleteConfirm = useSettings(s => s.skipDeleteConfirm);
  const setSkipDeleteConfirm = useSettings(s => s.setSkipDeleteConfirm);

  const [originalCategories, setOriginalCategories] = useState<Category[]>([]);
  const [loadingOriginal, setLoadingOriginal] = useState(true);
  /** Controls the AI classify dialog (config / running / interrupted / error states). */
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  /** Controls the preview dialog (shown when pendingPreview exists). */
  const [previewOpen, setPreviewOpen] = useState(false);

  // Per-bookmark interactions (right-click + "more" menu).
  const [menu, setMenu] = useState<
    | { url: string; title: string; anchor: { x: number; y: number } }
    | null
  >(null);
  const [editing, setEditing] = useState<{ url: string; title: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const [siteTestOpen, setSiteTestOpen] = useState(false);

  // Load chrome bookmarks once on mount + whenever permissions change.
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getOriginalCategories().then(cats => {
        if (!cancelled) {
          setOriginalCategories(cats);
          setLoadingOriginal(false);
        }
      });
    };
    load();
    window.addEventListener('permissions-granted', load);
    return () => {
      cancelled = true;
      window.removeEventListener('permissions-granted', load);
    };
  }, []);

  // `displayedCategories` follows the user's view toggle:
  //   - showOriginal=true  → always original Chrome bookmarks
  //   - showOriginal=false + cached AI result → AI categories
  //   - no cached AI result → original (no toggle to make)
  const displayedCategories =
    !showOriginal && aiCategories ? aiCategories : originalCategories;
  /** Are we currently rendering the AI-organized layout? */
  const isClassified = !showOriginal && aiCategories !== null;
  /** AI cache exists but user is currently viewing original — they can toggle back. */
  const hasAiCacheButShowingOriginal = showOriginal && aiCategories !== null;

  const allBookmarks = (): { url: string; title: string }[] => {
    const seen = new Set<string>();
    const result: { url: string; title: string }[] = [];
    for (const cat of originalCategories) {
      for (const item of cat.items) {
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        result.push(item);
      }
    }
    return result;
  };

  // Open the AI classify dialog — this used to start classification directly
  // (with all the streaming UI inline). Now the dialog handles the entire
  // lifecycle so the user can close it and let things run in the background.
  const openAiDialog = () => setAiDialogOpen(true);

  // When the engine finishes a run it stashes the result in store.pendingPreview.
  // Auto-show the preview dialog so the user doesn't miss it.
  useEffect(() => {
    if (pendingPreview && !previewOpen) {
      setPreviewOpen(true);
    }
  }, [pendingPreview, previewOpen]);

  // ─── Per-bookmark actions ───────────────────────────────────────────────

  const handleEdit = async (url: string, newTitle: string, newUrl: string) => {
    if (typeof chrome === 'undefined' || !chrome.bookmarks) return;
    try {
      await updateBookmarkByUrl(url, {
        title: newTitle,
        url: newUrl === url ? undefined : newUrl,
      });
    } catch (e) {
      console.warn('[bookmark edit] failed', e);
    }
    // Refresh the local original-categories cache so the rename shows up
    // even before next mount.
    getOriginalCategories().then(setOriginalCategories);
  };

  const requestDelete = (b: { url: string; title: string }) => {
    if (skipDeleteConfirm) {
      void performDelete(b.url);
    } else {
      setConfirmDelete(b);
    }
  };

  const performDelete = async (url: string) => {
    try {
      await removeBookmarkByUrl(url);
    } catch (e) {
      console.warn('[bookmark delete] failed', e);
    }
    getOriginalCategories().then(setOriginalCategories);
    // Also prune from cached AI categories so it disappears from the AI view.
    const cats = useBookmarkClassification.getState().categories;
    if (cats) {
      const next = cats
        .map(c => ({ ...c, items: c.items.filter(i => i.url !== url) }))
        .filter(c => c.items.length > 0);
      useBookmarkClassification.setState({ categories: next });
    }
  };

  const allBookmarksUnique = (): { url: string; title: string }[] => {
    const seen = new Set<string>();
    const out: { url: string; title: string }[] = [];
    for (const cat of originalCategories) {
      for (const it of cat.items) {
        if (seen.has(it.url)) continue;
        seen.add(it.url);
        out.push(it);
      }
    }
    return out;
  };

  const bulkDelete = async (urls: string[]) => {
    await removeBookmarksByUrls(urls);
    getOriginalCategories().then(setOriginalCategories);
    const cats = useBookmarkClassification.getState().categories;
    if (cats) {
      const toRemove = new Set(urls);
      const next = cats
        .map(c => ({ ...c, items: c.items.filter(i => !toRemove.has(i.url)) }))
        .filter(c => c.items.length > 0);
      useBookmarkClassification.setState({ categories: next });
    }
  };

  // Soft reset — keep the AI cache so the user can toggle back without
  // re-running classification (which costs an API call).
  const switchToOriginal = () => showOriginalView();
  const switchToAi = () => restoreAiView();

  // Don't render the section in preview mode if there are no bookmarks yet —
  // the empty state is uninteresting.
  if (!isExtensionContext() && originalCategories.length === 0 && !loadingOriginal) {
    return null;
  }

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="text-xs font-medium uppercase tracking-wider text-white/55">
            {t('my_bookmarks')}
          </div>
          {isClassified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-200/90">
              <Sparkles size={9} />
              {t('ai_organized')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SiteTestButton
            disabled={!isExtensionContext() || displayedCategories.length === 0}
            onStart={() => {
              useSiteTest.getState().start(allBookmarksUnique());
              setSiteTestOpen(true);
            }}
            onOpen={() => setSiteTestOpen(true)}
          />
          {isClassified && (
            <button
              type="button"
              onClick={switchToOriginal}
              className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/75 transition hover:bg-white/20 hover:text-white"
            >
              <RotateCcw size={11} />
              {t('reset_to_original')}
            </button>
          )}
          {hasAiCacheButShowingOriginal && (
            <button
              type="button"
              onClick={switchToAi}
              className="flex items-center gap-1 rounded-full bg-amber-400/15 px-3 py-1.5 text-xs text-amber-200/95 transition hover:bg-amber-400/25 hover:text-amber-100"
            >
              <Sparkles size={11} />
              {t('restore_ai_view')}
            </button>
          )}
          <AiClassifyButton
            bookmarksCount={allBookmarks().length}
            hasCategories={aiCategories !== null}
            onClick={openAiDialog}
          />
        </div>
      </div>

      {loadingOriginal ? (
        <div className="py-10 text-center text-sm text-white/40">{t('loading')}</div>
      ) : displayedCategories.length === 0 ? (
        <div className="py-10 text-center text-sm text-white/40">{t('empty_hint')}</div>
      ) : (
        // CSS columns masonry: each card flows into the shortest column at
        // its natural height — small categories stay short, big ones grow
        // (up to the inner list's max-h cap). `break-inside-avoid` prevents
        // a card from splitting across columns.
        <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
          <AnimatePresence initial={false}>
            {displayedCategories.map(cat => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                className="mb-3 break-inside-avoid"
              >
                <CategoryCard
                  category={cat}
                  aiBadge={isClassified}
                  onItemMenu={(item, anchor) =>
                    setMenu({ url: item.url, title: item.title, anchor })
                  }
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {aiDialogOpen && (
          <AiClassifyDialog
            key="ai-classify-dialog"
            bookmarks={allBookmarks()}
            onOpenSettings={() => {
              // Close the AI dialog and pop the global settings drawer
              // straight into its AI sub-panel via a window event the
              // SettingsDrawer listens for. Saves the user from hunting
              // for the gear icon → drilling into AI tab themselves.
              setAiDialogOpen(false);
              window.dispatchEvent(new CustomEvent('open-ai-settings'));
            }}
            onApplyPreview={() => {
              if (pendingPreview) setCategories(pendingPreview);
              setPendingPreview(null);
              setPreviewOpen(false);
              setAiDialogOpen(false);
            }}
            onDiscardPreview={() => {
              setPendingPreview(null);
              setPreviewOpen(false);
              setAiDialogOpen(false);
            }}
            onClose={() => setAiDialogOpen(false)}
          />
        )}

        {previewOpen && pendingPreview && !aiDialogOpen && (
          <ClassifyPreviewDialog
            key="preview-dialog"
            categories={pendingPreview}
            onApply={cats => {
              setCategories(cats);
              setPendingPreview(null);
              setPreviewOpen(false);
            }}
            onCancel={() => {
              setPendingPreview(null);
              setPreviewOpen(false);
            }}
          />
        )}

        {menu && (
          <BookmarkActionMenu
            key="action-menu"
            anchor={menu.anchor}
            url={menu.url}
            title={menu.title}
            onEdit={() => setEditing({ url: menu.url, title: menu.title })}
            onDelete={() =>
              requestDelete({ url: menu.url, title: menu.title })
            }
            onClose={() => setMenu(null)}
          />
        )}

        {editing && (
          <BookmarkEditDialog
            key="edit-dialog"
            initialTitle={editing.title}
            initialUrl={editing.url}
            onSave={async (title, url) => {
              await handleEdit(editing.url, title, url);
            }}
            onClose={() => setEditing(null)}
          />
        )}

        {confirmDelete && (
          <ConfirmDeleteDialog
            key="confirm-delete"
            title={t('delete_bookmark_title')}
            warning={t('delete_warn_bookmark')}
            itemTitle={confirmDelete.title}
            itemUrl={confirmDelete.url}
            onConfirm={remember => {
              if (remember) setSkipDeleteConfirm(true);
              void performDelete(confirmDelete.url);
              setConfirmDelete(null);
            }}
            onClose={() => setConfirmDelete(null)}
          />
        )}

        {siteTestOpen && (
          <SiteTestDialog
            key="site-test"
            onDelete={bulkDelete}
            onClose={() => setSiteTestOpen(false)}
            onRestart={() => {
              useSiteTest.getState().start(allBookmarksUnique());
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CategoryCard({
  category,
  aiBadge,
  onItemMenu,
}: {
  category: Category;
  aiBadge: boolean;
  onItemMenu: (
    item: { url: string; title: string },
    anchor: { x: number; y: number }
  ) => void;
}) {
  const t = useT();
  return (
    <div className="glass glass-hover flex flex-col rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2">
        <Folder
          size={13}
          className={aiBadge ? 'shrink-0 text-amber-200/80' : 'shrink-0 text-white/55'}
        />
        <h3 className="flex-1 truncate text-sm font-medium text-white/90">
          {category.name}
        </h3>
        <span className="shrink-0 rounded-full bg-white/8 px-1.5 py-0.5 text-[10px] text-white/55">
          {category.items.length}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        {category.items.map(item => (
          <a
            key={item.url}
            href={item.url}
            title={item.title}
            onContextMenu={e => {
              // Right-click → our menu (suppress browser's native one).
              e.preventDefault();
              onItemMenu(item, { x: e.clientX, y: e.clientY });
            }}
            className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-white/10"
          >
            <img
              src={faviconUrl(item.url, 32)}
              alt=""
              className="h-4 w-4 shrink-0 rounded"
            />
            <span className="min-w-0 flex-1 truncate text-xs text-white/80">
              {item.title}
            </span>
            <button
              type="button"
              aria-label={t('bookmark_more')}
              title={t('bookmark_more')}
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                // Anchor just below the "more" button for a predictable position.
                onItemMenu(item, { x: rect.right - 4, y: rect.bottom + 4 });
              }}
              // Always reserved at the row's right edge so the title doesn't
              // jump width on hover; faded out until the row is hovered or
              // the button itself receives focus (keyboard accessibility).
              className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded text-white/55 opacity-0 transition-opacity hover:bg-white/15 hover:text-white group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100"
            >
              <MoreHorizontal size={13} />
            </button>
          </a>
        ))}
      </div>
    </div>
  );
}

// The inline ClassifyingPanel was removed — its streaming UI now lives in
// AiClassifyDialog (which is openable/closable independently of the underlying
// fetch, so progress survives a dialog close or page refresh).

/**
 * Group Chrome bookmarks by their immediate parent folder name into a
 * one-level structure: folder → leaf bookmarks. Synthetic root folders
 * keep their natural names (Bookmarks Bar, Other Bookmarks, ...).
 */
async function getOriginalCategories(): Promise<Category[]> {
  if (typeof chrome === 'undefined' || !chrome.bookmarks?.getTree) return [];
  return new Promise(resolve => {
    chrome.bookmarks.getTree(roots => {
      const groups = new Map<string, { url: string; title: string }[]>();
      const walk = (
        node: chrome.bookmarks.BookmarkTreeNode,
        parentName: string
      ) => {
        if (node.url) {
          const list = groups.get(parentName) || [];
          list.push({
            url: node.url,
            title: node.title || hostname(node.url),
          });
          groups.set(parentName, list);
        }
        if (node.children) {
          // The synthetic root (id "0") has an empty title — fall back to
          // current parentName so its direct children inherit a sane folder.
          const next = node.title || parentName;
          for (const c of node.children) walk(c, next);
        }
      };
      for (const root of roots) walk(root, 'Other');

      const cats: Category[] = [];
      for (const [name, items] of groups.entries()) {
        cats.push({ id: `orig-${name}`, name, items });
      }
      // Larger folders first
      cats.sort((a, b) => b.items.length - a.items.length);
      resolve(cats);
    });
  });
}

/**
 * The "站点测试" toolbar button. It morphs between three states based on the
 * persisted site-test store:
 *
 *   idle    — neutral label, click → start a new test
 *   running — shows live progress in the label; click → open the dialog
 *   done    — shows dead count; click → open the dialog (review + delete)
 *
 * Background work and progress live in the store; this component is purely
 * presentation + click routing.
 */
function SiteTestButton(props: {
  disabled?: boolean;
  onStart: () => void;
  onOpen: () => void;
}) {
  const t = useT();
  const status = useSiteTest(s => s.status);
  const urls = useSiteTest(s => s.urls);
  const titles = useSiteTest(s => s.titles);
  const results = useSiteTest(s => s.results);
  const progress = getProgress({ status, urls, titles, results } as never);

  const handleClick = () => {
    if (props.disabled) return;
    if (status === 'idle') {
      props.onStart();
    } else {
      // running OR done — open the dialog to view details.
      props.onOpen();
    }
  };

  let label: string;
  if (status === 'running') {
    label = t('site_test_in_progress', {
      done: String(progress.done),
      total: String(progress.total),
    });
  } else if (status === 'done') {
    label = progress.dead === 0
      ? t('site_test_done_clean')
      : t('site_test_done_label', { dead: String(progress.dead) });
  } else {
    label = t('site_test');
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={props.disabled}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
        status === 'running'
          ? 'bg-amber-400/15 text-amber-100/95 hover:bg-amber-400/25'
          : status === 'done' && progress.dead > 0
            ? 'bg-red-500/15 text-red-100/95 hover:bg-red-500/25'
            : status === 'done'
              ? 'bg-emerald-500/15 text-emerald-100/95 hover:bg-emerald-500/25'
              : 'bg-white/10 text-white/75 hover:bg-white/20 hover:text-white'
      }`}
    >
      {status === 'running' ? (
        <Loader2 size={11} className="animate-spin" />
      ) : (
        <Activity size={11} />
      )}
      {label}
    </button>
  );
}

/**
 * Compact toolbar button for the AI-classify flow. Reads its label and
 * styling from the persisted classification store so the user can see at a
 * glance whether AI is running / waiting for apply / errored, even after a
 * refresh. Click always opens the dialog — never starts/cancels directly.
 */
function AiClassifyButton(props: {
  bookmarksCount: number;
  hasCategories: boolean;
  onClick: () => void;
}) {
  const t = useT();
  const inProgress = useBookmarkClassification(s => s.inProgress);
  const pendingPreview = useBookmarkClassification(s => s.pendingPreview);
  const lastError = useBookmarkClassification(s => s.lastError);

  const running =
    !!inProgress && !inProgress.interrupted && isAiClassifyActive();
  const interrupted = !!inProgress && inProgress.interrupted;
  const waiting = !!pendingPreview && !running;
  const errored = !!lastError && !running;

  let label: string;
  let tone: 'amber' | 'emerald' | 'red' | 'neutral';
  if (running) {
    tone = 'amber';
    label = t('ai_classify_btn_running', {
      bytes: String(inProgress!.bytesReceived || 0),
    });
  } else if (waiting) {
    tone = 'emerald';
    label = t('ai_classify_btn_waiting');
  } else if (interrupted) {
    tone = 'amber';
    label = t('ai_classify_btn_interrupted');
  } else if (errored) {
    tone = 'red';
    label = t('ai_classify_btn_error');
  } else {
    tone = 'neutral';
    label = props.hasCategories ? t('ai_reclassify') : t('ai_classify_btn');
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.bookmarksCount === 0 && !running && !waiting}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
        tone === 'amber'
          ? 'bg-amber-400/15 text-amber-100/95 hover:bg-amber-400/25'
          : tone === 'emerald'
            ? 'bg-emerald-500/15 text-emerald-100/95 hover:bg-emerald-500/25'
            : tone === 'red'
              ? 'bg-red-500/15 text-red-100/95 hover:bg-red-500/25'
              : 'bg-white/15 text-white hover:bg-white/25'
      }`}
    >
      {running ? (
        <Loader2 size={12} className="animate-spin" />
      ) : interrupted || errored ? (
        <AlertTriangle size={12} />
      ) : (
        <Sparkles size={12} />
      )}
      {label}
    </button>
  );
}
