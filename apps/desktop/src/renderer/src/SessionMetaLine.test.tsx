// The owner, 2026-11-20: a console's bottom bar says, in one thin line, on which account and for which organisation it
// works, who started it, the runner and model, the folder and branch, and the ids; everything whole on hover.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SessionMetaLine } from './SessionMetaLine'
import { I18nProvider } from './i18n'
import type { SessionMeta } from '../../shared/sessionMeta'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const meta: SessionMeta = {
  sessionId: '8343a070-7035-4705-aba6-3f4aad030206', runnerSessionId: '1fc71162-60b8-4271-831a-708a1a6e70f8', runner: 'claude-code', model: 'claude-opus-5-5',
  folder: '/Users/example/DATA/fabric', branch: 'feat/ceo-window-place',
  account: { label: 'claude13@example.me', short: 'claude13@…', source: 'switchboard-session' }, context: 'PassionCode.ai',
  started: { by: 'ceo', via: 'voice', at: '2026-11-20T18:40:00.000Z', parentSessionId: 'ceo-1' }, handedOver: null
}

function mount(m: SessionMeta | null, extra: Record<string, unknown> = {}) {
  const revealFolder = vi.fn().mockResolvedValue({ ok: true })
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { ...globalThis.navigator, clipboard: { writeText } })
  vi.stubGlobal('window', Object.assign(globalThis.window, { fabric: { terminal: { meta: vi.fn().mockResolvedValue(m), revealFolder, ...extra } } }))
  render(<I18nProvider locale="ru"><SessionMetaLine sessionId={meta.sessionId} fallback={<span>папка как раньше</span>} /></I18nProvider>)
  return { revealFolder, writeText }
}

describe('the console\'s system line', () => {
  it('says who started it, the account, the organisation, runner and model, folder and branch, each whole on hover; the ids are copied, never shown', async () => {
    mount(meta)
    const line = await screen.findByLabelText('Сведения о сессии')
    const text = line.textContent ?? ''
    for (const part of ['CEO голосом', 'claude13@…', 'PassionCode.ai', 'Opus 5.5', 'fabric', 'feat/ceo-window-place', 'id сессии', 'id агента'])
      expect(text).toContain(part)
    // SP-2: no machine id is shown; the buttons copy them.
    for (const id of ['8343a070', '1fc71162'])
      expect(text).not.toContain(id)
    // The agent's name and the folder's whole path say themselves on hover (design review F1).
    expect(screen.getByText('Opus 5.5').getAttribute('title')).toBe('Claude Code · Opus 5.5')
    expect(line.querySelector('.is-branch svg')).toBeTruthy()
    expect(screen.getByText('claude13@…').getAttribute('title')).toContain('claude13@example.me')
    expect(screen.getByText('id сессии').getAttribute('title')).not.toContain(meta.sessionId)
    expect(screen.getByText(/CEO голосом/).getAttribute('title')).toContain('Запустила другая сессия')
    expect(screen.getByText(/CEO голосом/).getAttribute('title')).not.toContain('ceo-1')
  })

  it('opens the folder in Finder and copies an id on a press', async () => {
    const f = mount(meta)
    fireEvent.click(await screen.findByTitle(/Папка: \/Users\/example\/DATA\/fabric/))
    expect(f.revealFolder).toHaveBeenCalledWith(meta.sessionId)
    await act(async () => { fireEvent.click(screen.getByText('id сессии')) })
    expect(f.writeText).toHaveBeenCalledWith(meta.sessionId)
    // Said in a live region, so the id keeps its width (design review F8).
    expect((await screen.findByRole('status')).textContent).toBe('Скопировано')
    expect(screen.getByText('id сессии')).toBeTruthy()
  })

  it('a session Switchboard handed over says so; an account from the group\'s route says it may change', async () => {
    mount({ ...meta, started: { by: 'switchboard', via: 'fallback', at: '2026-11-20T19:58:00.000Z', parentSessionId: null }, handedOver: { at: '2026-11-20T19:58:00.000Z' },
      account: { label: 'claude38@example.me', short: 'claude38@…', source: 'group-route' } })
    expect(await screen.findByText(/Передана Switchboard/)).toBeTruthy()
    expect(screen.getByText('claude38@…').getAttribute('title')).toMatch(/может смениться/)
  })

  it('without a reading it keeps the folder as before, and leaves out what was not read', async () => {
    mount(null)
    expect(await screen.findByText('папка как раньше')).toBeTruthy()
    cleanup()
    mount({ ...meta, account: null, context: null, branch: null, model: null })
    const line = await screen.findByLabelText('Сведения о сессии')
    expect(line.textContent).not.toContain('@')
    expect(line.textContent).toContain('Claude Code')
    expect(line.querySelector('.is-branch')).toBeNull()
  })
})
