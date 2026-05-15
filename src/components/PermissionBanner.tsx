import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, ShieldAlert, Lock } from 'lucide-react';
import { useT } from '@/i18n';
import {
  checkPermissions,
  requestPermissions,
  type PermStatus,
} from '@/lib/permissions';

export function PermissionBanner() {
  const t = useT();
  const [status, setStatus] = useState<PermStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkPermissions().then(setStatus);
  }, []);

  const onGrant = async () => {
    const ok = await requestPermissions();
    if (ok) {
      setStatus('granted');
      window.dispatchEvent(new CustomEvent('permissions-granted'));
    }
  };

  if (status === null) return null;
  if (status === 'granted' || dismissed) return null;

  const isNoExt = status === 'no-extension';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        className="glass-strong fixed left-1/2 top-5 z-40 flex w-[520px] max-w-[92vw] -translate-x-1/2 items-start gap-3 rounded-2xl p-4"
      >
        <div className="mt-0.5 shrink-0 text-white/80">
          {isNoExt ? <Lock size={18} /> : <ShieldAlert size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-sm font-medium text-white">
            {t('permissions_title')}
          </div>
          <div className="text-xs leading-relaxed text-white/65">
            {isNoExt ? t('permissions_outside_ext') : t('permissions_desc')}
          </div>
        </div>
        <div className="shrink-0">
          {!isNoExt && (
            <button
              type="button"
              onClick={onGrant}
              className="flex items-center gap-1.5 rounded-xl bg-white/90 px-3 py-1.5 text-xs font-medium text-black hover:bg-white"
            >
              <ShieldCheck size={14} />
              {t('permissions_grant')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="ml-2 rounded-xl px-3 py-1.5 text-xs text-white/55 hover:bg-white/10 hover:text-white/85"
          >
            ×
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
