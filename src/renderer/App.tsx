import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { buildBooklet, type BuildResult } from "../core/build";
import { PAPER_SIZES, mm } from "../core/paper";
import { sheetCount as sheetsFor, blankCount } from "../core/imposition";
import { FULL_PAGE, type Bounds } from "../core/crop";
import { closePdf, loadPdf, renderPage, scanMargins } from "./lib/pdf";
import { Dropzone } from "./components/Dropzone";
import { Preview } from "./components/Preview";
import { CropPanel } from "./components/CropPanel";
import { Field, Segmented, Select, Slider, Switch } from "./components/Controls";
import {
  FoldedDiagram, MarginsDiagram, PerfectDiagram, SaddleDiagram,
} from "./components/Diagrams";

/**
 * "folded" is a saddle imposition with exactly one sheet per signature: every
 * sheet is folded on its own, the folded sheets are stacked, and the spine is
 * glued rather than stapled.
 */
type BindingChoice = "saddle" | "folded" | "perfect" | "none";

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

const BINDINGS: Array<{
  id: BindingChoice; title: string; desc: string; Diagram: typeof SaddleDiagram;
}> = [
  {
    id: "saddle", title: "Stitched (saddle)",
    desc: "Sheets nest inside each other, fold once, staple the spine.",
    Diagram: SaddleDiagram,
  },
  {
    id: "folded", title: "Folded & glued",
    desc: "Fold every sheet on its own, stack the folded sheets, glue the spine.",
    Diagram: FoldedDiagram,
  },
  {
    id: "perfect", title: "Perfect binding",
    desc: "Print flat, cut down the middle, stack the piles, glue the spine.",
    Diagram: PerfectDiagram,
  },
  {
    id: "none", title: "Margins only",
    desc: "No reordering — just trim whitespace so the text prints larger.",
    Diagram: MarginsDiagram,
  },
];

/** Maps a UI choice onto the core imposition options. */
function coreBinding(choice: BindingChoice, sheetsPerSignature: number) {
  if (choice === "none") return { binding: "none" as const, sheetsPerSignature: 0 };
  if (choice === "perfect") return { binding: "perfect" as const, sheetsPerSignature: 0 };
  return {
    binding: "saddle" as const,
    sheetsPerSignature: choice === "folded" ? 1 : sheetsPerSignature,
  };
}

const ASSEMBLY: Record<BindingChoice, string[]> = {
  saddle: [
    "Print double-sided on the chosen paper, landscape.",
    "Stack the sheets in printed order, keeping them flat.",
    "Fold the whole stack once down the middle.",
    "Staple twice through the fold, then trim the fore-edge.",
  ],
  folded: [
    "Print double-sided on the chosen paper, landscape.",
    "Fold each sheet in half on its own — no nesting.",
    "Stack the folded sheets in printed order, folds all on the same side.",
    "Clamp the folded spine, glue it, and let it cure before trimming.",
  ],
  perfect: [
    "Print double-sided on the chosen paper, landscape.",
    "Cut every sheet down the middle line.",
    "Put the right-hand pile underneath the left-hand pile.",
    "Clamp the spine, roughen it, glue and let it cure.",
  ],
  none: [
    "Print single- or double-sided as usual.",
    "The page content is trimmed and scaled up to fill the paper.",
  ],
};

/** Everything the UI needs to know about a build, minus the bytes themselves. */
type OutputInfo = Omit<BuildResult, "bytes"> & { url: string };

export default function App() {
  const [file, setFile] = useState<{ name: string } | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  // PDF bytes live in refs, never in state or props: React's development build
  // serialises changed props onto its performance track, and a multi-megabyte
  // typed array there throws DataCloneError mid-commit.
  const source = useRef<Uint8Array | null>(null);
  const built = useRef<Uint8Array | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [detected, setDetected] = useState<{ perPage: Bounds[]; shared: Bounds } | null>(null);
  const [crop, setCrop] = useState<Bounds>(FULL_PAGE);
  const [scanning, setScanning] = useState(0); // 0-1 progress, 0 = idle
  const [output, setOutput] = useState<OutputInfo | null>(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const buildId = useRef(0);

  const set = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
  }, []);

  /* ── loading a document ─────────────────────────────────────────────── */
  const openFile = useCallback(async (f: File) => {
    setError(null);
    setOutput((old) => { if (old) URL.revokeObjectURL(old.url); return null; });
    setDetected(null);
    setCrop(FULL_PAGE);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const d = await loadPdf(bytes);
      source.current = bytes;
      built.current = null;
      setFile({ name: f.name });
      setDoc((old) => { closePdf(old); return d; });
      setPageCount(d.numPages);
    } catch {
      setError("That file could not be opened as a PDF.");
    }
  }, []);

  const closeFile = useCallback(() => {
    source.current = null;
    built.current = null;
    setFile(null);
    setOutput((old) => { if (old) URL.revokeObjectURL(old.url); return null; });
    setDoc((old) => { closePdf(old); return null; });
    setPageCount(0);
  }, []);

  /** Draws a source page for the crop preview without exposing pdf.js as a prop. */
  const renderSample = useCallback(async (canvas: HTMLCanvasElement, pageNumber: number) => {
    if (!doc) return;
    const page = await doc.getPage(Math.min(pageNumber, doc.numPages));
    await renderPage(page, canvas, 150);
    page.cleanup();
  }, [doc]);

  /* ── margin detection, once per document ───────────────────────────── */
  useEffect(() => {
    if (!doc) return;
    const ac = new AbortController();
    setScanning(0.001);
    scanMargins(doc, (done, total) => setScanning(done / total), ac.signal)
      .then((scan) => {
        if (ac.signal.aborted) return;
        setDetected(scan);
        setCrop(scan.shared);
      })
      .catch(() => {})
      .finally(() => !ac.signal.aborted && setScanning(0));
    return () => ac.abort();
  }, [doc]);

  /* ── rebuild the booklet whenever anything changes ─────────────────── */
  const activeCrop = useMemo<Bounds | Bounds[] | null>(() => {
    if (!settings.cropEnabled) return null;
    if (settings.uniformCrop || !detected) return crop;
    return detected.perPage;
  }, [settings.cropEnabled, settings.uniformCrop, crop, detected]);

  useEffect(() => {
    const bytes = source.current;
    if (!file || !bytes) return;
    const id = ++buildId.current;
    const timer = setTimeout(async () => {
      setBuilding(true);
      try {
        const { bytes: outBytes, ...info } = await buildBooklet(bytes, {
          ...coreBinding(settings.binding, settings.sheetsPerSignature),
          paperId: settings.paperId,
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
  }, [file, settings, activeCrop]);

  /* ── export ─────────────────────────────────────────────────────────── */
  const exportPdf = useCallback(async () => {
    const bytes = built.current;
    if (!bytes || !file) return;
    const suffix = settings.binding === "none" ? "trimmed" : `${settings.binding}-booklet`;
    const name = `${file.name.replace(/\.pdf$/i, "")} — ${suffix}.pdf`;
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
  }, [output, file, settings.binding]);


  const sheets = pageCount ? sheetsFor(pageCount) : 0;
  const isBooklet = settings.binding !== "none";

  if (!file) return <Landing onFile={openFile} error={error} />;

  return (
    <div className="app">
      <header className="masthead">
        <Wordmark />
        <span className="folio-line">
          <strong>{file.name}</strong>
          <span className="rule-v" />
          <span>{pageCount} pages</span>
          <button className="btn ghost sm" title="Close this file" onClick={closeFile}>
            Close
          </button>
        </span>
        <div className="spacer" />
        {/* A label wrapping a hidden input is not focusable, so the control is
            given a button's role and keyboard activation of its own. */}
        <label className="btn sm" style={{ cursor: "pointer" }} role="button" tabIndex={0}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            e.currentTarget.querySelector("input")?.click();
          }}>
          Replace
          <input type="file" accept="application/pdf,.pdf" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) openFile(f); e.target.value = ""; }} />
        </label>
        <button className="btn primary" onClick={exportPdf} disabled={!output || building}>
          {saved ? "Saved ✓" : "Export PDF"}
        </button>
      </header>

      <div className="body">
        <aside className="column">
          {error && <div className="error">{error}</div>}

          <section className="section">
            <h2><span className="step">01</span>Binding</h2>
            <div className="cards">
              {BINDINGS.map(({ id, title, desc, Diagram }) => (
                <button key={id} type="button" className="card" aria-pressed={settings.binding === id}
                  onClick={() => set("binding", id)}>
                  <figure><Diagram /></figure>
                  <span>
                    <span className="title">{title}</span>
                    <span className="desc">{desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="section">
            <h2><span className="step">02</span>Paper</h2>
            <Field label="Sheet size"
              hint={isBooklet ? "Sheets print landscape, two pages per side." : undefined}>
              <Select value={settings.paperId} onChange={(v) => set("paperId", v)}
                options={[...PAPER_SIZES.map((p) => ({ value: p.id, label: p.label })),
                  { value: "source", label: "Match the source pages" }]} />
            </Field>
            <Field label="Outer margin" value={`${settings.outerMargin} mm`}>
              <Slider min={0} max={25} value={settings.outerMargin}
                onChange={(v) => set("outerMargin", v)} />
            </Field>
            {isBooklet && (
              <Field label="Spine gutter" value={`${settings.gutter} mm`}
                hint="Room for the fold or the glue, split between the two pages.">
                <Slider min={0} max={40} value={settings.gutter} onChange={(v) => set("gutter", v)} />
              </Field>
            )}
          </section>

          <section className="section">
            <h2><span className="step">03</span>Margins</h2>
            <Field label="">
              <Switch label="Trim page margins"
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

          {isBooklet && (
            <section className="section">
              <h2><span className="step">04</span>Printing</h2>
              <Field label="Duplex flip"
                hint="If the back of a sheet comes out upside down, switch this.">
                <Segmented value={settings.duplexFlip} onChange={(v) => set("duplexFlip", v)}
                  options={[
                    { value: "short", label: "Short edge" },
                    { value: "long", label: "Long edge" },
                  ]} />
              </Field>
              {settings.binding === "folded" && (
                <p className="hint" style={{ marginBottom: 18 }}>
                  Each sheet holds 4 pages and is folded by itself, so the spine stays
                  square however long the document is.
                </p>
              )}
              {settings.binding === "saddle" && (
                <Field label="Signature size"
                  value={settings.sheetsPerSignature === 0 ? "one booklet" : `${settings.sheetsPerSignature} sheets`}
                  hint="Thick books fold badly. Split them into signatures, then bind the signatures together.">
                  <Slider min={0} max={12} value={settings.sheetsPerSignature}
                    onChange={(v) => set("sheetsPerSignature", v)} />
                </Field>
              )}
              <Field label="">
                <Switch label={settings.binding === "perfect" ? "Cut line" : "Fold line"}
                  sub="Dashed guide down the middle of the sheet"
                  checked={settings.guideLine} onChange={(v) => set("guideLine", v)} />
              </Field>
              <Field label="">
                <Switch label="Trim marks" sub="Corner marks for cutting the fore-edge"
                  checked={settings.cropMarks} onChange={(v) => set("cropMarks", v)} />
              </Field>
              <Field label="">
                <Switch label="Right-to-left" sub="Arabic, Hebrew, Japanese"
                  checked={settings.rtl} onChange={(v) => set("rtl", v)} />
              </Field>
            </section>
          )}

          <section className="section">
            <h2>How to assemble</h2>
            <ol>
              {ASSEMBLY[settings.binding].map((s) => <li key={s}>{s}</li>)}
            </ol>
          </section>
        </aside>

        <main>
          <Preview src={output?.url ?? null} layout={output?.layout ?? []}
            binding={settings.binding} busy={building} sheetCount={output?.sheets ?? sheets} />
          <div className="colophon">
            <Stat k="Source" v={`${pageCount} pages`} />
            {isBooklet ? (
              <>
                <Stat k="Sheets of paper" v={`${output?.sheets ?? sheets}`} />
                <Stat k="Printed sides" v={`${output?.pages ?? sheets * 2}`} />
                <Stat k="Blank slots" v={`${output?.blanks ?? blankCount(pageCount)}`} />
                <Stat k="Duplex" v={settings.duplexFlip === "short" ? "Flip short edge" : "Flip long edge"} />
              </>
            ) : (
              <Stat k="Output pages" v={`${output?.pages ?? pageCount}`} />
            )}
            {settings.cropEnabled && (
              <Stat k="Trimmed" v={settings.uniformCrop
                ? `${Math.round((crop.left + crop.right) * 100)}% wide, ${Math.round((crop.top + crop.bottom) * 100)}% tall`
                : "per page"} />
            )}
          </div>
        </main>
      </div>
    </div>
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
function Landing({ onFile, error }: { onFile: (f: File) => void; error: string | null }) {
  return (
    <div className="app">
      <header className="masthead">
        <Wordmark />
        <div className="spacer" />
        <span className="folio-line">Runs entirely on this machine</span>
      </header>

      <div className="cover">
        <div className="cover-inner">
          <div className="spread">
            <div>
              <p className="kicker">Booklet imposition · Margin trimming · Offline</p>
              <h1>Turn any PDF<br />into a <em>booklet</em></h1>
              <p className="standfirst">
                Reorder pages for stitched, folded, or perfect binding, trim dead
                margins so the text prints larger, and check every sheet before you
                print.
              </p>
            </div>
            <div>
              <Dropzone onFile={onFile} />
              {error && <div className="error">{error}</div>}
            </div>
          </div>

          <div className="directory-head">
            <h2>Binding directory</h2>
            <p>Four ways to turn a stack of paper into a book</p>
          </div>
          <div className="directory">
            {BINDINGS.map(({ id, title, desc, Diagram }) => (
              <div key={id}>
                <Diagram width={96} height={64} />
                <div className="name">{title}</div>
                <div className="what">{desc}</div>
              </div>
            ))}
          </div>

          <div className="cover-foot">
            <div className="imprint">
              Perfect Binding<br />
              Imposition, trimming, and a sheet-by-sheet proof<br />
              The PDF never leaves this computer
            </div>
            <div className="folio-mark" aria-hidden="true">04</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Wordmark() {
  return (
    <span className="wordmark">
      <Logo /> Perfect Binding<span className="star">*</span>
    </span>
  );
}

/** A folded signature seen end-on, with the spine marked in the spot colour. */
function Logo() {
  return (
    <svg width="22" height="18" viewBox="0 0 22 18" fill="none" aria-hidden="true">
      <path d="M11 3.4C8.6 1.6 4.8 1.2 1.2 2v13.4c3.6-.8 7.4-.4 9.8 1.4 2.4-1.8 6.2-2.2 9.8-1.4V2c-3.6-.8-7.4-.4-9.8 1.4Z"
        stroke="var(--ink)" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M11 3.4v13.4" stroke="var(--spot)" strokeWidth="1.4" />
    </svg>
  );
}
