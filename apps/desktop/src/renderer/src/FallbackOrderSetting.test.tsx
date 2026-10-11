// Settings → Fallback order (ADR-0125, SCN-135). Pure UI over `settings.runnerFallback`; the walk it
// configures is tested in shared/runnerRoute.test.ts.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FallbackOrderSetting } from './FallbackOrderSetting'
import { I18nProvider } from './i18n'
import { en } from './i18n/en'

afterEach(cleanup)
const mount = (order: Array<{ runner: string; session: 'spawn' | 'attach-or-spawn' | 'attach-only' }>, onChange = vi.fn()) => {
  render(<I18nProvider locale="en"><FallbackOrderSetting value={{ order }} onChange={onChange} /></I18nProvider>)
  return onChange
}

describe('FallbackOrderSetting', () => {
  it('says that an empty order changes nothing, and adds a coding agent to it', () => {
    const onChange = mount([])
    expect(screen.getByText(en['settings.fallback.empty'])).toBeTruthy()
    fireEvent.change(screen.getByLabelText(en['settings.fallback.pick']), { target: { value: 'hermes' } })
    fireEvent.click(screen.getByText(en['settings.fallback.add']))
    expect(onChange).toHaveBeenCalledWith({ runnerFallback: { order: [{ runner: 'hermes', session: 'spawn' }] } })
  })

  it('never offers the plain shell', () => {
    mount([])
    const pick = screen.getByLabelText(en['settings.fallback.pick']) as HTMLSelectElement
    expect([...pick.options].map((o) => o.value)).not.toContain('shell')
  })

  it('reorders, changes how an agent serves, and removes one — the operator\'s example order', () => {
    const order = [{ runner: 'claude-code', session: 'attach-only' as const }, { runner: 'hermes', session: 'spawn' as const }]
    const onChange = mount(order)
    fireEvent.click(screen.getAllByText(en['settings.fallback.down'])[0] as HTMLElement)
    expect(onChange).toHaveBeenLastCalledWith({ runnerFallback: { order: [order[1], order[0]] } })
    fireEvent.change(screen.getByLabelText('How Hermes Agent serves'), { target: { value: 'attach-or-spawn' } })
    expect(onChange).toHaveBeenLastCalledWith({ runnerFallback: { order: [order[0], { runner: 'hermes', session: 'attach-or-spawn' }] } })
    fireEvent.click(screen.getAllByText(en['settings.fallback.remove'])[0] as HTMLElement)
    expect(onChange).toHaveBeenLastCalledWith({ runnerFallback: { order: [order[1]] } })
  })
  it('a save that fails is not an unhandled rejection, and focus stays on the moved row (0.3.3 iteration 2, ER-8, UX-9)', async () => {
    const seen: unknown[] = []
    const onUnhandled = (e: PromiseRejectionEvent) => { seen.push(e.reason); e.preventDefault() }
    window.addEventListener('unhandledrejection', onUnhandled)
    mount([{ runner: 'claude-code', session: 'spawn' }, { runner: 'codex', session: 'spawn' }], vi.fn(async () => { throw new Error('settings write failed') }))
    fireEvent.click(screen.getByRole('button', { name: en['settings.fallback.upFor'].replace('{agent}', 'Codex') }))
    await new Promise((r) => setTimeout(r, 20))
    window.removeEventListener('unhandledrejection', onUnhandled)
    expect(seen).toEqual([])
  })

  it('focus follows the moved row once the saved order is drawn, and Remove leaves it on the next row (iteration 3, UX-1, UX-6)', async () => {
    const { useState } = await import('react')
    const { act } = await import('@testing-library/react')
    const Host = () => {
      const [order, setOrder] = useState([{ runner: 'claude-code', session: 'spawn' as const }, { runner: 'codex', session: 'spawn' as const }, { runner: 'kilo', session: 'spawn' as const }])
      return <I18nProvider locale="en"><FallbackOrderSetting value={{ order }} onChange={async (next) => { await Promise.resolve(); setOrder(next.runnerFallback!.order as never) }} /></I18nProvider>
    }
    render(<Host />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en['settings.fallback.upFor'].replace('{agent}', 'Codex') })) })
    await waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toBe(en['settings.fallback.downFor'].replace('{agent}', 'Codex')))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: en['settings.fallback.removeFor'].replace('{agent}', 'Codex') })) })
    await waitFor(() => expect(document.activeElement?.getAttribute('aria-label') ?? '').toMatch(/Claude Code/))
  })
})
