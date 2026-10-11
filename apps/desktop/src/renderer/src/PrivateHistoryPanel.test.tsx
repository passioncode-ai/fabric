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
const restored = { ok: true, operation_id: OP, target_estate_id: T, history_restored: true, access_verified: true, private_history: true, private_history_skipped: null, opened: false }
function stub(over: Record<string, unknown> = {}) {
  const history = { list: vi.fn(async () => []), export: vi.fn(async () => ({ ok: true, archive_id: 'a', name: '2026-09-28-export', conversations: 1, messages: 2 })),
    choose: vi.fn(async () => archive()), restore: vi.fn(async () => restored), check: vi.fn(async () => restored), open: vi.fn(async () => ({ ok: true, reason: null })),
    pending: vi.fn(async () => []), restored: vi.fn(async () => []), ...over }
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

// Audit 2026-10-05 A3-004, A3-005, A5-011…A5-014: every call can fail, and a restore outlives the panel.
const chooseAndRestore = async (): Promise<void> => {
  fireEvent.click(screen.getByRole('button', { name: en['history.choose'] }))
  await screen.findByLabelText(en['history.name'])
  fireEvent.change(screen.getByLabelText(en['history.name']), { target: { value: 'X' } })
  fireEvent.click(screen.getByRole('button', { name: en['history.restore'] }))
}
describe('SCR-48 / SCR-65 when a call fails', () => {
  it('a restore whose IPC throws leaves "Restoring…", says so, and shows the operation main recorded', async () => {
    const h = stub({ restore: vi.fn(async () => { throw new Error('ipc') }) }); show()
    await waitFor(() => expect(h.pending).toHaveBeenCalledTimes(1))
    h.pending.mockResolvedValue([{ operation_id: OP, name: 'X' }] as never)
    await chooseAndRestore()
    await screen.findByText(fill(en['history.refused'], { reason: en['history.reason.unavailable'] }))
    expect(screen.queryByText(en['history.restoring'])).toBeNull()
    await screen.findByText(fill(en['history.pending.item'], { name: 'X' }))
    fireEvent.click(screen.getByRole('button', { name: fill(en['history.checkNamed'], { name: 'X' }) }))
    await screen.findByText(en['history.fact.history'])
    expect(h.check).toHaveBeenCalledWith(OP)
  })
  it('an export, a choice or a check that throws is a refusal or stays checkable, never a spinner', async () => {
    const h = stub({ export: vi.fn(async () => { throw new Error('ipc') }), choose: vi.fn(async () => { throw new Error('ipc') }) }); show()
    fireEvent.click(screen.getByRole('button', { name: en['history.export'] }))
    await screen.findByText(fill(en['history.exportRefused'], { reason: en['history.reason.unavailable'] }))
    fireEvent.click(screen.getByRole('button', { name: en['history.choose'] }))
    await screen.findByText(fill(en['history.refused'], { reason: en['history.reason.unavailable'] }))
    h.choose.mockResolvedValue(archive() as never)
    h.restore.mockResolvedValue({ ok: false, state: 'result_unknown', reason_code: 'result_unknown', operation_id: OP } as never)
    h.check.mockRejectedValueOnce(new Error('ipc') as never)
    await chooseAndRestore()
    await screen.findByText(en['history.unknown'])
    fireEvent.click(screen.getByRole('button', { name: en['history.checkAgain'] }))
    await waitFor(() => expect(h.check).toHaveBeenCalledTimes(1))
    await screen.findByText(en['history.unknown'])
    expect(screen.queryByText(en['history.restoring'])).toBeNull()
  })
  it('a refusal that carries its operation (the archive could not be read) can be checked again', async () => {
    const h = stub({ restore: vi.fn(async () => ({ ok: false, state: 'refused', reason_code: 'not_found', operation_id: OP })) }); show()
    await chooseAndRestore()
    await screen.findByText(fill(en['history.refused'], { reason: en['history.reason.not_found'] }))
    fireEvent.click(screen.getByRole('button', { name: en['history.checkAgain'] }))
    await screen.findByText(en['history.fact.history'])
    expect(h.check).toHaveBeenCalledWith(OP)
  })
  it('a failed Open keeps the restored result, names why, and can be tried again', async () => {
    const h = stub({ open: vi.fn(async () => ({ ok: false, reason: 'write_failed' })) }); show()
    await chooseAndRestore()
    await screen.findByText(en['history.fact.history'])
    fireEvent.click(screen.getByRole('button', { name: en['history.open'] }))
    await screen.findByText(fill(en['history.openFailed'], { reason: en['history.openReason.write_failed'] }))
    expect(screen.getByText(en['history.fact.history'])).toBeTruthy()
    h.open.mockRejectedValueOnce(new Error('ipc') as never)
    fireEvent.click(screen.getByRole('button', { name: en['history.open'] }))
    await screen.findByText(fill(en['history.openFailed'], { reason: en['history.openReason.unavailable'] }))
    expect(h.open).toHaveBeenCalledTimes(2)
  })
})
describe('SCR-48 restores that outlive the panel', () => {
  it('restored Estates can be opened later, from the list main keeps', async () => {
    const h = stub({ restored: vi.fn(async () => [{ target_estate_id: T, name: 'Restored Atlas', private_history: true }]) }); show()
    await screen.findByText(en['history.restoredList.title'])
    fireEvent.click(screen.getByRole('button', { name: fill(en['history.openNamed'], { name: 'Restored Atlas' }) }))
    await waitFor(() => expect(h.open).toHaveBeenCalledWith(T))
  })
  it('a restore left waiting is listed with Check again after the panel reopens', async () => {
    const h = stub({ pending: vi.fn(async () => [{ operation_id: OP, name: 'Waiting' }]) }); show()
    await screen.findByText(en['history.pending.title'])
    fireEvent.click(screen.getByRole('button', { name: fill(en['history.checkNamed'], { name: 'Waiting' }) }))
    await screen.findByText(en['history.fact.history'])
    expect(h.check).toHaveBeenCalledWith(OP)
  })
  it.each([['not_your_history', 'history.reason.not_your_history'], ['idempotency_conflict', 'history.reason.idempotency_conflict']] as const)(
    'a restore whose private history was not imported (%s) says why', async (code, key) => {
      stub({ choose: vi.fn(async () => archive(code !== 'not_your_history')),
        restore: vi.fn(async () => ({ ...restored, private_history: false, private_history_skipped: code })) }); show()
      await chooseAndRestore()
      await screen.findByText(fill(en['history.fact.privateSkipped'], { reason: en[key] }))
      expect(screen.queryByText(en['history.fact.noPrivate'])).toBeNull()
      expect(screen.getByRole('button', { name: en['history.open'] })).toBeTruthy()
    })
})
