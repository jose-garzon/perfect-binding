/* One drawing system for all five figures: a binding is shown end-on, as the
   cross-section you would see looking down the spine, on a shared 76×56 stage.
   Paper is a filled surface with a hairline edge, the outermost sheet carries
   the darker stroke, and the spot colour is spent on one thing only — whatever
   actually holds the book together (staples, glue, the trim). The draft print
   is the exception: it has no spine to look down, so it is drawn face-on. */

interface Props { width?: number; height?: number }

const ink = "var(--ink-2)";
const faint = "var(--rule-strong)";
const accent = "var(--spot)";
const paper = "var(--surface)";

const HAIR = 1.15;

function Stage({ width = 76, height = 56, children }: Props & { children: React.ReactNode }) {
  return (
    <svg width={width} height={height} viewBox="0 0 76 56" fill="none" aria-hidden="true"
      strokeLinecap="round" strokeLinejoin="round">
      {children}
      {/* the press bed every figure rests on */}
      <line x1="8" y1="52" x2="68" y2="52" stroke={faint} strokeWidth=".8" opacity=".55" />
    </svg>
  );
}

/** One folded sheet seen end-on: two leaves meeting at the fold on the left. */
function foldedSheet(fold: number, top: number, bottom: number, right: number) {
  const mid = (top + bottom) / 2;
  return `M${right} ${top}
          L${fold + 7} ${top + 1}
          Q ${fold} ${mid}, ${fold + 7} ${bottom - 1}
          L${right} ${bottom}`;
}

/** Nested folded sheets, stapled through the common fold. */
export function SaddleDiagram(props: Props) {
  return (
    <Stage {...props}>
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={foldedSheet(14 + i * 2.5, 9 + i * 4.5, 47 - i * 4.5, 66 - i * 3.5)}
          fill={i === 0 ? paper : "none"}
          stroke={i === 0 ? ink : faint}
          strokeWidth={HAIR}
        />
      ))}
      {/* staples driven through every fold at once */}
      {[21, 28, 35].map((y) => (
        <rect key={y} x="14.8" y={y} width="6" height="2.8" rx="1.4" fill={accent} />
      ))}
    </Stage>
  );
}

/**
 * The one figure that is not a cross-section: a draft has no spine to look down.
 * Flat sheets, two pages to a side, held by a single staple in the top corner.
 */
export function DraftDiagram(props: Props) {
  return (
    <Stage {...props}>
      {[2, 1, 0].map((i) => (
        <rect
          key={i}
          x={12 + i * 2.5} y={8 + i * 3} width="48" height="32" rx="1"
          fill={paper}
          stroke={i === 0 ? ink : faint}
          strokeWidth={HAIR}
        />
      ))}
      {/* the two pages sharing the top sheet */}
      <line x1="36" y1="12" x2="36" y2="36" stroke={faint} strokeWidth=".8" opacity=".7" />
      {[0, 1, 2].map((i) => (
        <g key={i} stroke={ink} strokeWidth="1.5" opacity=".45">
          <line x1="18" y1={20 + i * 5} x2={i === 2 ? 27 : 32} y2={20 + i * 5} />
          <line x1="40" y1={20 + i * 5} x2={i === 2 ? 49 : 54} y2={20 + i * 5} />
        </g>
      ))}
      {/* the one staple, driven through every sheet at the corner */}
      <rect x="13" y="12" width="8" height="2.6" rx="1.3" fill={accent}
        transform="rotate(-45 17 13.3)" />
    </Stage>
  );
}

/** Loose leaves, milled flat and glued into a wrap-around cover. */
export function PerfectDiagram(props: Props) {
  return (
    <Stage {...props}>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <line
          key={i}
          x1="19" y1={11 + i * 5} x2={i % 2 ? 62 : 65} y2={11 + i * 5}
          stroke={faint} strokeWidth="1.4"
        />
      ))}
      {/* the glue slab: what turns the loose leaves into a block */}
      <path d="M18 9 L18 47" stroke={accent} strokeWidth="3.4" opacity=".9" />
      {/* the cover, wrapped around that slab */}
      <path d="M66 6 L21 6 C 13 6, 13 50, 21 50 L66 50" stroke={ink} strokeWidth={HAIR} fill="none" />
    </Stage>
  );
}

/** A page whose dead margin is trimmed away so the text prints larger. */
export function MarginsDiagram(props: Props) {
  return (
    <Stage {...props}>
      <rect x="15" y="5" width="46" height="42" rx="1"
        fill={paper} stroke={faint} strokeWidth={HAIR} />
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1="25" y1={16 + i * 5} x2={i === 4 ? 40 : 51} y2={16 + i * 5}
          stroke={ink} strokeWidth="1.8" opacity=".7" />
      ))}
      {/* trim marks: where the margin gets cut off */}
      <g stroke={accent} strokeWidth="1.3">
        <path d="M22 9 L22 13 M22 9 L26 9" />
        <path d="M54 9 L54 13 M54 9 L50 9" />
        <path d="M22 43 L22 39 M22 43 L26 43" />
        <path d="M54 43 L54 39 M54 43 L50 43" />
      </g>
    </Stage>
  );
}

/** How the printed sheet is folded, cut, or stapled, shown next to the preview. */
export function SheetDiagram({ binding }: { binding: "saddle" | "perfect" | "draft" | "none" }) {
  if (binding === "none") return null;
  if (binding === "draft") return <StapleSheet />;
  const folds = binding === "saddle";
  return (
    <svg width="74" height="42" viewBox="0 0 74 42" fill="none" aria-hidden="true"
      strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3" width="64" height="26" rx="1"
        fill="var(--surface)" stroke={faint} strokeWidth={HAIR} />
      <line x1="37" y1="1" x2="37" y2="31" stroke={accent} strokeWidth="1.2"
        strokeDasharray={folds ? "4 3" : undefined} />
      {folds ? (
        /* the half that swings over onto the other */
        <g stroke={accent} strokeWidth="1.2" fill="none">
          <path d="M60 11 C 54 5, 44 5, 38 11" />
          <path d="M38 11 L42 10 M38 11 L41 14" />
        </g>
      ) : (
        <>
          <path d="M37 1 L34 5 M37 1 L40 5" stroke={accent} strokeWidth="1.2" />
          <path d="M37 27 L34 23 M37 27 L40 23" stroke={accent} strokeWidth="1.2" />
        </>
      )}
      <text x="37" y="39" fill="var(--ink-3)" fontSize="7" letterSpacing="1"
        textAnchor="middle">{folds ? "FOLD" : "CUT"}</text>
    </svg>
  );
}

/** A draft sheet: nothing to fold or cut, one staple through the corner. */
function StapleSheet() {
  return (
    <svg width="74" height="42" viewBox="0 0 74 42" fill="none" aria-hidden="true"
      strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="3" width="64" height="26" rx="1"
        fill="var(--surface)" stroke={faint} strokeWidth={HAIR} />
      <line x1="37" y1="6" x2="37" y2="26" stroke={faint} strokeWidth=".8" opacity=".7" />
      <rect x="6" y="6" width="8" height="2.6" rx="1.3" fill={accent}
        transform="rotate(-45 10 7.3)" />
      <text x="37" y="39" fill="var(--ink-3)" fontSize="7" letterSpacing="1"
        textAnchor="middle">STAPLE</text>
    </svg>
  );
}
