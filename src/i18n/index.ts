import { useSettings } from '@/stores/settings';
import { MESSAGES, format, type MessageKey } from './messages';

export function useT() {
  const locale = useSettings(s => s.locale);
  const table = MESSAGES[locale];
  return (key: MessageKey, vars?: Record<string, string>) => {
    const raw = table[key];
    if (typeof raw !== 'string') return key;
    return format(raw, vars);
  };
}

export function localeForDate(locale: string): string {
  return locale === 'zh-CN' ? 'zh-CN' : 'en-US';
}
