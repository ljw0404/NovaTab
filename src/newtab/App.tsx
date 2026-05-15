import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { MeshGradientCanvas } from '@/components/MeshGradientCanvas';
import { Wallpaper } from '@/components/Wallpaper';
import { Clock } from '@/components/Clock';
import { SearchBar } from '@/components/SearchBar';
import { SpeedDial } from '@/components/SpeedDial';
import { Bookmarks } from '@/components/Bookmarks';
import { TopSites } from '@/components/TopSites';
import { AiOrganizedBookmarks } from '@/components/AiOrganizedBookmarks';
import { Drawer } from '@/components/Drawer';
import { SettingsDrawer } from '@/components/SettingsDrawer';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { PermissionBanner } from '@/components/PermissionBanner';
import { HubMissingDialog } from '@/components/HubMissingDialog';
import { applyTheme, useSettings } from '@/stores/settings';
import { useCloudSync } from '@/stores/cloudSync';
import { startCloudSync, stopCloudSync } from '@/lib/cloud-sync-engine';
import { initHubEngine } from '@/lib/hub-engine';
import { bootSiteTestEngine } from '@/lib/site-test-engine';

export default function App() {
  const theme = useSettings(s => s.theme);
  const wallpaperUrl = useSettings(s => s.wallpaperUrl);
  const signedIn = useCloudSync(s => !!s.user);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Boot the HubTabPinData engine: find/create the bookmark folder and start
  // listening for changes from anywhere (us, Chrome's bookmark manager, sync).
  useEffect(() => {
    void initHubEngine();
    // Site-test runs in the background and resumes from the persisted store
    // if a test was in progress when the page was previously closed.
    bootSiteTestEngine();
  }, []);

  // Auto-sync: start the cloud sync engine while the user is signed in.
  // The engine pushes local store changes to chrome.storage.sync (debounced)
  // and pulls remote changes from other devices.
  useEffect(() => {
    if (signedIn) startCloudSync();
    else stopCloudSync();
    return () => stopCloudSync();
  }, [signedIn]);

  return (
    <div className="relative min-h-screen text-white">
      {/* When a wallpaper URL is set, show the image (and skip the canvas to
          save GPU). Otherwise the animated mesh gradient is the background. */}
      {wallpaperUrl ? <Wallpaper /> : <MeshGradientCanvas />}

      <PermissionBanner />
      <HubMissingDialog />

      <div className="fixed right-3 top-3 z-30 flex items-center gap-1.5 sm:right-5 sm:top-5 sm:gap-2">
        <LanguageSwitcher />
        <SettingsDrawer />
        <Drawer />
      </div>

      <main className="relative z-10 flex min-h-screen flex-col items-center gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-12 [justify-content:safe_center]">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <Clock />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          className="sticky top-4 z-20 flex w-full justify-center"
        >
          <SearchBar />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          className="flex w-full justify-center"
        >
          <SpeedDial />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          className="flex w-full justify-center"
        >
          <TopSites />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          className="flex w-full justify-center"
        >
          <Bookmarks />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          className="flex w-full justify-center"
        >
          <AiOrganizedBookmarks />
        </motion.div>
      </main>
    </div>
  );
}
