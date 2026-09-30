// What jsdom does not implement and the interface reaches for anyway.
//
// Added when the first test to render `App` whole crashed at IMPORT time with
// `document.queryCommandSupported is not a function` — Monaco, pulled in
// through `EditorWindow`, probes for it while its module is evaluated. Nothing
// in the test had run yet.
//
// One file rather than a stub in the test that hit it: the next test to render
// the app whole would have hit the same wall, and a polyfill hidden inside one
// spec is a polyfill the next author does not find.

if (typeof document !== 'undefined' && !('queryCommandSupported' in document)) {
  Object.defineProperty(document, 'queryCommandSupported', { value: () => false })
}
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null
    })
  })
}

// `ResizeObserver`, reached for by `TerminalView` — which UX28-13 embedded in
// `EstateAgents`, so the FIRST spec to render that panel with a live session
// crashed the whole tree: the effect threw, React unmounted, and two unrelated
// assertions about per-source read failures reported `expected null to be
// truthy` against an empty body. The cause was three files away from the
// symptom.
//
// It landed here rather than in the spec that hit it, which is this file's own
// rule — and I had already written the stub inside my own spec before reading
// the header above.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class NoopResizeObserver implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', { value: NoopResizeObserver, writable: true })
}

