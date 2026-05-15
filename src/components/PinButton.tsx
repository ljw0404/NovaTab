import { Pin, PinOff } from 'lucide-react';
import { useSpeedDial } from '@/stores/speedDial';
import { findPinByUrl } from '@/lib/hub-folder';
import { useT } from '@/i18n';

export function PinButton(props: {
  url: string;
  title: string;
  size?: number;
  className?: string;
}) {
  const t = useT();
  const size = props.size ?? 12;
  // Subscribe to entries so the icon flips immediately when state changes
  // anywhere — including changes that came from Chrome's bookmark manager.
  const pinned = useSpeedDial(s => !!findPinByUrl(s.entries, props.url));
  const togglePin = useSpeedDial(s => s.togglePinByUrl);
  const ready = useSpeedDial(s => s.ready && !!s.hubFolderId);

  return (
    <button
      type="button"
      disabled={!ready}
      onClick={e => {
        e.preventDefault();
        e.stopPropagation();
        // Fire and forget — the hub-engine bookmark listener will refresh
        // entries (and therefore `pinned`) within a debounce window.
        void togglePin(props.url, props.title);
      }}
      title={pinned ? t('unpin_from_home') : t('pin_to_home')}
      className={`flex shrink-0 items-center justify-center rounded-full transition ${
        pinned
          ? 'bg-white/20 text-white'
          : 'text-white/0 group-hover:text-white/65 hover:bg-white/15 hover:text-white'
      } disabled:cursor-not-allowed disabled:opacity-40 ${props.className ?? ''}`}
    >
      {pinned ? <PinOff size={size} /> : <Pin size={size} />}
    </button>
  );
}
