import { useEffect, useRef } from "react";

/**
 * A short question before something that cannot be taken back. Laid out like
 * the print panel, smaller; the safe choice holds focus, so Enter keeps the work.
 */
export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel }: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const keep = useRef<HTMLButtonElement>(null);
  const drop = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    keep.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onCancel(); }
      if (e.key === "Tab") {
        e.preventDefault();
        (document.activeElement === keep.current ? drop : keep).current?.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => { window.removeEventListener("keydown", onKey, true); opener?.focus?.(); };
  }, [onCancel]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal confirm" role="alertdialog" aria-modal="true"
        aria-labelledby="confirm-title" aria-describedby="confirm-body">
        <div className="modal-body">
          <h2 id="confirm-title">{title}</h2>
          <p id="confirm-body">{body}</p>
        </div>
        <footer className="modal-foot">
          <div className="foot-actions">
            <div className="spacer" />
            <button ref={drop} type="button" className="btn ghost sm danger" onClick={onConfirm}>
              {confirmLabel}
            </button>
            <button ref={keep} type="button" className="btn primary" onClick={onCancel}>
              Keep working
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
