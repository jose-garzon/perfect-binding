import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Which source pages take part in the output. The state is the set of *removed*
 * pages, so the kept list is ascending by construction and nothing here can
 * reorder a document. Removal never touches the loaded bytes: it is undone by
 * putting the page number back.
 */

const UNDO_LIMIT = 50;
const ALL_REMOVED = "At least one page has to stay.";

export interface PageSelection {
  removed: ReadonlySet<number>;
  /** Kept source pages, 1-based ascending. */
  kept: number[];
  keptCount: number;
  removedCount: number;
  /** Why the last action was refused, or what a quick action just did. */
  notice: string | null;
  setNotice: (text: string | null) => void;
  canUndo: boolean;
  toggle: (page: number) => void;
  remove: (pages: Iterable<number>) => void;
  restore: (pages: Iterable<number>) => void;
  /** Replaces the whole selection, as the range field does. */
  keepOnly: (pages: Iterable<number>, note?: string) => void;
  invert: () => void;
  restoreAll: () => void;
  undo: () => void;
  /** Forgets the selection and its history — a new document was loaded. */
  reset: () => void;
}

export function usePageSelection(pageCount: number): PageSelection {
  const [removed, setRemovedState] = useState<ReadonlySet<number>>(() => new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const history = useRef<ReadonlySet<number>[]>([]);

  const kept = useMemo(
    () => Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => !removed.has(p)),
    [pageCount, removed],
  );

  /** Applies a new removed-set, refusing one that would leave nothing to print. */
  const apply = useCallback((next: Set<number>, note?: string) => {
    setRemovedState((current) => {
      if (pageCount > 0 && next.size >= pageCount) {
        setNotice(ALL_REMOVED);
        return current;
      }
      if (sameSet(current, next)) {
        setNotice(note ?? null);
        return current;
      }
      history.current = [...history.current.slice(-(UNDO_LIMIT - 1)), current];
      setCanUndo(true);
      setNotice(note ?? null);
      return next;
    });
  }, [pageCount]);

  const toggle = useCallback((page: number) => {
    setRemovedState((current) => {
      const next = new Set(current);
      if (next.has(page)) next.delete(page);
      else next.add(page);
      if (pageCount > 0 && next.size >= pageCount) {
        setNotice(ALL_REMOVED);
        return current;
      }
      history.current = [...history.current.slice(-(UNDO_LIMIT - 1)), current];
      setCanUndo(true);
      setNotice(null);
      return next;
    });
  }, [pageCount]);

  const remove = useCallback((pages: Iterable<number>) => {
    setRemovedState((current) => {
      const next = new Set(current);
      for (const p of pages) next.add(p);
      if (pageCount > 0 && next.size >= pageCount) {
        setNotice(ALL_REMOVED);
        return current;
      }
      if (sameSet(current, next)) return current;
      history.current = [...history.current.slice(-(UNDO_LIMIT - 1)), current];
      setCanUndo(true);
      setNotice(null);
      return next;
    });
  }, [pageCount]);

  const restore = useCallback((pages: Iterable<number>) => {
    setRemovedState((current) => {
      const next = new Set(current);
      for (const p of pages) next.delete(p);
      if (sameSet(current, next)) return current;
      history.current = [...history.current.slice(-(UNDO_LIMIT - 1)), current];
      setCanUndo(true);
      setNotice(null);
      return next;
    });
  }, []);

  const keepOnly = useCallback((pages: Iterable<number>, note?: string) => {
    const keep = new Set(pages);
    const next = new Set<number>();
    for (let p = 1; p <= pageCount; p++) if (!keep.has(p)) next.add(p);
    apply(next, note);
  }, [apply, pageCount]);

  const invert = useCallback(() => {
    const next = new Set<number>();
    for (let p = 1; p <= pageCount; p++) if (!removed.has(p)) next.add(p);
    apply(next, `Kept ${pageCount - next.size} pages instead.`);
  }, [apply, pageCount, removed]);

  const restoreAll = useCallback(() => {
    apply(new Set(), removed.size ? `Restored ${removed.size} pages.` : undefined);
  }, [apply, removed]);

  const undo = useCallback(() => {
    const previous = history.current.pop();
    setCanUndo(history.current.length > 0);
    if (!previous) return;
    setNotice(null);
    setRemovedState(previous);
  }, []);

  const reset = useCallback(() => {
    history.current = [];
    setCanUndo(false);
    setNotice(null);
    setRemovedState(new Set());
  }, []);

  // Cmd/Ctrl+Z anywhere but a text field, so a removal is always one keystroke
  // from being taken back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "z" && e.key !== "Z") return;
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      if (isTextEntry(e.target)) return;
      e.preventDefault();
      undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  // Memoised so the callbacks the app hangs off this object keep their identity
  // between renders.
  return useMemo(() => ({
    removed,
    kept,
    keptCount: kept.length,
    removedCount: removed.size,
    notice,
    setNotice,
    canUndo,
    toggle,
    remove,
    restore,
    keepOnly,
    invert,
    restoreAll,
    undo,
    reset,
  }), [
    removed, kept, notice, canUndo,
    toggle, remove, restore, keepOnly, invert, restoreAll, undo, reset,
  ]);
}

function sameSet(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}
