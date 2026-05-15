import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Pin, PinOff, Pencil, Trash2 } from 'lucide-react';
import { useT } from '@/i18n';
import { useSpeedDial } from '@/stores/speedDial';
import { findPinByUrl } from '@/lib/hub-folder';

/**
 * Floating popup menu attached to a bookmark — opened by the "more" button
 * or by right-click on the bookmark row. The caller positions it (anchor)
 * and supplies the bookmark + handlers.
 */
export function BookmarkActionMenu(props: {
  anchor: { x: number; y: number };
  url: string;
  title: string;
  /** When omitted, the "Edit" menu item is hidden (e.g. for history rows). */
  onEdit?: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);

  const pinned = useSpeedDial(s => !!findPinByUrl(s.entries, props.url));
  const togglePin = useSpeedDial(s => s.togglePinByUrl);

  // Close on outside click + Escape.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        props.onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [props]);

  // Clamp inside viewport so right-clicks near edges don't render off-screen.
  const MENU_W = 180;
  const MENU_H = 130;
  const x = Math.min(props.anchor.x, window.innerWidth - MENU_W - 8);
  const y = Math.min(props.anchor.y, window.innerHeight - MENU_H - 8);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      style={{ left: x, top: y, width: MENU_W }}
      className="glass-strong fixed z-[90] overflow-hidden rounded-2xl p-1.5"
    >
      <MenuItem
        icon={pinned ? <PinOff size={13} /> : <Pin size={13} />}
        label={pinned ? t('unpin_from_home') : t('pin_to_home')}
        onClick={() => {
          void togglePin(props.url, props.title);
          props.onClose();
        }}
      />
      {props.onEdit && (
        <MenuItem
          icon={<Pencil size={13} />}
          label={t('bookmark_edit_title')}
          onClick={() => {
            props.onEdit!();
            props.onClose();
          }}
        />
      )}
      <MenuItem
        icon={<Trash2 size={13} />}
        label={t('delete')}
        danger
        onClick={() => {
          props.onDelete();
          props.onClose();
        }}
      />
    </motion.div>
  );
}

function MenuItem(props: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition ${
        props.danger
          ? 'text-red-200/90 hover:bg-red-500/15 hover:text-red-100'
          : 'text-white/85 hover:bg-white/10 hover:text-white'
      }`}
    >
      <span className={props.danger ? 'text-red-200/85' : 'text-white/70'}>
        {props.icon}
      </span>
      {props.label}
    </button>
  );
}
