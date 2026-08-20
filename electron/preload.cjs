const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  /** Opens a native save dialog. Resolves false if the user cancels. */
  savePdf: (suggestedName, bytes) =>
    ipcRenderer.invoke("save-pdf", suggestedName, new Uint8Array(bytes)),
});
