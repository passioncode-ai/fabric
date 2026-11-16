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
    // The operator, 2026-11-12: the card says what is wanted, not why; the why is on the Board.
    expect(card.querySelector('.lh-q-why')).toBeNull()
    // «Открыть доску» in the column's head opens the Board.
    fireEvent.click(screen.getByRole('button', { name: en['launch.home.board.open'] }))
    expect(onBoard).toHaveBeenCalledWith()
    onBoard.mockClear()
    expect(screen.getByRole('heading', { name: new RegExp(en['launch.home.board.title']) }).textContent).toContain('1')
    // The question itself opens the item on the board, with the item's own ref (0.3.11 review UX-4).
    fireEvent.click(within(card).getByRole('button', { name: /SB-114/ }))
    expect(onBoard).toHaveBeenCalledWith(entry.ref)
    // A click on the card's body opens it too.
    onBoard.mockClear()
    fireEvent.click(card.querySelector('.lh-q-from')!)
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
    const q = (id: string, why?: string) => ({ kind: 'question', ref: `question:${id}`, subject: { kind: 'question', id }, projectId: 'p1', projectName: 'private29', title: `Q ${id}`,
      detail: 'blocking 1 task', waitingSince: '2026-10-22T00:00:00Z', origin: 'authored', question: { revision: 1, options: [{ id: 'a', label: 'Yes' }] }, ...(why ? { why } : {}) })
    vi.stubGlobal('window', Object.assign(window, { fabric: { board: { query: vi.fn(async () => ({ data: { items: [q('1', 'Rules change the check of texts in every project that picked this voice.'), q('2')], total: 2, hidden: 0, countsByProject: {} }, sources: [], asOf: null, freshness: 'fresh' })) } } }))
    render(<I18nProvider locale="en"><HomeBoard feedMark={0} onBoard={vi.fn()} /></I18nProvider>)
    await waitFor(() => expect(screen.getByText('Q 1')).toBeTruthy())
    // The operator, 2026-11-12: no why line on Главная at all (the Board shows it under «Подробнее»).
    const [one, two] = screen.getAllByRole('article')
    expect(one.querySelector('.lh-q-why')).toBeNull()
    expect(two.querySelector('.lh-q-why')).toBeNull()
    expect(document.body.textContent).not.toContain(en['board.blocks.one'].replace('{count}', '1'))
  })
})

describe('a question on Главная is answered where it is read (SCN-163 step 2, CO-391)', () => {
  it('shows the options as buttons and records the chosen one; the count reaches the greeting', async () => {
    const item = { kind: 'question', ref: 'question:q9', subject: { kind: 'question', id: 'q9' }, projectId: 'p1', projectName: 'Fabric', title: 'Which?', detail: null, waitingSince: '2026-10-22T00:00:00Z', origin: 'authored', askedBy: { kind: 'agent', agent: 'codex' }, question: { revision: 2, options: [{ id: 'a', label: 'Keep it' }, { id: 'b', label: 'Drop it', recommended: true }] } }
    const query = vi.fn(async () => ({ data: { items: [item], total: 1, hidden: 0, countsByProject: {} }, sources: [], asOf: null, freshness: 'fresh' }))
    const answer = vi.fn(async (_input: unknown) => ({ committed: true, repeated: false, unblocked: [], stillBlocked: [], continuations: [] }))
    vi.stubGlobal('window', Object.assign(window, { fabric: { board: { query }, questions: { answer } } }))
    const onTotal = vi.fn()
    render(<I18nProvider locale="en"><HomeBoard feedMark={0} onBoard={vi.fn()} onTotal={onTotal} /></I18nProvider>)
    await waitFor(() => expect(screen.getByText('Which?')).toBeTruthy())
    expect(onTotal).toHaveBeenCalledWith(1)
    // The operator, 2026-11-12: the recommended answer first and gold, the rest plain, and «Отдать агенту» (only on an agent's question with options since the 0.3.21 review, UX-19).
    const acts = within(screen.getByRole('group', { name: en['launch.board.options'] })).getAllByRole('button')
    expect(acts.map((b) => b.textContent)).toEqual([en['launch.board.recommended'] + ': Drop it', 'Keep it', en['launch.board.delegate']])
    expect(acts[0].className).toContain('gold')
    expect(acts[1].className).not.toContain('gold')
    fireEvent.click(acts[0])
    await waitFor(() => expect(answer).toHaveBeenCalled())
    expect(answer.mock.calls[0]?.[0]).toMatchObject({ questionId: 'q9', projectId: 'p1', expectedRevision: 2, chosenOption: 'b' })
  })
})

describe('SCN-179 (CO-521): work handed in for review is decided on its card', () => {
  it('shows what the agent handed in and the three answers; accepting sends the decision for the task', async () => {
    const review = { ...entry, subject: { kind: 'task', id: 't1' }, detail: null,
      handedIn: { said: 'Released in v0.6.28; open: SB-116.', by: 'agent', at: '2026-10-13T08:00:00Z' } }
    const decide = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('window', Object.assign(window, { fabric: {
      board: { query: vi.fn(async () => ({ data: { items: [review], total: 1, hidden: 0, countsByProject: {} }, sources: [], asOf: null, freshness: 'fresh' })) },
      tasks: { decide } } }))
    const onBoard = vi.fn()
    render(<I18nProvider locale="en"><HomeBoard feedMark={0} onBoard={onBoard} /></I18nProvider>)
    const card = await screen.findByRole('article', { name: /SB-114/ })
    expect(card.textContent).toContain('Released in v0.6.28; open: SB-116.')
    fireEvent.click(within(card).getByRole('button', { name: en['review.accept'] }))
    await waitFor(() => expect(decide).toHaveBeenCalledWith('t1', 'accept', ''))
    expect(onBoard).not.toHaveBeenCalled()
  })
})

describe('UX-3 (0.3.21 review, iteration 1): a question with no options offers no button that does nothing', () => {
  it('shows the answer box and no «Leave it to the agent»', async () => {
    const open = { kind: 'question', ref: 'question:q1', projectId: 'p1', projectName: 'Switchboard', title: 'Which account goes first?',
      detail: null, waitingSince: '2026-10-12T00:00:00Z', origin: 'derived', question: { id: 'q1', options: [] } }
    vi.stubGlobal('window', Object.assign(window, { fabric: { board: { query: vi.fn(async () => ({ data: { items: [open], total: 1, hidden: 0, countsByProject: {} }, sources: [], asOf: null, freshness: 'fresh' })) } } }))
    render(<I18nProvider locale="en"><HomeBoard feedMark={0} onBoard={() => {}} /></I18nProvider>)
    await waitFor(() => expect(screen.getByText(/Which account goes first/)).toBeTruthy())
    expect(screen.queryByRole('button', { name: en['launch.board.delegate'] })).toBeNull()
  })
})

describe('UX-19 (0.3.21 review, iteration 3, run three): a person\'s question with options offers no «Leave it to the agent»', () => {
  it('shows the options and no delegate button, as the Board does', async () => {
    const mine = { kind: 'question', ref: 'question:q2', projectId: 'p1', projectName: 'Switchboard', title: 'Which name do we keep?',
      detail: null, waitingSince: '2026-10-12T00:00:00Z', origin: 'authored', askedBy: { kind: 'person', agent: null },
      question: { id: 'q2', revision: 1, options: [{ id: 'a', label: 'Keep it', recommended: true }, { id: 'b', label: 'Drop it' }] } }
    vi.stubGlobal('window', Object.assign(window, { fabric: { board: { query: vi.fn(async () => ({ data: { items: [mine], total: 1, hidden: 0, countsByProject: {} }, sources: [], asOf: null, freshness: 'fresh' })) } } }))
    render(<I18nProvider locale="en"><HomeBoard feedMark={0} onBoard={() => {}} /></I18nProvider>)
    await waitFor(() => expect(screen.getByText(/Which name do we keep/)).toBeTruthy())
    expect(screen.getByRole('button', { name: /Keep it/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: en['launch.board.delegate'] })).toBeNull()
  })
})

// The operator, 2026-11-16: «Два перехода внутрь тоже сделаем, чтобы было без перехода»: every «Нужны вы» card is
// decided where it is read; none of them sends the person to the board to act.
describe('every «Нужны вы» card is decided on Главная, without opening the board (2026-11-16)', () => {
  const board = (items: unknown[], extra: Record<string, unknown> = {}) =>
    Object.assign(window, { fabric: { board: { query: vi.fn(async () => ({ data: { items, total: items.length, hidden: 0, countsByProject: {} }, sources: [], asOf: null, freshness: 'fresh' })) }, ...extra } })

  it('an access request offers Deny and Allow in the card, and Deny answers the request', async () => {
    const decide = vi.fn(async () => ({ ok: true }))
    const access = {
      requestId: 'r1', agent: { agentId: 'a1', name: 'Kira', installedBy: null, repository: null }, callee: 'fabric', product: 'Fabric',
      connected: true, ask: [{ kind: 'enroll', project: { id: 'p1', name: 'Fabric' } }], reason: 'to work here', incremental: false,
      requestedAt: '2026-11-16T10:00:00Z', expiresAt: '2026-11-17T10:00:00Z'
    }
    vi.stubGlobal('window', board([{ kind: 'access', ref: 'access/request:r1', subject: { kind: 'access-request', id: 'r1' }, projectId: 'p1', projectName: 'Fabric',
      title: 'Kira asks for access', detail: null, waitingSince: '2026-11-16T10:00:00Z', origin: 'derived', access }], { hub: { decide } }))
    render(<I18nProvider locale="en"><HomeBoard feedMark={0} onBoard={vi.fn()} /></I18nProvider>)
    const card = await screen.findByRole('article', { name: /Kira asks/ })
    // Compact on Главная: the rest of the prompt's facts wait behind «More».
    expect(within(card).getByText(en['launch.board.decide.details']).closest('details')).not.toBeNull()
    expect(within(card).queryByRole('button', { name: en['launch.home.board.openOne'] })).toBeNull()
    fireEvent.click(within(card).getByRole('button', { name: new RegExp(en['access.deny']) }))
    await waitFor(() => expect(decide).toHaveBeenCalledWith('r1', 'denied'))
  })

  it('a refused act is asked as its question, its target apart, and «Allow once» issues the grant', async () => {
    const grant = vi.fn(async () => ({ expiresAt: '2026-11-16T13:00:00Z' }))
    vi.stubGlobal('window', board([{ kind: 'refused', ref: 'refused/refusal:7', subject: { kind: 'refusal', id: '7' }, projectId: 'p1', projectName: 'Fabric',
      title: 'Publishing was refused', detail: 'The release agent tried to publish 0.3.22.', waitingSince: '2026-11-16T10:00:00Z', origin: 'derived', grantable: { floorClass: 'publication', target: 'npm', askedBecause: null } }],
    { attention: { grant } }))
    render(<I18nProvider locale="en"><HomeBoard feedMark={0} onBoard={vi.fn()} /></I18nProvider>)
    const card = await screen.findByRole('article', { name: en['launch.board.decide.refused.publication'] })
    expect(within(card).getByText('npm').tagName).toBe('CODE')
    expect(within(card).getByText('The release agent tried to publish 0.3.22.')).toBeTruthy()
    expect(within(card).queryByRole('button', { name: en['launch.home.board.openOne'] })).toBeNull()
    fireEvent.click(within(card).getByRole('button', { name: en['ceo.grant'] }))
    await waitFor(() => expect(grant).toHaveBeenCalledWith({ projectId: 'p1', floorClass: 'publication', target: 'npm' }))
  })

  it('an overdue review the agent wrote nothing for is still accepted in the card', async () => {
    const decideTask = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('window', board([{ kind: 'review', ref: 'review/task:t9', subject: { kind: 'task', id: 't9' }, projectId: 'p1', projectName: 'Fabric',
      title: 'Ship the login fix', detail: null, waitingSince: '2026-11-10T10:00:00Z', reviewSince: '2026-11-10T10:00:00Z', overdue: true, origin: 'derived' }],
    { tasks: { decide: decideTask } }))
    render(<I18nProvider locale="en"><HomeBoard feedMark={0} onBoard={vi.fn()} /></I18nProvider>)
    const card = await screen.findByRole('article', { name: /Ship the login fix/ })
    expect(within(card).queryByRole('button', { name: en['launch.home.board.openOne'] })).toBeNull()
    fireEvent.click(within(card).getByRole('button', { name: en['review.accept'] }))
    await waitFor(() => expect(decideTask).toHaveBeenCalledWith('t9', 'accept', ''))
  })
})

describe('«Нужны вы» with nothing to decide takes no room when the home asks so (2026-11-16)', () => {
  it('renders nothing when clear and `hideWhenClear`, yet still reports its count', async () => {
    vi.stubGlobal('window', Object.assign(window, { fabric: { board: { query: vi.fn(async () => ({ data: { items: [], total: 0, hidden: 0, countsByProject: {} }, sources: [], asOf: null, freshness: 'fresh' })) } } }))
    const onTotal = vi.fn()
    const { container } = render(<I18nProvider locale="en"><HomeBoard feedMark={0} onBoard={vi.fn()} onTotal={onTotal} hideWhenClear /></I18nProvider>)
    await waitFor(() => expect(onTotal).toHaveBeenCalledWith(0))
    expect(container.querySelector('#sec-board')).toBeNull()
  })
})
