import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./app.css";

declare global {
  interface Window {
    desktop?: {
      savePdf: (suggestedName: string, bytes: Uint8Array) => Promise<boolean>;
      updates?: {
        check: (force?: boolean) => Promise<import("./components/UpdateBar").Update | null>;
        enabled: (value?: boolean) => Promise<boolean>;
        skip: (version: string) => Promise<unknown>;
        openReleasePage: (url: string) => Promise<boolean>;
        onFound: (handler: (u: import("./components/UpdateBar").Update) => void) => () => void;
      };
    };
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
