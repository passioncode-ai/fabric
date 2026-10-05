// SCR-52 → Share anonymous usage counts (SCN-134). The API is a fake of `window.fabric.analytics`; the module
// behind it is tested in test/analytics.test.mjs against a synthetic server.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { UsageCountsSetting } from './UsageCountsSetting'
import { I18nProvider } from './i18n'
import { en } from './i18n/en'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const mount = (analytics: Record<string, unknown>) => {
  vi.stubGlobal('fabric', { analytics })
  return render(<I18nProvider locale="en"><UsageCountsSetting /></I18nProvider>)
}

describe('UsageCountsSetting', () => {
  it('shows the switch on, says what is counted, and turns it off for every PassionCode app', async () => {
    const setEnabled = vi.fn(async (enabled: boolean) => ({ availability: enabled ? 'on' : 'off' }))
    mount({ status: async () => ({ availability: 'on' }), setEnabled })
    const box = await screen.findByRole('checkbox', { name: en['analytics.label'] }) as HTMLInputElement
    await waitFor(() => expect(box.checked).toBe(true))
    expect(screen.getByText(en['analytics.note'])).toBeTruthy()
    fireEvent.click(box)
    await waitFor(() => expect(setEnabled).toHaveBeenCalledWith(false))
    await waitFor(() => expect(box.checked).toBe(false))
  })

  it('a build without the App Key cannot share, and says so', async () => {
    mount({ status: async () => ({ availability: 'unavailable-no-key' }), setEnabled: vi.fn() })
    await screen.findByText(en['analytics.noKey'])
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true)
  })

  it('an unreadable shared file keeps it off and names why', async () => {
    mount({ status: async () => ({ availability: 'unavailable-file' }), setEnabled: vi.fn() })
    await screen.findByText(en['analytics.noFile'])
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
  })

  it('a status that cannot be read is said as unreadable, never shown as off', async () => {
    mount({ status: async () => { throw new Error('ipc down') }, setEnabled: vi.fn() })
    await screen.findByText(en['analytics.unreadable'])
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true)
  })
})
