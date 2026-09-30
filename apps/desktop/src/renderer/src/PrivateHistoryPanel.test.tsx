// SCR-65 and SCR-48 in the app (first-slice plan A1-6c). The API is a fake of
// `window.fabric.history`; the service behind it is tested on an owned cluster in main.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PrivateHistoryPanel } from './PrivateHistoryPanel'
import { I18nProvider } from './i18n'
import { en } from './i18n/en'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const T = '00000000-0000-4000-8000-000000000030', OP = '00000000-0000-4000-8000-000000000031'
const archive = (mine = true) => ({ ok: true, token: 'tok', taken_at: '2026-09-28T10:00:00.000Z', events: 3, companion: { conversations: 1, messages: 2, mine } })
const restored = { ok: true, operation_id: OP, target_estate_id: T, history_restored: true, access_verified: true, private_history: true, opened: false }
function stub(over: Record<string, unknown> = {}) {
  const history = { list: vi.fn(async () => []), export: vi.fn(async () => ({ ok: true, archive_id: 'a', name: '2026-09-28-export', conversations: 1, messages: 2 })),
    choose: vi.fn(async () => archive()), restore: vi.fn(async () => restored), check: vi.fn(async () => restored), open: vi.fn(async () => ({ ok: true, reason: null })), ...over }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { history } }))
  return history
}
const show = () => render(<I18nProvider locale="en"><PrivateHistoryPanel onClose={() => {}} /></I18nProvider>)
const fill = (s: string, v: Record<string, string | number>) => Object.entries(v).reduce((x, [k, val]) => x.replace(`{${k}}`, String(val)), s)

describe('SCR-65 private history', () => {
  it('says what travels, that the files are not encrypted, and that nothing was exported yet', async () => {
    stub(); show()
    expect(screen.getByText(en['history.private.what'])).toBeTruthy()
    expect(screen.getByText(en['history.private.file'])).toBeTruthy()
    await screen.findByText(en['history.none'])
  })
  it('an unreadable list is unknown, never "nothing exported"', async () => {
    stub({ list: vi.fn(async () => { throw new Error('ipc') }) }); show()
    await screen.findByText(en['history.listUnknown'])
    expect(screen.queryByText(en['history.none'])).toBeNull()
  })
  it('export names the file; a refused export says no partial file was kept', async () => {
    const h = stub(); show()
    fireEvent.click(screen.getByRole('button', { name: en['history.export'] }))
    await screen.findByText(fill(en['history.exported'], { name: '2026-09-28-export' }))
    expect(h.export).toHaveBeenCalledWith()
    h.export.mockResolvedValueOnce({ ok: false, state: 'refused', reason_code: 'archive_stale' } as never)
    fireEvent.click(screen.getByRole('button', { name: en['history.export'] }))
    await screen.findByText(fill(en['history.exportRefused'], { reason: en['history.reason.archive_stale'] }))
  })
})

describe('SCR-48 restore into a fresh Estate', () => {
  it('Choose archive is the one action while nothing is chosen, and a cancelled dialog changes nothing', async () => {
    const h = stub({ choose: vi.fn(async () => null) }); show()
    fireEvent.click(screen.getByRole('button', { name: en['history.choose'] }))
    await waitFor(() => expect(h.choose).toHaveBeenCalledWith())
    expect(screen.getByRole('button', { name: en['history.choose'] })).toBeTruthy()
    expect(screen.queryByRole('button', { name: en['history.restore'] })).toBeNull()
  })
  it('a refused archive names its reason and says nothing was written', async () => {
    stub({ choose: vi.fn(async () => ({ ok: false, state: 'refused', reason_code: 'integrity_mismatch' })) }); show()
    fireEvent.click(screen.getByRole('button', { name: en['history.choose'] }))
    await screen.findByText(fill(en['history.refused'], { reason: en['history.reason.integrity_mismatch'] }))
  })
  it('someone else\'s private history is announced as not imported', async () => {
    stub({ choose: vi.fn(async () => archive(false)) }); show()
    fireEvent.click(screen.getByRole('button', { name: en['history.choose'] }))
    await screen.findByText(en['history.archive.notMine'])
  })
  it('restore sends only the token and the name, then shows the facts and a separate Open', async () => {
    const h = stub(); show()
    fireEvent.click(screen.getByRole('button', { name: en['history.choose'] }))
    await screen.findByText(fill(en['history.archive.mine'], { conversations: 1, messages: 2 }))
    const restore = screen.getByRole('button', { name: en['history.restore'] }) as HTMLButtonElement
    expect(restore.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(en['history.name']), { target: { value: 'Restored Atlas' } })
    fireEvent.click(restore)
    await screen.findByText(en['history.fact.history'])
    expect(h.restore).toHaveBeenCalledWith('tok', 'Restored Atlas')
    for (const k of ['history.fact.access', 'history.fact.private', 'history.fact.notOpened'] as const) expect(screen.getByText(en[k])).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['history.open'] }))
    await waitFor(() => expect(h.open).toHaveBeenCalledWith(T))
  })
  it('a lost reply is checked by the same operation, never a second restore', async () => {
    const h = stub({ restore: vi.fn(async () => ({ ok: false, state: 'result_unknown', reason_code: 'result_unknown', operation_id: OP })) }); show()
    fireEvent.click(screen.getByRole('button', { name: en['history.choose'] }))
    await screen.findByLabelText(en['history.name'])
    fireEvent.change(screen.getByLabelText(en['history.name']), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: en['history.restore'] }))
    await screen.findByText(en['history.unknown'])
    fireEvent.click(screen.getByRole('button', { name: en['history.checkAgain'] }))
    await screen.findByText(en['history.fact.history'])
    expect(h.check).toHaveBeenCalledWith(OP)
    expect(h.restore).toHaveBeenCalledTimes(1)
  })
})
