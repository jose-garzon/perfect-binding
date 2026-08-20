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
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
        stroke="var(--ink)" strokeWidth="1.2" strokeLinecap="square" strokeLinejoin="miter">
        <path d="M12 15V4m0 0L8 8M12 4l4 4" />
        <path d="M4 14v5h16v-5" />
      </svg>
      <span className="big">Drop a PDF</span>
      <span className="small">or click to choose a file — nothing leaves your computer</span>
      <input ref={input} type="file" accept="application/pdf,.pdf" hidden
        onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
    </div>
  );
}
