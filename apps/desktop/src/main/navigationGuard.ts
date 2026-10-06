// #region navigation-guard — docs: docs/adr/0020-provider-views-are-sandboxed-extensions-and-layout-is-host-owned.md#provider-views-are-sandboxed-extensions-workspace-layout-is-host-owned
/**
 * Which documents may stand in a Fabric window (audit 2026-10-05 A7-002).
 *
 * Every Fabric window carries the preload, so whatever document loads in it gets `window.fabric`:
 * terminal input, file writes, `hub.decide`. Nothing stopped a window from navigating away: a file
 * dropped outside a drop zone, a link Monaco or xterm opened in place, any `location` change. The new
 * document then held the whole bridge. So a window may move only within Fabric's own renderer document
 * (its route lives in the hash and the query), a new window is never opened in-app, and an http(s)
 * link goes to the person's browser instead.
 *
 * Pure: the Electron wiring is in `index.ts`, which hands this the renderer's entry.
 */

export interface AppEntry {
  /** The dev server's origin (`ELECTRON_RENDERER_URL`), when the renderer is served. */
  devOrigin?: string | null
  /** The packaged renderer's `index.html`, as a file URL path. */
  indexFile: string
}

/** Whether `target` is Fabric's renderer document itself (any query or hash). */
export function isAppDocument(target: string, entry: AppEntry): boolean {
  let url: URL
  try { url = new URL(target) } catch { return false /* not a URL at all: not the app's document */ }
  if (entry.devOrigin) {
    try { if (url.origin === new URL(entry.devOrigin).origin) return true } catch { /* a dev origin that is not a URL is no origin */ }
  }
  if (url.protocol !== 'file:') return false
  // A malformed escape (`%E0%A4%A`) makes decodeURIComponent throw; such a path is not the app's either,
  // and the guard runs inside Electron's navigation event, where a throw would let the navigation through.
  try { return decodeURIComponent(url.pathname) === entry.indexFile } catch { return false /* a malformed escape: not the app's document */ }
}

/** The URL to hand the person's browser instead, or null when it is not a web link. */
export function externalLink(target: string): string | null {
  try {
    const url = new URL(target)
    return url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'mailto:' ? url.toString() : null
  } catch {
    return null /* not a URL: nothing to hand the browser */
  }
}
// #endregion navigation-guard
