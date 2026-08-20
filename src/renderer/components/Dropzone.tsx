import { useRef, useState } from "react";

export function Dropzone({ onFile }: { onFile: (file: File) => void }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const pick = (list: FileList | null) => {
    const file = [...(list ?? [])].find((f) => f.type === "application/pdf" ||
      f.name.toLowerCase().endsWith(".pdf"));
    if (file) onFile(file);
  };

  return (
    <div
      className={`dropzone${over ? " over" : ""}`}
      role="button" tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files); }}
    >
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
        stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
        <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
      </svg>
      <span className="big">Drop a PDF here</span>
      <span className="small">or click to choose a file — nothing leaves your computer</span>
      <input ref={input} type="file" accept="application/pdf,.pdf" hidden
        onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
    </div>
  );
}
