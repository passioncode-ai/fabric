// #region crash-boundary — docs: docs/ux/scenarios.md#scn-073-диагностика
import React from 'react'
import { translator } from './i18n/translate.ts'

// Audit 2026-10-05 A7-009: a renderer error is contained and recorded, not a blank window whose
// reason died in a console nobody opens. The boundary keeps the window standing with a way back; render
// errors reach the main process's ops log through `componentDidCatch` and the root's `onUncaughtError`,
// and errors the boundary cannot see — event handlers, timers, promises — through the window's own
// `error` and `unhandledrejection` events (0.3.2 verification ER-6, UX-7).
/** The crash screen's language: the app's own setting, which App writes to <html lang>; the OS before that. */
function crashT(): ReturnType<typeof translator> {
  const lang = document.documentElement.lang || (typeof navigator !== 'undefined' ? navigator.language : '')
  return translator(lang.startsWith('ru') ? 'ru' : 'en')
}

/** React's production build replaces render errors with a code and a URL; that is not a sentence to show. */
export function shownMessage(message: string): string | null {
  return /^Minified React error #\d+/.test(message) ? null : message
}

export function reportRendererError(error: unknown, component?: string | null): void {
  try {
    const e = error instanceof Error ? error : new Error(String(error))
    window.fabric?.ops?.rendererError({ message: e.message, stack: e.stack ?? null, component: component ?? null })
  } catch {
    // The bridge itself may be the failure; there is nowhere further to report.
  }
}

/** Reports what the boundary cannot see. Installed once, by `main.tsx`. */
export function installWindowErrorReporting(): void {
  window.addEventListener('error', (event) => reportRendererError(event.error ?? event.message))
  window.addEventListener('unhandledrejection', (event) => reportRendererError(event.reason))
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error }
  }
  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    reportRendererError(error, info.componentStack)
  }
  override render(): React.ReactNode {
    const { error } = this.state
    if (error) {
      const t = crashT()
      const message = shownMessage(error.message)
      return (
        <div role="alert" style={{ margin: '4rem auto', maxWidth: '34rem', fontFamily: 'inherit' }}>
          <h1>{t('app.crash.title')}</h1>
          <p>{t('app.crash.body')}</p>
          {message && <p style={{ opacity: 0.6, fontSize: '0.85em' }}>{message}</p>}
          <button type="button" onClick={() => this.setState({ error: null })}>
            {t('app.crash.back')}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
// #endregion crash-boundary
