import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Pencil, Folder, FolderPlus, LinkIcon } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
} from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { faviconUrl } from '@/lib/favicon';
import { useT } from '@/i18n';
import { useEscKey } from '@/lib/hooks/useEscKey';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
import { useSettings } from '@/stores/settings';
import { useSpeedDial } from '@/stores/speedDial';
import type {
  SpeedDialEntry,
  SpeedDialFolder,
  SpeedDialPin,
} from '@/lib/hub-folder';
import { PinDialog } from './PinDialog';
import { FolderDialog } from './FolderDialog';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

type Dialog =
  | { kind: 'closed' }
  | { kind: 'add-pin'; folderId: string | null }
  | { kind: 'edit-pin'; pin: SpeedDialPin }
  | { kind: 'add-folder' }
  | { kind: 'edit-folder'; folder: SpeedDialFolder }
  | { kind: 'open-folder'; folderId: string }
  | { kind: 'confirm-delete'; entry: SpeedDialEntry };

/**
 * Eat the next `click` event the browser synthesizes from a pointerup.
 *
 * Called at the start of every dnd-kit `onDragEnd` callback (both the
 * top-level grid and the folder-view grid). Adds a capture-phase listener
 * on `document` that preventDefault + stopPropagation + removes itself
 * on the very next click. A 200 ms failsafe removes the listener if no
 * click materializes (e.g. the drag ended with a touch sequence that
 * doesn't synthesize a click).
 *
 * Why this exists alongside the per-card `useDragClickGuard`: the per-card
 * guard relies on React state + a useLayoutEffect mirror of dnd-kit's
 * `isDragging`. There's a rare edge case where the second drag in a row
 * commits its state changes in a different ordering than the first, and
 * `sawDrag` ends up false at click time, letting the anchor's default
 * navigation through. This document-level interceptor is independent of
 * per-card React state — it sees the click before any component handler
 * does, regardless of which card was dragged.
 */
function swallowNextClick() {
  const handler = (e: MouseEvent) => {
    // detail === 0 → synthetic activate (e.g. keyboard); never suppress.
    if (e.detail === 0) return;
    e.preventDefault();
    e.stopPropagation();
    document.removeEventListener('click', handler, true);
  };
  document.addEventListener('click', handler, true);
  // Failsafe: if no click ever fires (touch device, drag cancel, etc.)
  // detach the listener so it doesn't intercept a future unrelated click.
  setTimeout(() => {
    document.removeEventListener('click', handler, true);
  }, 200);
}

// Build the inline style for a sortable item from dnd-kit's transform.
// We do this manually (instead of using @dnd-kit/utilities) to avoid pulling
// in another package — and to keep z-index/cursor in the same blob.
function sortableStyle(
  transform: { x: number; y: number; scaleX: number; scaleY: number } | null,
  transition: string | undefined,
  isDragging: boolean
): React.CSSProperties {
  return {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`
      : undefined,
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.7 : undefined,
    touchAction: 'manipulation',
  };
}

export function SpeedDial() {
  const t = useT();
  const entries = useSpeedDial(s => s.entries);
  const ready = useSpeedDial(s => s.ready);
  const removeEntry = useSpeedDial(s => s.removeEntry);
  const reorderEntry = useSpeedDial(s => s.reorderEntry);
  const skipDeleteConfirm = useSettings(s => s.skipDeleteConfirm);
  const setSkipDeleteConfirm = useSettings(s => s.setSkipDeleteConfirm);

  const [dialog, setDialog] = useState<Dialog>({ kind: 'closed' });
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  // Track which entry IDs we've already rendered so we can distinguish
  // "card mounted as part of initial bulk render" from "user just added
  // this one". Only the latter gets the pin-pop-in CSS animation —
  // running 30+ pop-ins in parallel was what we just removed.
  //
  // The seenIds set is seeded with whatever's in `entries` the FIRST time
  // `ready` flips true, so the initial batch is treated as "already seen"
  // and silent. From then on, any ID in `entries` that's not in the set is
  // a fresh addition.
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!ready) return;
    if (!initializedRef.current) {
      seenIdsRef.current = new Set(entries.map(e => e.id));
      initializedRef.current = true;
      return;
    }
    // Subsequent updates: add any new IDs and prune removed ones (prevents
    // the set from growing unboundedly across many add/delete cycles).
    const next = new Set(entries.map(e => e.id));
    next.forEach(id => seenIdsRef.current.add(id));
    seenIdsRef.current.forEach(id => {
      if (!next.has(id)) seenIdsRef.current.delete(id);
    });
  }, [entries, ready]);

  const isNewEntry = (id: string) =>
    initializedRef.current && !seenIdsRef.current.has(id);

  // Pointer must move 8px before dnd-kit treats it as a drag — keeps the
  // anchor's click-to-navigate working for normal clicks.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    // Belt-and-suspenders: eat the synthetic click the browser is about
    // to fire from this pointerup, before it can reach the anchor inside
    // the dragged card. Called UNCONDITIONALLY (even when the drop is a
    // no-op like dropping on the same slot) — any time a drag ends with
    // a pointerup over a card, the navigation must be suppressed.
    swallowNextClick();

    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = entries.findIndex(e => e.id === active.id);
    const newIndex = entries.findIndex(e => e.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    // Optimistically reorder locally — dnd-kit's drop animation snaps the
    // dragged card to its sortable slot on release, and if `entries` still
    // shows the old order at that moment the card "flies back" to the
    // original position before chrome.bookmarks.move finishes. By updating
    // entries synchronously here, the slot is already in the right place.
    useSpeedDial.setState({ entries: arrayMove(entries, oldIndex, newIndex) });

    await reorderEntry(String(active.id), newIndex);
  };

  const requestDelete = (entry: SpeedDialEntry) => {
    if (skipDeleteConfirm) {
      void removeEntry(entry.id);
    } else {
      setDialog({ kind: 'confirm-delete', entry });
    }
  };

  const openFolder =
    dialog.kind === 'open-folder'
      ? (entries.find(e => e.id === dialog.folderId && e.kind === 'folder') as
        | SpeedDialFolder
        | undefined)
      : undefined;

  return (
    <div className="w-full max-w-6xl">
      {!ready ? (
        // Skeleton phase — the hub engine hasn't returned data yet (could be
        // the chrome.bookmarks call or, on first install, the user hasn't
        // granted the `bookmarks` permission yet). Show shimmering
        // placeholders sized like the real tiles. We deliberately hide the
        // "+" tile during this state so the user doesn't get a half-empty
        // grid that suggests "you have zero pins" — once data lands the
        // real grid (with "+") replaces this.
        <SkeletonGrid />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={entries.map(e => e.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-7">
              {entries.map(entry => (
                <SortableEntry
                  key={entry.id}
                  entry={entry}
                  isNew={isNewEntry(entry.id)}
                  onEditPin={pin => setDialog({ kind: 'edit-pin', pin })}
                  onEditFolder={folder =>
                    setDialog({ kind: 'edit-folder', folder })
                  }
                  onOpenFolder={folder =>
                    setDialog({ kind: 'open-folder', folderId: folder.id })
                  }
                  onRequestDelete={requestDelete}
                />
              ))}
              {/* "+" tile is intentionally outside SortableContext — it isn't
                  draggable and stays at the end of the grid. */}
              <AddTile
                ready={ready}
                menuOpen={addMenuOpen}
                setMenuOpen={setAddMenuOpen}
                onAddPin={() =>
                  setDialog({ kind: 'add-pin', folderId: null })
                }
                onAddFolder={() => setDialog({ kind: 'add-folder' })}
              />
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AnimatePresence>
        {dialog.kind === 'add-pin' && (
          <PinDialog
            initialFolderId={dialog.folderId}
            onClose={() => setDialog({ kind: 'closed' })}
          />
        )}
        {dialog.kind === 'edit-pin' && (
          <PinDialog
            editing={{
              id: dialog.pin.id,
              title: dialog.pin.title,
              url: dialog.pin.url,
            }}
            onClose={() => setDialog({ kind: 'closed' })}
          />
        )}
        {dialog.kind === 'add-folder' && (
          <FolderDialog
            mode="create"
            onClose={() => setDialog({ kind: 'closed' })}
          />
        )}
        {dialog.kind === 'edit-folder' && (
          <FolderDialog
            mode={{
              kind: 'edit',
              id: dialog.folder.id,
              title: dialog.folder.title,
            }}
            onClose={() => setDialog({ kind: 'closed' })}
          />
        )}
        {dialog.kind === 'open-folder' && openFolder && (
          <FolderView
            folder={openFolder}
            onClose={() => setDialog({ kind: 'closed' })}
            onAddPin={() =>
              setDialog({ kind: 'add-pin', folderId: openFolder.id })
            }
            onEditPin={pin => setDialog({ kind: 'edit-pin', pin })}
            onRemovePin={pin => requestDelete(pin)}
            onRenameFolder={() =>
              setDialog({ kind: 'edit-folder', folder: openFolder })
            }
            onRemoveFolder={() => requestDelete(openFolder)}
          />
        )}
        {dialog.kind === 'confirm-delete' && (
          <ConfirmDeleteDialog
            title={
              dialog.entry.kind === 'folder'
                ? t('pin_add_folder')
                : t('edit_pin_title')
            }
            warning={t('delete_warn_bookmark')}
            itemTitle={dialog.entry.title}
            itemUrl={dialog.entry.kind === 'pin' ? dialog.entry.url : undefined}
            onConfirm={remember => {
              if (remember) setSkipDeleteConfirm(true);
              void removeEntry(dialog.entry.id);
              setDialog({ kind: 'closed' });
            }}
            onClose={() => setDialog({ kind: 'closed' })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Skeleton grid ───────────────────────────────────────────────────────────
//
// 21 placeholder tiles (7 cols × 3 rows on desktop; the grid folds at the
// `sm:grid-cols-5` and `grid-cols-3` breakpoints, so on smaller screens
// the count fills more rows — that's fine, the skeleton just looks like a
// longer "still-loading" patch). Each tile has a staggered animation-delay
// driven by its column position so the shimmer reads as a single wave
// rolling left-to-right rather than every tile pulsing in sync.

const SKELETON_COUNT = 21;

function SkeletonGrid() {
  return (
    <div
      className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-7"
      aria-hidden="true"
    >
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <div
          key={i}
          className="skeleton-tile aspect-square w-full rounded-2xl"
          // The shimmer animation lives on `.skeleton-tile::before`, so
          // inline `animationDelay` wouldn't reach it. Set a CSS custom
          // property instead — it cascades into the pseudo-element and
          // is consumed by `animation-delay: var(--shimmer-delay)` in
          // globals.css. `i % 7` keeps the wave coherent across breakpoints.
          style={{ '--shimmer-delay': `${(i % 7) * 80}ms` } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// ─── Sortable wrapper ────────────────────────────────────────────────────────

function SortableEntry(props: {
  entry: SpeedDialEntry;
  isNew?: boolean;
  onEditPin: (pin: SpeedDialPin) => void;
  onEditFolder: (folder: SpeedDialFolder) => void;
  onOpenFolder: (folder: SpeedDialFolder) => void;
  onRequestDelete: (entry: SpeedDialEntry) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.entry.id });
  const style = sortableStyle(transform, transition, isDragging);

  if (props.entry.kind === 'pin') {
    return (
      <PinCard
        pin={props.entry}
        sortableRef={setNodeRef}
        sortableStyle={style}
        sortableAttrs={attributes}
        sortableListeners={listeners}
        isDragging={isDragging}
        isNew={props.isNew}
        onEdit={() => props.onEditPin(props.entry as SpeedDialPin)}
        onRemove={() => props.onRequestDelete(props.entry)}
      />
    );
  }
  return (
    <FolderCard
      folder={props.entry}
      sortableRef={setNodeRef}
      sortableStyle={style}
      sortableAttrs={attributes}
      sortableListeners={listeners}
      isDragging={isDragging}
      isNew={props.isNew}
      onOpen={() => props.onOpenFolder(props.entry as SpeedDialFolder)}
      onEdit={() => props.onEditFolder(props.entry as SpeedDialFolder)}
      onRemove={() => props.onRequestDelete(props.entry)}
    />
  );
}

// ─── Add tile ────────────────────────────────────────────────────────────────

function AddTile(props: {
  ready: boolean;
  menuOpen: boolean;
  setMenuOpen: (b: boolean) => void;
  onAddPin: () => void;
  onAddFolder: () => void;
}) {
  return (
    <div className="relative">
      <motion.button
        type="button"
        onClick={() => props.setMenuOpen(!props.menuOpen)}
        disabled={!props.ready}
        whileHover={props.ready ? { y: -3, scale: 1.04 } : undefined}
        whileTap={props.ready ? { scale: 0.96 } : undefined}
        className="glass glass-hover flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl p-3 text-white/55 hover:text-white/85 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus size={32} strokeWidth={1.5} />
      </motion.button>

      <AnimatePresence>
        {props.menuOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => props.setMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="glass-strong absolute left-1/2 top-full z-40 mt-2 w-44 -translate-x-1/2 overflow-hidden rounded-2xl p-1.5"
            >
              <AddMenuItem
                icon={<LinkIcon size={14} />}
                labelKey="pin_add_site"
                onClick={() => {
                  props.setMenuOpen(false);
                  props.onAddPin();
                }}
              />
              <AddMenuItem
                icon={<FolderPlus size={14} />}
                labelKey="pin_add_folder"
                onClick={() => {
                  props.setMenuOpen(false);
                  props.onAddFolder();
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function AddMenuItem(props: {
  icon: React.ReactNode;
  labelKey: 'pin_add_site' | 'pin_add_folder';
  onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-white/85 transition hover:bg-white/10"
    >
      <span className="text-white/75">{props.icon}</span>
      {t(props.labelKey)}
    </button>
  );
}

// ─── Pin card ────────────────────────────────────────────────────────────────

type SortableProps = {
  sortableRef?: (node: HTMLElement | null) => void;
  sortableStyle?: React.CSSProperties;
  sortableAttrs?: DraggableAttributes;
  sortableListeners?: SyntheticListenerMap;
  isDragging?: boolean;
};

// Suppress the click the browser fires on the wrapper after a dnd-kit drag —
// without this, releasing a dragged pin navigates into the site. Two signals
// combine to detect a drag-release vs. a real click:
//
//   1. `sawDrag` — mirrors dnd-kit's `isDragging` into a ref via
//      useLayoutEffect (synchronous after commit) so the click event that
//      fires immediately after pointerup sees the latest value.
//   2. `downPos` — distance between pointerdown and the eventual click. If
//      the pointer moved ≥ 8px (PointerSensor's activation distance), the
//      "click" is really a drag release. This catches fast drags where
//      dnd-kit's isDragging state didn't have a chance to flip true before
//      pointerup — which is what caused the second-drag-navigates bug, since
//      after the first drag's optimistic reorder re-renders, the second
//      drag's state transitions can lag behind the pointer events.
//
// Capture-phase handlers run before the inner anchor/button receives the
// click, so we can preventDefault (anchor nav) and stopPropagation (button
// onClick) before they take effect.
function useDragClickGuard(isDragging?: boolean) {
  const sawDrag = useRef(false);
  const downPos = useRef<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (isDragging) sawDrag.current = true;
  }, [isDragging]);
  return {
    onPointerDownCapture: (e: React.PointerEvent) => {
      sawDrag.current = false;
      downPos.current = { x: e.clientX, y: e.clientY };
    },
    onClickCapture: (e: React.MouseEvent) => {
      // detail===0 means keyboard-triggered (Enter) — never suppress those.
      if (e.detail === 0) return;
      const d = downPos.current;
      const movedFar =
        !!d &&
        (e.clientX - d.x) * (e.clientX - d.x) +
          (e.clientY - d.y) * (e.clientY - d.y) >=
          8 * 8;
      if (sawDrag.current || movedFar) {
        e.preventDefault();
        e.stopPropagation();
      }
      sawDrag.current = false;
      downPos.current = null;
    },
  };
}

function PinCard(
  props: {
    pin: SpeedDialPin;
    isNew?: boolean;
    onEdit: () => void;
    onRemove: () => void;
  } & SortableProps
) {
  const guard = useDragClickGuard(props.isDragging);
  // No outer motion.div for entrance/exit (batch-mounting many JS springs
  // blocked the main thread). When this card is a fresh user-added pin
  // (not the initial bulk load), the parent passes isNew=true and we
  // wrap in a div carrying the `pin-pop-in` CSS keyframe — single-card,
  // GPU-only, zero JS overhead. The keyframe targets the wrapper so it
  // doesn't fight motion.a's whileHover/whileTap transforms inside.
  const popClass = props.isNew ? 'pin-pop-in' : undefined;
  return (
    <div
      ref={props.sortableRef}
      style={props.sortableStyle}
      {...(props.sortableAttrs ?? {})}
      {...(props.sortableListeners ?? {})}
      onPointerDownCapture={guard.onPointerDownCapture}
      onClickCapture={guard.onClickCapture}
      className={popClass}
    >
      <motion.a
        href={props.pin.url}
        whileHover={{ y: -3, scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className="glass glass-hover group relative flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl p-3"
      >
        <div className="absolute right-1.5 top-1.5 hidden gap-1 group-hover:flex">
          <IconBtn
            icon={<Pencil size={11} />}
            onClick={props.onEdit}
            label="Edit"
          />
          <IconBtn
            icon={<X size={12} />}
            onClick={props.onRemove}
            label="Remove"
          />
        </div>
        <img
          src={faviconUrl(props.pin.url)}
          alt=""
          className="h-9 w-9 rounded-lg sm:h-10 sm:w-10"
          onError={e => {
            (e.target as HTMLImageElement).style.opacity = '0.3';
          }}
          draggable={false}
        />
        <div className="line-clamp-1 max-w-full text-center text-xs text-white/85">
          {props.pin.title}
        </div>
      </motion.a>
    </div>
  );
}

// ─── Folder card ─────────────────────────────────────────────────────────────

function FolderCard(
  props: {
    folder: SpeedDialFolder;
    isNew?: boolean;
    onOpen: () => void;
    onEdit: () => void;
    onRemove: () => void;
  } & SortableProps
) {
  const t = useT();
  const previews = props.folder.children.slice(0, 4);
  const guard = useDragClickGuard(props.isDragging);
  // Same isNew/pin-pop-in pattern as PinCard — only single newly-added
  // folders get the GPU-driven pop-in; the initial bulk render is silent.
  const popClass = props.isNew ? 'pin-pop-in' : undefined;
  return (
    <div
      ref={props.sortableRef}
      style={props.sortableStyle}
      {...(props.sortableAttrs ?? {})}
      {...(props.sortableListeners ?? {})}
      onPointerDownCapture={guard.onPointerDownCapture}
      onClickCapture={guard.onClickCapture}
      className={popClass}
    >
      <motion.button
        type="button"
        onClick={props.onOpen}
        whileHover={{ y: -3, scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        aria-label={t('pin_folder_open')}
        className="glass glass-hover group relative flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl p-3"
      >
        <div className="absolute right-1.5 top-1.5 hidden gap-1 group-hover:flex">
          <IconBtn
            icon={<Pencil size={11} />}
            onClick={e => {
              e.stopPropagation();
              props.onEdit();
            }}
            label="Rename"
          />
          <IconBtn
            icon={<X size={12} />}
            onClick={e => {
              e.stopPropagation();
              props.onRemove();
            }}
            label="Remove"
          />
        </div>
        {previews.length === 0 ? (
          <Folder size={40} className="text-white/65" />
        ) : (
          <div className="grid h-12 w-12 shrink-0 grid-cols-2 gap-1 rounded-xl bg-white/8 p-1 sm:h-14 sm:w-14">
            {[0, 1, 2, 3].map(i => {
              const c = previews[i];
              return c ? (
                <img
                  key={c.id}
                  src={faviconUrl(c.url, 64)}
                  alt=""
                  className="h-full w-full rounded-md object-cover"
                  onError={e => {
                    (e.target as HTMLImageElement).style.opacity = '0.3';
                  }}
                  draggable={false}
                />
              ) : (
                <div
                  key={`empty-${i}`}
                  className="h-full w-full rounded-md bg-white/8"
                />
              );
            })}
          </div>
        )}
        <div className="line-clamp-1 max-w-full text-center text-xs text-white/85">
          {props.folder.title}
        </div>
      </motion.button>
    </div>
  );
}

function IconBtn(props: {
  icon: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={e => {
        e.preventDefault();
        props.onClick(e);
      }}
      className="flex h-5 w-5 items-center justify-center rounded-full bg-black/40 text-white/90 hover:bg-black/60"
      aria-label={props.label}
    >
      {props.icon}
    </button>
  );
}

// ─── Folder content popup (also sortable inside) ─────────────────────────────

function FolderView(props: {
  folder: SpeedDialFolder;
  onClose: () => void;
  onAddPin: () => void;
  onEditPin: (pin: SpeedDialPin) => void;
  onRemovePin: (pin: SpeedDialPin) => void;
  onRenameFolder: () => void;
  onRemoveFolder: () => void;
}) {
  const t = useT();
  const reorderEntry = useSpeedDial(s => s.reorderEntry);
  useEscKey(true, props.onClose);
  useBodyScrollLock();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    // Same belt-and-suspenders click suppression as the top-level grid —
    // pin cards inside the folder view also navigate on click, so the
    // synthetic post-pointerup click needs swallowing.
    swallowNextClick();

    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = props.folder.children.findIndex(c => c.id === active.id);
    const newIndex = props.folder.children.findIndex(c => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    // Same optimistic-update trick as the top-level grid — patch the folder's
    // children array in the store so the dropped card's slot is already in
    // the new position when dnd-kit's drop animation runs.
    const current = useSpeedDial.getState().entries;
    const next = current.map(e =>
      e.kind === 'folder' && e.id === props.folder.id
        ? { ...e, children: arrayMove(e.children, oldIndex, newIndex) }
        : e
    );
    useSpeedDial.setState({ entries: next });

    await reorderEntry(String(active.id), newIndex);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={props.onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 12 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        onClick={e => e.stopPropagation()}
        className="glass-strong flex max-h-[78vh] w-[640px] max-w-[92vw] flex-col rounded-3xl p-6"
      >
        <div className="mb-5 flex shrink-0 items-center gap-2">
          <Folder size={18} className="shrink-0 text-white/85" />
          <button
            type="button"
            onClick={props.onRenameFolder}
            className="group flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-base font-medium text-white transition hover:bg-white/10"
            title={t('pin_edit_folder_title')}
          >
            {props.folder.title}
            <Pencil
              size={12}
              className="opacity-0 transition group-hover:opacity-60"
            />
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={props.onRemoveFolder}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/55 hover:bg-red-500/15 hover:text-red-200"
              aria-label="Delete folder"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
          {props.folder.children.length === 0 ? (
            <div className="rounded-2xl bg-white/5 px-4 py-12 text-center text-sm text-white/45">
              {t('pin_folder_empty')}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={props.folder.children.map(c => c.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
                  {props.folder.children.map(pin => (
                    <SortableFolderChild
                      key={pin.id}
                      pin={pin}
                      onEdit={() => props.onEditPin(pin)}
                      onRemove={() => props.onRemovePin(pin)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>

        <div className="mt-4 flex shrink-0 justify-end">
          <button
            type="button"
            onClick={props.onAddPin}
            className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/25"
          >
            <Plus size={13} />
            {t('pin_add_site')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SortableFolderChild(props: {
  pin: SpeedDialPin;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.pin.id });
  const style = sortableStyle(transform, transition, isDragging);
  return (
    <PinCard
      pin={props.pin}
      sortableRef={setNodeRef}
      sortableStyle={style}
      sortableAttrs={attributes}
      sortableListeners={listeners}
      isDragging={isDragging}
      onEdit={props.onEdit}
      onRemove={props.onRemove}
    />
  );
}
