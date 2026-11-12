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

export type Flip = "short" | "long";

/** Which edge a printer turns the paper over on, as the driver names it. */
const duplexFor = (flip: Flip): Duplex => (flip === "short" ? "shortEdge" : "longEdge");

/** A printer and flip that have been checked with a test sheet. */
export const testKey = (device: string, flip: Flip) => `${device}|${flip}`;

/**
 * The print setup sheet.
 *
 * It exists because the platform's own print dialog is write-only: Electron is
 * told nothing about what the user chose there, so nothing chosen there can be
 * remembered. Everything this panel asks for is ours, and so it can be saved
 * and replayed — which is what makes the one-click reprint possible. The
 * platform dialog stays available for the driver settings this does not carry.
 *
 * For a two-up job the flip is not a printer setting of its own: it is the
 * imposition's duplex flip, held by the app, and the printer is asked to turn
 * the paper on that same edge. One choice, so the two can never disagree.
 */
export function PrintPanel({
  twoUp, sheetCount, currentSheet, flip, onFlip, building, tested, onTested,
  initialFailure, onClose, onPrint,
}: {
  /** Two source pages to a printed side — everything but margins-only. */
  twoUp: boolean;
  /** Sheets of paper in the built job, or output pages when not two-up. */
  sheetCount: number;
  /** The sheet on show in the proof view, 1-based. */
  currentSheet: number;
  /** The imposition's duplex flip; the printer is asked for the same edge. */
  flip: Flip;
  onFlip: (flip: Flip) => void;
  /** True while a changed flip is being rebuilt: nothing prints the old one. */
  building: boolean;
  /** Printer-and-flip pairs a test sheet has confirmed, see `testKey`. */
  tested: ReadonlySet<string>;
  onTested: (key: string) => void;
  /** Why the last one-click print failed, if that is what opened the panel. */
  initialFailure?: string | null;
  onClose: () => void;
  onPrint: (options: PrintOptions) => Promise<PrintResult>;
}) {
  const [prefs, setPrefs] = useState<PrintPrefs>(DEFAULT_PRINT_PREFS);
  const [printers, setPrinters] = useState<Printer[] | null>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const [scope, setScope] = useState<PrintScope>("all");
  const [rangeText, setRangeText] = useState("");
  const [failure, setFailure] = useState<string | null>(initialFailure ?? null);
  const [busy, setBusy] = useState(false);
  /** The test sheet's progress: not sent, out and waiting for an answer, or re-flipped. */
  const [check, setCheck] = useState<"idle" | "asking" | "flipped">("idle");
  /** Paper, scale and colour are rarely changed; they wait behind a disclosure. */
  const [more, setMore] = useState(false);

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
        duplex: twoUp ? duplexFor(flip) : (saved.deviceName ? saved.duplex : "simplex"),
      });
    })().catch(() => setPrinters([]));
    return () => { stale = true; };
    // The flip is read once here and applied on every send below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twoUp]);

  /* ── the panel is modal: escape closes it, focus comes back afterwards ── */
  useEffect(() => {
    opener.current = document.activeElement;
    dialog.current?.querySelector<HTMLElement>("select, input, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
      // Keep Tab inside the sheet while it is open.
      if (e.key === "Tab" && dialog.current) {
        const all = [...dialog.current.querySelectorAll<HTMLElement>(
          "button:not(:disabled), select, input:not(:disabled)")];
        if (all.length === 0) return;
        const first = all[0]!, last = all[all.length - 1]!;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
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

  const chosen = scope === "all" ? sheetCount
    : scope === "sheet" ? 1
    : parsed && parsed.ok ? parsed.pages.length : 0;
  const paper = chosen * prefs.copies;

  const key = prefs.deviceName ? testKey(prefs.deviceName, flip) : null;
  // A test is worth it only when there is a back to get wrong and more than
  // one sheet to waste.
  const needsTest = twoUp && sheetCount > 1 && key !== null && !tested.has(key);

  const noPrinters = printers !== null && printers.length === 0;
  const canPrint = !busy && !building && Boolean(prefs.deviceName)
    && (scope !== "range" || Boolean(parsed && parsed.ok));

  const options = (ranges: PrintOptions["pageRanges"], silent: boolean, copies = prefs.copies) => ({
    ...prefs, copies, duplex: twoUp ? duplexFor(flip) : prefs.duplex, pageRanges: ranges, silent,
  });

  async function send(silent: boolean) {
    if (scope === "range" && !(parsed && parsed.ok)) {
      setFailure(parsed ? parsed.error : `Enter at least one ${unit}.`);
      return;
    }
    setBusy(true);
    setFailure(null);
    const result = await onPrint(options(pageRanges(), silent));
    setBusy(false);
    if (result.ok) {
      // Only our own panel's choices are worth saving — the platform dialog
      // never says what was picked in it.
      if (silent) await window.desktop?.print?.prefs(options(undefined, true));
      onClose();
      return;
    }
    if (result.cancelled) return; // the user meant that
    setFailure(result.reason ?? "The job could not be sent to the printer.");
  }

  async function sendTest() {
    setBusy(true);
    setFailure(null);
    const result = await onPrint(options(sheetsToPageRanges([1], true), true, 1));
    setBusy(false);
    if (result.ok) {
      await window.desktop?.print?.prefs(options(undefined, true));
      setCheck("asking");
      return;
    }
    if (!result.cancelled) setFailure(result.reason ?? "The test sheet could not be sent.");
  }

  function answer(upright: boolean) {
    if (upright) { if (key) onTested(key); setCheck("idle"); return; }
    onFlip(flip === "short" ? "long" : "short");
    setCheck("flipped");
  }

  const other = flip === "short" ? "long" : "short";

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
                onChange={(v) => { set("deviceName", v || null); setMissing(null); setCheck("idle"); }}
                options={[
                  ...(prefs.deviceName ? [] : [{ value: "", label: "Choose a printer…" }]),
                  ...printers.map((p) => ({
                    value: p.name,
                    label: p.isDefault ? `${p.displayName} (default)` : p.displayName,
                  })),
                ]} />
            </Field>
          )}

          {twoUp ? (
            <Field label="Paper turns over on"
              hint="Both sides of every sheet are printed. The back is laid out for this edge.">
              <Segmented label="Paper turns over on" value={flip}
                onChange={(v) => { onFlip(v); setCheck("idle"); }}
                options={[
                  { value: "short", label: "Short edge" },
                  { value: "long", label: "Long edge" },
                ]} />
            </Field>
          ) : (
            <Field label="Sides">
              <Segmented label="Sides" value={prefs.duplex} onChange={(v: Duplex) => set("duplex", v)}
                options={[
                  { value: "simplex", label: "One side" },
                  { value: "shortEdge", label: "Short edge" },
                  { value: "longEdge", label: "Long edge" },
                ]} />
            </Field>
          )}

          {/* The one moment paper can be wasted in bulk, so it is checked on one sheet. */}
          {twoUp && sheetCount > 1 && prefs.deviceName && (needsTest || check !== "idle") && (
            <div className="test-sheet" role="group" aria-labelledby="test-sheet-title">
              <p className="sr-only" aria-live="polite">
                {check === "asking" ? "Test sheet sent. Is the back the right way up?"
                  : check === "flipped" ? `Switched to the ${flip} edge.` : ""}
              </p>
              {check === "asking" ? (
                <>
                  <p><strong id="test-sheet-title">Sheet 1 is on its way.</strong> Turn it over the way you
                    would read it. Is the back the right way up?</p>
                  <div className="test-actions">
                    <button type="button" className="btn sm primary" onClick={() => answer(true)}>
                      Yes, upright
                    </button>
                    <button type="button" className="btn sm ghost" onClick={() => answer(false)}>
                      No, upside down
                    </button>
                  </div>
                </>
              ) : check === "flipped" ? (
                <>
                  <p><strong id="test-sheet-title">Switched to the {flip} edge.</strong> Print sheet 1 again to
                    confirm before the rest.</p>
                  <div className="test-actions">
                    <button type="button" className="btn sm primary" onClick={sendTest}
                      disabled={busy || building}>
                      Print test sheet again
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p><strong id="test-sheet-title">Print one test sheet first.</strong> Printers disagree on which
                    edge they turn the paper over; one sheet tells you before {sheetCount} do.</p>
                  <div className="test-actions">
                    <button type="button" className="btn sm primary" onClick={sendTest}
                      disabled={busy || building}>
                      Print test sheet
                    </button>
                    <button type="button" className="btn sm ghost"
                      onClick={() => key && onTested(key)}>
                      Already checked
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <Field label="Print" hint={twoUp
            ? "A sheet is two printed sides, so one sheet is two pages of the built file."
            : undefined}>
            <Segmented label="What to print" value={scope} onChange={setScope}
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
                name="print-range" inputMode="numeric" spellCheck={false} value={rangeText} autoFocus
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

          <Field label="Copies">
            <input className="control copies" type="number" name="copies" id="print-copies"
              min={1} max={999} inputMode="numeric" value={prefs.copies}
              aria-label="Copies"
              onChange={(e) => {
                const n = Math.round(Number(e.target.value));
                set("copies", Number.isFinite(n) ? Math.min(999, Math.max(1, n)) : 1);
              }} />
          </Field>

          <button type="button" className="disclosure" aria-expanded={more}
            aria-controls="print-more" onClick={() => setMore((m) => !m)}>
            More options
            <span className="disclosure-summary">
              {[prefs.paperName ?? "Paper as loaded",
                prefs.scale === 100 ? null : `${prefs.scale}%`,
                prefs.color ? null : "Greyscale"].filter(Boolean).join(" · ")}
            </span>
          </button>

          <div id="print-more" hidden={!more}>
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
          </div>

          {failure && <p className="notice bad" role="alert">{failure}</p>}
        </div>

        <footer className="modal-foot">
          <p className="hint">
            {needsTest
              ? `Not tested on this printer yet. If the back comes out upside down, switch to the ${other} edge.`
              : "Choices made in the system dialog apply to this print only; they can't be remembered."}
          </p>
          <div className="foot-actions">
            <button type="button" className="btn ghost sm" onClick={() => send(false)}
              disabled={busy || building}
              title="Hand the job to the platform's own dialog">
              System dialog…
            </button>
            <div className="spacer" />
            {(busy || building) && (
              <span className="busy"><i className="spinner" />{building ? "Rebuilding…" : "Sending…"}</span>
            )}
            <button type="button" className={needsTest ? "btn sm ghost" : "btn primary"}
              onClick={() => send(true)} disabled={!canPrint || paper === 0}>
              {paper === 0
                ? "Print"
                : `${needsTest ? "Skip test, print" : "Print"} ${paper} ${unit}${paper === 1 ? "" : "s"}`}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
