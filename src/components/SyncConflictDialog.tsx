import { motion } from 'framer-motion';
import { Laptop, Cloud, GitMerge } from 'lucide-react';
import { useT } from '@/i18n';
import { useEscKey } from '@/lib/hooks/useEscKey';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import type { SyncEnvelope } from '@/lib/cloud-sync';

export function SyncConflictDialog(props: {
  local: SyncEnvelope;
  remote: SyncEnvelope;
  onChoose: (choice: 'local' | 'remote' | 'merge') => void;
  onClose: () => void;
}) {
  const t = useT();
  useEscKey(true, props.onClose);
  useBodyScrollLock();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 backdrop-blur-sm"
      onClick={props.onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 12 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        onClick={e => e.stopPropagation()}
        className="glass-strong w-[520px] max-w-[92vw] rounded-3xl p-6"
      >
        <h2 className="mb-1 text-lg font-medium text-white">
          {t('sync_conflict_title')}
        </h2>
        <p className="mb-5 text-sm text-white/65">{t('sync_conflict_desc')}</p>

        <div className="space-y-2">
          <Option
            icon={<Laptop size={16} />}
            label={t('sync_use_local')}
            desc={t('sync_local_summary', {
              colors: String(props.local.settings.customColors?.length ?? 0),
            })}
            onClick={() => props.onChoose('local')}
          />
          <Option
            icon={<Cloud size={16} />}
            label={t('sync_use_remote')}
            desc={t('sync_remote_summary', {
              colors: String(props.remote.settings.customColors?.length ?? 0),
            })}
            onClick={() => props.onChoose('remote')}
          />
          <Option
            icon={<GitMerge size={16} />}
            label={t('sync_merge')}
            desc={t('sync_merge_desc')}
            onClick={() => props.onChoose('merge')}
            highlight
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

function Option(props: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left transition ${
        props.highlight
          ? 'bg-white/15 ring-1 ring-white/30 hover:bg-white/25'
          : 'bg-white/5 hover:bg-white/15'
      }`}
    >
      <div className="mt-0.5 text-white/85">{props.icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-white">{props.label}</div>
        <div className="mt-0.5 text-xs text-white/55">{props.desc}</div>
      </div>
    </button>
  );
}
