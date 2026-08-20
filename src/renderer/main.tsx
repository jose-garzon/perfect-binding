import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./app.css";

declare global {
  interface Window {
    desktop?: {
      savePdf: (suggestedName: string, bytes: Uint8Array) => Promise<boolean>;
    };
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
