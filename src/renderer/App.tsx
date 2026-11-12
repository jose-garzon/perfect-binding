import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { buildBooklet, type BuildResult } from "../core/build";
import { mergeSources } from "../core/merge";
import { PAPER_SIZES, mm } from "../core/paper";
import { sheetCount as sheetsFor, blankCount } from "../core/imposition";
import { FULL_PAGE, type Bounds } from "../core/crop";
import {
  clearThumbnails, closePdf, loadPdf, rasterizeForPrint, renderPage, renderThumbnail, scanBlanks, scanMargins,
  type CropScan,
} from "./lib/pdf";
import { formatRanges, parseRanges, sheetsToPageRanges } from "./lib/ranges";
import { DEFAULT_PRINT_PREFS, type PrintOptions, type PrintPrefs, type PrintResult } from "./lib/print";
import { EMPTY_SNAPSHOT, keptPages, usePageSelection, type SelectionSnapshot } from "./lib/selection";
import { SourcesPanel, type SourceRow } from "./components/SourcesPanel";
import { Dropzone } from "./components/Dropzone";
import { Preview, type PlateView } from "./components/Preview";
import { CropPanel } from "./components/CropPanel";
import { PageGrid } from "./components/PageGrid";
import { PagesPanel } from "./components/PagesPanel";
import { PrintPanel, testKey } from "./components/PrintPanel";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { Field, Segmented, Select, Slider, Switch } from "./components/Controls";
import {
  DraftDiagram, MarginsDiagram, PerfectDiagram, SaddleDiagram,
} from "./components/Diagrams";
import { UpdateBar, useUpdate } from "./components/UpdateBar";

type BindingChoice = "saddle" | "perfect" | "draft" | "none";

interface Settings {
  binding: BindingChoice;
  paperId: string;
  outerMargin: number; // mm
  gutter: number; // mm
  duplexFlip: "short" | "long";
  sheetsPerSignature: number; // 0 = one signature
  rtl: boolean;
  guideLine: boolean;
  cropMarks: boolean;
  cropEnabled: boolean;
  uniformCrop: boolean;
}

const DEFAULTS: Settings = {
  binding: "saddle",
  paperId: "a4",
  outerMargin: 6,
  gutter: 8,
  duplexFlip: "short",
  sheetsPerSignature: 0,
  rtl: false,
  guideLine: true,
  cropMarks: false,
  cropEnabled: false,
  uniformCrop: true,
};

/* Settings describe the reader's printer and taste, not one file, so they
   outlive a launch. Storage can be missing or blocked; defaults then apply. */
const SETTINGS_KEY = "pb.settings.v1";
const TESTED_KEY = "pb.tested.v1";

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    const saved = JSON.parse(raw) as Partial<Settings>;
    const out = { ...DEFAULTS };
    for (const k of Object.keys(DEFAULTS) as Array<keyof Settings>) {
      if (typeof saved[k] === typeof DEFAULTS[k]) (out as Record<string, unknown>)[k] = saved[k];
    }
    if (!BINDINGS.some((b) => b.id === out.binding)) out.binding = DEFAULTS.binding;
    return out;
  } catch { return DEFAULTS; }
}

function loadTested(): Set<string> {
  try {
    const raw = localStorage.getItem(TESTED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}

function store(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* not kept, still works */ }
}

const BINDINGS: Array<{
  id: BindingChoice; title: string; desc: string; Diagram: typeof SaddleDiagram;
}> = [
  {
    id: "saddle", title: "Stitched (saddle)",
    desc: "Sheets nest inside each other, fold once, staple the spine.",
    Diagram: SaddleDiagram,
  },
  {
    id: "perfect", title: "Perfect binding",
    desc: "Print flat, cut down the middle, stack the piles, glue the spine.",
    Diagram: PerfectDiagram,
  },
  {
    id: "draft", title: "Optimized draft print",
    desc: "Two pages a side in reading order, stacked and stapled at the corner.",
    Diagram: DraftDiagram,
  },
  {
    id: "none", title: "No booklet, trim only",
    desc: "No reordering — just trim whitespace so the text prints larger.",
    Diagram: MarginsDiagram,
  },
];

/** Maps a UI choice onto the core imposition options. */
function coreBinding(choice: BindingChoice, sheetsPerSignature: number) {
  if (choice === "none") return { binding: "none" as const, sheetsPerSignature: 0 };
  if (choice === "perfect") return { binding: "perfect" as const, sheetsPerSignature: 0 };
  if (choice === "draft") return { binding: "draft" as const, sheetsPerSignature: 0 };
  return { binding: "saddle" as const, sheetsPerSignature };
}

const ASSEMBLY: Record<BindingChoice, string[]> = {
  saddle: [
    "Print double-sided on the chosen paper, landscape.",
    "Stack the sheets in printed order, keeping them flat.",
    "Fold the whole stack once down the middle.",
    "Staple twice through the fold, then trim the fore-edge.",
  ],
  perfect: [
    "Print double-sided on the chosen paper, landscape.",
    "Cut every sheet down the middle line.",
    "Put the right-hand pile underneath the left-hand pile.",
    "Clamp the spine, roughen it, glue and let it cure.",
  ],
  draft: [
    "Print double-sided on the chosen paper, landscape.",
    "Stack the sheets in printed order — nothing is folded or cut.",
    "Drive one staple through the top corner of the stack.",
  ],
  none: [
    "Print single- or double-sided as usual.",
    "The page content is trimmed and scaled up to fill the paper.",
  ],
};

/** Everything the UI needs to know about a build, minus the bytes themselves. */
type OutputInfo = Omit<BuildResult, "bytes"> & { url: string };

/** One opened PDF. Its bytes live in a ref map keyed by id, never in state. */
interface Source {
  id: string;
  name: string;
  doc: PDFDocumentProxy;
  pageCount: number;
  /** Margin measurement, null until the background scan reaches it. */
  scan: CropScan | null;
}

/** The smallest margins of several crops: a box that cuts nothing from any of them. */
function loosest(all: Bounds[]): Bounds {
  return {
    left: Math.min(...all.map((b) => b.left)),
    top: Math.min(...all.map((b) => b.top)),
    right: Math.min(...all.map((b) => b.right)),
    bottom: Math.min(...all.map((b) => b.bottom)),
  };
}

export default function App() {
  // Several PDFs can be open at once; their kept pages are merged in list order.
  const [sources, setSources] = useState<Source[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  /** Selections of the sources that are not active, undo history included. */
  const [parked, setParked] = useState<ReadonlyMap<string, SelectionSnapshot>>(() => new Map());
  // PDF bytes live in refs, never in state or props: React's development build
  // serialises changed props onto its performance track, and a multi-megabyte
  // typed array there throws DataCloneError mid-commit.
  const sourceBytes = useRef(new Map<string, Uint8Array>());
  const merged = useRef<{ key: string; bytes: Uint8Array } | null>(null);
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;
  const nextId = useRef(0);
  const built = useRef<Uint8Array | null>(null);
  const active = sources.find((s) => s.id === activeId) ?? null;
  const doc = active?.doc ?? null;
  const pageCount = active?.pageCount ?? 0;
  const file = sources[0] ?? null;
  const [settings, setSettings] = useState<Settings>(loadSettings);
  /** Said once per launch when last time's settings were brought back. */
  const [restored, setRestored] = useState(
    () => JSON.stringify(settings) !== JSON.stringify(DEFAULTS));
  useEffect(() => store(SETTINGS_KEY, settings), [settings]);
  const [tested, setTested] = useState<ReadonlySet<string>>(loadTested);
  const markTested = useCallback((key: string) => setTested((t) => {
    const n = new Set(t); n.add(key); store(TESTED_KEY, [...n]); return n;
  }), []);
  const [assembly, setAssembly] = useState<"closed" | "open" | "printed" | "saved">("closed");
  const [pickBinding, setPickBinding] = useState(false);
  const [confirm, setConfirm] = useState<null | { action: "close" | "replace"; files?: File[] }>(null);
  const [printFailure, setPrintFailure] = useState<string | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const [crop, setCrop] = useState<Bounds>(FULL_PAGE);
  const [scanning, setScanning] = useState(0); // 0-1 progress, 0 = idle
  const [output, setOutput] = useState<OutputInfo | null>(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [printPrefs, setPrintPrefs] = useState<PrintPrefs>(DEFAULT_PRINT_PREFS);
  const [printed, setPrinted] = useState(false);
  const [side, setSide] = useState(0); // which sheet side the proof is showing
  const [view, setView] = useState<PlateView>("proof");
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [hideRemoved, setHideRemoved] = useState(false);
  const [blankScan, setBlankScan] = useState(0); // 0-1 progress, 0 = idle
  const blankAbort = useRef<AbortController | null>(null);
  const update = useUpdate();
  const buildId = useRef(0);
  const selection = usePageSelection(pageCount);

  /** What each source contributes to the job, in output order. */
  const parts = useMemo(() => sources.map((s) => ({
    source: s,
    pages: s.id === activeId
      ? selection.kept
      : keptPages(s.pageCount, (parked.get(s.id) ?? EMPTY_SNAPSHOT).removed),
  })), [sources, activeId, parked, selection.kept]);
  const totalPages = sources.reduce((n, s) => n + s.pageCount, 0);
  const totalKept = parts.reduce((n, p) => n + p.pages.length, 0);
  const multi = sources.length > 1;

  /** Margins of the job: per output page when merged, per source page otherwise. */
  const detected = useMemo<CropScan | null>(() => {
    if (sources.length === 0 || sources.some((s) => !s.scan)) return null;
    if (sources.length === 1) return sources[0]!.scan;
    return {
      perPage: parts.flatMap(({ source, pages }) =>
        pages.map((p) => source.scan!.perPage[p - 1] ?? FULL_PAGE)),
      shared: loosest(sources.map((s) => s.scan!.shared)),
    };
  }, [sources, parts]);

  const set = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
  }, []);

  /** Everything about a page selection is per-document and starts clean. */
  const resetPages = useCallback(() => {
    blankAbort.current?.abort();
    blankAbort.current = null;
    setBlankScan(0);
    setRangeError(null);
    setHideRemoved(false);
    setView("proof");
    clearThumbnails();
    selection.reset();
  }, [selection]);

  /* ── loading documents ──────────────────────────────────────────────── */
  const discardAll = useCallback(() => {
    for (const src of sourcesRef.current) closePdf(src.doc);
    sourceBytes.current.clear();
    merged.current = null;
    built.current = null;
    setOutput((old) => { if (old) URL.revokeObjectURL(old.url); return null; });
    setParked(new Map());
    resetPages();
  }, [resetPages]);

  /** Opens PDFs as sources: replacing the job, or appended to its end. */
  const openFiles = useCallback(async (files: File[], mode: "replace" | "append") => {
    const loaded: Source[] = [];
    const bytesFor = new Map<string, Uint8Array>();
    const failed: string[] = [];
    for (const f of files) {
      try {
        const bytes = new Uint8Array(await f.arrayBuffer());
        const d = await loadPdf(bytes);
        const id = `s${++nextId.current}`;
        bytesFor.set(id, bytes);
        loaded.push({ id, name: f.name, doc: d, pageCount: d.numPages, scan: null });
      } catch {
        failed.push(f.name);
      }
    }
    setError(failed.length === 0 ? null
      : files.length === 1 ? "That file could not be opened as a PDF."
      : `Could not open as a PDF: ${failed.join(", ")}.`);
    if (loaded.length === 0) return;
    // Replacing discards the old bytes, so the new ones go in only after that.
    if (mode === "replace" || sourcesRef.current.length === 0) discardAll();
    for (const [id, bytes] of bytesFor) sourceBytes.current.set(id, bytes);
    if (mode === "replace" || sourcesRef.current.length === 0) {
      setCrop(FULL_PAGE);
      setSources(loaded);
      setActiveId(loaded[0]!.id);
    } else {
      setSources((list) => [...list, ...loaded]);
    }
  }, [discardAll]);

  const closeFile = useCallback(() => {
    discardAll();
    setSources([]);
    setActiveId(null);
  }, [discardAll]);

  /** Parks the active selection and brings back the chosen source's. */
  const switchTo = useCallback((id: string, keepCurrent: boolean) => {
    blankAbort.current?.abort();
    blankAbort.current = null;
    setBlankScan(0);
    setRangeError(null);
    setHideRemoved(false);
    const current = activeId;
    const snap = selection.snapshot();
    selection.load(parked.get(id) ?? EMPTY_SNAPSHOT);
    setParked((m) => {
      const n = new Map(m);
      if (current && keepCurrent) n.set(current, snap);
      if (current && !keepCurrent) n.delete(current);
      n.delete(id);
      return n;
    });
    setActiveId(id);
  }, [activeId, parked, selection]);

  const activate = useCallback((id: string) => {
    if (id !== activeId) switchTo(id, true);
  }, [activeId, switchTo]);

  const removeSource = useCallback((id: string) => {
    const list = sourcesRef.current;
    if (list.length <= 1) { closeFile(); return; }
    const idx = list.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const rest = list.filter((s) => s.id !== id);
    if (id === activeId) switchTo(rest[Math.min(idx, rest.length - 1)]!.id, false);
    else setParked((m) => { const n = new Map(m); n.delete(id); return n; });
    closePdf(list[idx]!.doc);
    sourceBytes.current.delete(id);
    setSources(rest);
  }, [activeId, closeFile, switchTo]);

  const moveSource = useCallback((id: string, delta: -1 | 1) => {
    setSources((list) => {
      const i = list.findIndex((s) => s.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  }, []);

  /** Draws a source page for the crop preview without exposing pdf.js as a prop. */
  const renderSample = useCallback(async (canvas: HTMLCanvasElement, pageNumber: number) => {
    if (!doc) return;
    const page = await doc.getPage(Math.min(pageNumber, doc.numPages));
    await renderPage(page, canvas, 150);
    page.cleanup();
  }, [doc]);

  /** Paints one contact-sheet tile. Returns false when the work was dropped. */
  const drawThumbnail = useCallback(async (
    canvas: HTMLCanvasElement, page: number, signal: AbortSignal,
  ) => {
    if (!doc) return false;
    const bitmap = await renderThumbnail(doc, page, 160, signal);
    if (!bitmap || signal.aborted) return false;
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return false;
    ctx.drawImage(bitmap, 0, 0);
    return true;
  }, [doc]);

  /* ── page selection ─────────────────────────────────────────────────── */
  const applyRanges = useCallback((text: string) => {
    const parsed = parseRanges(text, pageCount);
    if (!parsed.ok) { setRangeError(parsed.error); return; }
    setRangeError(null);
    selection.keepOnly(parsed.pages);
  }, [pageCount, selection]);

  const removeBlanks = useCallback(async () => {
    if (!doc) return;
    blankAbort.current?.abort();
    const ac = new AbortController();
    blankAbort.current = ac;
    setRangeError(null);
    setBlankScan(0.001);
    try {
      const blank = await scanBlanks(doc, (done, total) => setBlankScan(done / total), ac.signal);
      if (ac.signal.aborted) return;
      const fresh = blank.filter((p) => !selection.removed.has(p));
      if (fresh.length === 0) selection.setNotice("No blank pages found.");
      else {
        selection.remove(fresh);
        selection.setNotice(`Removed ${fresh.length} blank page${fresh.length === 1 ? "" : "s"}.`);
      }
    } catch {
      // An aborted scan is the expected outcome of cancelling or closing.
    } finally {
      if (blankAbort.current === ac) blankAbort.current = null;
      setBlankScan(0);
    }
  }, [doc, selection]);

  const cancelBlanks = useCallback(() => {
    blankAbort.current?.abort();
    blankAbort.current = null;
    setBlankScan(0);
  }, []);

  /* ── margin detection, once per source, one source at a time ──────── */
  const pendingScan = sources.find((s) => !s.scan)?.id ?? null;
  useEffect(() => {
    const src = sourcesRef.current.find((s) => s.id === pendingScan);
    if (!src) return;
    const ac = new AbortController();
    const settle = (scan: CropScan) => setSources((list) =>
      list.map((s) => (s.id === src.id ? { ...s, scan } : s)));
    setScanning(0.001);
    scanMargins(src.doc, (done, total) => setScanning(done / total), ac.signal)
      .then((scan) => { if (!ac.signal.aborted) settle(scan); })
      // A page that will not render must not stall the queue: no trim for it.
      .catch(() => {
        if (!ac.signal.aborted) {
          settle({ perPage: Array(src.pageCount).fill(FULL_PAGE), shared: FULL_PAGE });
        }
      })
      .finally(() => !ac.signal.aborted && setScanning(0));
    return () => ac.abort();
  }, [pendingScan]);

  // The uniform crop starts from what was measured, and again when the set of
  // documents changes what that is.
  const sharedKey = detected ? JSON.stringify(detected.shared) : "";
  useEffect(() => {
    if (detected) setCrop(detected.shared);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedKey]);

  /* ── rebuild the booklet whenever anything changes ─────────────────── */
  const activeCrop = useMemo<Bounds | Bounds[] | null>(() => {
    if (!settings.cropEnabled) return null;
    if (settings.uniformCrop || !detected) return crop;
    return detected.perPage;
  }, [settings.cropEnabled, settings.uniformCrop, crop, detected]);

  useEffect(() => {
    if (parts.length === 0) return;
    const id = ++buildId.current;
    // Busy from the moment anything changes, not only once the debounce ends:
    // a print sent in between would carry the bytes of the previous settings.
    setBuilding(true);
    const timer = setTimeout(async () => {
      try {
        // One source goes in as it is; several are merged first, and the
        // merged document's every page takes part.
        let input: Uint8Array;
        let pages: number[] | null;
        if (parts.length === 1) {
          input = sourceBytes.current.get(parts[0]!.source.id)!;
          pages = parts[0]!.pages;
        } else {
          const key = parts.map((p) => `${p.source.id}:${formatRanges(p.pages)}`).join("|");
          if (merged.current?.key !== key) {
            const bytes = await mergeSources(parts.map((p) => ({
              bytes: sourceBytes.current.get(p.source.id)!, pages: p.pages,
            })));
            merged.current = { key, bytes };
          }
          if (id !== buildId.current) return;
          input = merged.current.bytes;
          pages = null;
        }
        const { bytes: outBytes, ...info } = await buildBooklet(input, {
          ...coreBinding(settings.binding, settings.sheetsPerSignature),
          paperId: settings.paperId,
          pages,
          crop: activeCrop,
          outerMargin: mm(settings.outerMargin),
          gutter: mm(settings.gutter),
          duplexFlip: settings.duplexFlip,
          rtl: settings.rtl,
          guideLine: settings.guideLine,
          cropMarks: settings.cropMarks,
        });
        if (id === buildId.current) {
          built.current = outBytes;
          const url = URL.createObjectURL(
            new Blob([outBytes as BlobPart], { type: "application/pdf" }));
          setOutput((old) => { if (old) URL.revokeObjectURL(old.url); return { ...info, url }; });
          setError(null);
        }
      } catch (e) {
        if (id === buildId.current) {
          setError(e instanceof Error ? e.message : "Could not build the booklet.");
        }
      } finally {
        if (id === buildId.current) setBuilding(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [parts, settings, activeCrop]);

  /* ── export ─────────────────────────────────────────────────────────── */
  const exportPdf = useCallback(async () => {
    const bytes = built.current;
    if (!bytes || !file) return;
    const suffix = settings.binding === "none"
      ? "trimmed"
      : settings.binding === "draft"
        ? "draft-print"
        : `${settings.binding}-booklet`;
    const base = file.name.replace(/\.pdf$/i, "");
    const name = multi
      ? `${base} + ${sources.length - 1} more — merged ${suffix} (${totalKept} pages).pdf`
      : `${base} — ${suffix}${selection.removedCount
        ? ` (${selection.keptCount} of ${pageCount} pages)` : ""}.pdf`;
    const bridge = window.desktop;
    if (bridge) {
      const ok = await bridge.savePdf(name, bytes);
      if (!ok) return;
    } else {
      const a = document.createElement("a");
      a.href = output?.url ?? "";
      a.download = name;
      a.click();
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
    // A saved booklet still has to be printed and bound: the steps follow.
    if (settings.binding !== "none") setAssembly("saved");
  }, [output, file, multi, sources.length, totalKept, settings.binding,
    selection.keptCount, selection.removedCount, pageCount]);


  /* ── printing ───────────────────────────────────────────────────────────
     The built bytes go to the printer as they are: no export, no save dialog,
     nothing left on disk. The desktop writes them to a private temporary file
     and removes it again — see electron/print.cjs. */

  /** The saved preferences, so the caption knows whether a printer is set. */
  useEffect(() => {
    const bridge = window.desktop?.print;
    if (!bridge) return;
    let stale = false;
    bridge.prefs().then((p) => { if (!stale) setPrintPrefs(p); }).catch(() => {});
    return () => { stale = true; };
  }, [printOpen]); // re-read after the panel has had a chance to save

  const sendJob = useCallback(async (options: PrintOptions): Promise<PrintResult> => {
    const bytes = built.current;
    const bridge = window.desktop?.print;
    if (!bytes) return { ok: false, reason: "There is nothing built to print yet." };
    if (!bridge) return { ok: false, reason: "Printing needs the desktop app." };
    let pages;
    try {
      pages = await rasterizeForPrint(bytes, options.pageRanges);
    } catch (e) {
      return { ok: false, reason: `The booklet could not be prepared for printing. ${(e as Error).message}` };
    }
    if (pages.length === 0) return { ok: false, reason: "The chosen pages are not in the booklet." };
    const { pageRanges: _, ...rest } = options;
    const result = await bridge.job(pages, rest);
    if (result.ok) {
      setPrinted(true);
      setTimeout(() => setPrinted(false), 2200);
      // The whole job is out: what comes next is folding, cutting and binding,
      // so the steps stay on screen until they are dismissed.
      if (!options.pageRanges || options.pageRanges.length === 0) setAssembly("printed");
    }
    return result;
  }, []);

  /** Without the desktop bridge there is no panel — the browser's dialog does it. */
  const printInBrowser = useCallback(() => {
    const url = output?.url;
    if (!url) return;
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    frame.src = url;
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        window.open(url, "_blank"); // some browsers will not print a framed PDF
      }
      // Long enough for the dialog to have taken the document from the frame.
      setTimeout(() => frame.remove(), 60_000);
    };
    document.body.appendChild(frame);
  }, [output]);

  const openPrint = useCallback(() => {
    if (!built.current) return;
    if (!window.desktop?.print) { printInBrowser(); setAssembly("printed"); return; }
    setPrintFailure(null);
    setPrintOpen(true);
  }, [printInBrowser]);

  /** One click from the caption: the sheet on show, both its sides. */
  const printCurrentSheet = useCallback(async () => {
    const bridge = window.desktop?.print;
    // No printer chosen yet, so there is nothing to print silently with: the
    // first print is always a deliberate one.
    if (!bridge || !printPrefs.deviceName) { openPrint(); return; }
    const twoUp = settings.binding !== "none";
    // Printing silently with a flip nobody has checked is how a stack of
    // upside-down backs happens; the panel walks through the test instead.
    if (twoUp && !tested.has(testKey(printPrefs.deviceName, settings.duplexFlip))) {
      openPrint(); return;
    }
    const sheet = twoUp ? Math.floor(side / 2) + 1 : side + 1;
    const result = await sendJob({
      ...printPrefs,
      duplex: twoUp ? (settings.duplexFlip === "short" ? "shortEdge" : "longEdge") : printPrefs.duplex,
      pageRanges: sheetsToPageRanges([sheet], twoUp),
      silent: true,
    });
    // A printer that has gone away is worth saying out loud, and the panel is
    // where it gets fixed.
    if (!result.ok && !result.cancelled) {
      setPrintFailure(result.reason ?? "The sheet could not be printed.");
      setPrintOpen(true);
    }
  }, [printPrefs, settings.binding, settings.duplexFlip, tested, side, sendJob, openPrint]);

  /* ── leaving a job ─────────────────────────────────────────────────────
     Close and Replace drop every page choice, crop and merged source. That
     is only asked about when there is something to lose. */
  const hasWork = multi || selection.removedCount > 0 || settings.cropEnabled;

  const requestClose = useCallback(() => {
    if (hasWork) setConfirm({ action: "close" }); else closeFile();
  }, [hasWork, closeFile]);

  const requestReplace = useCallback((fs: File[]) => {
    if (fs.length === 0) return;
    if (hasWork) setConfirm({ action: "replace", files: fs }); else openFiles(fs, "replace");
  }, [hasWork, openFiles]);

  const confirmLeave = useCallback(() => {
    const c = confirm;
    setConfirm(null);
    if (!c) return;
    if (c.action === "close") closeFile();
    else if (c.files) openFiles(c.files, "replace");
  }, [confirm, closeFile, openFiles]);

  /* Ctrl/Cmd+P opens the panel rather than the browser's own print. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "p" && e.key !== "P") return;
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      e.preventDefault();
      if (file) openPrint();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [file, openPrint]);

  /* The File → Print… menu item arrives here. */
  useEffect(() => window.desktop?.print?.onOpen(() => { if (file) openPrint(); }), [file, openPrint]);

  const sheets = totalKept ? sheetsFor(totalKept) : 0;
  const sourceRows = useMemo<SourceRow[]>(() => parts.map(({ source, pages }) => ({
    id: source.id, name: source.name, pageCount: source.pageCount,
    keptCount: pages.length, ranges: formatRanges(pages),
  })), [parts]);
  const jobPages = totalKept === totalPages
    ? `${totalPages} pages`
    : `${totalKept} of ${totalPages} pages · ${totalPages - totalKept} removed`;
  const keptRanges = useMemo(
    () => formatRanges(selection.kept),
    [selection.kept],
  );
  // Everything except margins-only puts two source pages on a sheet side, and
  // that — not whether the job is a book — is what these controls depend on.
  const isTwoUp = settings.binding !== "none";

  // With a printer to hand, printing is where the job ends; the browser build
  // can only hand a file over, so there exporting is.
  const printFirst = Boolean(window.desktop?.print);
  const flipTested = Boolean(printPrefs.deviceName)
    && tested.has(testKey(printPrefs.deviceName!, settings.duplexFlip));

  if (!file) {
    return <Landing onFiles={(fs) => openFiles(fs, "replace")} error={error} update={update}
      binding={settings.binding} onBinding={(b) => set("binding", b)} />;
  }

  const chosen = BINDINGS.find((b) => b.id === settings.binding)!;

  return (
    <div className="app">
      <header className="masthead">
        <Wordmark />
        <span className="folio-line">
          <strong>{multi ? `${file.name} + ${sources.length - 1} more` : file.name}</strong>
          <span className="rule-v" />
          <span>{jobPages}</span>
        </span>
        <div className="spacer" />
        <button type="button" className="btn ghost sm" onClick={requestClose}>Close</button>
        <button type="button" className="btn sm" onClick={() => replaceInput.current?.click()}>
          Replace…
        </button>
        <input ref={replaceInput} type="file" name="replace-pdf" accept="application/pdf,.pdf" multiple hidden
          tabIndex={-1} aria-hidden="true"
          onChange={(e) => {
            requestReplace([...(e.target.files ?? [])]);
            e.target.value = "";
          }} />
        <span className="rule-v tall" aria-hidden="true" />
        <button className={printFirst ? "btn" : "btn primary"} onClick={exportPdf}
          disabled={!output || building}>
          {saved ? "Saved ✓" : "Export PDF"}
        </button>
        <button className={printFirst ? "btn primary" : "btn"} onClick={openPrint}
          disabled={!output || building} title="Print the booklet (Ctrl+P)">
          {printed ? "Sent ✓" : printFirst ? "Print booklet…" : "Print"}
        </button>
      </header>
      <UpdateBar {...update} />

      <div className="body">
        <aside className="column">
          <div className="alert-slot" role="alert">
            {error && <div className="error">{error}</div>}
          </div>
          {restored && (
            <div className="restored" role="status">
              <span>Using your last settings.</span>
              <button type="button" className="link-btn"
                onClick={() => { setSettings(DEFAULTS); setCrop(detected?.shared ?? FULL_PAGE); setRestored(false); }}>
                Reset to defaults
              </button>
              <button type="button" className="link-btn" onClick={() => setRestored(false)}
                aria-label="Keep these settings">Keep</button>
            </div>
          )}

          <section className="section">
            <h2><span className="step">01</span>Binding</h2>
            {pickBinding ? (
              <BindingPicker value={settings.binding}
                onChange={(b) => { set("binding", b); setPickBinding(false); }} />
            ) : (
              <div className="chosen">
                <figure><chosen.Diagram /></figure>
                <span>
                  <span className="title">{chosen.title}</span>
                  <span className="desc">{chosen.desc}</span>
                </span>
                <button type="button" className="btn ghost sm" onClick={() => setPickBinding(true)}
                  aria-label={`Change binding, now ${chosen.title}`}>
                  Change
                </button>
              </div>
            )}
          </section>

          <section className="section">
            <h2><span className="step">02</span>Pages</h2>
            <SourcesPanel rows={sourceRows} activeId={activeId} onActivate={activate}
              onMove={moveSource} onRemove={removeSource}
              onAdd={(fs) => { if (fs.length) openFiles(fs, "append"); }} />
            {multi && active && <p className="folio-line">Choosing pages from {active.name}</p>}
            <PagesPanel
              pageCount={pageCount}
              keptCount={selection.keptCount}
              removedCount={selection.removedCount}
              ranges={keptRanges}
              invalid={rangeError}
              notice={selection.notice}
              canUndo={selection.canUndo}
              scanning={blankScan}
              onApply={applyRanges}
              onRemoveBlanks={removeBlanks}
              onCancelScan={cancelBlanks}
              onInvert={selection.invert}
              onRestoreAll={selection.restoreAll}
              onUndo={selection.undo}
              onOpenGrid={() => setView("pages")}
            />
          </section>

          <section className="section">
            <h2><span className="step">03</span>Layout</h2>
            <Field label="Sheet size"
              hint={isTwoUp ? "Sheets print landscape, two pages per side." : undefined}>
              <Select value={settings.paperId} onChange={(v) => set("paperId", v)}
                options={[...PAPER_SIZES.map((p) => ({ value: p.id, label: p.label })),
                  { value: "source", label: "Match the source pages" }]} />
            </Field>
            <Field label="Outer margin" value={`${settings.outerMargin} mm`}>
              <Slider min={0} max={25} value={settings.outerMargin}
                onChange={(v) => set("outerMargin", v)} />
            </Field>
            {isTwoUp && (
              <Field label="Spine gutter" value={`${settings.gutter} mm`}
                hint="Room for the fold or the glue, split between the two pages.">
                <Slider min={0} max={40} value={settings.gutter} onChange={(v) => set("gutter", v)} />
              </Field>
            )}
            {settings.binding === "saddle" && (
              <Field label="Booklets of"
                value={settings.sheetsPerSignature === 0 ? "all sheets" : `${settings.sheetsPerSignature} sheets`}
                hint="Thick books fold badly. Split them into smaller folded booklets (signatures), then bind those together.">
                <Slider min={0} max={12} value={settings.sheetsPerSignature}
                  onChange={(v) => set("sheetsPerSignature", v)} />
              </Field>
            )}
            {isTwoUp && (
              <Field label="">
                <Switch label="Right-to-left" sub="Arabic, Hebrew, Japanese"
                  checked={settings.rtl} onChange={(v) => set("rtl", v)} />
              </Field>
            )}
          </section>

          <section className="section">
            <h2><span className="step">04</span>Margins</h2>
            <Field label="">
              <Switch label="Trim white margins"
                sub={scanning ? "Measuring content…" : detected ? "Content measured automatically" : "Detects the printed area"}
                checked={settings.cropEnabled} onChange={(v) => set("cropEnabled", v)} />
            </Field>
            {scanning > 0 && (
              <div className="progress" style={{ marginBottom: 18 }}>
                <i style={{ width: `${Math.round(scanning * 100)}%` }} />
              </div>
            )}
            {settings.cropEnabled && (
              <>
                <Field label="">
                  <Switch label="Same crop for every page"
                    sub={settings.uniformCrop ? "One box, safest for books" : "Each page trimmed on its own"}
                    checked={settings.uniformCrop} onChange={(v) => set("uniformCrop", v)}
                    disabled={!detected} />
                </Field>
                {settings.uniformCrop && (
                  <CropPanel renderSample={renderSample} pageNumber={Math.min(2, pageCount)} crop={crop}
                    detected={detected?.shared ?? null} onChange={setCrop}
                    onReset={() => setCrop(detected?.shared ?? FULL_PAGE)} />
                )}
              </>
            )}
          </section>

          {isTwoUp && (
            <section className="section">
              <h2><span className="step">05</span>Sheet</h2>
              {printFirst ? (
                // On the desktop the test sheet owns the flip: here it is only reported.
                <Field label="Paper turns over on">
                  <button type="button" className="flip-status" onClick={openPrint}
                    disabled={!output || building}>
                    <span>{settings.duplexFlip === "short" ? "Short edge" : "Long edge"}</span>
                    <span className={flipTested ? "badge ok" : "badge"}>
                      {flipTested ? "Tested ✓" : "Not tested"}
                    </span>
                    <span className="flip-go">{flipTested ? "Change in Print" : "Test in Print"} →</span>
                  </button>
                </Field>
              ) : (
                <Field label="Paper turns over on"
                  hint="Match your printer's double-sided setting. If backs come out upside down, switch this.">
                  <Segmented label="Paper turns over on" value={settings.duplexFlip}
                    onChange={(v) => set("duplexFlip", v)}
                    options={[
                      { value: "short", label: "Short edge" },
                      { value: "long", label: "Long edge" },
                    ]} />
                </Field>
              )}
              {/* A draft is neither folded nor cut, so there is no guide to draw. */}
              {settings.binding !== "draft" && (
                <Field label="">
                  <Switch label={settings.binding === "perfect" ? "Cut line" : "Fold line"}
                    sub="Dashed guide down the middle of the sheet"
                    checked={settings.guideLine} onChange={(v) => set("guideLine", v)} />
                </Field>
              )}
              <Field label="">
                <Switch label="Trim marks" sub="Corner marks for cutting the fore-edge"
                  checked={settings.cropMarks} onChange={(v) => set("cropMarks", v)} />
              </Field>
            </section>
          )}
        </aside>

        <main>
          <Preview src={output?.url ?? null} layout={output?.layout ?? []}
            binding={settings.binding} busy={building} sheetCount={output?.sheets ?? sheets}
            view={view} onView={setView} index={side} onIndex={setSide}
            canPrint={Boolean(window.desktop?.print) && Boolean(output) && !building}
            printerName={printPrefs.deviceName}
            onPrintSheet={printCurrentSheet}
            pages={
              <div className="contact">
                <div className="contact-bar">
                  <span className="folio-line">
                    {multi && active ? `${active.name} · ` : ""}
                    {selection.removedCount
                      ? `${selection.keptCount} of ${pageCount} pages kept`
                      : `${pageCount} pages`}
                  </span>
                  <div className="spacer" />
                  {selection.removedCount > 0 && (
                    <button type="button" className="btn sm ghost"
                      aria-pressed={hideRemoved}
                      onClick={() => setHideRemoved((v) => !v)}>
                      {hideRemoved ? "Show removed" : "Hide removed"}
                    </button>
                  )}
                  <button type="button" className="btn sm ghost" onClick={selection.undo}
                    disabled={!selection.canUndo}>Undo</button>
                </div>
                <PageGrid pageCount={pageCount} removed={selection.removed}
                  hidden={hideRemoved} onToggle={selection.toggle}
                  onRemove={selection.remove} onRestore={selection.restore}
                  drawThumbnail={drawThumbnail} />
              </div>
            } />
          {assembly !== "closed" && (
            <Assembly binding={settings.binding} title={chosen.title}
              sheets={output?.sheets ?? sheets}
              done={assembly === "printed" || assembly === "saved" ? assembly : null}
              onClose={() => setAssembly("closed")} />
          )}
          <div className="colophon">
            <button type="button" className="stat stat-action"
              aria-expanded={assembly !== "closed"} aria-controls="assembly"
              onClick={() => setAssembly((a) => (a === "closed" ? "open" : "closed"))}>
              <span className="k">Next</span>
              <span className="v">How to assemble <span aria-hidden="true">→</span></span>
            </button>
            <Stat k={multi ? `Sources · ${sources.length} files` : "Source"}
              v={totalKept === totalPages ? `${totalPages} pages` : `${totalKept} of ${totalPages} pages`} />
            {isTwoUp ? (
              <>
                <Stat k="Sheets of paper" v={`${output?.sheets ?? sheets}`} />
                <Stat k="Printed sides" v={`${output?.pages ?? sheets * 2}`} />
                <Stat k="Blank pages added" v={`${output?.blanks ?? blankCount(totalKept)}`} />
                <Stat k="Turns over on" v={settings.duplexFlip === "short" ? "Short edge" : "Long edge"} />
              </>
            ) : (
              <Stat k="Output pages" v={`${output?.pages ?? totalKept}`} />
            )}
            {settings.cropEnabled && (
              <Stat k="Trimmed" v={settings.uniformCrop
                ? `${Math.round((crop.left + crop.right) * 100)}% wide, ${Math.round((crop.top + crop.bottom) * 100)}% tall`
                : "per page"} />
            )}
            <div className="spacer" />
            <span key={printed ? "p" : saved ? "s" : "i"} role="status"
              className={printed || saved ? "stamp fresh" : "stamp idle"}>
              {printed ? "Sent to press" : saved ? "Saved" : "Proof"}
            </span>
          </div>
        </main>
      </div>

      {printOpen && (
        <PrintPanel
          twoUp={isTwoUp}
          sheetCount={isTwoUp
            ? (output?.sheets ?? sheets)
            : (output?.pages ?? totalKept)}
          currentSheet={isTwoUp ? Math.floor(side / 2) + 1 : side + 1}
          flip={settings.duplexFlip}
          onFlip={(f) => set("duplexFlip", f)}
          building={building}
          tested={tested}
          onTested={markTested}
          initialFailure={printFailure}
          onClose={() => setPrintOpen(false)}
          onPrint={sendJob} />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.action === "close" ? "Close this job?" : "Replace this job?"}
          body={`Your page choices${settings.cropEnabled ? ", trim" : ""}${multi ? " and the other merged files" : ""} will be dropped. The PDF on disk is not touched.`}
          confirmLabel={confirm.action === "close" ? "Close job" : "Replace"}
          onConfirm={confirmLeave}
          onCancel={() => setConfirm(null)} />
      )}
    </div>
  );
}

/** The four methods as a radio group: arrow keys move, the choice follows focus. */
function BindingPicker({ value, onChange, variant = "list" }: {
  value: BindingChoice; onChange: (b: BindingChoice) => void; variant?: "list" | "directory";
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const at = BINDINGS.findIndex((b) => b.id === value);
  useEffect(() => { if (variant === "list") refs.current[at]?.focus(); }, []); // opened to choose
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1
      : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const j = (i + d + BINDINGS.length) % BINDINGS.length;
    refs.current[j]?.focus();
    onChange(BINDINGS[j]!.id);
  };
  return (
    <div className={variant === "list" ? "cards" : "directory"} role="radiogroup"
      aria-label="Binding">
      {BINDINGS.map(({ id, title, desc, Diagram }, i) => (
        <button key={id} ref={(el) => { refs.current[i] = el; }} type="button"
          className={variant === "list" ? "card" : "directory-cell"}
          role="radio" aria-checked={value === id} tabIndex={value === id ? 0 : -1}
          onKeyDown={(e) => onKey(e, i)}
          onClick={() => onChange(id)}>
          {variant === "list" ? (
            <>
              <figure><Diagram /></figure>
              <span>
                <span className="title">{title}</span>
                <span className="desc">{desc}</span>
              </span>
            </>
          ) : (
            <>
              <Diagram width={96} height={64} />
              <span className="name">{title}</span>
              <span className="what">{desc}</span>
              {id === "saddle" && <span className="tip">Good first choice for up to about 60 pages</span>}
            </>
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * What to do with the paper once it is printed. Opened from the colophon at
 * any time, and on its own after a whole job has gone to the printer — the
 * point where the reader needs it most.
 */
function Assembly({ binding, title, sheets, done, onClose }: {
  binding: BindingChoice; title: string; sheets: number;
  done: "printed" | "saved" | null; onClose: () => void;
}) {
  const plural = `${sheets} sheet${sheets === 1 ? "" : "s"}`;
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => { head.current?.focus(); }, []);
  return (
    <aside className="assembly" id="assembly" aria-labelledby="assembly-title">
      <header>
        <p className="assembly-status">
          {done === "printed" ? `Sent to the printer · ${plural}`
            : done === "saved" ? `Saved · ${plural}` : title}
        </p>
        <button type="button" className="btn ghost sm" onClick={onClose}>Done</button>
      </header>
      <h2 id="assembly-title" ref={head} tabIndex={-1}>
        {done === "printed" ? <>Now, <em>bind it</em></>
          : done === "saved" ? <>Then, <em>bind it</em></> : "How to assemble"}
      </h2>
      <ol>
        {ASSEMBLY[binding].map((s) => <li key={s}>{s}</li>)}
      </ol>
    </aside>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return <div className="stat"><span className="k">{k}</span><span className="v">{v}</span></div>;
}

/**
 * The cover: a display headline and standfirst on the left, the dropzone as a
 * plate on the right, and the four methods below as a directory of hairline
 * cells — the reference magazine's directory spread.
 */
function Landing({ onFiles, error, update, binding, onBinding }: {
  onFiles: (files: File[]) => void;
  error: string | null;
  update: ReturnType<typeof useUpdate>;
  binding: BindingChoice;
  onBinding: (b: BindingChoice) => void;
}) {
  return (
    <div className="app cover-app">
      <header className="masthead">
        <Wordmark />
        <div className="spacer" />
        <span className="folio-line">Your PDF never leaves this machine</span>
      </header>
      <UpdateBar {...update} />

      <div className="cover">
        <div className="cover-inner">
          <div className="spread">
            <div>
              <h1>Turn any PDF<br />into a <em>booklet</em></h1>
              <p className="standfirst">
                Reorder pages for stitched or perfect binding, print a two-up draft
                to read, trim dead margins so the text prints larger, and check every
                sheet before you print.
              </p>
            </div>
            <div>
              <Dropzone onFiles={onFiles} />
              <div role="alert" aria-live="assertive">
                {error && <div className="error">{error}</div>}
              </div>
            </div>
          </div>

          <div className="directory-head">
            <h2>What are you making?</h2>
            <p>Pick one now or later — you can change it at any time</p>
          </div>
          <BindingPicker variant="directory" value={binding} onChange={onBinding} />
        </div>
      </div>
    </div>
  );
}

function Wordmark() {
  return (
    <span className="wordmark">
      <Logo /> Perfect Binding
    </span>
  );
}

/** A folded signature seen end-on, with the spine marked in the spot colour. */
function Logo() {
  return (
    <svg width="22" height="18" viewBox="0 0 22 18" fill="none" aria-hidden="true">
      <path d="M11 3.4C8.6 1.6 4.8 1.2 1.2 2v13.4c3.6-.8 7.4-.4 9.8 1.4 2.4-1.8 6.2-2.2 9.8-1.4V2c-3.6-.8-7.4-.4-9.8 1.4Z"
        stroke="var(--ink)" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M11 3.4v13.4" stroke="var(--spot)" strokeWidth="1.6" />
    </svg>
  );
}
