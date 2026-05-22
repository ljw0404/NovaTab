import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Cloud, LogIn, LogOut, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useT } from '@/i18n';
import { useCloudSync } from '@/stores/cloudSync';
import { useSettings } from '@/stores/settings';
import { formatRelative } from '@/lib/relative-time';
import {
  envelopesEqual,
  getCurrentUser,
  hasChromeSync,
  hasMeaningfulData,
  isLocalPristine,
  mergeEnvelopes,
  readLocal,
  readRemote,
  requestIdentityPermission,
  writeRemote,
  type SyncEnvelope,
} from '@/lib/cloud-sync';
import {
  applyRemoteEnvelopeAndMark,
  markEnvelopeWritten,
} from '@/lib/cloud-sync-engine';
import { SyncConflictDialog } from './SyncConflictDialog';

export function CloudSyncSection() {
  const t = useT();
  const locale = useSettings(s => s.locale);
  const user = useCloudSync(s => s.user);
  const lastSyncedAt = useCloudSync(s => s.lastSyncedAt);
  const status = useCloudSync(s => s.status);
  const error = useCloudSync(s => s.error);
  const setUser = useCloudSync(s => s.setUser);
  const setLastSyncedAt = useCloudSync(s => s.setLastSyncedAt);
  const setStatus = useCloudSync(s => s.setStatus);
  const setError = useCloudSync(s => s.setError);

  const [conflict, setConflict] = useState<{ local: SyncEnvelope; remote: SyncEnvelope } | null>(null);

  const inExt = hasChromeSync();

  // If persisted user record exists, re-verify on mount that they're still signed into Chrome.
  useEffect(() => {
    if (!inExt || !user) return;
    getCurrentUser().then(u => {
      if (!u || u.email !== user.email) setUser(u);
    });
  }, [inExt, user?.email, setUser, user]);

  const signIn = async () => {
    setStatus('syncing');
    setError(null);
    const granted = await requestIdentityPermission();
    if (!granted) {
      setStatus('error');
      setError(t('sync_permission_denied'));
      return;
    }
    const u = await getCurrentUser();
    if (!u) {
      setStatus('error');
      setError(t('sync_no_chrome_account'));
      return;
    }
    setUser(u);
    setStatus('idle');
    // Run a first-time reconciliation immediately after sign-in.
    await firstSync();
  };

  const signOut = () => {
    setUser(null);
    setLastSyncedAt(null);
    setError(null);
  };

  const firstSync = async () => {
    setStatus('syncing');
    setError(null);
    try {
      const remote = await readRemote();
      // Fresh-install short-circuit: if the local settings store has never
      // been touched on this device, anything readLocal() returns is just
      // defaults. Treat that as "no local data" and pull remote wholesale
      // — otherwise the merge step below would let defaults overwrite the
      // user's real remote settings (and then push the corrupted version
      // back up, permanently destroying them).
      if (isLocalPristine() && remote) {
        applyRemoteEnvelopeAndMark(remote);
        setLastSyncedAt(Date.now());
        setStatus('idle');
        return;
      }
      const local = readLocal();
      const localHas = hasMeaningfulData(local) && !isLocalPristine();
      const remoteHas = hasMeaningfulData(remote);

      if (!localHas && !remoteHas) {
        setLastSyncedAt(Date.now());
        setStatus('idle');
        return;
      }
      if (!localHas && remote) {
        // Only remote has data → pull down.
        applyRemoteEnvelopeAndMark(remote);
        setLastSyncedAt(Date.now());
        setStatus('idle');
        return;
      }
      if (localHas && !remoteHas) {
        // Only local has data → push up.
        await writeRemote(local);
        markEnvelopeWritten(local);
        setLastSyncedAt(Date.now());
        setStatus('idle');
        return;
      }
      // Both have meaningful data — let user pick.
      if (remote && envelopesEqual(local, remote)) {
        setLastSyncedAt(Date.now());
        setStatus('idle');
        return;
      }
      if (remote) {
        setConflict({ local, remote });
        setStatus('idle');
      }
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const syncNow = async () => {
    setStatus('syncing');
    setError(null);
    try {
      const local = readLocal();
      const remote = (await readRemote()) ?? {
        version: 1 as const,
        updatedAt: 0,
        settings: {},
      };
      const merged = mergeEnvelopes(local, remote);
      await writeRemote(merged);
      applyRemoteEnvelopeAndMark(merged);
      setLastSyncedAt(Date.now());
      setStatus('idle');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const resolveConflict = async (choice: 'local' | 'remote' | 'merge') => {
    if (!conflict) return;
    const { local, remote } = conflict;
    setConflict(null);
    setStatus('syncing');
    setError(null);
    try {
      let result: SyncEnvelope;
      if (choice === 'local') {
        result = { ...local, updatedAt: Date.now() };
        await writeRemote(result);
        markEnvelopeWritten(result);
      } else if (choice === 'remote') {
        result = remote;
        applyRemoteEnvelopeAndMark(result);
      } else {
        result = mergeEnvelopes(local, remote);
        await writeRemote(result);
        applyRemoteEnvelopeAndMark(result);
      }
      setLastSyncedAt(Date.now());
      setStatus('idle');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (!inExt) {
    return (
      <div className="rounded-2xl bg-white/5 px-4 py-3.5">
        <div className="mb-0.5 flex items-center gap-1.5 text-sm text-white/90">
          <Cloud size={14} />
          {t('cloud_sync')}
        </div>
        <div className="text-xs text-white/50">{t('sync_only_in_extension')}</div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl bg-white/5 px-4 py-3.5">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm text-white/90">
            <Cloud size={14} />
            {t('cloud_sync')}
          </div>
          {user && (
            <div className="flex items-center gap-1 text-[10px] text-white/45">
              {lastSyncedAt ? (
                <>
                  <CheckCircle2 size={10} className="text-emerald-300/80" />
                  {t('sync_status_synced', { time: formatRelative(lastSyncedAt, locale) })}
                </>
              ) : (
                t('sync_status_never')
              )}
            </div>
          )}
        </div>
        <div className="mb-3 text-xs text-white/50">{t('cloud_sync_desc')}</div>

        {!user ? (
          <button
            type="button"
            onClick={signIn}
            disabled={status === 'syncing'}
            className="flex items-center gap-1.5 rounded-xl bg-white/90 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-white disabled:opacity-50"
          >
            <LogIn size={12} />
            {t('sync_sign_in')}
          </button>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white/85">
                {user.email[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0 flex-1 truncate text-xs text-white/80">
                {user.email}
              </div>
              <button
                type="button"
                onClick={signOut}
                className="text-white/45 hover:text-white/80"
                title={t('sync_sign_out')}
              >
                <LogOut size={12} />
              </button>
            </div>
            <button
              type="button"
              onClick={syncNow}
              disabled={status === 'syncing'}
              className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/25 disabled:opacity-50"
            >
              <RefreshCw
                size={12}
                className={status === 'syncing' ? 'animate-spin' : ''}
              />
              {t('sync_now')}
            </button>
          </>
        )}

        {error && (
          <div className="mt-2 rounded-xl bg-red-500/15 px-3 py-2 text-[11px] text-red-200/85">
            {error}
          </div>
        )}
      </div>

      <AnimatePresence>
        {conflict && (
          <SyncConflictDialog
            local={conflict.local}
            remote={conflict.remote}
            onChoose={resolveConflict}
            onClose={() => setConflict(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
