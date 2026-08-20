const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  /** Opens a native save dialog. Resolves false if the user cancels. */
  savePdf: (suggestedName, bytes) =>
    ipcRenderer.invoke("save-pdf", suggestedName, new Uint8Array(bytes)),

  /**
   * Update notices. The renderer makes no network requests of its own — the
   * main process asks GitHub and answers with a version or null.
   */
  updates: {
    check: (force = false) => ipcRenderer.invoke("updates:check", { force }),
    /** Called with no argument this reads the preference; with one, it sets it. */
    enabled: (value) => ipcRenderer.invoke("updates:enabled", value),
    skip: (version) => ipcRenderer.invoke("updates:skip", version),
    openReleasePage: (url) => ipcRenderer.invoke("open-release-page", url),
    /** Fired by the File → Check for Updates… menu item. */
    onFound: (handler) => {
      const listener = (_e, update) => handler(update);
      ipcRenderer.on("updates:found", listener);
      return () => ipcRenderer.removeListener("updates:found", listener);
    },
  },
});
