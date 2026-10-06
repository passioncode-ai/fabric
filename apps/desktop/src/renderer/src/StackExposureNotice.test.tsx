// Audit 2026-10-05 A7-001, 0.3.2 verification UX-9/UX-6: when the local stack answers on this Mac's network,
// a warning stands above every screen with the remedy — and nothing is shown when nothing answered.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { StackExposureNotice } from './StackExposureNotice'
import { I18nProvider } from './i18n'
import { en } from './i18n/en'
import type { StackExposureView } from '../../shared/types'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function mount(exposure: StackExposureView | null): void {
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { stack: { exposure: vi.fn().mockResolvedValue(exposure) } } }))
  render(<I18nProvider locale="en"><StackExposureNotice /></I18nProvider>)
}

describe('the stack exposure warning', () => {
  it('names the interfaces and ports that answered, and the remedy without markup', async () => {
    mount({ checkedAt: '2026-10-06T00:00:00Z', ports: [54321, 54322], exposed: [{ iface: 'en0', port: 54321 }, { iface: 'en0', port: 54322 }] })
    expect(await screen.findByText(en['diagnostics.exposure.title'])).toBeTruthy()
    expect(screen.getByText(/answers on en0 \(54321, 54322\)/)).toBeTruthy()
    expect(screen.getByText(/orbctl config set docker\.expose_ports_to_lan false/).textContent).not.toContain('`')
  })

  it('is absent when nothing answered, and before any check has finished', async () => {
    mount({ checkedAt: '2026-10-06T00:00:00Z', ports: [54321], exposed: [] })
    await new Promise((r) => setTimeout(r, 10))
    expect(screen.queryByText(en['diagnostics.exposure.title'])).toBeNull()
    cleanup()
    mount(null)
    await new Promise((r) => setTimeout(r, 10))
    expect(screen.queryByText(en['diagnostics.exposure.title'])).toBeNull()
  })
})
