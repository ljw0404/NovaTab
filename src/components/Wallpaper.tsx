import { useSettings } from '@/stores/settings';

export function Wallpaper() {
  const url = useSettings(s => s.wallpaperUrl);
  const overlay = useSettings(s => s.wallpaperOverlay);
  const blur = useSettings(s => s.wallpaperBlur);

  if (!url) return null;

  // 0-100 → 0-30px CSS blur. Heavy blur fuzzes the edges past the viewport,
  // so we scale the image up proportionally to keep the screen covered.
  const blurPx = (blur / 100) * 30;
  const scale = 1 + (blur / 100) * 0.18;

  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat will-change-transform"
        style={{
          backgroundImage: `url("${url.replace(/"/g, '\\"')}")`,
          filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transition: 'filter 220ms ease-out, transform 220ms ease-out',
        }}
      />
      {overlay > 0 && (
        <div
          className="absolute inset-0 transition-colors duration-200"
          style={{ background: `rgba(0, 0, 0, ${overlay / 100})` }}
        />
      )}
    </div>
  );
}
