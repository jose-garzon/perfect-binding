import type { ReactNode } from "react";

export function Field({ label, value, children, hint }: {
  label: string; value?: ReactNode; children: ReactNode; hint?: ReactNode;
}) {
  // A switch supplies its own label, so the header row is dropped entirely
  // rather than left as an empty line taking up space.
  const header = label !== "" || value !== undefined;
  return (
    <div className="field">
      {header && (
        <div className="field-label">
          <span>{label}</span>
          {value !== undefined && <span className="value">{value}</span>}
        </div>
      )}
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string; title?: string }>;
}) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" title={o.title}
          aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ label, sub, checked, onChange, disabled }: {
  label: string; sub?: string; checked: boolean;
  onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <label className="switch" style={disabled ? { opacity: .5 } : undefined}>
      <span>
        <span className="label">{label}</span>
        {sub && <span className="sub">{sub}</span>}
      </span>
      <input type="checkbox" checked={checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
    </label>
  );
}

export function Slider({ min, max, step = 1, value, onChange, disabled }: {
  min: number; max: number; step?: number; value: number;
  onChange: (v: number) => void; disabled?: boolean;
}) {
  return (
    <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))} />
  );
}

export function Select<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>;
}) {
  return (
    <select className="control" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
