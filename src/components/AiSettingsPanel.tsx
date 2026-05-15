import { useState } from 'react';
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
import { ToggleRow } from './ui/ToggleRow';

export function AiSettingsPanel() {
  const t = useT();
  const useCustom = useAiConfig(s => s.useCustom);
  const setUseCustom = useAiConfig(s => s.setUseCustom);
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
      <ToggleRow
        label={t('ai_use_custom')}
        desc={t('ai_use_custom_desc')}
        value={useCustom}
        onChange={setUseCustom}
      />

      <AnimatePresence initial={false}>
        {useCustom ? (
          <motion.div
            key="custom-fields"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
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
                <div className="relative">
                  <input
                    type="text"
                    value={customModel}
                    onChange={e => setCustomModel(e.target.value)}
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

                  <AnimatePresence>
                    {modelMenuOpen && models.length > 0 && (
                      <>
                        <div
                          className="fixed inset-0 z-30"
                          onClick={() => setModelMenuOpen(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.15 }}
                          className="glass-strong absolute right-0 top-full z-40 mt-1.5 max-h-64 w-full overflow-y-auto rounded-2xl p-1.5"
                        >
                          {models.map(m => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => {
                                setCustomModel(m);
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
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
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
          </motion.div>
        ) : (
          <motion.div
            key="builtin-hint"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl bg-white/5 px-4 py-3.5">
              <div className="flex items-start gap-2 text-xs text-white/60">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-300/85" />
                <span>{t('ai_use_builtin_desc')}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
