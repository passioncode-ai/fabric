// 0.3.2 verification UX-8 / ER-6: the crash screen speaks the app's language, never shows React's
// minified code as a sentence, and every renderer failure — the boundary's and the window's — reaches
// the main process.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ErrorBoundary, installWindowErrorReporting, shownMessage } from './CrashBoundary'

afterEach(() => {
  cleanup()
  document.documentElement.lang = ''
})

function bridge(): ReturnType<typeof vi.fn> {
  const rendererError = vi.fn()
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { ops: { rendererError } } }))
  return rendererError
}

function Boom({ message }: { message: string }): React.JSX.Element {
  throw new Error(message)
}

describe('the crash boundary', () => {
  it('shows the recovery screen in the app language and reports the failure', () => {
    const sent = bridge()
    document.documentElement.lang = 'ru'
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom message="the panel broke" /></ErrorBoundary>)
    expect(screen.getByRole('alert').textContent).toContain('Что-то в этом окне сломалось')
    expect(screen.getByText('the panel broke')).toBeTruthy()
    expect(sent).toHaveBeenCalledWith(expect.objectContaining({ message: 'the panel broke' }))
  })

  it('hides a minified React message', () => {
    bridge()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom message="Minified React error #185; visit https://react.dev/errors/185" /></ErrorBoundary>)
    expect(screen.getByRole('alert').textContent).toContain('Something in this window failed')
    expect(screen.queryByText(/Minified React error/)).toBeNull()
    expect(shownMessage('plain words')).toBe('plain words')
  })

  it('reports errors and rejections the boundary cannot see', () => {
    const sent = bridge()
    installWindowErrorReporting()
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('a click handler threw'), message: 'a click handler threw' }))
    const rejection = new Event('unhandledrejection') as Event & { reason: unknown }
    rejection.reason = new Error('a promise nobody awaited')
    window.dispatchEvent(rejection)
    expect(sent).toHaveBeenCalledWith(expect.objectContaining({ message: 'a click handler threw' }))
    expect(sent).toHaveBeenCalledWith(expect.objectContaining({ message: 'a promise nobody awaited' }))
  })
})
