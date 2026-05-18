import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Plug,
} from 'lucide-react';
import { useT } from '@/i18n';
import { useAiConfig } from '@/stores/aiConfig';
import { listModels, testConnection } from '@/lib/ai/client';
import {
  hasHostAccess,
  requestHostAccess,
  ensureCurrentEndpointAccess,
} from '@/lib/ai/host-access';

export function AiSettingsPanel() {
  const t = useT();
  const customBaseUrl = useAiConfig(s => s.customBaseUrl);
  const setCustomBaseUrl = useAiConfig(s => s.setCustomBaseUrl);
  const customApiKey = useAiConfig(s => s.customApiKey);
  const setCustomApiKey = useAiConfig(s => s.setCustomApiKey);
  const customModel = useAiConfig(s => s.customModel);
  const setCustomModel = useAiConfig(s => s.setCustomModel);

  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    { ok: true; count: number } | { ok: false; error: string } | null
  >(null);
  /**
   * True when `customModel` arrived via a click on a dropdown row rather
   * than via the keyboard — the dropdown shows ALL models in that case
   * (so the user can keep browsing) instead of collapsing the filter to
   * just the selected row. Reset to false the moment the user types.
   */
  const [pickedFromList, setPickedFromList] = useState(false);

  /**
   * Live substring filter for the dropdown.
   *
   *  - empty query → show all (just-opened state).
   *  - `pickedFromList` → show all (the user clicked a row; the typed
   *    value happens to equal a model id, but it's not "their filter").
   *  - otherwise → case-insensitive substring match. Note this fires
   *    even when the typed value happens to exactly match an existing
   *    model id — that's still a filter, just a 1-result filter, and
   *    suppressing it broke the "gpt-5" case.
   */
  const filteredModels = useMemo(() => {
    const q = customModel.trim().toLowerCase();
    if (!q) return models;
    if (pickedFromList) return models;
    return models.filter(m => m.toLowerCase().includes(q));
  }, [models, customModel, pickedFromList]);
  const isFiltering = !pickedFromList && customModel.trim().length > 0;

  /**
   * The model input field — the dropdown is portaled to <body>, so it needs
   * the live bounding rect of this anchor to position itself with
   * `position: fixed`. Going through a portal escapes the multi-layer
   * `overflow-hidden` chain in SettingsDrawer (drawer panel → tab container
   * → scrollable content) that would otherwise clip the dropdown.
   */
  const modelFieldRef = useRef<HTMLDivElement>(null);
  const [menuRect, setMenuRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  // Whenever the menu is open, keep it positioned under the input. We follow
  // (rather than close) on scroll/resize — the drawer's own scrollable
  // column scrolls the input, so closing-on-scroll meant the user couldn't
  // ever scroll the drawer with the menu open. rAF-throttle the recompute
  // so a fast scroll doesn't trigger one setState per pixel.
  useEffect(() => {
    if (!modelMenuOpen) return;
    const update = () => {
      const el = modelFieldRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setMenuRect({ top: r.bottom + 6, left: r.left, width: r.width });
    };
    update();

    let raf = 0;
    const scheduleUpdate = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    };

    window.addEventListener('resize', scheduleUpdate);
    // Capture phase so scrolls inside the SettingsDrawer's overflow-y-auto
    // column also keep the dropdown anchored.
    window.addEventListener('scroll', scheduleUpdate, true);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);
    };
  }, [modelMenuOpen]);

  const fetchModels = async () => {
    if (!customBaseUrl || !customApiKey) return;
    setLoadingModels(true);
    setModelsError(null);
    try {
      // Custom endpoints need a runtime host-permission grant before the
      // extension is allowed to call them cross-origin.
      if (!(await hasHostAccess(customBaseUrl))) {
        const granted = await requestHostAccess(customBaseUrl);
        if (!granted) {
          throw new Error(t('ai_host_permission_denied'));
        }
      }
      const list = await listModels(customBaseUrl, customApiKey);
      setModels(list);
      // If the persisted customModel was one of the just-returned ids,
      // treat it as a prior selection so opening the menu shows ALL
      // models rather than narrowing to the single matching row.
      if (
        customModel &&
        list.some(m => m.toLowerCase() === customModel.toLowerCase())
      ) {
        setPickedFromList(true);
      } else {
        setPickedFromList(false);
      }
      setModelMenuOpen(true);
    } catch (e) {
      setModelsError(e instanceof Error ? e.message : String(e));
      setModels([]);
      setModelMenuOpen(false);
    } finally {
      setLoadingModels(false);
    }
  };

  const canFetch = customBaseUrl.length > 0 && customApiKey.length > 0;

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    const access = await ensureCurrentEndpointAccess();
    if (!access.ok) {
      setTesting(false);
      setTestResult({
        ok: false,
        error:
          access.reason === 'denied'
            ? t('ai_host_permission_denied')
            : t('ai_host_invalid'),
      });
      return;
    }
    const res = await testConnection();
    setTesting(false);
    if (res.ok) setTestResult({ ok: true, count: res.models });
    else setTestResult({ ok: false, error: res.error });
  };

  return (
    <div className="space-y-2">
      {/* Required-config banner — built-in AI service has been removed,
          so this explains up-front why the fields below are mandatory. */}
      <div className="flex items-start gap-2 rounded-2xl bg-amber-400/10 px-4 py-3 text-xs text-amber-100/85 ring-1 ring-amber-300/20">
        <AlertCircle size={13} className="mt-0.5 shrink-0 text-amber-200/85" />
        <span>{t('ai_config_required_desc')}</span>
      </div>

      <div className="space-y-3 rounded-2xl bg-white/5 px-4 py-3.5">
              <Field label={t('ai_base_url')}>
                <input
                  type="url"
                  value={customBaseUrl}
                  onChange={e => setCustomBaseUrl(e.target.value)}
                  placeholder={t('ai_base_url_placeholder')}
                  className="w-full rounded-xl bg-black/25 px-3 py-2 text-sm text-white placeholder-white/35 outline-none ring-1 ring-white/10 focus:ring-white/30"
                />
              </Field>

              <Field label={t('ai_api_key')}>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={customApiKey}
                    onChange={e => setCustomApiKey(e.target.value)}
                    placeholder={t('ai_api_key_placeholder')}
                    className="w-full rounded-xl bg-black/25 px-3 py-2 pr-10 font-mono text-sm text-white placeholder-white/35 outline-none ring-1 ring-white/10 focus:ring-white/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/45 hover:bg-white/10 hover:text-white/80"
                    aria-label="toggle visibility"
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </Field>

              <Field label={t('ai_model')}>
                <div ref={modelFieldRef} className="relative">
                  <input
                    type="text"
                    value={customModel}
                    onChange={e => {
                      setCustomModel(e.target.value);
                      // Any keystroke means "user is filtering" — clear the
                      // pickedFromList flag so the filter actually applies
                      // even if their typed text happens to equal a model id.
                      setPickedFromList(false);
                      // Typing also re-opens the dropdown so the user can see
                      // the filter narrow live — without this, dismissing the
                      // menu (e.g. click-outside) and then typing would leave
                      // the user filtering against an invisible list.
                      if (models.length > 0) setModelMenuOpen(true);
                    }}
                    // Once we've fetched the model list at least once,
                    // treat the input as a combobox trigger — focus or
                    // click re-opens the cached list without re-hitting
                    // the API.
                    onFocus={() => {
                      if (models.length > 0) setModelMenuOpen(true);
                    }}
                    onClick={() => {
                      if (models.length > 0) setModelMenuOpen(true);
                    }}
                    onKeyDown={e => {
                      // ESC: if filtering, just clear the filter (keep the
                      // dropdown open so the user can re-browse). If not
                      // filtering, close the dropdown.
                      if (e.key === 'Escape' && modelMenuOpen) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isFiltering) setCustomModel('');
                        else setModelMenuOpen(false);
                      }
                    }}
                    placeholder={t('ai_model_placeholder')}
                    className="w-full rounded-xl bg-black/25 px-3 py-2 pr-28 text-sm text-white placeholder-white/35 outline-none ring-1 ring-white/10 focus:ring-white/30"
                  />
                  <button
                    type="button"
                    onClick={fetchModels}
                    disabled={!canFetch || loadingModels}
                    className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1 text-[11px] text-white/85 transition hover:bg-white/25 disabled:opacity-40 disabled:hover:bg-white/15"
                  >
                    <RefreshCw
                      size={11}
                      className={loadingModels ? 'animate-spin' : ''}
                    />
                    {loadingModels ? t('ai_fetch_models_loading') : t('ai_fetch_models')}
                    {!loadingModels && models.length > 0 && (
                      <ChevronDown size={10} className="opacity-60" />
                    )}
                  </button>
                </div>

                {modelsError && (
                  <div className="mt-2 flex items-start gap-2 rounded-xl bg-red-500/15 px-3 py-2 text-[11px] text-red-200/85">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    <span className="break-all">
                      {t('ai_fetch_models_error', { err: modelsError })}
                    </span>
                  </div>
                )}
                {modelMenuOpen && !loadingModels && models.length === 0 && !modelsError && (
                  <div className="mt-2 text-[11px] text-white/45">
                    {t('ai_fetch_models_empty')}
                  </div>
                )}
              </Field>
      </div>

      {/* Model dropdown — portaled to <body> with `position: fixed` so it
          escapes the SettingsDrawer's multi-layer overflow-hidden chain
          (drawer panel → tabs container → scrollable column) which would
          otherwise clip a normal absolute-positioned popover. */}
      {createPortal(
        <AnimatePresence>
          {modelMenuOpen && models.length > 0 && menuRect && (
            <>
              {/* Click-outside catcher. Above the drawer's own backdrop
                  (z-40) but below the dropdown itself. */}
              <div
                className="fixed inset-0 z-[60]"
                onClick={() => setModelMenuOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                style={{
                  top: menuRect.top,
                  left: menuRect.left,
                  width: menuRect.width,
                }}
                className="glass-strong fixed z-[61] max-h-64 overflow-y-auto rounded-2xl p-1.5 shadow-2xl"
              >
                {filteredModels.length === 0 ? (
                  <div className="px-3 py-2.5 text-[11px] text-white/55">
                    {t('ai_fetch_models_no_match')}
                  </div>
                ) : (
                  filteredModels.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setCustomModel(m);
                        // Click = selection — show all on next re-open.
                        setPickedFromList(true);
                        setModelMenuOpen(false);
                      }}
                      className={`block w-full truncate rounded-xl px-3 py-2 text-left text-sm transition ${
                        m === customModel
                          ? 'bg-white/20 text-white'
                          : 'text-white/80 hover:bg-white/10'
                      }`}
                    >
                      {m}
                    </button>
                  ))
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      <div className="rounded-2xl bg-white/5 px-4 py-3.5">
        <button
          type="button"
          onClick={runTest}
          disabled={testing}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/25 disabled:opacity-50"
        >
          {testing ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Plug size={14} />
          )}
          {testing ? t('ai_test_testing') : t('ai_test_connection')}
        </button>
        <AnimatePresence>
          {testResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              {testResult.ok ? (
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-emerald-400/15 px-3 py-2 text-[11px] text-emerald-200/90">
                  <CheckCircle2 size={12} className="shrink-0" />
                  {t('ai_test_ok', { count: String(testResult.count) })}
                </div>
              ) : (
                <div className="mt-2 flex items-start gap-2 rounded-xl bg-red-500/15 px-3 py-2 text-[11px] text-red-200/85">
                  <AlertCircle size={12} className="mt-0.5 shrink-0" />
                  <span className="break-all">
                    {t('ai_test_failed', { err: testResult.error })}
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-white/55">
        {props.label}
      </div>
      {props.children}
    </div>
  );
}
