const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  /** Opens a native save dialog. Resolves false if the user cancels. */
  savePdf: (suggestedName, bytes) =>
    ipcRenderer.invoke("save-pdf", suggestedName, new Uint8Array(bytes)),

  /**
   * Printing. The bytes never leave this process pair: the main process writes
   * them to a private temporary file, prints it, and deletes it — no export,
   * no save dialog, nothing left behind.
   */
  print: {
    /** The machine's printers, the platform's default marked. */
    printers: () => ipcRenderer.invoke("print:printers"),
    /** Sends a job. Resolves `{ ok }` or `{ ok: false, reason | cancelled }`. */
    job: (bytes, options) => ipcRenderer.invoke("print:job", new Uint8Array(bytes), options),
    /** Called with no argument this reads the preferences; with one, it saves it. */
    prefs: (patch) => ipcRenderer.invoke("print:prefs", patch),
    /** Fired by the File → Print… menu item. */
    onOpen: (handler) => {
      const listener = () => handler();
      ipcRenderer.on("print:open", listener);
      return () => ipcRenderer.removeListener("print:open", listener);
    },
  },

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
