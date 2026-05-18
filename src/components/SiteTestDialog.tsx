import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { useT } from '@/i18n';
import { useEscKey } from '@/lib/hooks/useEscKey';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { faviconUrl, hostname } from '@/lib/favicon';
import { getProgress, useSiteTest } from '@/stores/siteTest';
import { retestOne } from '@/lib/site-test-engine';

/**
 * Viewer for the site-test progress / results. Open and close at will —
 * closing this dialog does NOT stop the test (the worker pool lives in
 * site-test-engine.ts and reads from the persisted store).
 */
export function SiteTestDialog(props: {
  onClose: () => void;
  /** Caller supplies the actual delete (we just collect URLs). */
  onDelete: (urls: string[]) => Promise<void>;
  /** Reset state and start a brand-new test on the same bookmark list. */
  onRestart: () => void;
}) {
  const t = useT();

  const status = useSiteTest(s => s.status);
  const urls = useSiteTest(s => s.urls);
  const titles = useSiteTest(s => s.titles);
  const results = useSiteTest(s => s.results);
  const progress = useMemo(
    () => getProgress({ status, urls, titles, results } as never),
    [status, urls, results, titles]
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /** URLs currently being thorough-probed via the per-row 🔄 button. */
  const [retesting, setRetesting] = useState<Set<string>>(new Set());
  /** URLs that just flipped from dead → alive on a manual retest. Shows a
   *  "✓ 可以访问了" toast for one beat before the row animates out of `dead`
   *  on the next render. */
  const [justAlive, setJustAlive] = useState<Set<string>>(new Set());

  // Pre-select all dead URLs once results come in (only the first time we see
  // a "done" state — afterwards leave selection alone so user edits stick).
  //
  // We also keep URLs in this list briefly after they flip dead → alive on a
  // manual retest, so the row can flash a "✓ 可以访问了" toast before it
  // slides out (otherwise the row would vanish the instant recordResult
  // writes 'alive', giving the user no acknowledgement that retest worked).
  const dead = useMemo(() => {
    const out: { url: string; title: string }[] = [];
    for (const url of urls) {
      if (results[url] === 'dead' || justAlive.has(url)) {
        out.push({ url, title: titles[url] || url });
      }
    }
    return out;
  }, [urls, results, titles, justAlive]);

  // Sync default-select-all on first arrival of `done` status.
  const [preselected, setPreselected] = useState(false);
  if (status === 'done' && !preselected) {
    setSelected(new Set(dead.map(d => d.url)));
    setPreselected(true);
  } else if (status !== 'done' && preselected) {
    // Reset preselected flag if we go back to running (re-test).
    setPreselected(false);
  }

  useEscKey(true, () => {
    if (deleting) return;
    props.onClose();
  });
  useBodyScrollLock();

  const toggleOne = (url: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === dead.length) setSelected(new Set());
    else setSelected(new Set(dead.map(d => d.url)));
  };

  const doRetestOne = async (url: string) => {
    if (retesting.has(url)) return;
    setRetesting(prev => {
      const next = new Set(prev);
      next.add(url);
      return next;
    });
    try {
      const result = await retestOne(url);
      if (result === 'alive') {
        // Flash a "now alive" hint, then drop from selection so a stray
        // checked-state doesn't delete a working bookmark.
        setSelected(prev => {
          if (!prev.has(url)) return prev;
          const next = new Set(prev);
          next.delete(url);
          return next;
        });
        setJustAlive(prev => {
          const next = new Set(prev);
          next.add(url);
          return next;
        });
        // The recomputed `dead` memo will drop this URL on the next render
        // since results[url] is now 'alive', so the flash is naturally
        // short-lived — but clean up the set after a delay regardless so it
        // doesn't grow forever if the user re-tests in weird orders.
        setTimeout(() => {
          setJustAlive(prev => {
            if (!prev.has(url)) return prev;
            const next = new Set(prev);
            next.delete(url);
            return next;
          });
        }, 1200);
      }
    } finally {
      setRetesting(prev => {
        const next = new Set(prev);
        next.delete(url);
        return next;
      });
    }
  };

  const doDelete = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      await props.onDelete(Array.from(selected));
      // After deletion, drop those URLs from the store too so the dialog
      // re-renders without them.
      const st = useSiteTest.getState();
      const nextResults = { ...st.results };
      const nextTitles = { ...st.titles };
      for (const u of selected) {
        delete nextResults[u];
        delete nextTitles[u];
      }
      useSiteTest.setState({
        results: nextResults,
        titles: nextTitles,
        urls: st.urls.filter(u => !selected.has(u)),
      });
      setSelected(new Set());
      setConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={deleting ? undefined : props.onClose}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 12 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        onClick={e => e.stopPropagation()}
        className="glass-strong flex max-h-[80vh] w-[560px] max-w-[92vw] flex-col rounded-3xl p-6"
      >
        <div className="mb-4 flex items-center gap-2">
          {status === 'running' ? (
            <Loader2 size={18} className="animate-spin text-white/85" />
          ) : (
            <CheckCircle2
              size={18}
              className={dead.length === 0 ? 'text-emerald-300' : 'text-amber-300'}
            />
          )}
          <h2 className="flex-1 text-lg font-medium text-white">
            {t('site_test')}
          </h2>
          {status === 'done' && (
            <button
              type="button"
              onClick={props.onRestart}
              className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs text-white/75 hover:bg-white/20 hover:text-white"
              title={t('site_test')}
            >
              <RotateCcw size={11} />
              {t('site_test_restart')}
            </button>
          )}
          <button
            type="button"
            onClick={props.onClose}
            disabled={deleting}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/65 hover:bg-white/10 disabled:opacity-50"
          >
            <X size={15} />
          </button>
        </div>

        {status === 'running' && (
          <div className="space-y-3">
            <div className="text-sm text-white/80">
              {t('site_test_running', {
                done: String(progress.done),
                total: String(progress.total),
              })}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full bg-white/85"
                animate={{
                  width: `${(progress.done / Math.max(1, progress.total)) * 100}%`,
                }}
                transition={{ duration: 0.2 }}
              />
            </div>
            {/* While the test is still running we already show any dead links
                we've found so far — gives instant feedback before completion. */}
            {dead.length > 0 && (
              <div className="text-xs text-amber-200/80">
                {t('site_test_dead_so_far', { n: String(dead.length) })}
              </div>
            )}
          </div>
        )}

        {status !== 'running' && dead.length === 0 && (
          <div className="rounded-2xl bg-emerald-500/10 px-4 py-6 text-center text-sm text-emerald-200/90">
            {t('site_test_all_alive')}
          </div>
        )}

        {dead.length > 0 && (
          <>
            <div className="mb-3 mt-3 flex items-center justify-between gap-2">
              <div className="text-sm text-white/85">
                {status === 'running'
                  ? t('site_test_dead_so_far', { n: String(dead.length) })
                  : t('site_test_dead_count', { n: String(dead.length) })}
              </div>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-white/55 hover:text-white/85"
              >
                {selected.size === dead.length
                  ? t('site_test_select_none')
                  : t('site_test_select_all')}
              </button>
            </div>

            <div className="-mx-1 mb-4 flex-1 overflow-y-auto px-1">
              <div className="space-y-1">
                {dead.map(b => {
                  const checked = selected.has(b.url);
                  const isRetesting = retesting.has(b.url);
                  const isJustAlive = justAlive.has(b.url);
                  return (
                    <div
                      key={b.url}
                      className="group flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/8"
                    >
                      {/* Checkbox — its own clickable label so toggling
                          selection doesn't conflict with the title link. */}
                      <label className="flex shrink-0 cursor-pointer items-center">
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded border transition ${
                            checked
                              ? 'border-white/85 bg-white/85 text-black'
                              : 'border-white/30 bg-transparent'
                          }`}
                        >
                          {checked && <Check size={11} strokeWidth={3} />}
                        </span>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => toggleOne(b.url)}
                        />
                      </label>

                      <img
                        src={faviconUrl(b.url, 32)}
                        alt=""
                        className="h-4 w-4 shrink-0 rounded"
                      />

                      {/* Title + hostname are a real link → opens the
                          original URL in a new tab so the user can verify
                          by hand that it's actually dead before deleting. */}
                      <a
                        href={b.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={t('site_test_open_link')}
                        className="group/link min-w-0 flex-1"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm text-white/90 group-hover/link:underline">
                            {b.title}
                          </span>
                          <ExternalLink
                            size={11}
                            className="shrink-0 text-white/35 opacity-0 transition group-hover/link:opacity-100"
                          />
                        </div>
                        <div className="truncate text-[11px] text-white/45">
                          {isJustAlive ? (
                            <span className="text-emerald-300/90">
                              {t('site_test_retest_now_alive')}
                            </span>
                          ) : (
                            hostname(b.url)
                          )}
                        </div>
                      </a>

                      {/* Per-row retest. Runs the thorough multi-angle probe
                          (HEAD → GET → favicon image → www-swap retry).
                          Hidden during the post-success flash since there's
                          nothing left to retest. */}
                      {isJustAlive ? (
                        <CheckCircle2
                          size={15}
                          className="shrink-0 text-emerald-300"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => doRetestOne(b.url)}
                          disabled={isRetesting}
                          title={t('site_test_retest_one')}
                          aria-label={t('site_test_retest_one')}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white/55 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                        >
                          {isRetesting ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <RefreshCw size={13} />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <AnimatePresence>
              {confirmingDelete && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mb-3 flex items-start gap-2 rounded-xl bg-red-500/15 px-3 py-2.5 text-xs text-red-200/90 ring-1 ring-red-300/20">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    <span>{t('site_test_delete_warn')}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={props.onClose}
                disabled={deleting}
                className="rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/10 disabled:opacity-50"
              >
                {t('site_test_close')}
              </button>
              {!confirmingDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={selected.size === 0}
                  className="flex items-center gap-1.5 rounded-xl bg-red-500/80 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={13} />
                  {t('site_test_delete_selected', {
                    n: String(selected.size),
                  })}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={doDelete}
                  disabled={deleting}
                  className="flex items-center gap-1.5 rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {deleting ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                  {t('site_test_delete_selected', {
                    n: String(selected.size),
                  })}
                </button>
              )}
            </div>
          </>
        )}

        {status !== 'running' && dead.length === 0 && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={props.onClose}
              className="rounded-xl bg-white/90 px-4 py-2 text-sm font-medium text-black hover:bg-white"
            >
              {t('site_test_close')}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
