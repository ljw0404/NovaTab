import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  Download,
  Upload,
  Wrench,
  CloudDownload,
  RotateCcw,
  AlertTriangle,
  FileJson,
} from 'lucide-react';
import { useT } from '@/i18n';
import { useEscKey } from '@/lib/hooks/useEscKey';
import { useCloudSync } from '@/stores/cloudSync';
import {
  downloadBackup,
  parseBackup,
  applyBackup,
  resetAllLocal,
  summarizeBackup,
  type BackupFile,
  type BackupSummary,
} from '@/lib/backup';
import {
  hasMeaningfulData,
  readRemote,
  type SyncEnvelope,
} from '@/lib/cloud-sync';
import { applyRemoteEnvelopeAndMark } from '@/lib/cloud-sync-engine';

type Action = 'export' | 'import' | 'repair' | null;

export function BackupSection() {
  const t = useT();
  const [action, setAction] = useState<Action>(null);

  return (
    <div className="rounded-2xl bg-white/5 px-4 py-3.5">
      <div className="mb-2.5 text-sm text-white/90">{t('backup_section')}</div>
      <div className="divide-y divide-white/10">
        <ActionRow
          icon={<Download size={15} />}
          label={t('backup_export')}
          desc={t('backup_export_desc')}
          onClick={() => setAction('export')}
        />
        <ActionRow
          icon={<Upload size={15} />}
          label={t('backup_import')}
          desc={t('backup_import_desc')}
          onClick={() => setAction('import')}
        />
        <ActionRow
          icon={<Wrench size={15} />}
          label={t('backup_repair')}
          desc={t('backup_repair_desc')}
          onClick={() => setAction('repair')}
        />
      </div>

      <AnimatePresence>
        {action === 'export' && <ExportDialog onClose={() => setAction(null)} />}
        {action === 'import' && <ImportDialog onClose={() => setAction(null)} />}
        {action === 'repair' && <RepairDialog onClose={() => setAction(null)} />}
      </AnimatePresence>
    </div>
  );
}

function ActionRow(props: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="group flex w-full items-center gap-3 py-3 text-left transition hover:bg-white/[0.04]"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/75 group-hover:bg-white/15 group-hover:text-white">
        {props.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-white">{props.label}</div>
        <div className="mt-0.5 text-xs text-white/50">{props.desc}</div>
      </div>
      <ChevronRight size={16} className="shrink-0 text-white/30 group-hover:text-white/65" />
    </button>
  );
}

// ─── Dialog shell ────────────────────────────────────────────────────────────

function DialogShell(props: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEscKey(true, props.onClose);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={props.onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 12 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        onClick={e => e.stopPropagation()}
        className="glass-strong w-[480px] max-w-[92vw] rounded-3xl p-6"
      >
        <h2 className="mb-4 text-lg font-medium text-white">{props.title}</h2>
        {props.children}
        {props.footer && <div className="mt-5 flex justify-end gap-2">{props.footer}</div>}
      </motion.div>
    </motion.div>
  );
}

// ─── Export ──────────────────────────────────────────────────────────────────

function ExportDialog(props: { onClose: () => void }) {
  const t = useT();
  return (
    <DialogShell
      title={t('backup_export')}
      onClose={props.onClose}
      footer={
        <>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/10"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={() => {
              downloadBackup();
              props.onClose();
            }}
            className="flex items-center gap-1.5 rounded-xl bg-white/90 px-4 py-2 text-sm font-medium text-black hover:bg-white"
          >
            <Download size={14} />
            {t('backup_download')}
          </button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-white/70">
        {t('backup_export_summary')}
      </p>
    </DialogShell>
  );
}

// ─── Import ──────────────────────────────────────────────────────────────────

function ImportDialog(props: { onClose: () => void }) {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<BackupFile | null>(null);
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const onFile = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const backup = parseBackup(text);
      setParsed(backup);
      setSummary(summarizeBackup(backup));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(t('backup_import_invalid', { err: msg }));
      setParsed(null);
      setSummary(null);
    }
  };

  const onConfirm = () => {
    if (!parsed) return;
    applyBackup(parsed);
    // Reload so persist middleware re-hydrates from the new localStorage values.
    window.location.reload();
  };

  return (
    <DialogShell
      title={t('backup_import')}
      onClose={props.onClose}
      footer={
        <>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/10"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!parsed}
            className="flex items-center gap-1.5 rounded-xl bg-white/90 px-4 py-2 text-sm font-medium text-black hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload size={14} />
            {t('backup_import_confirm')}
          </button>
        </>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-8 text-sm transition ${
          dragOver
            ? 'border-white/50 bg-white/10 text-white'
            : 'border-white/15 bg-white/[0.03] text-white/55 hover:border-white/30 hover:text-white/85'
        }`}
      >
        <FileJson size={22} />
        <span>{parsed ? t('backup_pick_file') : t('backup_pick_drag_hint')}</span>
      </button>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-500/15 px-3 py-2 text-xs text-red-200/90">
          <AlertTriangle size={14} className="mt-px shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {parsed && summary && (
        <div className="mt-3 rounded-xl bg-white/5 px-4 py-3">
          <div className="mb-1.5 text-xs font-medium text-white/70">
            {t('backup_import_preview_title')}
          </div>
          <ul className="space-y-0.5 text-xs text-white/85">
            <li>· {t('backup_import_preview_pins', { n: String(summary.pins) })}</li>
            <li>· {t('backup_import_preview_colors', { n: String(summary.customColors) })}</li>
            {summary.hasWallpaper && <li>· {t('backup_import_preview_wallpaper')}</li>}
          </ul>
          <div className="mt-3 text-[11px] text-amber-200/75">
            {t('backup_import_preview_warn')}
          </div>
        </div>
      )}
    </DialogShell>
  );
}

// ─── Repair ──────────────────────────────────────────────────────────────────

function RepairDialog(props: { onClose: () => void }) {
  const t = useT();
  const signedIn = useCloudSync(s => !!s.user);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const restoreFromCloud = async () => {
    setBusy(true);
    setErr(null);
    try {
      const remote: SyncEnvelope | null = await readRemote();
      if (!remote || !hasMeaningfulData(remote)) {
        throw new Error(t('backup_repair_no_cloud'));
      }
      applyRemoteEnvelopeAndMark(remote);
      props.onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doReset = () => {
    resetAllLocal();
    window.location.reload();
  };

  return (
    <DialogShell
      title={t('backup_repair')}
      onClose={props.onClose}
      footer={
        <button
          type="button"
          onClick={props.onClose}
          className="rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/10"
        >
          {t('cancel')}
        </button>
      }
    >
      <div className="space-y-2">
        <RepairOption
          icon={<CloudDownload size={16} />}
          title={t('backup_repair_from_cloud')}
          desc={signedIn ? t('backup_repair_from_cloud_desc') : t('backup_repair_no_cloud')}
          disabled={!signedIn || busy}
          onClick={restoreFromCloud}
        />

        {!confirmReset ? (
          <RepairOption
            icon={<RotateCcw size={16} />}
            title={t('backup_repair_reset')}
            desc={t('backup_repair_reset_desc')}
            onClick={() => setConfirmReset(true)}
            tone="warning"
            disabled={busy}
          />
        ) : (
          <div className="rounded-2xl bg-red-500/10 px-4 py-3 ring-1 ring-red-300/25">
            <div className="mb-2 flex items-start gap-2 text-sm text-red-100/95">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{t('backup_repair_reset_confirm')}</span>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="rounded-xl px-3 py-1.5 text-xs text-white/75 hover:bg-white/10"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={doReset}
                className="rounded-xl bg-red-500/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500"
              >
                {t('backup_repair_reset_yes')}
              </button>
            </div>
          </div>
        )}

        {err && (
          <div className="flex items-start gap-2 rounded-xl bg-red-500/15 px-3 py-2 text-xs text-red-200/90">
            <AlertTriangle size={14} className="mt-px shrink-0" />
            <span>{err}</span>
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function RepairOption(props: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'warning';
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={`flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left transition ${
        props.disabled
          ? 'cursor-not-allowed bg-white/[0.03] opacity-55'
          : props.tone === 'warning'
            ? 'bg-amber-400/10 ring-1 ring-amber-300/20 hover:bg-amber-400/15'
            : 'bg-white/5 hover:bg-white/12'
      }`}
    >
      <div className="mt-0.5 shrink-0 text-white/85">{props.icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-white">{props.title}</div>
        <div className="mt-0.5 text-xs text-white/55">{props.desc}</div>
      </div>
    </button>
  );
}
