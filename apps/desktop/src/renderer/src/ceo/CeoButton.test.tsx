// SCN-110: the floating CEO button. It sits on every screen of the main window, so a window whose bridge has no CEO
// (the shell tests' mocks, an older preload) must still render the rest of the app: 0.3.25's hosted CI found the
// whole shell blank when its mount effect read `ceoAgent.status` with no `ceoAgent` there.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { CeoButton } from './CeoButton'
import { I18nProvider } from '../i18n'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const mount = (): void => { render(<I18nProvider locale="ru"><CeoButton onError={() => undefined} /></I18nProvider>) }

describe('the floating CEO button', () => {
  it('renders with no CEO on the bridge, and throws nothing', () => {
    vi.stubGlobal('window', Object.assign(globalThis.window, { fabric: {} }))
    mount()
    expect(screen.getByRole('button', { name: /CEO/ })).toBeTruthy()
  })

  it('says the CEO\'s state in its name once the status is read', async () => {
    vi.stubGlobal('window', Object.assign(globalThis.window, { fabric: { ceoAgent: { status: async () => ({ state: 'stopped' }), onChanged: () => () => undefined } } }))
    mount()
    await waitFor(() => expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(/остановлен/i))
  })
})
