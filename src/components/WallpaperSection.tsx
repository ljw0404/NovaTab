import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImagePlus, Image as ImageIcon, Trash2 } from 'lucide-react';
import { useT } from '@/i18n';
import { useSettings } from '@/stores/settings';
import { useEscKey } from '@/lib/hooks/useEscKey';

export function WallpaperSection() {
  const t = useT();
  const url = useSettings(s => s.wallpaperUrl);
  const overlay = useSettings(s => s.wallpaperOverlay);
  const blur = useSettings(s => s.wallpaperBlur);
  const setUrl = useSettings(s => s.setWallpaperUrl);
  const setOverlay = useSettings(s => s.setWallpaperOverlay);
  const setBlur = useSettings(s => s.setWallpaperBlur);

  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="rounded-2xl bg-white/5 px-4 py-3.5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-white/90">{t('wallpaper')}</div>
        {url && (
          <button
            type="button"
            onClick={() => setUrl('')}
            className="flex h-6 w-6 items-center justify-center rounded-full text-white/45 hover:bg-white/10 hover:text-white"
            title={t('remove_wallpaper')}
            aria-label={t('remove_wallpaper')}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      <div className="group relative aspect-video w-full overflow-hidden rounded-xl bg-black/30 ring-1 ring-white/10">
        {url ? (
          <img
            src={url}
            alt=""
            className="h-full w-full object-cover"
            onError={e => {
              (e.target as HTMLImageElement).style.opacity = '0.3';
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/30">
            <ImageIcon size={28} />
          </div>
        )}

        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white/90 backdrop-blur-md transition hover:bg-black/75"
          title={t('change_wallpaper')}
          aria-label={t('change_wallpaper')}
        >
          <ImagePlus size={14} />
        </button>

        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="absolute inset-0 flex items-center justify-center bg-black/0 transition hover:bg-black/30"
        >
          <span className="rounded-full bg-black/60 px-4 py-1.5 text-sm text-white opacity-0 backdrop-blur-md transition group-hover:opacity-100">
            {t('change_wallpaper')}
          </span>
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <SliderRow
          label={t('wallpaper_overlay')}
          value={overlay}
          onChange={setOverlay}
        />
        <SliderRow
          label={t('wallpaper_blur')}
          value={blur}
          onChange={setBlur}
        />
      </div>

      <AnimatePresence>
        {dialogOpen && (
          <WallpaperDialog
            initial={url}
            onClose={() => setDialogOpen(false)}
            onSave={u => {
              setUrl(u);
              setDialogOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SliderRow(props: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <div className="text-xs text-white/75">{props.label}</div>
        <div className="text-xs tabular-nums text-white/50">{props.value}%</div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={props.value}
        onChange={e => props.onChange(Number(e.target.value))}
        className="glass-slider w-full"
        style={{ ['--pct' as string]: `${props.value}%` }}
      />
    </div>
  );
}

function WallpaperDialog(props: {
  initial: string;
  onClose: () => void;
  onSave: (url: string) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState(props.initial);
  const [error, setError] = useState(false);

  useEscKey(true, props.onClose);

  const trimmed = draft.trim();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={props.onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 12 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        onClick={e => e.stopPropagation()}
        className="glass-strong w-[460px] max-w-[92vw] rounded-3xl p-6"
      >
        <h2 className="mb-4 text-lg font-medium text-white">{t('change_wallpaper')}</h2>
        <input
          autoFocus
          value={draft}
          onChange={e => {
            setDraft(e.target.value);
            setError(false);
          }}
          placeholder={t('wallpaper_url_placeholder')}
          className="w-full rounded-xl bg-white/10 px-4 py-2.5 text-white placeholder-white/40 outline-none ring-1 ring-white/15 focus:ring-white/40"
        />
        <div className="mt-2 text-[11px] text-white/45">{t('wallpaper_hint')}</div>

        {trimmed && (
          <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-xl bg-black/30 ring-1 ring-white/10">
            <img
              src={trimmed}
              alt=""
              className="h-full w-full object-cover"
              onLoad={() => setError(false)}
              onError={() => setError(true)}
            />
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-red-200/85">
                {t('wallpaper_invalid_url')}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/10"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={() => props.onSave(trimmed)}
            disabled={!trimmed || error}
            className="rounded-xl bg-white/90 px-4 py-2 text-sm font-medium text-black hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('confirm')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
