import { useLayoutEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Brain,
  Settings as SettingsIcon,
  Square,
  X,
  PlayCircle,
} from 'lucide-react';
import { useT } from '@/i18n';
import { useEscKey } from '@/lib/hooks/useEscKey';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { useBookmarkClassification } from '@/stores/bookmarkClassification';
import { useAiConfig } from '@/stores/aiConfig';
import {
  cancelAiClassify,
  startAiClassify,
  isAiClassifyActive,
} from '@/lib/ai-classify-engine';

/**
 * Single dialog that morphs across the lifecycle of an AI bookmark
 * classification run.
 *
 *   idle / has-result    → config preview + "开始分类" / "查看结果"
 *   running              → live reasoning + bytes + "停止"
 *   interrupted          → "上次中断" + "重试" / "丢弃"
 *   error                → red banner + "重试" / "丢弃"
 *
 * Closing the dialog (✕ / overlay / Esc) NEVER affects the underlying
 * classification — the engine drives it from the persisted store, so the
 * user can pop the dialog open later to check on progress.
 */
export function AiClassifyDialog(props: {
  bookmarks: Array<{ url: string; title: string }>;
  /** Open the settings drawer so the user can change endpoint / model. */
  onOpenSettings: () => void;
  /** Apply the pending preview into `categories`. */
  onApplyPreview: () => void;
  /** Discard the pending preview without applying. */
  onDiscardPreview: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const inProgress = useBookmarkClassification(s => s.inProgress);
  const pendingPreview = useBookmarkClassification(s => s.pendingPreview);
  const lastError = useBookmarkClassification(s => s.lastError);
  const setLastError = useBookmarkClassification(s => s.setLastError);
  const endClassify = useBookmarkClassification(s => s.endClassify);

  const customBaseUrl = useAiConfig(s => s.customBaseUrl);
  const customModel = useAiConfig(s => s.customModel);
  const isConfigured = useAiConfig(s => s.isConfigured());

  useEscKey(true, props.onClose);
  useBodyScrollLock();

  // Derive the high-level lifecycle state from the store.
  // `running` and `interrupted` are mutually exclusive thanks to engine boot.
  const running =
    !!inProgress && !inProgress.interrupted && isAiClassifyActive();
  const interrupted = !!inProgress && inProgress.interrupted;
  const hasPreview = pendingPreview !== null;
  const hasError = lastError !== null;
  const idle = !running && !interrupted && !hasPreview && !hasError;

  const handleStart = async () => {
    setLastError(null);
    const r = await startAiClassify(props.bookmarks);
    if (!r.ok && r.error !== 'aborted' && r.error !== 'already_running') {
      // Engine already wrote the error to the store for visible errors.
      // For pre-flight failures (permission/host) it sets lastError too.
      if (r.reason === 'permission_denied') {
        setLastError(t('ai_host_permission_denied'));
      } else if (r.reason === 'invalid_host') {
        setLastError(t('ai_host_invalid'));
      } else if (r.error === 'no_bookmarks') {
        setLastError(t('ai_classify_no_bookmarks'));
      }
    }
  };

  const handleStop = () => {
    cancelAiClassify();
    endClassify();
  };

  const handleDiscardInterruption = () => {
    endClassify();
    setLastError(null);
  };

  const showConfig = isConfigured
    ? { mode: 'custom' as const, endpoint: customBaseUrl, model: customModel }
    : { mode: 'unset' as const };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={props.onClose}
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
        {/* ─── Header ───────────────────────────────────────────────── */}
        <div className="mb-4 flex items-center gap-2">
          {running ? (
            <Loader2 size={18} className="animate-spin text-white/85" />
          ) : interrupted || hasError ? (
            <AlertTriangle size={18} className="text-amber-300" />
          ) : (
            <Sparkles size={18} className="text-amber-200/90" />
          )}
          <h2 className="flex-1 text-lg font-medium text-white">
            {t('ai_classify_dialog_title')}
          </h2>
          <button
            type="button"
            onClick={props.onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/65 hover:bg-white/10"
            aria-label={t('site_test_close')}
          >
            <X size={15} />
          </button>
        </div>

        {/* ─── Config card (always shown in idle/error/interrupted) ──── */}
        {(idle || interrupted || hasError) && (
          <div className="mb-4 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-white/70">
                <Brain size={12} />
                {t('ai_classify_config_label')}
              </div>
              <button
                type="button"
                onClick={props.onOpenSettings}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-white/55 hover:bg-white/10 hover:text-white"
              >
                <SettingsIcon size={11} />
                {t('ai_classify_open_settings')}
              </button>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-white/45">{t('ai_classify_endpoint')}</dt>
              <dd className="truncate text-white/85">
                {showConfig.mode === 'custom'
                  ? showConfig.endpoint
                  : <span className="text-amber-200/80">{t('ai_not_configured_short')}</span>}
              </dd>
              <dt className="text-white/45">{t('ai_model')}</dt>
              <dd className="truncate text-white/85">
                {showConfig.mode === 'custom'
                  ? showConfig.model
                  : <span className="text-amber-200/80">{t('ai_not_configured_short')}</span>}
              </dd>
              <dt className="text-white/45">{t('ai_classify_bookmark_count')}</dt>
              <dd className="text-white/85 tabular-nums">
                {props.bookmarks.length}
              </dd>
            </dl>
          </div>
        )}

        {/* ─── Content area ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {running && inProgress && (
            <RunningContent
              reasoning={inProgress.reasoning}
              bytesReceived={inProgress.bytesReceived}
              bookmarkCount={inProgress.bookmarkCount}
            />
          )}

          {interrupted && inProgress && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-2xl bg-amber-400/15 px-4 py-3 text-xs text-amber-100/90 ring-1 ring-amber-300/20">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>{t('ai_progress_interrupted')}</span>
              </div>
              {inProgress.reasoning && (
                <ReasoningPreview reasoning={inProgress.reasoning} />
              )}
            </div>
          )}

          {hasError && (
            <div className="flex items-start gap-2 rounded-2xl bg-red-500/15 px-4 py-3 text-xs text-red-200/85 ring-1 ring-red-300/20">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span className="break-all">{lastError}</span>
            </div>
          )}

          {hasPreview && (
            <div className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200/90 ring-1 ring-emerald-300/20">
              {t('ai_classify_preview_ready', {
                cats: String(pendingPreview!.length),
                items: String(
                  pendingPreview!.reduce((n, c) => n + c.items.length, 0)
                ),
              })}
            </div>
          )}
        </div>

        {/* ─── Footer ──────────────────────────────────────────────── */}
        <div className="mt-5 flex justify-end gap-2">
          {idle && (
            <>
              <button
                type="button"
                onClick={props.onClose}
                className="rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/10"
              >
                {t('cancel')}
              </button>
              {isConfigured ? (
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={props.bookmarks.length === 0}
                  className="flex items-center gap-1.5 rounded-xl bg-white/90 px-4 py-2 text-sm font-medium text-black hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <PlayCircle size={14} />
                  {t('ai_classify_start')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={props.onOpenSettings}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-400/85 px-4 py-2 text-sm font-medium text-black hover:bg-amber-300"
                >
                  <SettingsIcon size={14} />
                  {t('ai_open_settings')}
                </button>
              )}
            </>
          )}

          {running && (
            <>
              <button
                type="button"
                onClick={props.onClose}
                className="rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/10"
              >
                {t('ai_classify_hide')}
              </button>
              <button
                type="button"
                onClick={handleStop}
                className="flex items-center gap-1.5 rounded-xl bg-red-500/80 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
              >
                <Square size={12} />
                {t('ai_classify_stop')}
              </button>
            </>
          )}

          {(interrupted || hasError) && (
            <>
              <button
                type="button"
                onClick={handleDiscardInterruption}
                className="rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/10"
              >
                {t('ai_progress_dismiss')}
              </button>
              <button
                type="button"
                onClick={handleStart}
                className="flex items-center gap-1.5 rounded-xl bg-white/90 px-4 py-2 text-sm font-medium text-black hover:bg-white"
              >
                <PlayCircle size={14} />
                {t('ai_progress_retry')}
              </button>
            </>
          )}

          {hasPreview && (
            <>
              <button
                type="button"
                onClick={props.onDiscardPreview}
                className="rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/10"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={props.onApplyPreview}
                className="rounded-xl bg-white/90 px-4 py-2 text-sm font-medium text-black hover:bg-white"
              >
                {t('apply')}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function RunningContent(props: {
  reasoning: string;
  bytesReceived: number;
  bookmarkCount: number;
}) {
  const t = useT();
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-white/85">
        <Loader2 size={14} className="animate-spin" />
        <span className="flex-1 truncate">
          {t('ai_classify_loading', { n: String(props.bookmarkCount) })}
        </span>
        {props.bytesReceived > 0 && (
          <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] tabular-nums text-white/65">
            {t('ai_stream_bytes', { n: String(props.bytesReceived) })}
          </span>
        )}
        {props.reasoning.length === 0 && props.bytesReceived === 0 && (
          <span className="shrink-0 text-[10px] text-white/45">
            {t('ai_stream_waiting')}
          </span>
        )}
      </div>
      {props.reasoning && <ReasoningPreview reasoning={props.reasoning} />}
    </div>
  );
}

function ReasoningPreview({ reasoning }: { reasoning: string }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  // Auto-scroll the reasoning panel to the latest token.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [reasoning]);

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-white/55">
        <Brain size={11} />
        {t('ai_thinking')}
      </div>
      <div
        ref={ref}
        className="max-h-48 overflow-y-auto rounded-xl bg-black/25 px-3 py-2 text-[11px] leading-relaxed text-white/65 ring-1 ring-white/5"
      >
        <pre className="whitespace-pre-wrap font-mono">{reasoning}</pre>
      </div>
    </div>
  );
}

