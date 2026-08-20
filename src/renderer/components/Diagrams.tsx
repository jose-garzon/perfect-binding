interface Props { width?: number; height?: number }

const ink = "var(--ink-2)";
const faint = "var(--rule-strong)";
const accent = "var(--spot)";

/** Nested folded sheets, stapled through the spine. */
export function SaddleDiagram({ width = 76, height = 56 }: Props) {
  return (
    <svg width={width} height={height} viewBox="0 0 76 56" fill="none" aria-hidden="true">
      {[0, 1, 2].map((i) => {
        const o = i * 5;
        return (
          <path
            key={i}
            d={`M38 ${12 + o} C 30 ${6 + o}, 16 ${5 + o}, 8 ${8 + o}
                L8 ${40 - o} C 16 ${37 - o}, 30 ${38 - o}, 38 ${44 - o}
                C 46 ${38 - o}, 60 ${37 - o}, 68 ${40 - o}
                L68 ${8 + o} C 60 ${5 + o}, 46 ${6 + o}, 38 ${12 + o} Z`}
            fill="var(--surface)"
            stroke={i === 0 ? ink : faint}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        );
      })}
      <path d="M38 12 L38 44" stroke={faint} strokeWidth="1" strokeDasharray="3 3" />
      {[18, 28, 38].map((y) => (
        <rect key={y} x="35" y={y} width="6" height="2.4" fill={accent} />
      ))}
    </svg>
  );
}

/** Each sheet folded on its own, the folded sheets stacked and glued. */
export function FoldedDiagram({ width = 76, height = 56 }: Props) {
  return (
    <svg width={width} height={height} viewBox="0 0 76 56" fill="none" aria-hidden="true">
      {[0, 1, 2].map((i) => {
        const top = 11 + i * 14;
        return (
          <path
            key={i}
            d={`M68 ${top} L20 ${top} C 10 ${top}, 10 ${top + 10}, 20 ${top + 10} L64 ${top + 10}`}
            fill="none" stroke={i === 0 ? ink : faint} strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
          />
        );
      })}
      <rect x="10" y="8" width="4" height="42" fill={accent} opacity=".9" />
    </svg>
  );
}

/** Loose leaves stacked flat, glued along the spine. */
export function PerfectDiagram({ width = 76, height = 56 }: Props) {
  return (
    <svg width={width} height={height} viewBox="0 0 76 56" fill="none" aria-hidden="true">
      <rect x="10" y="8" width="8" height="40" fill={accent} opacity=".85" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line
          key={i}
          x1="18" y1={11 + i * 7} x2={i % 2 ? 62 : 66} y2={11 + i * 7}
          stroke={i < 2 ? ink : faint} strokeWidth="2.2" strokeLinecap="round"
        />
      ))}
      <path d="M18 8 L66 8" stroke={ink} strokeWidth="1.2" />
      <path d="M18 48 L66 48" stroke={ink} strokeWidth="1.2" />
    </svg>
  );
}

/** A page whose whitespace is trimmed away so the text prints larger. */
export function MarginsDiagram({ width = 76, height = 56 }: Props) {
  return (
    <svg width={width} height={height} viewBox="0 0 76 56" fill="none" aria-hidden="true">
      <rect x="14" y="5" width="48" height="46"
        fill="var(--surface)" stroke={faint} strokeWidth="1.2" />
      <rect x="23" y="14" width="30" height="28"
        stroke={accent} strokeWidth="1.4" strokeDasharray="3.5 2.5" />
      {[18, 23, 28, 33, 38].map((y, i) => (
        <line key={y} x1="26" y1={y} x2={i === 4 ? 42 : 50} y2={y}
          stroke={ink} strokeWidth="1.8" strokeLinecap="round" opacity=".75" />
      ))}
      <path d="M14 28 L22 28 M62 28 L54 28" stroke={accent} strokeWidth="1.2"
        strokeLinecap="round" markerEnd="" />
    </svg>
  );
}

/** How the printed sheet is folded or cut, shown next to the preview. */
export function SheetDiagram({ binding }: { binding: "saddle" | "folded" | "perfect" | "none" }) {
  if (binding === "none") return null;
  const folds = binding !== "perfect";
  return (
    <svg width="74" height="42" viewBox="0 0 74 42" fill="none" aria-hidden="true">
      <rect x="5" y="3" width="64" height="26"
        fill="var(--surface)" stroke={faint} strokeWidth="1.1" />
      <line x1="37" y1="1" x2="37" y2="31" stroke={accent} strokeWidth="1.2"
        strokeDasharray={folds ? "4 3" : "0"} />
      {binding === "perfect" && (
        <>
          <path d="M37 1 L34 5 M37 1 L40 5" stroke={accent} strokeWidth="1.2" strokeLinecap="round" />
          <text x="37" y="39" fill="var(--ink-3)" fontSize="7" letterSpacing="1"
            textAnchor="middle">CUT</text>
        </>
      )}
      {folds && (
        <text x="37" y="39" fill="var(--ink-3)" fontSize="7" letterSpacing="1"
          textAnchor="middle">FOLD</text>
      )}
    </svg>
  );
}
