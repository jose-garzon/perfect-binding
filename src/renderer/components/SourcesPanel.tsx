/**
 * The documents in the job, in output order. One is active: the page selector
 * and the contact sheet work on it. The merged output runs top to bottom.
 */
export interface SourceRow {
  id: string;
  name: string;
  pageCount: number;
  keptCount: number;
  ranges: string;
}

export function SourcesPanel({ rows, activeId, onActivate, onMove, onRemove, onAdd }: {
  rows: SourceRow[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onMove: (id: string, delta: -1 | 1) => void;
  onRemove: (id: string) => void;
  onAdd: (files: File[]) => void;
}) {
  return (
    <div className="sources">
      {rows.length > 1 && (
        <ol className="source-list">
          {rows.map((r, i) => (
            <li key={r.id} className="source-row" aria-current={r.id === activeId}>
              <button type="button" className="source-pick" onClick={() => onActivate(r.id)}
                title="Choose pages from this document">
                <span className="source-name">{i + 1}. {r.name}</span>
                <span className="source-meta">
                  {r.keptCount === r.pageCount
                    ? `${r.pageCount} pages`
                    : `${r.keptCount} of ${r.pageCount} · ${r.ranges}`}
                </span>
              </button>
              <span className="source-actions">
                <button type="button" className="btn sm ghost" disabled={i === 0}
                  aria-label="Move up" onClick={() => onMove(r.id, -1)}>↑</button>
                <button type="button" className="btn sm ghost" disabled={i === rows.length - 1}
                  aria-label="Move down" onClick={() => onMove(r.id, 1)}>↓</button>
                <button type="button" className="btn sm ghost" aria-label="Remove document"
                  onClick={() => onRemove(r.id)}>×</button>
              </span>
            </li>
          ))}
        </ol>
      )}
      <label className="btn sm" style={{ cursor: "pointer" }} role="button" tabIndex={0}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          e.currentTarget.querySelector("input")?.click();
        }}>
        Add PDF…
        <input type="file" accept="application/pdf,.pdf" multiple hidden
          onChange={(e) => { onAdd([...(e.target.files ?? [])]); e.target.value = ""; }} />
      </label>
    </div>
  );
}
