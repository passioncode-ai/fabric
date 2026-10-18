// История on the rail (SCN-168, SCN-169; 0.3.7 wave 3): the acts of wave 2's `acts.history`, newest first, by day,
// each with who did it and «Отменить» or why it cannot be undone. Wave 4 adds the filters and the detail pane.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import type { ActAnswer, ActRecord, ActView } from '../../../shared/acts.ts'
import { HistoryScreen } from './HistoryScreen'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const record = (over: Partial<ActRecord> = {}): ActRecord => ({
  v: 1, kind: 'repo.detach', category: 'folders', subject: { type: 'repo', id: 'r1', label: 'fabric' },
  said: { key: 'act.repo.detach', params: { folder: 'fabric' } },
  inverse: { kind: 'repo.attach', args: { path: '/x' } }, why_not: null, undoes: null, ref_seq: 3, ...over
})
const row = (seq: number, over: Partial<ActView> = {}): ActView => ({
  seq, occurredAt: new Date().toISOString(), actor: { kind: 'person', id: 'o' }, projectId: null, record: record(), undo: { state: 'available' }, ...over
})

function mount(pages: Array<{ rows: ActView[]; next: number | null } | Error>, undo = vi.fn(async (_seq: number): Promise<ActAnswer> => ({ ok: true, seq: 99 }))) {
  const history = vi.fn(async () => {
    const p = pages.shift()
    if (!p) return { rows: [], next: null }
    if (p instanceof Error) throw p
    return p
  })
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { acts: { history, undo } } }))
  render(<I18nProvider locale="en"><HistoryScreen projects={[{ id: 'p1', name: 'Atlas' }]} mark={0} /></I18nProvider>)
  return { history, undo }
}

describe('История', () => {
  it('says it is reading, then lists the acts newest first with who did them and «Отменить»', async () => {
    const { undo } = mount([{ rows: [row(12, { projectId: 'p1' }), row(10, { actor: { kind: 'agent', id: 'codex' } })], next: null }])
    expect(screen.getByText(en['acts.reading'])).toBeTruthy()
    const list = await screen.findByRole('list', { name: en['acts.list'] })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toContain(en['acts.actor.you'])
    expect(items[0].textContent).toContain('Atlas')
    expect(items[1].textContent).toContain(en['acts.actor.agent'])
    expect(screen.getByText(en['acts.today'])).toBeTruthy()
    fireEvent.click(within(items[0]).getByRole('button', { name: en['act.undo'] }))
    await waitFor(() => expect(undo).toHaveBeenCalledWith(12))
  })

  it('an act that cannot be undone says why; an undone one says so', async () => {
    mount([{ rows: [row(12, { undo: { state: 'cannot', why: 'published' } }), row(10, { undo: { state: 'undone', by: 12 } })], next: null }])
    const items = within(await screen.findByRole('list', { name: en['acts.list'] })).getAllByRole('listitem')
    expect(items[0].textContent).toContain(en['act.why.published'])
    expect(within(items[0]).queryByRole('button', { name: en['act.undo'] })).toBeNull()
    expect(items[1].textContent).toContain(en['acts.undoneAt'])
  })

  it('an undo refused by the world changes nothing and says why', async () => {
    const undo = vi.fn(async (): Promise<ActAnswer> => ({ ok: false, reason: 'folder_gone', says: 'ENOENT /x' }))
    mount([{ rows: [row(12)], next: null }], undo)
    const item = within(await screen.findByRole('list', { name: en['acts.list'] })).getAllByRole('listitem')[0]
    fireEvent.click(within(item).getByRole('button', { name: en['act.undo'] }))
    await waitFor(() => expect(item.textContent).toContain(en['act.why.folder_gone']))
    expect(item.textContent).toContain('ENOENT /x')
  })

  it('reads earlier acts with «Ещё раньше»', async () => {
    const { history } = mount([{ rows: [row(12)], next: 12 }, { rows: [row(5)], next: null }])
    fireEvent.click(await screen.findByRole('button', { name: en['acts.more'] }))
    await waitFor(() => expect(within(screen.getByRole('list', { name: en['acts.list'] })).getAllByRole('listitem')).toHaveLength(2))
    expect(history).toHaveBeenLastCalledWith({ limit: 50, before: 12 })
    expect(screen.queryByRole('button', { name: en['acts.more'] })).toBeNull()
  })

  it('an empty history says what will appear there', async () => {
    mount([{ rows: [], next: null }])
    expect(await screen.findByText(en['acts.empty'])).toBeTruthy()
  })

  it('a failed read says so with the machine’s words and «Повторить», never an empty list', async () => {
    const { history } = mount([new Error('journal unreachable'), { rows: [row(3)], next: null }])
    expect(await screen.findByText(en['acts.failed'])).toBeTruthy()
    expect(screen.getByText('journal unreachable')).toBeTruthy()
    expect(screen.queryByText(en['acts.empty'])).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en['acts.retry'] }))
    await waitFor(() => expect(history).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('list', { name: en['acts.list'] })).toBeTruthy()
  })
})
