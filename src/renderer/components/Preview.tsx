import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { closePdf, loadPdf, renderPage } from "../lib/pdf";
import type { SheetSide } from "../../core/imposition";
import { SheetDiagram } from "./Diagrams";

/** The plate shows either the built booklet or the source document. */
export type PlateView = "proof" | "pages";

/**
 * Renders the built booklet. It takes a blob: URL rather than the PDF bytes on
 * purpose: React's development build serialises changed props for its
 * performance track, and a multi-megabyte typed array there blows up the
 * structured clone (DataCloneError) and corrupts the commit phase.
 */
export function Preview({ src, layout, binding, busy, sheetCount, view, onView, pages }: {
  src: string | null;
  layout: SheetSide[];
  binding: "saddle" | "folded" | "perfect" | "none";
  busy: boolean;
  sheetCount: number;
  /** Which of the plate's two views is on show. */
  view: PlateView;
  onView: (view: PlateView) => void;
  /** The contact sheet, supplied by the app so no pdf.js object is a prop. */
  pages: ReactNode;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(760);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!src) { setDoc(null); return; }
    let stale = false;
    let opened: PDFDocumentProxy | null = null;
    loadPdf(src).then((d) => {
      if (stale) { closePdf(d); return; }
      opened = d;
      setDoc(d);
      setIndex((i) => Math.min(i, d.numPages - 1));
    }).catch(() => setDoc(null));
    return () => { stale = true; closePdf(opened); };
  }, [src]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry!.contentRect.width - 96;
      setWidth(Math.max(280, Math.min(1080, w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (view !== "proof" || !doc || !canvas.current) return;
      const page = await doc.getPage(index + 1);
      if (cancelled || !canvas.current) return;
      const vp = page.getViewport({ scale: 1 });
      const maxByHeight = (stage.current?.clientHeight ?? 700) - 96;
      const fit = Math.min(width, (maxByHeight * vp.width) / vp.height);
      await renderPage(page, canvas.current, Math.max(240, fit));
      page.cleanup();
    })().catch((e) => console.error("preview render failed", e));
    return () => { cancelled = true; };
  }, [doc, index, width, view]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The contact sheet uses the arrow keys for its own roving focus.
      if (view !== "proof") return;
      if (e.key === "ArrowRight" || e.key === "PageDown") step(1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const total = doc?.numPages ?? 0;
  const step = (d: number) => setIndex((i) => Math.min(total - 1, Math.max(0, i + d)));
  const side = layout[index];

  const proof = view === "proof";

  return (
    <section className="preview">
      <div className={`plate${proof ? "" : " pages"}`} ref={stage}>
        {proof ? (
          <div className={`sheet${busy ? "" : " turning"}`} key={index}>
            <canvas ref={canvas} />
            {binding !== "perfect" && binding !== "none" && <span className="fold" />}
          </div>
        ) : pages}
      </div>

      <div className="caption">
        <div className="view-switch" role="group" aria-label="Plate view">
          <button type="button" aria-pressed={proof} onClick={() => onView("proof")}>Proof</button>
          <button type="button" aria-pressed={!proof} onClick={() => onView("pages")}>Pages</button>
        </div>
        {proof ? (
          <>
            <div className="nav">
              <button className="btn icon" onClick={() => step(-1)} disabled={index === 0}
                aria-label="Previous sheet side">‹</button>
              <button className="btn icon" onClick={() => step(1)} disabled={index >= total - 1}
                aria-label="Next sheet side">›</button>
            </div>
            <div className="sheet-label">
              {binding === "none"
                ? <>Page {index + 1} <span>of {total}</span></>
                : side
                  ? <>Sheet {side.sheet + 1} <span>of {sheetCount} · {side.side}
                      {side.rotate180 ? " · rotated" : ""}</span></>
                  : <>Side {index + 1} <span>of {total}</span></>}
            </div>
          </>
        ) : (
          <div className="sheet-label">Source pages <span>click to remove, shift-click a run</span></div>
        )}
        <div className="spacer" />
        {busy && <span className="busy"><i className="spinner" />Rebuilding…</span>}
        {proof && <SheetDiagram binding={binding} />}
      </div>
    </section>
  );
}
