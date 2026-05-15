import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { faviconUrl, hostname } from '@/lib/favicon';
import { truncate } from '@/lib/truncate';
import { useT } from '@/i18n';
import { PinButton } from './PinButton';

type Site = { title: string; url: string };

const FALLBACK: Site[] = [
  { title: 'Wikipedia', url: 'https://wikipedia.org' },
  { title: 'Hacker News', url: 'https://news.ycombinator.com' },
  { title: 'Reddit', url: 'https://reddit.com' },
  { title: 'Twitter / X', url: 'https://x.com' },
  { title: 'Stack Overflow', url: 'https://stackoverflow.com' },
  { title: 'Product Hunt', url: 'https://producthunt.com' },
];

export function TopSites() {
  const t = useT();
  const [sites, setSites] = useState<Site[]>(FALLBACK);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.topSites?.get) {
      chrome.topSites.get(s => {
        if (s && s.length) {
          setSites(s.slice(0, 10).map(x => ({ title: x.title, url: x.url })));
        }
      });
    }
  }, []);

  return (
    <div className="w-full max-w-6xl">
      <div className="mb-3 px-1 text-xs font-medium uppercase tracking-wider text-white/55">
        {t('most_visited')}
      </div>
      <div className="flex flex-wrap gap-2">
        {sites.map(s => (
          <motion.a
            key={s.url}
            href={s.url}
            whileHover={{ y: -2, scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            title={s.title || hostname(s.url)}
            className="glass glass-hover group flex items-center gap-2 rounded-full py-1.5 pl-2 pr-1.5"
          >
            <img src={faviconUrl(s.url, 32)} alt="" className="h-4 w-4 rounded" />
            <span className="text-xs text-white/80">
              {truncate(s.title || hostname(s.url), 20)}
            </span>
            <PinButton
              url={s.url}
              title={s.title || hostname(s.url)}
              size={10}
              className="h-5 w-5"
            />
          </motion.a>
        ))}
      </div>
    </div>
  );
}
