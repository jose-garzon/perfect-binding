import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * The contact sheet: every source page as a thumbnail, kept or removed.
 *
 * Removed pages keep their slot rather than disappearing — a grid that
 * renumbers under the cursor is how a run gets removed twice — and no pdf.js
 * object is ever a prop, so drawing goes through a callback the app owns.
 */
export function PageGrid({
  pageCount, removed, hidden, onToggle, onRemove, onRestore, drawThumbnail, tileWidth = 128,
}: {
  pageCount: number;
  removed: ReadonlySet<number>;
  /** Removed pages are left out of the grid entirely. */
  hidden: boolean;
  onToggle: (page: number) => void;
  onRemove: (pages: number[]) => void;
  onRestore: (pages: number[]) => void;
  /** Draws one page into a canvas. Resolves false when the work was dropped. */
  drawThumbnail: (canvas: HTMLCanvasElement, page: number, signal: AbortSignal) => Promise<boolean>;
  tileWidth?: number;
}) {
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set());
  const [focused, setFocused] = useState(1);
  const anchor = useRef(1);
  const grid = useRef<HTMLDivElement>(null);

  const shown = useMemo(() => {
    const all = Array.from({ length: pageCount }, (_, i) => i + 1);
    return hidden ? all.filter((p) => !removed.has(p)) : all;
  }, [pageCount, hidden, removed]);

  /** Output position of each kept page, for the second folio on a tile. */
  const positions = useMemo(() => {
    const map = new Map<number, number>();
    let n = 0;
    for (let p = 1; p <= pageCount; p++) if (!removed.has(p)) map.set(p, ++n);
    return map;
  }, [pageCount, removed]);

  useEffect(() => { setSelected(new Set()); }, [pageCount]);

  const pick = useCallback((page: number, shift: boolean) => {
    if (!shift) {
      anchor.current = page;
      setSelected(new Set([page]));
      return;
    }
    const [from, to] = anchor.current <= page ? [anchor.current, page] : [page, anchor.current];
    const run = new Set<number>();
    for (const p of shown) if (p >= from && p <= to) run.add(p);
    setSelected(run);
  }, [shown]);

  const activate = useCallback((page: number, e: { shiftKey: boolean }) => {
    setFocused(page);
    pick(page, e.shiftKey);
    if (!e.shiftKey) onToggle(page);
  }, [onToggle, pick]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const index = shown.indexOf(focused);
    const columns = columnCount(grid.current, tileWidth);
    const move = (delta: number) => {
      const next = shown[Math.min(shown.length - 1, Math.max(0, index + delta))];
      if (next === undefined) return;
      e.preventDefault();
      setFocused(next);
      if (e.shiftKey) pick(next, true);
      else { anchor.current = next; setSelected(new Set([next])); }
      tileOf(grid.current, next)?.focus();
    };

    switch (e.key) {
      case "ArrowRight": return move(1);
      case "ArrowLeft": return move(-1);
      case "ArrowDown": return move(columns);
      case "ArrowUp": return move(-columns);
      case "Home": return move(-shown.length);
      case "End": return move(shown.length);
      case "Delete":
      case "Backspace": {
        e.preventDefault();
        const pages = selected.size ? [...selected] : [focused];
        const restoring = pages.every((p) => removed.has(p));
        if (restoring) onRestore(pages);
        else onRemove(pages.filter((p) => !removed.has(p)));
        return;
      }
      default:
    }
  }, [focused, onRemove, onRestore, pick, removed, selected, shown, tileWidth]);

  if (pageCount === 0) return null;

  return (
    <div
      className="page-grid"
      ref={grid}
      role="listbox"
      aria-multiselectable="true"
      aria-label="Source pages"
      onKeyDown={onKeyDown}
      style={{ ["--tile" as string]: `${tileWidth}px` }}
    >
      {shown.map((page) => (
        <Tile
          key={page}
          page={page}
          position={positions.get(page) ?? null}
          isRemoved={removed.has(page)}
          isSelected={selected.has(page)}
          isFocused={focused === page}
          width={tileWidth}
          onActivate={activate}
          onToggle={onToggle}
          drawThumbnail={drawThumbnail}
        />
      ))}
    </div>
  );
}

function Tile({
  page, position, isRemoved, isSelected, isFocused, width, onActivate, onToggle, drawThumbnail,
}: {
  page: number;
  position: number | null;
  isRemoved: boolean;
  isSelected: boolean;
  isFocused: boolean;
  width: number;
  onActivate: (page: number, e: { shiftKey: boolean }) => void;
  onToggle: (page: number) => void;
  drawThumbnail: (canvas: HTMLCanvasElement, page: number, signal: AbortSignal) => Promise<boolean>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const tile = useRef<HTMLDivElement>(null);
  const [painted, setPainted] = useState(false);

  // Tiles paint only once they are on screen, and abandon the work the moment
  // they leave it, so a fast scroll never queues hundreds of renders.
  useEffect(() => {
    const el = tile.current;
    if (!el) return;
    let ac: AbortController | null = null;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        if (ac || !canvas.current) return;
        ac = new AbortController();
        drawThumbnail(canvas.current, page, ac.signal)
          .then((ok) => { if (ok) setPainted(true); })
          .catch(() => {});
      } else {
        ac?.abort();
        ac = null;
      }
    }, { rootMargin: "300px 0px" });
    observer.observe(el);
    return () => { observer.disconnect(); ac?.abort(); };
  }, [drawThumbnail, page]);

  const state = isRemoved ? "removed" : "kept";
  return (
    <div
      ref={tile}
      className={`tile ${state}${isSelected ? " selected" : ""}`}
      role="option"
      aria-selected={isSelected}
      aria-label={`Page ${page}, ${isRemoved ? "removed" : "kept"}`}
      aria-disabled={isRemoved}
      tabIndex={isFocused ? 0 : -1}
      style={{ width }}
      onClick={(e) => onActivate(page, e)}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        onActivate(page, e);
      }}
    >
      <div className="tile-plate">
        <canvas ref={canvas} aria-hidden="true" />
        {!painted && <span className="tile-placeholder" aria-hidden="true" />}
        <span className="strike" aria-hidden="true" />
        <button
          type="button"
          className="tile-action"
          title={isRemoved ? `Restore page ${page}` : `Remove page ${page}`}
          aria-label={isRemoved ? `Restore page ${page}` : `Remove page ${page}`}
          onClick={(e) => { e.stopPropagation(); onToggle(page); }}
        >
          {isRemoved ? "↺" : "×"}
        </button>
      </div>
      <div className="tile-folio">
        <span className="src">{page}</span>
        {position !== null && position !== page && <span className="out">→ {position}</span>}
        {isRemoved && <span className="out">removed</span>}
      </div>
    </div>
  );
}

/** Columns currently laid out, so the arrow keys move a real row at a time. */
function columnCount(grid: HTMLDivElement | null, tileWidth: number): number {
  if (!grid) return 1;
  const style = getComputedStyle(grid);
  const gap = parseFloat(style.columnGap || "0") || 0;
  return Math.max(1, Math.floor((grid.clientWidth + gap) / (tileWidth + gap)));
}

function tileOf(grid: HTMLDivElement | null, page: number): HTMLElement | null {
  return grid?.querySelectorAll<HTMLElement>(".tile")[indexOfPage(grid, page)] ?? null;
}

/** The grid renders `shown` in order, so a tile's position is its index. */
function indexOfPage(grid: HTMLDivElement, page: number): number {
  const tiles = [...grid.querySelectorAll<HTMLElement>(".tile")];
  return tiles.findIndex((t) => t.getAttribute("aria-label")?.startsWith(`Page ${page},`));
}
