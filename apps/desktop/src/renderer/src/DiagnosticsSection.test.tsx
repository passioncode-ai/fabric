// Audit 2026-10-05 A7-001: when the local stack answers on this Mac's network address, Diagnostics
// says so first, with the remedy — and says nothing when it does not.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { DiagnosticsSection } from './DiagnosticsSection'
import { I18nProvider } from './i18n'
import type { DiagnosticsView } from '../../shared/types'

afterEach(cleanup)

function mount(view: DiagnosticsView): void {
  const api = {
    meta: { info: vi.fn().mockRejectedValue(new Error('no manifest in a test')) },
    diagnostics: { read: vi.fn().mockResolvedValue(view) }
  }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: api }))
  render(
    <I18nProvider locale="en">
      <DiagnosticsSection />
    </I18nProvider>
  )
}

describe('the stack exposure warning', () => {
  it('names the ports and interfaces that answered, and the remedy', async () => {
    mount({ records: [], file: null, stackExposure: { checkedAt: '2026-10-06T00:00:00Z', ports: [54321, 54322], exposed: [{ iface: 'en0', port: 54321 }, { iface: 'en0', port: 54322 }] } })
    expect(await screen.findByText('The local database can be reached from your network')).toBeTruthy()
    expect(screen.getByText(/Ports 54321, 54322 answered on en0\./)).toBeTruthy()
    expect(screen.getByText(/orbctl config set docker\.expose_ports_to_lan false/)).toBeTruthy()
  })

  it('is absent when nothing answered, and before the check has run', async () => {
    mount({ records: [], file: null, stackExposure: { checkedAt: '2026-10-06T00:00:00Z', ports: [54321], exposed: [] } })
    await screen.findByText(/What the program did/)
    expect(screen.queryByText('The local database can be reached from your network')).toBeNull()
    cleanup()
    mount({ records: [], file: null, stackExposure: null })
    await screen.findByText(/What the program did/)
    expect(screen.queryByText('The local database can be reached from your network')).toBeNull()
  })
})
