import { useCallback, useEffect, useState } from "react";

export interface Update { version: string; url: string; current: string }

/**
 * Asks the main process once per mount whether a newer release exists, and
 * listens for the File → Check for Updates… menu item. In a browser (bun run
 * web) there is no bridge and nothing happens.
 */
export function useUpdate() {
  const [update, setUpdate] = useState<Update | null>(null);

  useEffect(() => {
    const bridge = window.desktop?.updates;
    if (!bridge) return;
    let live = true;
    bridge.check().then((found) => { if (live && found) setUpdate(found); });
    const off = bridge.onFound((found) => setUpdate(found));
    return () => { live = false; off(); };
  }, []);

  const dismiss = useCallback(() => {
    setUpdate((u) => { if (u) window.desktop?.updates?.skip(u.version); return null; });
  }, []);

  const stopChecking = useCallback(() => {
    window.desktop?.updates?.enabled(false);
    setUpdate(null);
  }, []);

  return { update, dismiss, stopChecking };
}

/** A hairline strip under the masthead. Absent unless there is something to say. */
export function UpdateBar({ update, dismiss, stopChecking }: ReturnType<typeof useUpdate>) {
  if (!update) return null;
  return (
    <div className="update-bar" role="status">
      <span className="update-version">{update.version}</span>
      <span className="update-text">
        is out — you have {update.current}.
      </span>
      <button className="btn ghost sm"
        onClick={() => window.desktop?.updates?.openReleasePage(update.url)}>
        See what changed
      </button>
      <div className="spacer" />
      <button className="link-btn" onClick={dismiss}>Not now</button>
      <button className="link-btn" onClick={stopChecking}>Stop checking</button>
    </div>
  );
}
