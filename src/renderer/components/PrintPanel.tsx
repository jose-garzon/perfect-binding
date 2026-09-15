import { useCallback, useEffect, useRef, useState } from "react";
import { Field, Segmented, Select, Slider, Switch } from "./Controls";
import { parseRanges, sheetsToPageRanges } from "../lib/ranges";
import {
  DEFAULT_PRINT_PREFS,
  type Duplex, type PrintOptions, type PrintPrefs, type Printer, type PrintResult,
  type PrintScope,
} from "../lib/print";

/** What Electron's `pageSize` takes by name, plus letting the driver decide. */
const PAPERS = [
  { value: "", label: "Whatever the printer is loaded with" },
  { value: "A3", label: "A3" },
  { value: "A4", label: "A4" },
  { value: "A5", label: "A5" },
  { value: "Letter", label: "Letter" },
  { value: "Legal", label: "Legal" },
  { value: "Tabloid", label: "Tabloid" },
];

/**
 * The print setup sheet.
 *
 * It exists because the platform's own print dialog is write-only: Electron is
 * told nothing about what the user chose there, so nothing chosen there can be
 * remembered. Everything this panel asks for is ours, and so it can be saved
 * and replayed — which is what makes the one-click reprint possible. The
 * platform dialog stays available for the driver settings this does not carry.
 */
export function PrintPanel({
  twoUp, sheetCount, currentSheet, onClose, onPrint,
}: {
  /** Two source pages to a printed side — everything but margins-only. */
  twoUp: boolean;
  /** Sheets of paper in the built job, or output pages when not two-up. */
  sheetCount: number;
  /** The sheet on show in the proof view, 1-based. */
  currentSheet: number;
  onClose: () => void;
  onPrint: (options: PrintOptions) => Promise<PrintResult>;
}) {
  const [prefs, setPrefs] = useState<PrintPrefs>(DEFAULT_PRINT_PREFS);
  const [printers, setPrinters] = useState<Printer[] | null>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const [scope, setScope] = useState<PrintScope>("all");
  const [rangeText, setRangeText] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  const unit = twoUp ? "sheet" : "page";

  /* ── what the platform has, and what was saved last time ──────────────── */
  useEffect(() => {
    const bridge = window.desktop?.print;
    if (!bridge) return;
    let stale = false;
    (async () => {
      const [found, saved] = await Promise.all([bridge.printers(), bridge.prefs()]);
      if (stale) return;
      setPrinters(found);
      // A printer that is unplugged or renamed is reported, never quietly
      // swapped for the platform default.
      const gone = saved.deviceName && !found.some((p) => p.name === saved.deviceName);
      setMissing(gone ? saved.deviceName : null);
      setPrefs({
        ...saved,
        // Left unset when the saved printer is gone, and when none was ever
        // saved: a job is never sent to a printer the user did not pick.
        deviceName: gone ? null : saved.deviceName,
        // Nothing saved yet: a two-up job wants both sides of the paper, a
        // margins-only one does not.
        duplex: saved.deviceName ? saved.duplex : (twoUp ? "shortEdge" : "simplex"),
      });
    })().catch(() => setPrinters([]));
    return () => { stale = true; };
  }, [twoUp]);

  /* ── the panel is modal: escape closes it, focus comes back afterwards ── */
  useEffect(() => {
    opener.current = document.activeElement;
    dialog.current?.querySelector<HTMLElement>("select, input, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  const set = useCallback(<K extends keyof PrintPrefs>(key: K, value: PrintPrefs[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    setFailure(null);
  }, []);

  /** The range field, resolved. `null` means the text does not parse. */
  const parsed = scope === "range" ? parseRanges(rangeText, sheetCount) : null;
  const rangeError = scope === "range" && rangeText.trim() !== "" && parsed && !parsed.ok
    ? parsed.error
    : null;

  function pageRanges() {
    if (scope === "all") return [];
    if (scope === "sheet") return sheetsToPageRanges([currentSheet], twoUp);
    return parsed && parsed.ok ? sheetsToPageRanges(parsed.pages, twoUp) : [];
  }

  const noPrinters = printers !== null && printers.length === 0;
  const canPrint = !busy && Boolean(prefs.deviceName)
    && (scope !== "range" || Boolean(parsed && parsed.ok));

  async function send(silent: boolean) {
    if (scope === "range" && !(parsed && parsed.ok)) {
      setFailure(parsed ? parsed.error : `Enter at least one ${unit}.`);
      return;
    }
    setBusy(true);
    setFailure(null);
    const result = await onPrint({ ...prefs, pageRanges: pageRanges(), silent });
    setBusy(false);
    if (result.ok) {
      // Only our own panel's choices are worth saving — the platform dialog
      // never says what was picked in it.
      if (silent) await window.desktop?.print?.prefs(prefs);
      onClose();
      return;
    }
    if (result.cancelled) return; // the user meant that
    setFailure(result.reason ?? "The job could not be sent to the printer.");
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="print-title"
        ref={dialog}>
        <header className="modal-head">
          <h2 id="print-title">Print</h2>
          <div className="spacer" />
          <button type="button" className="btn ghost sm" onClick={onClose}>Close</button>
        </header>

        <div className="modal-body">
          {printers === null ? (
            <p className="notice">Looking for printers…</p>
          ) : noPrinters ? (
            <p className="notice bad" role="alert">
              No printers were found on this machine. The system dialog can still find one.
            </p>
          ) : (
            <Field label="Printer"
              hint={missing
                ? `The printer saved last time — ${missing} — is not available.`
                : undefined}>
              <Select value={prefs.deviceName ?? ""}
                onChange={(v) => { set("deviceName", v || null); setMissing(null); }}
                options={[
                  ...(prefs.deviceName ? [] : [{ value: "", label: "Choose a printer…" }]),
                  ...printers.map((p) => ({
                    value: p.name,
                    label: p.isDefault ? `${p.displayName} (default)` : p.displayName,
                  })),
                ]} />
            </Field>
          )}

          <Field label="Print" hint={twoUp
            ? "A sheet is two printed sides, so one sheet is two pages of the built file."
            : undefined}>
            <Segmented value={scope} onChange={setScope}
              options={[
                { value: "all", label: "Everything" },
                { value: "range", label: twoUp ? "Sheets" : "Pages" },
                { value: "sheet", label: "On screen" },
              ]} />
          </Field>

          {scope === "range" && (
            <Field label={twoUp ? "Sheets" : "Pages"}
              value={`1–${sheetCount}`}
              hint="Ranges like 1-4, 9, 12- .">
              <input className={`control${rangeError ? " invalid" : ""}`} type="text"
                inputMode="numeric" spellCheck={false} value={rangeText} autoFocus
                aria-label={twoUp ? "Sheets to print" : "Pages to print"}
                aria-invalid={rangeError ? true : undefined}
                onChange={(e) => { setRangeText(e.target.value); setFailure(null); }} />
            </Field>
          )}

          {scope === "sheet" && (
            <p className="notice">
              {twoUp
                ? `Sheet ${currentSheet} of ${sheetCount}, both sides.`
                : `Page ${currentSheet} of ${sheetCount}.`}
            </p>
          )}

          {rangeError && <p className="notice bad" role="alert">{rangeError}</p>}

          <Field label="Copies" value={`${prefs.copies}`}>
            <Slider min={1} max={20} value={prefs.copies} onChange={(v) => set("copies", v)} />
          </Field>

          <Field label="Sides"
            hint={twoUp
              ? "A booklet needs both sides of the paper. This asks the printer for it; the imposition's own duplex flip is a separate setting."
              : undefined}>
            <Segmented value={prefs.duplex} onChange={(v: Duplex) => set("duplex", v)}
              options={[
                { value: "simplex", label: "One side" },
                { value: "shortEdge", label: "Short edge" },
                { value: "longEdge", label: "Long edge" },
              ]} />
          </Field>

          <Field label="Paper">
            <Select value={prefs.paperName ?? ""} onChange={(v) => set("paperName", v || null)}
              options={PAPERS} />
          </Field>

          <Field label="Scale" value={`${prefs.scale}%`}
            hint={prefs.scale === 100
              ? undefined
              : "The sheet is already imposed at its final size. Anything but 100% moves the margins and the gutter."}>
            <Slider min={50} max={150} step={5} value={prefs.scale}
              onChange={(v) => set("scale", v)} />
          </Field>

          <Field label="">
            <Switch label="Colour" sub={prefs.color ? "As built" : "Greyscale"}
              checked={prefs.color} onChange={(v) => set("color", v)} />
          </Field>

          {failure && <p className="notice bad" role="alert">{failure}</p>}
        </div>

        <footer className="modal-foot">
          <p className="hint">
            Nothing chosen in the system dialog can be saved — the platform does not
            report it back.
          </p>
          <div className="foot-actions">
            <button type="button" className="btn ghost sm" onClick={() => send(false)}
              disabled={busy}
              title="Hand the job to the platform's own dialog">
              System dialog…
            </button>
            <div className="spacer" />
            {busy && <span className="busy"><i className="spinner" />Sending…</span>}
            <button type="button" className="btn primary" onClick={() => send(true)}
              disabled={!canPrint}>
              Print
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
