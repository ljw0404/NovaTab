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
    if (!isExtensionContext() || !chrome.bookmarks?.getRecent) {
      setLoaded(true);
      return;
    }
    const load = () => {
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
    load();
    // Refresh on permission grant (via custom event from PermissionBanner) or bookmark changes.
    const createdEvent = chrome.bookmarks?.onCreated;
    const removedEvent = chrome.bookmarks?.onRemoved;
    createdEvent?.addListener(load);
    removedEvent?.addListener(load);
    window.addEventListener('permissions-granted', load);
    return () => {
      createdEvent?.removeListener(load);
      removedEvent?.removeListener(load);
      window.removeEventListener('permissions-granted', load);
    };
  }, []);

  if (loaded && items.length === 0) return null;

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-3 px-1 text-xs font-medium uppercase tracking-wider text-white/55">
        {t('bookmarks')}
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
