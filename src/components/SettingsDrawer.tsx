import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings as SettingsIcon,
  X,
  Plus,
  Sparkles,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { useT } from '@/i18n';
import { useSettings } from '@/stores/settings';
import { useEscKey } from '@/lib/hooks/useEscKey';
import { CloudSyncSection } from './CloudSyncSection';
import { WallpaperSection } from './WallpaperSection';
import { BackupSection } from './BackupSection';
import { AiSettingsPanel } from './AiSettingsPanel';
import { ToggleRow } from './ui/ToggleRow';
import pkg from '../../package.json' with { type: 'json' };

const DEFAULT_NEW_COLORS = ['#ff6384', '#a78bfa', '#38bdf8'];

type SubPanel = 'main' | 'ai';

export function SettingsDrawer() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<SubPanel>('main');
  const showSeconds = useSettings(s => s.showSeconds);
  const setShowSeconds = useSettings(s => s.setShowSeconds);
  const customColors = useSettings(s => s.customColors);
  const setCustomColors = useSettings(s => s.setCustomColors);

  // ESC pops the sub-panel first; only when on main does it close the drawer.
  useEscKey(open && view === 'ai', () => setView('main'));
  useEscKey(open && view === 'main', () => setOpen(false));

  // When the drawer is closed, always return to the main view next time.
  useEffect(() => {
    if (!open) setView('main');
  }, [open]);

  const updateColor = (idx: number, value: string) =>
    setCustomColors(customColors.map((c, i) => (i === idx ? value : c)));
  const removeColor = (idx: number) =>
    setCustomColors(customColors.filter((_, i) => i !== idx));
  const addColor = () => {
    const next = DEFAULT_NEW_COLORS[customColors.length] ?? '#ffffff';
    setCustomColors([...customColors, next]);
  };
  const resetColors = () => setCustomColors([]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass glass-hover flex h-10 w-10 items-center justify-center rounded-full text-white/85"
        aria-label={t('settings_open')}
      >
        <SettingsIcon size={18} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            />
            <motion.div
              key="panel"
              initial={{ x: '110%' }}
              animate={{ x: 0 }}
              exit={{ x: '110%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="glass-strong fixed right-4 top-4 bottom-4 z-50 flex w-[420px] max-w-[92vw] flex-col overflow-hidden rounded-3xl"
            >
              {/* Header — back arrow + animated title + close */}
              <div className="flex items-center gap-2 p-5 pb-3">
                <AnimatePresence mode="wait" initial={false}>
                  {view === 'ai' ? (
                    <motion.button
                      key="back"
                      type="button"
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => setView('main')}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
                      aria-label={t('back')}
                    >
                      <ChevronLeft size={18} />
                    </motion.button>
                  ) : (
                    <div key="spacer" className="h-8 w-8" />
                  )}
                </AnimatePresence>
                <div className="flex-1 text-center text-base font-medium text-white/90">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={view}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="inline-block"
                    >
                      {view === 'main' ? t('settings') : t('ai_settings')}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body — slides between main and AI sub-panel */}
              <div className="relative flex-1 overflow-hidden">
                <AnimatePresence initial={false}>
                  {view === 'main' && (
                    <motion.div
                      key="main"
                      initial={{ x: '-14%', opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: '-14%', opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                      className="absolute inset-0 space-y-2 overflow-y-auto px-4 pb-5"
                    >
                      <CloudSyncSection />
                      <WallpaperSection />

                      <ToggleRow
                        label={t('show_seconds')}
                        desc={t('show_seconds_desc')}
                        value={showSeconds}
                        onChange={setShowSeconds}
                      />

                      <div className="rounded-2xl bg-white/5 px-4 py-3.5">
                        <div className="mb-0.5 flex items-center justify-between">
                          <div className="text-sm text-white/90">{t('gradient_colors')}</div>
                          {customColors.length > 0 && (
                            <button
                              type="button"
                              onClick={resetColors}
                              className="text-xs text-white/45 hover:text-white/80"
                            >
                              {t('gradient_reset')}
                            </button>
                          )}
                        </div>
                        <div className="mb-3 text-xs text-white/50">
                          {t('gradient_colors_desc')}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {customColors.map((c, i) => (
                            <ColorSwatch
                              key={i}
                              value={c}
                              onChange={v => updateColor(i, v)}
                              onRemove={() => removeColor(i)}
                            />
                          ))}
                          {customColors.length < 3 && (
                            <button
                              type="button"
                              onClick={addColor}
                              title={t('add_color')}
                              className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-white/30 text-white/60 transition hover:border-white/60 hover:bg-white/5 hover:text-white"
                            >
                              <Plus size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      <NavRow
                        icon={<Sparkles size={14} />}
                        label={t('ai_settings')}
                        desc={t('ai_settings_entry_desc')}
                        onClick={() => setView('ai')}
                      />

                      <BackupSection />

                      {/* Brand + version footer — sits at the very bottom
                          of the scroll area. Shows the app name in the user's
                          locale plus the alternate name as a small subtitle. */}
                      <div className="mt-6 flex flex-col items-center gap-1 pt-2 text-white/35">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium tracking-wide text-white/55">
                            {t('app_name')}
                          </span>
                          <span className="text-white/20">·</span>
                          <span className="tabular-nums">v{pkg.version}</span>
                        </div>
                        <div className="px-4 text-center text-[11px] leading-relaxed text-white/30">
                          {t('app_tagline')}
                        </div>
                      </div>
                    </motion.div>
                  )}
                  {view === 'ai' && (
                    <motion.div
                      key="ai"
                      initial={{ x: '14%', opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: '14%', opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                      className="absolute inset-0 overflow-y-auto px-4 pb-5"
                    >
                      <AiSettingsPanel />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function NavRow(props: {
  icon: React.ReactNode;
  label: string;
  desc?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="flex w-full items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 text-left transition hover:bg-white/10"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/85">
        {props.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-white/90">{props.label}</div>
        {props.desc && (
          <div className="mt-0.5 truncate text-xs text-white/50">{props.desc}</div>
        )}
      </div>
      <ChevronRight size={16} className="shrink-0 text-white/40" />
    </button>
  );
}

function ColorSwatch(props: {
  value: string;
  onChange: (v: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="group relative">
      <input
        className="color-swatch h-9 w-9"
        type="color"
        value={props.value}
        onChange={e => props.onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={props.onRemove}
        className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-black/80 text-white ring-1 ring-white/30 group-hover:flex"
        aria-label="Remove color"
      >
        <X size={9} />
      </button>
    </div>
  );
}
