import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { faviconUrl, hostname } from '@/lib/favicon';
import { truncate } from '@/lib/truncate';
import { useT } from '@/i18n';
import { isExtensionContext } from '@/lib/permissions';
import { PinButton } from './PinButton';

type Bookmark = { title: string; url: string; dateAdded: number };

export function Bookmarks() {
  const t = useT();
  const [items, setItems] = useState<Bookmark[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isExtensionContext()) {
      setLoaded(true);
      return;
    }

    // chrome.bookmarks lazily appears once the user grants the optional
    // `bookmarks` permission. The bookmark-change events also only exist
    // after that. We register them on the first successful load() rather
    // than at mount, so the first-install flow (permission still missing)
    // doesn't skip registration.
    let bookmarkEventsBound = false;
    const bindBookmarkEvents = () => {
      if (bookmarkEventsBound) return;
      if (!chrome.bookmarks?.onCreated || !chrome.bookmarks?.onRemoved) return;
      chrome.bookmarks.onCreated.addListener(load);
      chrome.bookmarks.onRemoved.addListener(load);
      bookmarkEventsBound = true;
    };

    const load = () => {
      if (!chrome.bookmarks?.getRecent) {
        // Permission still not granted — flip `loaded` so the parent
        // collapses this section (the render branch hides on
        // `loaded && items.length === 0`); we'll repopulate via the
        // permissions-granted listener bound below.
        setLoaded(true);
        return;
      }
      bindBookmarkEvents();
      chrome.bookmarks.getRecent(20, nodes => {
        const list = nodes
          .filter(n => n.url)
          .map(n => ({
            title: n.title || hostname(n.url!),
            url: n.url!,
            dateAdded: n.dateAdded ?? 0,
          }))
          .sort((a, b) => b.dateAdded - a.dateAdded);
        setItems(list);
        setLoaded(true);
      });
    };

    // CRITICAL: register permissions-granted BEFORE we early-out on missing
    // chrome.bookmarks. The previous version bailed at the top of this effect
    // when chrome.bookmarks was undefined (= first-install flow before the
    // user clicked 授权), which meant this listener was never bound — and so
    // "最近收藏" required a manual refresh after granting.
    window.addEventListener('permissions-granted', load);

    load();

    return () => {
      window.removeEventListener('permissions-granted', load);
      if (bookmarkEventsBound) {
        chrome.bookmarks?.onCreated?.removeListener(load);
        chrome.bookmarks?.onRemoved?.removeListener(load);
      }
    };
  }, []);

  if (loaded && items.length === 0) return null;

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-3 px-1 text-xs font-medium uppercase tracking-wider text-white/55">
        {t('recent_bookmarks')}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map(b => (
          <motion.a
            key={b.url}
            href={b.url}
            whileHover={{ y: -2, scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            title={b.title}
            className="glass glass-hover group flex items-center gap-2 rounded-full py-1.5 pl-2 pr-1.5"
          >
            <img src={faviconUrl(b.url, 32)} alt="" className="h-4 w-4 rounded" />
            <span className="text-xs text-white/80">
              {truncate(b.title || hostname(b.url), 20)}
            </span>
            <PinButton url={b.url} title={b.title} size={10} className="h-5 w-5" />
          </motion.a>
        ))}
      </div>
    </div>
  );
}
