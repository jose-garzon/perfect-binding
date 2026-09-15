/**
 * The shape of the printing bridge, shared by the panel, the preview caption,
 * and the app. The bridge itself lives in `electron/preload.cjs`; everything
 * here is types and the defaults the panel falls back to when the desktop has
 * nothing saved yet.
 */

export type Duplex = "simplex" | "shortEdge" | "longEdge";

export interface Printer {
  name: string;
  displayName: string;
  description: string;
  status: number;
  isDefault: boolean;
}

/** What the print panel asks for, and what is saved between launches. */
export interface PrintPrefs {
  deviceName: string | null;
  copies: number;
  duplex: Duplex;
  color: boolean;
  paperName: string | null;
  /** Percent. Anything but 100 refits an imposition that is already final. */
  scale: number;
}

export const DEFAULT_PRINT_PREFS: PrintPrefs = {
  deviceName: null,
  copies: 1,
  duplex: "shortEdge",
  color: true,
  paperName: null,
  scale: 100,
};

/** A cancelled system dialog is a refusal, not a failure: neither ok nor a reason. */
export interface PrintResult {
  ok: boolean;
  cancelled?: boolean;
  reason?: string;
}

export interface PrintOptions extends PrintPrefs {
  /** 0-based inclusive output-page ranges. Empty or absent prints everything. */
  pageRanges?: Array<{ from: number; to: number }>;
  /** False hands the job to the platform's own dialog instead of printing silently. */
  silent?: boolean;
}

export interface PrintBridge {
  printers: () => Promise<Printer[]>;
  job: (bytes: Uint8Array, options: PrintOptions) => Promise<PrintResult>;
  prefs: (patch?: Partial<PrintPrefs>) => Promise<PrintPrefs>;
  onOpen: (handler: () => void) => () => void;
}

/** What a job covers. "sheet" is the one on show in the proof view. */
export type PrintScope = "all" | "range" | "sheet";
