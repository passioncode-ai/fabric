// История on the rail (SCN-168, SCN-169; 0.3.7 wave 3): the acts of wave 2's `acts.history`, newest first, by day,
// each with who did it and «Отменить» or why it cannot be undone. Wave 4 adds the filters and the detail pane.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import type { ActAnswer, ActRecord, ActView } from '../../../shared/acts.ts'
import { HistoryScreen } from './HistoryScreen'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.sessionStorage.clear() })

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

describe('История shows what the agents did too (the operator\'s walk OF-34)', () => {
  it('lists the journal\'s events under «Что делали агенты», even when no act was recorded', async () => {
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { acts: { history: vi.fn(async () => ({ rows: [], next: null })), undo: vi.fn() } } }))
    const feed = [{ estate_id: 'e', seq: 7, type: 'task.moved@1', actor: { kind: 'agent', id: 's1' }, project_id: 'p1', occurred_at: '2026-10-22T10:00:00Z', payload: { to: 'review' } }]
    render(<I18nProvider locale="en"><HistoryScreen projects={[{ id: 'p1', name: 'Atlas' }]} mark={0} feed={feed} feedProjects={[{ id: 'p1', name: 'Atlas' } as never]} /></I18nProvider>)
    expect(await screen.findByRole('heading', { name: en['acts.agentsTitle'] })).toBeTruthy()
    expect(document.querySelector('.hx-agents .feed, .hx-agents ol, .hx-agents ul')).toBeTruthy()
  })
})

describe('История while the journal is unread (0.3.11 review ER-8, ER-9)', () => {
  it('says «reading» while the projects are unread, never an empty feed, and says a failed journal', async () => {
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { acts: { history: vi.fn(async () => ({ rows: [], next: null })), undo: vi.fn() } } }))
    const feed = [{ estate_id: 'e', seq: 7, type: 'task.moved@1', actor: { kind: 'agent', id: 's1' }, project_id: 'p1', occurred_at: '2026-10-22T10:00:00Z', payload: { to: 'review' } }]
    const { rerender } = render(<I18nProvider locale="en"><HistoryScreen projects={null} mark={0} feed={feed} feedProjects={null} /></I18nProvider>)
    await screen.findByRole('heading', { name: en['acts.agentsTitle'] })
    expect(document.querySelector('.hx-agents')!.textContent).not.toMatch(/task|moved|Atlas/i)
    rerender(<I18nProvider locale="en"><HistoryScreen projects={null} mark={0} feed={null} feedProjects={null} feedFailed /></I18nProvider>)
    expect(screen.getByText(en['acts.agentsUnread'])).toBeTruthy()
  })
})

describe('«Что делали агенты» reads as History (CO-395)', () => {
  it('groups by day, newest first, names who did it, and shows no journal number', async () => {
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { acts: { history: vi.fn(async () => ({ rows: [], next: null })), undo: vi.fn() } } }))
    const today = new Date(), yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 12) // noon of the previous calendar day: a day around a clock change is not 24 hours
    const ev = (seq: number, at: Date, actor: { kind: string; id: string }) => ({ estate_id: 'e', seq, type: 'task.moved@1', actor, project_id: 'p1', occurred_at: at.toISOString(), payload: { to: 'review' } })
    const feed = [ev(41, yesterday, { kind: 'agent', id: 'gone' }), ev(42, today, { kind: 'agent', id: 's1' }), ev(43, today, { kind: 'person', id: 'op' })]
    const sessions = [{ sessionId: 's1', program: 'claude-code' } as never]
    render(<I18nProvider locale="en"><HistoryScreen projects={[{ id: 'p1', name: 'Atlas' }]} mark={0} feed={feed} feedProjects={[{ id: 'p1', name: 'Atlas' } as never]} sessions={sessions} /></I18nProvider>)
    await screen.findByRole('heading', { name: en['acts.agentsTitle'] })
    const list = document.querySelector('.hx-agents')!
    expect([...list.querySelectorAll('.hx-day')].map((d) => d.textContent)).toEqual([en['acts.today'], en['acts.yesterday']])
    expect([...list.querySelectorAll('.hx-who')].map((d) => d.textContent)).toEqual([en['acts.actor.you'], en['agents.claudeCode'], en['acts.actor.agent']])
    expect(list.textContent).not.toMatch(/#4\d/)
    expect(list.textContent).toContain('Atlas')
  })
})

describe('История while only the projects fail (CO-405)', () => {
  it('shows the journal\'s rows without project names instead of «reading» for as long as the projects keep failing', async () => {
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { acts: { history: vi.fn(async () => ({ rows: [], next: null })), undo: vi.fn() } } }))
    const feed = [{ estate_id: 'e', seq: 7, type: 'task.moved@1', actor: { kind: 'person', id: 'op' }, project_id: 'p1', occurred_at: new Date().toISOString(), payload: { to: 'review' } }]
    render(<I18nProvider locale="en"><HistoryScreen projects={null} mark={0} feed={feed} feedProjects={null} projectsFailed /></I18nProvider>)
    await screen.findByRole('heading', { name: en['acts.agentsTitle'] })
    const list = document.querySelector('.hx-agents')!
    expect(list.querySelectorAll('.hx-act')).toHaveLength(1)
    expect(list.textContent).not.toContain(en['journal.reading'])
  })
})

describe('a task Fabric released names no agent (CO-430)', () => {
  it('says Fabric released it because its session ended, and an agent\'s own release still says an agent did', async () => {
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { acts: { history: vi.fn(async () => ({ rows: [], next: null })), undo: vi.fn() } } }))
    const at = new Date().toISOString()
    const released = (seq: number, actor: { kind: string; id: string }) => ({ estate_id: 'e', seq, type: 'work.released@1', actor, project_id: 'p1', occurred_at: at, payload: { work: 't1', how: 'lapsed' } })
    const feed = [released(51, { kind: 'system', id: 'work-sweep' }), released(50, { kind: 'agent', id: 's1' })]
    render(<I18nProvider locale="en"><HistoryScreen projects={[{ id: 'p1', name: 'Atlas' }]} mark={0} feed={feed} feedProjects={[{ id: 'p1', name: 'Atlas' } as never]} /></I18nProvider>)
    await screen.findByRole('heading', { name: en['acts.agentsTitle'] })
    const rows = [...document.querySelectorAll('.hx-agents .hx-act')]
    expect(rows).toHaveLength(2)
    expect(rows[0].querySelector('.hx-who')!.textContent).toBe(en['acts.actor.fabric'])
    expect(rows[0].querySelector('.hx-said')!.textContent).toContain(en['acts.releasedByFabric'])
    expect(rows[0].textContent).not.toContain(en['event.work.released@1'])
    expect(rows[1].querySelector('.hx-said')!.textContent).toContain(en['event.work.released@1'])
  })

  it('says the operator released it themselves, without an agent (CO-430\'s rest)', async () => {
    const { ru } = await import('../i18n/ru')
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { acts: { history: vi.fn(async () => ({ rows: [], next: null })), undo: vi.fn() } } }))
    const feed = [{ estate_id: 'e', seq: 52, type: 'work.released@1', actor: { kind: 'person', id: 'operator' }, project_id: 'p1', occurred_at: new Date().toISOString(), payload: {} }]
    render(<I18nProvider locale="ru"><HistoryScreen projects={[{ id: 'p1', name: 'Atlas' }]} mark={0} feed={feed} feedProjects={[{ id: 'p1', name: 'Atlas' } as never]} /></I18nProvider>)
    await screen.findByRole('heading', { name: ru['acts.agentsTitle'] })
    const row = document.querySelector('.hx-agents .hx-act')!
    expect(row.querySelector('.hx-who')!.textContent).toBe(ru['acts.actor.you'])
    expect(row.querySelector('.hx-said')!.textContent).toContain(ru['acts.releasedByYou'])
    expect(row.textContent).not.toContain(ru['event.work.released@1'])
  })

  it('says it in Russian without an agent too', async () => {
    const { ru } = await import('../i18n/ru')
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { acts: { history: vi.fn(async () => ({ rows: [], next: null })), undo: vi.fn() } } }))
    const feed = [{ estate_id: 'e', seq: 51, type: 'work.released@1', actor: { kind: 'system', id: 'session-end' }, project_id: 'p1', occurred_at: new Date().toISOString(), payload: {} }]
    render(<I18nProvider locale="ru"><HistoryScreen projects={[{ id: 'p1', name: 'Atlas' }]} mark={0} feed={feed} feedProjects={[{ id: 'p1', name: 'Atlas' } as never]} /></I18nProvider>)
    await screen.findByRole('heading', { name: ru['acts.agentsTitle'] })
    const said = document.querySelector('.hx-agents .hx-said')!.textContent
    expect(said).toContain(ru['acts.releasedByFabric'])
    expect(said).not.toContain(ru['event.work.released@1'])
  })
})

// CO-414 (SCN-168 steps 2 and 3): the filters «Кто», «Проект», «Что» and a search, kept when the person comes back, and
// one act read whole beside the list.
describe('История filters and the act in full (CO-414)', () => {
  const filters = () => screen.getByRole('group', { name: en['acts.filter.label'] })
  const select = (label: string) => within(filters()).getByLabelText(label) as HTMLSelectElement

  it('each filter goes into the read; an unfiltered read asks for what it always did', async () => {
    const { history } = mount([{ rows: [row(12)], next: null }, { rows: [row(11)], next: null }, { rows: [row(10)], next: null }, { rows: [row(9)], next: null }, { rows: [row(8)], next: null }])
    await screen.findByRole('list', { name: en['acts.list'] })
    expect(history).toHaveBeenLastCalledWith({ limit: 50 })
    fireEvent.change(select(en['acts.filter.who']), { target: { value: 'system' } })
    await waitFor(() => expect(history).toHaveBeenLastCalledWith({ limit: 50, actorKind: 'system' }))
    fireEvent.change(select(en['acts.filter.project']), { target: { value: 'p1' } })
    await waitFor(() => expect(history).toHaveBeenLastCalledWith({ limit: 50, actorKind: 'system', projectId: 'p1' }))
    fireEvent.change(select(en['acts.filter.what']), { target: { value: 'folders' } })
    await waitFor(() => expect(history).toHaveBeenLastCalledWith({ limit: 50, actorKind: 'system', projectId: 'p1', category: 'folders' }))
    fireEvent.change(within(filters()).getByLabelText(en['acts.filter.search']), { target: { value: 'fabric' } })
    await waitFor(() => expect(history).toHaveBeenLastCalledWith({ limit: 50, actorKind: 'system', projectId: 'p1', category: 'folders', text: 'fabric' }))
  })

  it('filters that match nothing say so with «Сбросить фильтры», which reads everything again', async () => {
    const { history } = mount([{ rows: [row(12)], next: null }, { rows: [], next: null }, { rows: [row(12)], next: null }])
    await screen.findByRole('list', { name: en['acts.list'] })
    fireEvent.change(select(en['acts.filter.what']), { target: { value: 'releases' } })
    expect(await screen.findByText(en['acts.filter.none'])).toBeTruthy()
    expect(screen.queryByText(en['acts.empty'])).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en['acts.filter.reset'] }))
    await waitFor(() => expect(history).toHaveBeenLastCalledWith({ limit: 50 }))
    expect(select(en['acts.filter.what']).value).toBe('')
    expect(await screen.findByRole('list', { name: en['acts.list'] })).toBeTruthy()
  })

  it('the filters stay when the person leaves История and comes back', async () => {
    mount([{ rows: [row(12)], next: null }, { rows: [row(12)], next: null }])
    await screen.findByRole('list', { name: en['acts.list'] })
    fireEvent.change(select(en['acts.filter.who']), { target: { value: 'person' } })
    await waitFor(() => expect(select(en['acts.filter.who']).value).toBe('person'))
    cleanup()
    const { history } = mount([{ rows: [row(12)], next: null }])
    await screen.findByRole('list', { name: en['acts.list'] })
    expect(select(en['acts.filter.who']).value).toBe('person')
    expect(history).toHaveBeenCalledWith({ limit: 50, actorKind: 'person' })
  })

  it('an act opens whole beside the list: who, when, its project, before and after, and the act that undid it', async () => {
    const move = record({ kind: 'task.move', category: 'tasks', subject: { type: 'task', id: 't9', label: 'Ship it' }, said: { key: 'act.task.move', params: { task: 'Ship it', from: 'running', to: 'review' } }, inverse: { kind: 'task.move', args: { to: 'running' } } })
    const back = record({ kind: 'task.move', category: 'tasks', subject: { type: 'task', id: 't9', label: 'Ship it' }, said: { key: 'act.task.move', params: { task: 'Ship it', from: 'review', to: 'running' } }, undoes: 10 })
    const history = vi.fn(async () => ({ rows: [row(12, { record: back, projectId: 'p1' }), row(10, { record: move, projectId: 'p1', undo: { state: 'undone', by: 12 } })], next: null }))
    const onOpen = vi.fn()
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { acts: { history, undo: vi.fn() } } }))
    render(<I18nProvider locale="en"><HistoryScreen projects={[{ id: 'p1', name: 'Atlas' }]} mark={0} onOpen={onOpen} /></I18nProvider>)
    const items = within(await screen.findByRole('list', { name: en['acts.list'] })).getAllByRole('listitem')
    expect(screen.queryByRole('region', { name: /Ship it/ })).toBeNull()
    const sentence = en['act.task.move'].replace('{task}', 'Ship it').replace('{to}', en['act.state.review'])
    fireEvent.click(within(items[1]).getByRole('button', { name: sentence }))
    const pane = await screen.findByRole('region', { name: sentence })
    expect(pane.textContent).toContain(en['acts.actor.you'])
    expect(pane.textContent).toContain('Atlas')
    expect(within(pane).getByText(en['act.state.running'])).toBeTruthy()
    expect(within(pane).getByText(en['act.state.review'])).toBeTruthy()
    // The act that undid it, in words, never a journal number.
    expect(pane.textContent).toContain(en['act.task.move'].replace('{task}', 'Ship it').replace('{to}', en['act.state.running']))
    expect(pane.textContent).not.toMatch(/#1\d/)
    fireEvent.click(within(pane).getByRole('button', { name: en['acts.detail.source'] }))
    expect(onOpen).toHaveBeenCalledWith('p1', { kind: 'task', id: 't9' })
    fireEvent.click(within(pane).getByRole('button', { name: en['acts.detail.close'] }))
    await waitFor(() => expect(screen.queryByRole('region', { name: sentence })).toBeNull())
  })
})
