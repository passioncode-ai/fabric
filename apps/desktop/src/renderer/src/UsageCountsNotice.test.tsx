// A7-012 (ADR-0127): the first-run disclosure. The API is a fake of `window.fabric.analytics`; that nothing leaves
// before the answer is proved in test/analytics.test.mjs against a synthetic server.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { UsageCountsNotice } from './UsageCountsNotice'
import { I18nProvider } from './i18n'
import { en } from './i18n/en'
import { ru } from './i18n/ru'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const mount = (analytics: Record<string, unknown>) => {
  vi.stubGlobal('fabric', { analytics })
  return render(<I18nProvider locale="en"><UsageCountsNotice /></I18nProvider>)
}

describe('UsageCountsNotice', () => {
  it('says what is counted and that nothing has been sent, and keeps counts on when the person continues', async () => {
    const setEnabled = vi.fn(async (enabled: boolean) => ({ availability: enabled ? 'on' : 'off' }))
    mount({ status: async () => ({ availability: 'pending-disclosure' }), setEnabled })
    await screen.findByText(en['analytics.notice.title'])
    expect(screen.getByText(en['analytics.note'])).toBeTruthy()
    expect(screen.getByText(en['analytics.notice.nothingYet'])).toBeTruthy()
    const box = screen.getByRole('checkbox', { name: en['analytics.label'] }) as HTMLInputElement
    expect(box.checked).toBe(true)
    const go = screen.getByRole('button', { name: en['analytics.notice.continue'] })
    await waitFor(() => expect(document.activeElement).toBe(go))
    fireEvent.click(go)
    await waitFor(() => expect(setEnabled).toHaveBeenCalledWith(true))
    await waitFor(() => expect(screen.queryByText(en['analytics.notice.title'])).toBeNull())
  })

  it('an install that already sent counts (0.3.2) is not told that nothing has been sent (0.3.3 verification DA-2)', async () => {
    mount({ status: async () => ({ availability: 'pending-disclosure', sentBefore: true }), setEnabled: vi.fn() })
    expect(await screen.findByText(en['analytics.notice.sentBefore'])).toBeTruthy()
    expect(screen.queryByText(en['analytics.notice.nothingYet'])).toBeNull()
  })

  it('turning the switch off before continuing is the answer: counts stay off', async () => {
    const setEnabled = vi.fn(async (enabled: boolean) => ({ availability: enabled ? 'on' : 'off' }))
    mount({ status: async () => ({ availability: 'pending-disclosure' }), setEnabled })
    fireEvent.click(await screen.findByRole('checkbox', { name: en['analytics.label'] }))
    fireEvent.click(screen.getByRole('button', { name: en['analytics.notice.continue'] }))
    await waitFor(() => expect(setEnabled).toHaveBeenCalledWith(false))
  })

  it('an answer that could not be saved keeps the notice and says nothing is sent', async () => {
    mount({ status: async () => ({ availability: 'pending-disclosure' }), setEnabled: vi.fn(async () => ({ availability: 'pending-disclosure' })) })
    fireEvent.click(await screen.findByRole('button', { name: en['analytics.notice.continue'] }))
    await screen.findByText(en['analytics.notice.failed'])
    expect(screen.getByText(en['analytics.notice.title'])).toBeTruthy()
  })

  it('shows nothing once answered, in a build that sends nothing, or when the status cannot be read', async () => {
    for (const status of [async () => ({ availability: 'on' }), async () => ({ availability: 'off' }),
      async () => ({ availability: 'unavailable-no-key' }), async () => { throw new Error('ipc') }]) {
      mount({ status, setEnabled: vi.fn() })
      await new Promise((r) => setTimeout(r, 0))
      expect(screen.queryByText(en['analytics.notice.title'])).toBeNull()
      cleanup()
    }
  })

  it('a host without the analytics API renders nothing instead of breaking the window', async () => {
    vi.stubGlobal('fabric', {})
    render(<I18nProvider locale="en"><UsageCountsNotice /></I18nProvider>)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByText(en['analytics.notice.title'])).toBeNull()
  })

  it('has every string in Russian too', () => {
    for (const key of ['analytics.notice.title', 'analytics.notice.nothingYet', 'analytics.notice.sentBefore', 'analytics.notice.continue', 'analytics.notice.failed'] as const)
      expect(ru[key], key).toBeTruthy()
  })
})
