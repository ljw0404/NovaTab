import { lazy, Suspense, useEffect } from 'react';
import { MeshGradientCanvas } from '@/components/MeshGradientCanvas';
import { Wallpaper } from '@/components/Wallpaper';
import { Clock } from '@/components/Clock';
import { SearchBar } from '@/components/SearchBar';
import { SpeedDial } from '@/components/SpeedDial';
import { Bookmarks } from '@/components/Bookmarks';
import { TopSites } from '@/components/TopSites';
import { AiOrganizedBookmarks } from '@/components/AiOrganizedBookmarks';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { applyTheme, useSettings } from '@/stores/settings';
import { useCloudSync } from '@/stores/cloudSync';
import { startCloudSync, stopCloudSync } from '@/lib/cloud-sync-engine';
import { readRememberedUser } from '@/lib/cloud-sync';
import { initHubEngine } from '@/lib/hub-engine';
import { bootSiteTestEngine } from '@/lib/site-test-engine';
import { bootAiClassifyEngine } from '@/lib/ai-classify-engine';

// Lazy-load components that are NOT visible on first paint. Each becomes
// its own JS chunk that the browser fetches in parallel after the main
// bundle, cutting the initial parse-and-compile cost of the new-tab page.
//
//  - Drawer: only opens when the toolbar button is clicked
//  - SettingsDrawer: same
//  - PermissionBanner: only rendered when an optional permission is missing
//  - HubMissingDialog: only rendered when the HubTabPinData folder
//    disappeared and we have a local mirror to offer a restore
//
// These chunks together strip ~80-100KB (gzipped) off the critical bundle.
const Drawer = lazy(() =>
  import('@/components/Drawer').then(m => ({ default: m.Drawer }))
);
const SettingsDrawer = lazy(() =>
  import('@/components/SettingsDrawer').then(m => ({ default: m.SettingsDrawer }))
);
const PermissionBanner = lazy(() =>
  import('@/components/PermissionBanner').then(m => ({ default: m.PermissionBanner }))
);
const HubMissingDialog = lazy(() =>
  import('@/components/HubMissingDialog').then(m => ({ default: m.HubMissingDialog }))
);

// Use requestIdleCallback when available so non-critical engine boot doesn't
// fight the first paint. Safari / older browsers fall back to setTimeout.
const idle = (cb: () => void): (() => void) => {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(cb, { timeout: 1000 });
    return () => cancelIdleCallback(id);
  }
  const id = window.setTimeout(cb, 1);
  return () => window.clearTimeout(id);
};

export default function App() {
  const theme = useSettings(s => s.theme);
  const wallpaperUrl = useSettings(s => s.wallpaperUrl);
  const signedIn = useCloudSync(s => !!s.user);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Boot the HubTabPinData engine immediately (it drives the visible
  // SpeedDial — deferring it would make the skeleton flash for hundreds of
  // extra ms). The other two engines have no first-paint visual impact, so
  // they ride requestIdleCallback to keep chrome.* callbacks from
  // competing with the initial frame.
  useEffect(() => {
    const bootHub = () => {
      // Hub engine bails early if chrome.bookmarks isn't available yet —
      // calling it again after permissions are granted will populate Pins
      // without requiring a page refresh.
      void initHubEngine();
    };
    const bootIdleEngines = () => {
      // Site-test runs in the background and resumes from the persisted store
      // if a test was in progress when the page was previously closed.
      bootSiteTestEngine();
      // AI classify can't *resume* (the streaming fetch dies with the page),
      // but the engine boot marks any orphaned `inProgress` as interrupted so
      // the dialog can offer a clean retry/discard path.
      bootAiClassifyEngine();
    };
    const bootAll = () => {
      bootHub();
      bootIdleEngines();
    };

    bootHub();
    const cancelIdle = idle(bootIdleEngines);

    // First-install flow: at this point the optional `bookmarks` permission
    // hasn't been granted yet, so chrome.bookmarks is `undefined` and the
    // hub engine populated `entries: []`. When the user clicks "授权" in
    // PermissionBanner (or toggles it on from chrome://extensions), re-run
    // boot so Pins + "我的收藏" data load immediately instead of after a
    // manual refresh.
    //
    // Listen on both channels:
    //  - the custom event we dispatch from PermissionBanner.onGrant
    //    (covers our in-page button flow),
    //  - chrome.permissions.onAdded (covers grants made outside our UI,
    //    e.g. the user enables the permission from the extensions page).
    // All boot functions are idempotent, so double-firing is harmless.
    window.addEventListener('permissions-granted', bootAll);
    // @types/chrome@0.0.281 is missing `removeListener` on PermissionsAddedEvent;
    // the runtime does have it (chrome.events.Event<T>), so cast through the
    // structural shape we need rather than dragging in a types upgrade.
    type PermEvt = {
      addListener: (cb: () => void) => void;
      removeListener: (cb: () => void) => void;
    };
    const permEvt = chrome.permissions?.onAdded as unknown as PermEvt | undefined;
    permEvt?.addListener(bootAll);
    return () => {
      cancelIdle();
      window.removeEventListener('permissions-granted', bootAll);
      permEvt?.removeListener(bootAll);
    };
  }, []);

  // After a reinstall, useCloudSync.user is empty (localStorage was wiped
  // with the old install). But the previous sign-in wrote the user info to
  // chrome.storage.sync, which IS tied to the Google account — so we can
  // pull it back here. As soon as setUser fires, the effect below picks it
  // up and starts the engine, which then reconciles AI classification +
  // settings down from the cloud.
  useEffect(() => {
    if (signedIn) return;
    let cancelled = false;
    readRememberedUser().then(u => {
      if (cancelled || !u) return;
      // Only restore if still nothing locally — avoids stomping a fresh
      // explicit sign-out that the user just performed.
      if (!useCloudSync.getState().user) {
        useCloudSync.getState().setUser(u);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

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

      {/* Lazy-loaded surfaces: each is hidden by default so the empty
          Suspense fallback is invisible to the user. */}
      <Suspense fallback={null}>
        <PermissionBanner />
        <HubMissingDialog />
      </Suspense>

      <div className="fixed right-3 top-3 z-30 flex items-center gap-1.5 sm:right-5 sm:top-5 sm:gap-2">
        <LanguageSwitcher />
        <Suspense fallback={<div className="h-9 w-9" />}>
          <SettingsDrawer />
          <Drawer />
        </Suspense>
      </div>

      {/* Single coordinated CSS fade-in instead of six per-section
          framer-motion entrances. Killed the staggered delays (0.05s →
          0.45s) that made the page feel "still loading" for half a second
          and the per-section `y: 12` translates that were thrashing layout
          on each frame. The mesh-gradient or wallpaper underneath is its
          own visual layer, so a uniform 250ms opacity fade reads as a
          smooth single-shot entrance. */}
      <main
        className="app-fade-in relative z-10 flex min-h-screen flex-col items-center gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-12 [justify-content:safe_center]"
      >
        <Clock />
        <div className="sticky top-4 z-20 flex w-full justify-center">
          <SearchBar />
        </div>
        <div className="flex w-full justify-center">
          <SpeedDial />
        </div>
        <div className="flex w-full justify-center">
          <TopSites />
        </div>
        <div className="flex w-full justify-center">
          <Bookmarks />
        </div>
        {/* Below the fold for most viewports — `content-visibility: auto`
            lets Chrome skip layout/paint for this subtree until it's near
            the viewport. */}
        <div
          className="flex w-full justify-center"
          style={{ contentVisibility: 'auto', containIntrinsicSize: '600px 400px' } as React.CSSProperties}
        >
          <AiOrganizedBookmarks />
        </div>
      </main>
    </div>
  );
}
