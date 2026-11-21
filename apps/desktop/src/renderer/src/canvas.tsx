// The canvas's document (ADR-0201 §2): its own entry, so Excalidraw loads in the canvas window alone, and its fonts are
// the app's own files (`electron.vite.config.ts#excalidrawAssets`), set before the editor is imported.
window.EXCALIDRAW_ASSET_PATH = new URL('excalidraw-assets/', window.location.href).href

void import('./canvas/mount').then((m) => m.mountCanvas())
