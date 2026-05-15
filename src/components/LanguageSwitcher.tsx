import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Languages } from 'lucide-react';
import { LOCALES, type Locale } from '@/i18n/messages';
import { useSettings } from '@/stores/settings';
import { useEscKey } from '@/lib/hooks/useEscKey';

export function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const locale = useSettings(s => s.locale);
  const setLocale = useSettings(s => s.setLocale);

  useEscKey(open, () => setOpen(false));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="glass glass-hover flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm text-white/85"
        aria-label="Switch language"
      >
        <Languages size={16} />
        <span className="text-xs font-medium">
          {LOCALES.find(l => l.id === locale)?.label}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="glass-strong absolute right-0 top-full z-40 mt-2 w-36 overflow-hidden rounded-2xl p-1.5"
            >
              {LOCALES.map(l => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    setLocale(l.id as Locale);
                    setOpen(false);
                  }}
                  className={`block w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                    l.id === locale
                      ? 'bg-white/20 text-white'
                      : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
