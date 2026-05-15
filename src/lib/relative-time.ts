import type { Locale } from '@/i18n/messages';

export function formatRelative(ts: number | undefined, locale: Locale): string {
  if (!ts) return '';
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
  const bcp47 = locale === 'zh-CN' ? 'zh-CN' : 'en-US';
  const rtf = new Intl.RelativeTimeFormat(bcp47, { numeric: 'auto' });

  if (diffSec < 60) return rtf.format(-diffSec, 'second');
  if (diffSec < 3600) return rtf.format(-Math.floor(diffSec / 60), 'minute');
  if (diffSec < 86400) return rtf.format(-Math.floor(diffSec / 3600), 'hour');
  if (diffSec < 86400 * 30) return rtf.format(-Math.floor(diffSec / 86400), 'day');

  // Older than ~30 days — show an absolute short date.
  return new Date(ts).toLocaleDateString(bcp47, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
