// «Нужны вы» on the home (the operator's walk, OF-14, 2026-10-22): what is needed from the person, each row opening in
// place to read all of it, with the way to the board inside it.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { HomeBoard, NEEDS_YOU_LIMIT } from './HomeParts'

const entry = {
  kind: 'review', ref: 'review:t1', projectId: 'p1', projectName: 'Switchboard', title: 'SB-114: recovery after account limits',
  detail: 'The agent finished and asks you to check the recovery path', waitingSince: '2026-10-12T00:00:00Z', origin: 'derived'
}

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('the home says what is needed from the person (OF-14, the approved mockup)', () => {
  it('is titled «Нужны вы» with its count; each item is an open card saying who asks and why, its question opening the board', async () => {
    vi.stubGlobal('window', Object.assign(window, { fabric: { board: { query: vi.fn(async () => ({ data: { items: [entry], total: 1, hidden: 0, countsByProject: {} }, sources: [], asOf: null, freshness: 'fresh' })) } } }))
    const onBoard = vi.fn()
    const { container } = render(<I18nProvider locale="en"><HomeBoard feedMark={0} onBoard={onBoard} /></I18nProvider>)
    expect(screen.getByRole('heading', { name: new RegExp(en['launch.home.board.title']) })).toBeTruthy()
    await waitFor(() => expect(screen.getByText(/SB-114/)).toBeTruthy())
    // The mockup (gap map F2 to F4): no closed rows, no kicker, no board button in the head, no footer.
    expect(container.querySelector('details')).toBeNull()
    expect(screen.queryByText(en['launch.home.board.kicker'])).toBeNull()
    expect(container.querySelector('.lp-panel-foot')).toBeNull()
    expect(screen.queryByRole('button', { name: en['launch.board.addTopic'] })).toBeNull()
    const card = screen.getByRole('article', { name: /SB-114/ })
    expect(card.textContent).toContain('Switchboard')
    // The why is read without opening anything.
    expect(card.textContent).toContain('asks you to check the recovery path')
    expect(screen.getByRole('heading', { name: new RegExp(en['launch.home.board.title']) }).textContent).toContain('1')
    // The question itself opens the item on the board, with the item's own ref (0.3.11 review UX-4).
    fireEvent.click(within(card).getByRole('button', { name: /SB-114/ }))
    expect(onBoard).toHaveBeenCalledWith(entry.ref)
    // A click on the card's body opens it too.
    onBoard.mockClear()
    fireEvent.click(card.querySelector('.lh-q-why')!)
    expect(onBoard).toHaveBeenCalledWith(entry.ref)
  })

  it('shows every item the read returns, and says how many more wait on the board', async () => {
    const items = Array.from({ length: 4 }, (_, i) => ({ ...entry, ref: `review:t${i}`, title: `Item ${i}` }))
    vi.stubGlobal('window', Object.assign(window, { fabric: { board: { query: vi.fn(async () => ({ data: { items, total: 6, hidden: 2, countsByProject: {} }, sources: [], asOf: null, freshness: 'fresh' })) } } }))
    const onBoard = vi.fn()
    render(<I18nProvider locale="en"><HomeBoard feedMark={0} onBoard={onBoard} /></I18nProvider>)
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(4))
    fireEvent.click(screen.getByRole('button', { name: en['launch.home.board.more'].replace('{count}', '2') }))
    expect(onBoard).toHaveBeenCalledWith()
  })
})

describe('«Нужны вы» shows only what the person resolves, naming who asks (CO-391)', () => {
  it('asks the board for the person\'s part only, and names the asking agent, an unknown agent or a person', async () => {
    const q = (id: string, askedBy: unknown) => ({ kind: 'question', ref: `question:${id}`, projectId: 'p1', projectName: 'Fabric', title: `Q ${id}`, detail: null, waitingSince: '2026-10-22T00:00:00Z', origin: 'authored', askedBy })
    const query = vi.fn(async () => ({ data: { items: [q('1', { kind: 'agent', agent: 'claude-code' }), q('2', { kind: 'agent', agent: null }), q('3', { kind: 'person', agent: null })], total: 3, hidden: 0, countsByProject: {} }, sources: [], asOf: null, freshness: 'fresh' }))
    vi.stubGlobal('window', Object.assign(window, { fabric: { board: { query } } }))
    const { container } = render(<I18nProvider locale="en"><HomeBoard feedMark={0} onBoard={vi.fn()} /></I18nProvider>)
    await waitFor(() => expect(screen.getByText('Q 1')).toBeTruthy())
    expect(query).toHaveBeenCalledWith({ projectId: null, limit: NEEDS_YOU_LIMIT, personOnly: true })
    const text = container.textContent ?? ''
    expect(text).toMatch(/Fabric · Claude Code asks/)
    expect(text).toContain('Fabric · ' + en['needsYou.askedByAnAgent'])
    expect(text).toContain('Fabric · ' + en['needsYou.askedByPerson'])
  })
})

describe('a question\'s muted line says why it is asked, never the board\'s count of what it blocks (the home harness bug)', () => {
  it('shows the asker\'s own «why», and nothing when it wrote none, never «Blocks 1 task» as its reason', async () => {
    const q = (id: string, why?: string) => ({ kind: 'question', ref: `question:${id}`, subject: { kind: 'question', id }, projectId: 'p1', projectName: 'Copylot', title: `Q ${id}`,
      detail: 'blocking 1 task', waitingSince: '2026-10-22T00:00:00Z', origin: 'authored', question: { revision: 1, options: [{ id: 'a', label: 'Yes' }] }, ...(why ? { why } : {}) })
    vi.stubGlobal('window', Object.assign(window, { fabric: { board: { query: vi.fn(async () => ({ data: { items: [q('1', 'Rules change the check of texts in every project that picked this voice.'), q('2')], total: 2, hidden: 0, countsByProject: {} }, sources: [], asOf: null, freshness: 'fresh' })) } } }))
    render(<I18nProvider locale="en"><HomeBoard feedMark={0} onBoard={vi.fn()} /></I18nProvider>)
    await waitFor(() => expect(screen.getByText('Q 1')).toBeTruthy())
    const [one, two] = screen.getAllByRole('article')
    expect(one.querySelector('.lh-q-why')?.textContent).toBe('Rules change the check of texts in every project that picked this voice.')
    expect(two.querySelector('.lh-q-why')).toBeNull()
    expect(document.body.textContent).not.toContain(en['board.blocks.one'].replace('{count}', '1'))
  })
})

describe('a question on Главная is answered where it is read (SCN-163 step 2, CO-391)', () => {
  it('shows the options as buttons and records the chosen one; the count reaches the greeting', async () => {
    const item = { kind: 'question', ref: 'question:q9', subject: { kind: 'question', id: 'q9' }, projectId: 'p1', projectName: 'Fabric', title: 'Which?', detail: null, waitingSince: '2026-10-22T00:00:00Z', origin: 'authored', askedBy: { kind: 'person', agent: null }, question: { revision: 2, options: [{ id: 'a', label: 'Keep it' }, { id: 'b', label: 'Drop it' }] } }
    const query = vi.fn(async () => ({ data: { items: [item], total: 1, hidden: 0, countsByProject: {} }, sources: [], asOf: null, freshness: 'fresh' }))
    const answer = vi.fn(async (_input: unknown) => ({ committed: true, repeated: false, unblocked: [], stillBlocked: [], continuations: [] }))
    vi.stubGlobal('window', Object.assign(window, { fabric: { board: { query }, questions: { answer } } }))
    const onTotal = vi.fn()
    render(<I18nProvider locale="en"><HomeBoard feedMark={0} onBoard={vi.fn()} onTotal={onTotal} /></I18nProvider>)
    await waitFor(() => expect(screen.getByText('Which?')).toBeTruthy())
    expect(onTotal).toHaveBeenCalledWith(1)
    // The answers are visible on the card (gap map F3): the first as the gold primary, the rest plain.
    expect(screen.getByRole('button', { name: 'Keep it' }).className).toContain('gold')
    expect(screen.getByRole('button', { name: 'Drop it' }).className).not.toContain('gold')
    fireEvent.click(screen.getByRole('button', { name: 'Drop it' }))
    await waitFor(() => expect(answer).toHaveBeenCalled())
    expect(answer.mock.calls[0]?.[0]).toMatchObject({ questionId: 'q9', projectId: 'p1', expectedRevision: 2, chosenOption: 'b' })
  })
})
