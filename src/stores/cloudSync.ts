import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ChromeUser } from '@/lib/cloud-sync';

type SyncStatus = 'idle' | 'syncing' | 'error';

type State = {
  user: ChromeUser | null;
  lastSyncedAt: number | null;
  status: SyncStatus;
  error: string | null;
  setUser: (u: ChromeUser | null) => void;
  setLastSyncedAt: (ts: number | null) => void;
  setStatus: (s: SyncStatus) => void;
  setError: (e: string | null) => void;
};

export const useCloudSync = create<State>()(
  persist(
    set => ({
      user: null,
      lastSyncedAt: null,
      status: 'idle',
      error: null,
      setUser: u => set({ user: u }),
      setLastSyncedAt: ts => set({ lastSyncedAt: ts }),
      setStatus: s => set({ status: s }),
      setError: e => set({ error: e }),
    }),
    {
      name: 'glass-start:cloud-sync',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        user: state.user,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }
  )
);
