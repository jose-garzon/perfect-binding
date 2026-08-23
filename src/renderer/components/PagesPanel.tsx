import { useEffect, useState } from "react";
import { Field } from "./Controls";

/**
 * The text half of the page selection: the kept pages as ranges, the quick
 * actions, and a way into the contact sheet. The field and the grid are two
 * views of one selection, so the text is rewritten whenever the grid changes —
 * except while it is being edited.
 */
export function PagesPanel({
  pageCount, keptCount, removedCount, ranges, invalid, notice, canUndo, scanning,
  onApply, onRemoveBlanks, onCancelScan, onInvert, onRestoreAll, onUndo, onOpenGrid,
}: {
  pageCount: number;
  keptCount: number;
  removedCount: number;
  /** The current selection, formatted. */
  ranges: string;
  /** Why the typed ranges were not applied. */
  invalid: string | null;
  notice: string | null;
  canUndo: boolean;
  /** 0 = idle, otherwise the blank pass's progress, 0-1. */
  scanning: number;
  onApply: (text: string) => void;
  onRemoveBlanks: () => void;
  onCancelScan: () => void;
  onInvert: () => void;
  onRestoreAll: () => void;
  onUndo: () => void;
  onOpenGrid: () => void;
}) {
  const [text, setText] = useState(ranges);
  const [editing, setEditing] = useState(false);

  useEffect(() => { if (!editing) setText(ranges); }, [ranges, editing]);

  const apply = () => {
    setEditing(false);
    if (text.trim() === ranges) return;
    onApply(text);
  };

  return (
    <>
      <Field label="Pages kept"
        value={removedCount ? `${keptCount} of ${pageCount}` : `all ${pageCount}`}
        hint="Ranges like 1-4, 9, 12- . Leave a page out to drop it from the booklet.">
        <input
          className={`control${invalid ? " invalid" : ""}`}
          type="text"
          inputMode="numeric"
          spellCheck={false}
          value={text}
          aria-label="Pages kept"
          aria-invalid={invalid ? true : undefined}
          onChange={(e) => { setEditing(true); setText(e.target.value); }}
          onBlur={apply}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); apply(); }
            if (e.key === "Escape") { setEditing(false); setText(ranges); e.currentTarget.blur(); }
          }}
        />
      </Field>

      {invalid && <p className="notice bad" role="alert">{invalid}</p>}
      {!invalid && notice && <p className="notice">{notice}</p>}

      <div className="row-actions">
        <button type="button" className="btn sm" onClick={onOpenGrid}>Choose pages…</button>
        {scanning > 0 ? (
          <button type="button" className="btn sm ghost" onClick={onCancelScan}>Stop scan</button>
        ) : (
          <button type="button" className="btn sm ghost" onClick={onRemoveBlanks}>
            Remove blanks
          </button>
        )}
        <button type="button" className="btn sm ghost" onClick={onInvert}>Invert</button>
        <button type="button" className="btn sm ghost" onClick={onRestoreAll}
          disabled={removedCount === 0}>
          Restore all
        </button>
        <button type="button" className="btn sm ghost" onClick={onUndo} disabled={!canUndo}
          title="Undo the last page change (Ctrl+Z)">
          Undo
        </button>
      </div>

      {scanning > 0 && (
        <div className="progress" style={{ marginBottom: 18 }}>
          <i style={{ width: `${Math.round(scanning * 100)}%` }} />
        </div>
      )}
    </>
  );
}
