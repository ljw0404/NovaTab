import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Locale } from '@/i18n/messages';

type Theme = 'light' | 'dark' | 'system';

type SettingsState = {
  theme: Theme;
  searchEngineId: string;
  locale: Locale;
  showSeconds: boolean;
  customColors: string[];
  wallpaperUrl: string;
  wallpaperOverlay: number; // 0..100
  wallpaperBlur: number; // 0..100
  skipDeleteConfirm: boolean;
  setTheme: (t: Theme) => void;
  setSearchEngineId: (id: string) => void;
  setLocale: (l: Locale) => void;
  setShowSeconds: (b: boolean) => void;
  setCustomColors: (colors: string[]) => void;
  setWallpaperUrl: (url: string) => void;
  setWallpaperOverlay: (n: number) => void;
  setWallpaperBlur: (n: number) => void;
  setSkipDeleteConfirm: (b: boolean) => void;
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export const useSettings = create<SettingsState>()(
  persist(
    set => ({
      theme: 'dark',
      searchEngineId: 'google',
      locale: 'zh-CN',
      showSeconds: true,
      customColors: [],
      wallpaperUrl: '',
      wallpaperOverlay: 0,
      wallpaperBlur: 0,
      skipDeleteConfirm: false,
      setTheme: t => set({ theme: t }),
      setSearchEngineId: id => set({ searchEngineId: id }),
      setLocale: l => set({ locale: l }),
      setShowSeconds: b => set({ showSeconds: b }),
      setCustomColors: colors => set({ customColors: colors.slice(0, 3) }),
      setWallpaperUrl: url => set({ wallpaperUrl: url }),
      setWallpaperOverlay: n => set({ wallpaperOverlay: clamp(Math.round(n), 0, 100) }),
      setWallpaperBlur: n => set({ wallpaperBlur: clamp(Math.round(n), 0, 100) }),
      setSkipDeleteConfirm: b => set({ skipDeleteConfirm: b }),
    }),
    {
      name: 'glass-start:settings',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        theme: state.theme,
        searchEngineId: state.searchEngineId,
        locale: state.locale,
        showSeconds: state.showSeconds,
        customColors: state.customColors,
        wallpaperUrl: state.wallpaperUrl,
        wallpaperOverlay: state.wallpaperOverlay,
        wallpaperBlur: state.wallpaperBlur,
        skipDeleteConfirm: state.skipDeleteConfirm,
      }),
    }
  )
);

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', isDark);
}
