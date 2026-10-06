import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
// The pack names three faces (Inter Tight, Inter, JetBrains Mono) and its whole
// identity is that pairing. A desktop app cannot fetch them at runtime, so they
// are bundled: without this the display and body roles collapse to the same
// system face and the pack renders as a lookalike.
import '@fontsource/inter-tight/400.css'
import '@fontsource/inter-tight/600.css'
import '@fontsource/inter-tight/700.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/jetbrains-mono/400.css'
// Order matters: the pack's token layer, then the app's semantic aliases over
// it, then component styles that may only consume var(--…).
import './tokens.paperclip.css'
import './tokens.passioncode.css'
import './tokens.app.css'
import './styles.css'
// M117 — the component set, after the app stylesheet so the set owns the
// classes it declares while the screens are being moved onto it.
import './components.css'
import '@xterm/xterm/css/xterm.css'
import { translator } from './i18n/translate.ts'

// Audit 2026-10-05 A7-009: a renderer error is contained and recorded, not a blank window whose
// reason died in a console nobody opens. The boundary keeps the window standing with a way back,
// and every uncaught error — renders the boundary cannot see (event handlers, async) included —
// reaches the main process's ops log through the bridge. The registry may itself be what crashed,
// so the language follows the OS, not the settings the crash may have taken down.
const crashT = translator(typeof navigator !== 'undefined' && navigator.language?.startsWith('ru') ? 'ru' : 'en')

function reportRendererError(error: unknown, component?: string | null): void {
  try {
    const e = error instanceof Error ? error : new Error(String(error))
    window.fabric?.ops?.rendererError({ message: e.message, stack: e.stack ?? null, component: component ?? null })
  } catch {
    // The bridge itself may be the failure; there is nowhere further to report.
  }
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error }
  }
  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    reportRendererError(error, info.componentStack)
  }
  override render(): React.ReactNode {
    const { error } = this.state
    if (error)
      return (
        <div role="alert" style={{ margin: '4rem auto', maxWidth: '34rem', fontFamily: 'inherit' }}>
          <h1>{crashT('app.crash.title')}</h1>
          <p>{crashT('app.crash.body')}</p>
          <p style={{ opacity: 0.6, fontSize: '0.85em' }}>{error.message}</p>
          <button type="button" onClick={() => this.setState({ error: null })}>
            {crashT('app.crash.back')}
          </button>
        </div>
      )
    return this.props.children
  }
}

createRoot(document.getElementById('root')!, {
  onUncaughtError: (error, info) => reportRendererError(error, info.componentStack)
}).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
