import { useEffect, useRef } from "react";
import type { Bounds } from "../../core/crop";
import { Field, Slider } from "./Controls";

const EDGES: Array<[keyof Bounds, string]> = [
  ["top", "Top"], ["bottom", "Bottom"], ["left", "Left"], ["right", "Right"],
];

/** Live crop overlay on a sample page, plus per-edge fine tuning. */
export function CropPanel({ renderSample, pageNumber, crop, onChange, onReset, detected }: {
  /** Draws the sample page. Kept as a callback so no pdf.js object is a prop. */
  renderSample: (canvas: HTMLCanvasElement, pageNumber: number) => Promise<void>;
  pageNumber: number;
  crop: Bounds;
  onChange: (b: Bounds) => void;
  onReset: () => void;
  detected: Bounds | null;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!canvas.current) return;
      await renderSample(canvas.current, pageNumber);
      if (cancelled) return;
    })().catch((e) => console.error("crop preview render failed", e));
    return () => { cancelled = true; };
  }, [renderSample, pageNumber]);

  const box = {
    left: `${crop.left * 100}%`,
    top: `${crop.top * 100}%`,
    right: `${crop.right * 100}%`,
    bottom: `${crop.bottom * 100}%`,
  };

  return (
    <>
      <div className="crop-preview">
        <div style={{ position: "relative", lineHeight: 0 }}>
          <canvas ref={canvas} />
          <div className="crop-box" style={box} />
        </div>
      </div>
      <p className="hint" style={{ marginBottom: 12 }}>
        {detected
          ? "Detected content is boxed in green. Nudge any edge if it clips something."
          : "Set each edge by hand."}
      </p>
      <div className="mini-grid">
        {EDGES.map(([key, label]) => (
          <Field key={key} label={label} value={`${(crop[key] * 100).toFixed(1)}%`}>
            <Slider min={0} max={45} step={0.5} value={Number((crop[key] * 100).toFixed(1))}
              onChange={(v) => onChange({ ...crop, [key]: v / 100 })} />
          </Field>
        ))}
      </div>
      <button className="btn sm ghost" type="button" onClick={onReset}
        style={{ marginTop: 4, paddingLeft: 0 }}>
        {detected ? "Reset to detected" : "Clear"}
      </button>
    </>
  );
}
