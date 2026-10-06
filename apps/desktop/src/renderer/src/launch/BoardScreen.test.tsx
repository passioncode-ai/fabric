// The receipt M168 built on purpose, thrown away by the only caller (UX28-12).
//
// MOVED 2026-09-29 with the acts themselves: the CEO side panel these cases were written
// against was retired when the Board became a screen (SCR-41), and the acts moved to
// `launch/ObligationActs.tsx`, which the board's details render. Every case below is the
// same rule held against the new home; only the way to reach the row changed (open it).
//
// `proposals.decide` used to return `void`. M168 changed that DELIBERATELY, and
// the contract in `shared/types.ts` says why in its own words: "this returned
// `void`, so a refusal had nowhere to go and the only way to say no was to
// throw, which reaches a renderer as 'Error invoking remote method'. The
// contract itself forbade the answer. It now carries the checker's receipt: a
// reason code, what to do about it, and whether trying again could ever work."
//
// `AttentionPanel` calls it like this:
//
//     void window.fabric.proposals.decide(item.proposal!.id, 'accepted')
//       .catch((e) => onError(String(e)))
//
// `void`, and a `.catch` — so the ONLY outcome that reaches the operator is a
// thrown one, and `decideProposal` returns `ok: false` in four places without
// throwing from any of them. `Rejection` carries `says`, `remedy` ("a refusal
// with no next step is a wall"), `retryable`, `fieldPath` and `checkerVersion`.
// None of it is rendered. Neither is `taskId` — the canonical ref of the thing
// an acceptance CREATED.
//
// So a refused acceptance looks exactly like a successful one: nothing happens
// on screen. That is UX28-12's negative acceptance word for word — advice
// cannot be shown as a committed artifact — reached from the other side: the
// operator believes the task exists because the refusal is invisible.
//
// AND THE ROW STAYS DECIDABLE. The list is re-read on a 15-second timer and
// NOT after a decision, so for up to fifteen seconds both buttons remain live
// on a proposal that is already decided. `decideProposal` revalidates at commit
// precisely because two windows can race — its own header says so — so the
// second click is refused with `already_decided`, and that refusal is discarded
// too. SCN-011's Errors & recovery names the remedy: "already-resolved proposal
// shows the existing resolution and disables duplicate action".
//
// The eight milestones UX28-12 depends on (M153, M158, M166, M167, M169, M171,
// M175, M194) are all unshipped, and the card excludes building a competing
// CEO. This is the half of the card that is about SHIPPED code.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BoardScreen } from './BoardScreen'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { checkProposalDecision, type Rejection } from '../../../shared/proposals'
import type { AttentionItem, ProjectRow } from '../../../shared/types'
import { boardEntries, cutBoard, type BoardCut } from '../../../shared/board'
import { envelope, type ReadEnvelope } from '../../../shared/readEnvelope'
import { attentionOf } from '../../../shared/attention'
import { pendingFacts } from '../../../shared/access'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** A proposal row as the reader produces one. */
const item = (over: Partial<AttentionItem> = {}): AttentionItem =>
  ({
    kind: 'proposal',
    ref: { kind: 'proposal', id: 'pr-1' },
    projectId: 'p1',
    projectName: 'Atlas',
    title: 'Atlas should adopt the ledger',
    detail: null,
    since: '2026-09-10T00:00:00Z',
    proposal: { id: 'pr-1', depth: 2, bound: 3 },
    ...over
  }) as AttentionItem

const rejectionOf = (decision: unknown = 'accepted'): Rejection => {
  const result = checkProposalDecision({
    facts: {
      id: 'pr-1',
      proposal: { id: 'pr-1', project_id: 'p1', title: 'adopt the ledger', decided_at: '2026-09-10T00:00:00Z', decision: 'accepted' },
      projectExists: true
    },
    decision
  })
  if (result.ok) throw new Error('the fixture is not a refusal, so it proves nothing')
  return result
}

const STAMP = '2026-09-11T00:00:00Z'

/** The board the main process builds, built here BY THE SAME FUNCTIONS: the producer turns the
 *  obligations into entries, `cutBoard` cuts them, `envelope` derives availability from the
 *  receipts — so a fixture cannot claim `complete` beside a source that failed. */
const boardOf = (items: AttentionItem[], sources: { name: string; status: 'ok' | 'error'; asOf: string | null; errorCode?: string }[]): ReadEnvelope<BoardCut> =>
  envelope({
    data: cutBoard(boardEntries({ questions: [], attention: items, projectWeightOf: () => 1, now: new Date(STAMP) }), 100),
    sources,
    asOf: STAMP,
    freshness: 'fresh'
  })
const whole = (items: AttentionItem[]) => boardOf(items, [{ name: 'obligations/proposals', status: 'ok', asOf: STAMP }])
const partial = (items: AttentionItem[]) => boardOf(items, [
  { name: 'obligations/proposals', status: 'ok', asOf: STAMP },
  { name: 'obligations/refusals', status: 'error', asOf: null, errorCode: 'permission denied for table journal' }
])
const PROJECTS = [{ id: 'p1', name: 'Atlas', purpose: '', repo_path: null, status: 'active' }] as unknown as ProjectRow[]
const noneResolved = envelope({ data: [], sources: [{ name: 'questions', status: 'ok', asOf: STAMP }], asOf: STAMP, freshness: 'fresh' })

function install(query: () => Promise<unknown>, decide: (...a: unknown[]) => Promise<unknown> = vi.fn()) {
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, {
    fabric: { board: { query, resolved: vi.fn(async () => noneResolved), deferred: vi.fn(async () => noneResolved) }, proposals: { decide }, attention: { grant: vi.fn() } }
  }))
}

function stub(answer: unknown, items: AttentionItem[] = [item()], hold?: Promise<void>) {
  const decide = vi.fn(async () => {
    if (hold) await hold
    return answer
  })
  const list = vi.fn(async () => whole(items))
  install(list, decide)
  return { decide, list }
}

const render_ = (onError = vi.fn()) => {
  const onOpen = vi.fn()
  render(
    <I18nProvider locale="en">
      <BoardScreen projects={PROJECTS} feedMark={0} onOpen={onOpen} onError={onError} onChat={vi.fn()} />
    </I18nProvider>
  )
  return { onError, onOpen }
}

/** The board lists the row; its acts are in the details the row opens. */
const openRow = async (title = 'Atlas should adopt the ledger'): Promise<void> => {
  fireEvent.click(await waitFor(() => screen.getByText(title)))
}
const show = async (onError = vi.fn()) => {
  const r = render_(onError)
  await openRow()
  return r
}

const ACCEPT = en['attention.accept']
const DECLINE = en['attention.decline']

const accept = async (): Promise<HTMLElement> => {
  const button = await waitFor(() => screen.getByText(ACCEPT))
  fireEvent.click(button)
  return button
}

describe('a decision says what it did', () => {
  it('names the task an acceptance created', async () => {
    // Step 4 of the card: "creation receipt is result". The command answers
    // with the canonical ref and the surface dropped it, so the one thing the
    // operator needs — what now exists — was the one thing not shown.
    const { decide } = stub({ ok: true, taskId: 'task-77', seq: 512 })
    await show()
    await accept()
    await waitFor(() => expect(decide).toHaveBeenCalledWith('pr-1', 'accepted'))
    const said = await waitFor(() => screen.getByRole('status').textContent ?? '')
    expect(said, 'the created task is not named, so the receipt reached nobody').toMatch(/task-77/)
  })

  it('and shows the checker’s refusal, its remedy and whether retrying can work', async () => {
    // `decideProposal` returns `ok: false` in four places and throws from none
    // of them, so `.catch` never fires and this was silent.
    const rejection = rejectionOf()
    expect(rejection.reasonCode, 'the fixture must be the already-decided case').toBe('already_decided')
    const { decide } = stub({ ok: false, rejection })
    await show()
    await accept()
    await waitFor(() => expect(decide).toHaveBeenCalled())
    const said = await waitFor(() => screen.getByRole('alert').textContent ?? '')
    expect(said, 'the refusal is invisible, so a refused acceptance reads as a successful one').toContain(
      rejection.says
    )
    // "A refusal with no next step is a wall" — the type's own words.
    expect(said, 'the remedy the checker supplied is not shown').toContain(rejection.remedy)
  })

  it('and a refusal that could never succeed is not offered as retryable', async () => {
    // `retryable` exists to separate "the checker did not run" from "the answer
    // is no". Showing a retry on the second is how an operator learns to click
    // twice at a wall.
    const { decide } = stub({ ok: false, rejection: rejectionOf() })
    await show()
    await accept()
    await waitFor(() => expect(decide).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.queryByText(/try again/i), 'a final refusal offered a retry').toBeNull()
  })
})

describe('a proposal cannot be decided twice', () => {
  it('settles the row on the decision instead of leaving it live for fifteen seconds', async () => {
    // SCN-011: "already-resolved proposal shows the existing resolution and
    // disables duplicate action". The list re-read on a timer and not on the
    // decision, so both buttons stayed live on a decided proposal — and the
    // command revalidates at commit exactly because that race is real.
    const { decide } = stub({ ok: true, taskId: 'task-77', seq: 512 })
    await show()
    await accept()
    await waitFor(() => expect(decide).toHaveBeenCalledTimes(1))
    // THE TRANSITION, not the sentence: the act is gone, so it cannot be taken
    // a second time.
    await waitFor(() =>
      expect(screen.queryByText(ACCEPT), 'the same proposal can still be accepted again').toBeNull()
    )
    expect(screen.queryByText(DECLINE), 'a decided proposal still offers the opposite act').toBeNull()
  })

  it('and re-reads the queue on the decision rather than waiting for the timer', async () => {
    // Otherwise the decided row sits on screen for up to fifteen seconds,
    // which is what invited the second click in the first place.
    const { decide, list } = stub({ ok: true, taskId: 'task-77', seq: 512 })
    await show()
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1))
    await accept()
    await waitFor(() => expect(decide).toHaveBeenCalled())
    await waitFor(() =>
      expect(list.mock.calls.length, 'the queue was not re-read after a decision').toBeGreaterThan(1)
    )
  })

  it('but a refusal leaves the row decidable, because nothing was decided', async () => {
    // The other direction, so the fix is not "always remove the row". A
    // `checker_unavailable` refusal means the checker never ran; removing the
    // act would strand a proposal nobody can decide.
    const { decide } = stub({
      ok: false,
      rejection: { ...rejectionOf(), reasonCode: 'checker_unavailable', retryable: true }
    })
    await show()
    await accept()
    await waitFor(() => expect(decide).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByText(ACCEPT), 'a retryable refusal removed the act anyway').toBeTruthy()
  })
})

describe('an answer belongs to the row it was asked about', () => {
  it('shows one proposal’s refusal on that proposal only', async () => {
    // The keyed-outcome rule: the board holds several proposals at once, and one shared slot
    // would print row A's refusal under row B. The details show one row at a time, so the
    // proof is that the refusal stays with A when B is opened.
    const rejection = rejectionOf()
    const two = [
      item({ title: 'first', ref: { kind: 'proposal', id: 'pr-1' }, proposal: { id: 'pr-1', depth: 2, bound: 3 } }),
      item({ title: 'second', ref: { kind: 'proposal', id: 'pr-2' }, proposal: { id: 'pr-2', depth: 2, bound: 3 } })
    ]
    const { decide } = stub({ ok: false, rejection }, two)
    render_()
    await openRow('first')
    await accept()
    await waitFor(() => expect(decide).toHaveBeenCalledWith('pr-1', 'accepted'))
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1))
    await openRow('second')
    // The OTHER row is untouched: still decidable, nothing claimed about it.
    await waitFor(() => expect(screen.getByText(ACCEPT), 'the undecided row lost its act').toBeTruthy())
    expect(screen.queryAllByRole('alert'), "row A's refusal was printed under row B").toHaveLength(0)
    await openRow('first')
    await waitFor(() => expect(screen.getAllByRole('alert'), 'the refusal did not stay with its row').toHaveLength(1))
  })

  it('and cannot be decided twice while the command is still running', async () => {
    // The in-flight window, which nothing watched. UX28-04's lesson: a probe
    // that only looks before and after never sees the gap the double click
    // lives in.
    let release = (): void => {}
    const hold = new Promise<void>((resolve) => {
      release = () => resolve()
    })
    const { decide } = stub({ ok: true, taskId: 'task-77', seq: 512 }, [item()], hold)
    await show()
    const button = await accept()
    // Still in flight: the command has been called and has not answered.
    await waitFor(() => expect(decide).toHaveBeenCalledTimes(1))
    expect((button as HTMLButtonElement).disabled, 'the act stayed live during the command').toBe(true)
    fireEvent.click(button)
    expect(decide, 'a second click reached the command mid-flight').toHaveBeenCalledTimes(1)
    release()
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy())
  })
})

describe('the board never calls a partial queue clear (UXA-C02)', () => {
  // Five tables feed the obligations. When one refuses, the others still answer, so the read
  // RESOLVES with a board missing an entire class of obligation — "clear" said over it is a
  // measurement nobody made.
  const showWith = (view: ReadEnvelope<BoardCut>) => {
    install(vi.fn(async () => view))
    render_()
  }

  it('says the board is clear when the read was WHOLE — the fixture is the calm case', async () => {
    showWith(whole([]))
    await waitFor(() => expect(screen.getByText(en['launch.home.board.clear'])).toBeTruthy())
  })

  it('but NOT when a source refused and the board came back empty', async () => {
    showWith(partial([]))
    await waitFor(() => expect(screen.getByText(/permission denied|refusals/i)).toBeTruthy())
    expect(screen.queryByText(en['launch.home.board.clear']), 'an empty partial board is not a calm estate').toBeNull()
  })

  it('and still lists what DID answer, naming what did not', async () => {
    showWith(partial([item()]))
    await waitFor(() => expect(screen.getByText(/Atlas should adopt the ledger/)).toBeTruthy())
    expect(screen.getByText(/permission denied|refusals/i)).toBeTruthy()
  })
})

describe('the board screen itself (SCR-41)', () => {
  const question = {
    id: 'q-1', projectId: 'p1', projectName: 'Atlas', text: 'Which context goes to the next agent?', kind: 'decision' as const,
    askedAt: '2026-09-10T00:00:00Z', blocks: 1, servesActiveGoal: false, revision: 3,
    options: [{ id: 'full', label: 'The full pack' }, { id: 'lean', label: 'Decisions only' }]
  }
  const withQuestion = envelope({
    data: cutBoard(boardEntries({ questions: [question], attention: [], projectWeightOf: () => 1, now: new Date(STAMP) }), 100),
    sources: [{ name: 'questions', status: 'ok', asOf: STAMP }], asOf: STAMP, freshness: 'fresh'
  })
  const resolved = envelope({
    data: [{ ref: 'question:q-0', questionId: 'q-0', projectId: 'p1', projectName: 'Atlas', title: 'Which database version?', kind: 'decision',
      askedAt: '2026-09-09T00:00:00Z', answeredAt: '2026-09-09T02:00:00Z', answer: 'Postgres 17.', chosenLabel: 'Postgres 17', answeredBy: 'person' }],
    sources: [{ name: 'questions', status: 'ok', asOf: STAMP }], asOf: STAMP, freshness: 'fresh'
  })
  const setAside = envelope({
    data: [{ ref: 'question:q-9', questionId: 'q-9', projectId: 'p1', projectName: 'Atlas', title: 'Who owns the staging budget?', kind: 'decision',
      askedAt: '2026-09-08T00:00:00Z', reason: 'after the pilot', deferredAt: '2026-09-10T00:00:00Z' }],
    sources: [{ name: 'deferrals', status: 'ok', asOf: STAMP }], asOf: STAMP, freshness: 'fresh'
  })
  const committed = (over = {}) => ({ state: 'committed', repeated: false, seq: 1, questionId: 'q-1', ...over })
  const mount = (answer = vi.fn(async () => ({ committed: true, unblocked: [], stillBlocked: [], continuations: [] })),
    board: Record<string, unknown> = {}) => {
    const query = vi.fn(async () => withQuestion)
    const api = { query, resolved: vi.fn(async () => resolved), deferred: vi.fn(async () => setAside),
      defer: vi.fn(async () => committed()), reopen: vi.fn(async () => committed({ questionId: 'q-9' })), addTopic: vi.fn(async () => committed()), ...board }
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, {
      fabric: { board: api, questions: { answer }, proposals: { decide: vi.fn() }, attention: { grant: vi.fn() } }
    }))
    render_()
    return { answer, query, api }
  }

  it('answers an authored question from its details, through the one answer writer, against the revision shown', async () => {
    const { answer } = mount()
    await openRow('Which context goes to the next agent?')
    fireEvent.click(await waitFor(() => screen.getByText('Decisions only')))
    await waitFor(() => expect(answer).toHaveBeenCalledTimes(1))
    expect((answer.mock.calls[0] as unknown[])[0]).toMatchObject({ questionId: 'q-1', projectId: 'p1', expectedRevision: 3, chosenOption: 'lean' })
    await waitFor(() => expect(screen.getByText(en['launch.board.recorded'])).toBeTruthy())
  })

  // Audit 2026-10-05 A3-001: the stub used to return the question as still open after its answer, which
  // hid that the re-read removes it. Here the board re-reads WITHOUT it, as the projection does.
  it('the receipt stays on screen after the answered question leaves the open list', async () => {
    const answer = vi.fn(async () => ({ committed: true, unblocked: [{ id: 't1', title: 'Ship the pack' }], stillBlocked: [], continuations: [] }))
    const empty = envelope({ data: cutBoard([], 100), sources: [{ name: 'questions', status: 'ok', asOf: STAMP }], asOf: STAMP, freshness: 'fresh' })
    let answered = false
    const query = vi.fn(async () => (answered ? empty : withQuestion))
    mount(answer as never, { query })
    answer.mockImplementation(async () => { answered = true; return { committed: true, unblocked: [{ id: 't1', title: 'Ship the pack' }], stillBlocked: [], continuations: [] } })
    await openRow('Which context goes to the next agent?')
    fireEvent.click(await waitFor(() => screen.getByText('Decisions only')))
    await waitFor(() => expect(answer).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(query.mock.calls.length).toBeGreaterThan(1))
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.getByText(en['launch.board.recorded'])).toBeTruthy()
    expect(screen.getByText(en['launch.board.state.answered'])).toBeTruthy()
    expect(screen.queryByText('Which context goes to the next agent?')).toBeTruthy()
  })

  it('a refused answer says why and keeps what was typed', async () => {
    const answer = vi.fn(async () => ({ committed: false, reason: 'the question changed while you were reading it', unblocked: [], stillBlocked: [], continuations: [] }))
    mount(answer)
    await openRow('Which context goes to the next agent?')
    const box = await waitFor(() => screen.getByPlaceholderText(en['launch.board.outcomeHint']))
    fireEvent.change(box, { target: { value: 'Send decisions only.' } })
    fireEvent.click(screen.getByRole('button', { name: en['launch.board.record'] }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/changed while you were reading/))
    expect((screen.getByPlaceholderText(en['launch.board.outcomeHint']) as HTMLTextAreaElement).value, 'a refusal cleared the draft').toBe('Send decisions only.')
    expect(screen.queryByText(en['launch.board.recorded']), 'a refusal read as a record').toBeNull()
  })

  it('lists what was answered under «Resolved», with the answer and the option chosen', async () => {
    mount()
    fireEvent.click(await waitFor(() => screen.getByRole('button', { name: en['launch.board.tab.done'] })))
    await openRow('Which database version?')
    expect(document.body.textContent, 'a raw registry key reached the screen').not.toMatch(/needsYou\.|launch\.board\./)
    expect(screen.queryByText('Which context goes to the next agent?'), 'an open question leaked into Resolved').toBeNull()
    await waitFor(() => expect(screen.getByText('Postgres 17.')).toBeTruthy())
    expect(screen.getByText(en['launch.board.by.you']), 'who answered is not said').toBeTruthy()
    expect(screen.getAllByText('Postgres 17').length).toBeGreaterThan(0)
  })

  it('«All topics» holds both, each once', async () => {
    mount()
    fireEvent.click(await waitFor(() => screen.getByRole('button', { name: en['launch.board.tab.all'] })))
    await waitFor(() => expect(screen.getByText('Which database version?')).toBeTruthy())
    expect(screen.getAllByText('Which context goes to the next agent?')).toHaveLength(1)
  })

  it('starting a review marks nothing read and writes nothing', async () => {
    const { answer, query } = mount()
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: en['launch.board.reviewStart'] }))
    expect(screen.getByText(en['launch.board.reviewTitle'])).toBeTruthy()
    expect(answer).not.toHaveBeenCalled()
    expect(query, 'a review re-read or wrote something').toHaveBeenCalledTimes(1)
  })
})

describe('next time, and a topic of your own (SCR-41, L3b)', () => {
  const question = {
    id: 'q-1', projectId: 'p1', projectName: 'Atlas', text: 'Which context goes to the next agent?', kind: 'decision' as const,
    askedAt: '2026-09-10T00:00:00Z', blocks: 1, servesActiveGoal: false, revision: 3, options: []
  }
  const open = envelope({
    data: cutBoard(boardEntries({ questions: [question], attention: [], projectWeightOf: () => 1, now: new Date(STAMP) }), 100),
    sources: [{ name: 'questions', status: 'ok', asOf: STAMP }], asOf: STAMP, freshness: 'fresh'
  })
  const later = envelope({
    data: [{ ref: 'question:q-9', questionId: 'q-9', projectId: 'p1', projectName: 'Atlas', title: 'Who owns the staging budget?', kind: 'decision',
      askedAt: '2026-09-08T00:00:00Z', reason: 'after the pilot', deferredAt: '2026-09-10T00:00:00Z' }],
    sources: [{ name: 'deferrals', status: 'ok', asOf: STAMP }], asOf: STAMP, freshness: 'fresh'
  })
  const mount = (board: Record<string, unknown> = {}) => {
    const api = { query: vi.fn(async () => open), resolved: vi.fn(async () => noneResolved), deferred: vi.fn(async () => later),
      defer: vi.fn(async () => ({ state: 'committed', repeated: false, seq: 5, questionId: 'q-1' })),
      reopen: vi.fn(async () => ({ state: 'committed', repeated: false, seq: 6, questionId: 'q-9' })),
      addTopic: vi.fn(async () => ({ state: 'committed', repeated: false, seq: 7, questionId: 'new' })), ...board }
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, {
      fabric: { board: api, questions: { answer: vi.fn() }, proposals: { decide: vi.fn() }, attention: { grant: vi.fn() } }
    }))
    render_()
    return api
  }
  const later_ = () => screen.getByRole('button', { name: en['launch.board.tab.later'], pressed: false })

  it('a question is set aside only with a reason, through its command, and the board is re-read', async () => {
    const api = mount()
    await openRow('Which context goes to the next agent?')
    fireEvent.click(await waitFor(() => screen.getAllByRole('button', { name: en['launch.board.tab.later'] }).find((b) => b.closest('.lp-detail'))!))
    const confirm = screen.getByRole('button', { name: en['launch.board.defer.confirm'] }) as HTMLButtonElement
    expect(confirm.disabled, 'a reasonless deferral was offered').toBe(true)
    fireEvent.change(screen.getByPlaceholderText(en['launch.board.defer.hint']), { target: { value: 'after the pilot' } })
    fireEvent.click(confirm)
    await waitFor(() => expect(api.defer).toHaveBeenCalledTimes(1))
    expect((api.defer.mock.calls[0] as unknown[])[0]).toMatchObject({ questionId: 'q-1', projectId: 'p1', reason: 'after the pilot' })
    await waitFor(() => expect(api.query.mock.calls.length, 'the board was not re-read').toBeGreaterThan(1))
  })

  it('a refusal is named, keeps the reason, and a retry is the SAME command', async () => {
    const defer = vi.fn()
      .mockResolvedValueOnce({ state: 'unconfirmed' })
      .mockResolvedValueOnce({ state: 'refused', refusal: 'already_deferred' })
    const api = mount({ defer })
    await openRow('Which context goes to the next agent?')
    fireEvent.click(await waitFor(() => screen.getAllByRole('button', { name: en['launch.board.tab.later'] }).find((b) => b.closest('.lp-detail'))!))
    fireEvent.change(screen.getByPlaceholderText(en['launch.board.defer.hint']), { target: { value: 'after the pilot' } })
    fireEvent.click(screen.getByRole('button', { name: en['launch.board.defer.confirm'] }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(en['launch.board.unconfirmed']))
    fireEvent.click(screen.getByRole('button', { name: en['launch.board.defer.confirm'] }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(en['launch.board.refused.already_deferred']))
    const [first, second] = api.defer.mock.calls.map((c) => ((c as unknown[])[0] as { commandId: string }).commandId)
    expect(second, 'a retry after an unconfirmed answer minted a second act').toBe(first)
    expect((screen.getByPlaceholderText(en['launch.board.defer.hint']) as HTMLTextAreaElement).value).toBe('after the pilot')
  })

  it('«Next time» lists what was set aside with its reason, says it still blocks, and returns it', async () => {
    const api = mount()
    fireEvent.click(await waitFor(() => later_()))
    expect(screen.queryByText('Which context goes to the next agent?'), 'a current question leaked into Next time').toBeNull()
    await openRow('Who owns the staging budget?')
    expect(document.body.textContent, 'a raw registry key reached the screen').not.toMatch(/needsYou\.|launch\.board\./)
    expect(screen.getAllByText('after the pilot').length).toBeGreaterThan(0)
    expect(screen.getByText(en['launch.board.defer.stillBlocks'])).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['launch.board.reopen'] }))
    await waitFor(() => expect(api.reopen).toHaveBeenCalledTimes(1))
    expect((api.reopen.mock.calls[0] as unknown[])[0]).toMatchObject({ questionId: 'q-9', projectId: 'p1' })
  })

  it('a topic needs words; it is written onto the chosen project with ids stable for the attempt', async () => {
    const addTopic = vi.fn()
      .mockResolvedValueOnce({ state: 'unconfirmed' })
      .mockResolvedValueOnce({ state: 'committed', repeated: true, seq: 7, questionId: 'q-new' })
    mount({ addTopic })
    fireEvent.click(await waitFor(() => screen.getByRole('button', { name: en['launch.board.addTopic'] })))
    const add = screen.getByRole('button', { name: en['launch.board.topic.add'] }) as HTMLButtonElement
    expect(add.disabled, 'an empty topic was offered').toBe(true)
    fireEvent.change(screen.getByLabelText(en['launch.board.topic.text']), { target: { value: 'Agree the pilot scope' } })
    fireEvent.click(add)
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(en['launch.board.unconfirmed']))
    fireEvent.click(screen.getByRole('button', { name: en['launch.board.topic.add'] }))
    await waitFor(() => expect(addTopic).toHaveBeenCalledTimes(2))
    const [a, b] = addTopic.mock.calls.map((c) => (c as unknown[])[0] as { commandId: string; questionId: string; projectId: string; text: string })
    expect(b.commandId).toBe(a.commandId); expect(b.questionId).toBe(a.questionId)
    expect(a).toMatchObject({ projectId: 'p1', text: 'Agree the pilot scope' })
    expect('note' in a, 'an empty note was sent').toBe(false)
    await waitFor(() => expect(screen.getByText(en['launch.board.topic.added'])).toBeTruthy())
  })
})

describe('one project\'s board, opened at one row (SCR-31 → SCR-41)', () => {
  it('reads only that project, names it, and opens the row it was asked for', async () => {
    const q = { id: 'q-1', projectId: 'p1', projectName: 'Atlas', text: 'Which context goes to the next agent?', kind: 'decision' as const,
      askedAt: '2026-09-10T00:00:00Z', blocks: 1, servesActiveGoal: false, revision: 3, options: [] }
    const cut = cutBoard(boardEntries({ questions: [q], attention: [], projectWeightOf: () => 1, now: new Date(STAMP) }), 100)
    const board = { query: vi.fn(async () => envelope({ data: cut, sources: [{ name: 'questions', status: 'ok', asOf: STAMP }], asOf: STAMP, freshness: 'fresh' })),
      resolved: vi.fn(async () => noneResolved), deferred: vi.fn(async () => noneResolved) }
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: { board, questions: { answer: vi.fn() }, proposals: { decide: vi.fn() }, attention: { grant: vi.fn() } } }))
    render(
      <I18nProvider locale="en">
        <BoardScreen projects={PROJECTS} projectId="p1" initialItem={cut.items[0].ref} feedMark={0} onOpen={vi.fn()} onError={vi.fn()} onChat={vi.fn()} />
      </I18nProvider>
    )
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Which context goes to the next agent?' })).toBeTruthy())
    for (const read of [board.query, board.resolved, board.deferred]) expect(read.mock.calls[0]).toEqual([{ projectId: 'p1', limit: expect.any(Number) }])
    expect(screen.getByText(en['launch.board.footProject'].replace('{project}', 'Atlas'))).toBeTruthy()
  })
})

// Verification iteration 2 for 0.3.1, UX-1 (blocking): the detail pane rendered the acts of whichever row
// was chosen with no key, so the access acts kept their own answer when another row was opened — the
// second request said "Allowed" though nobody answered it, and it offered no Deny or Allow.
describe('an access request\'s answer belongs to that request (UX-1, iteration 2)', () => {
  const two = attentionOf({ reviews: [], expired: [], refusals: [], proposals: [], names: {}, access: [
    pendingFacts({ id: 'req-1', agent_id: 'research-desk.default', callee: 'fabric-inbox', capabilities: ['read_message'], resources: ['cloudflare:news@example.com'],
      reason: 'summarise the newsletter', asked_by_binding: null, requested_at: STAMP, expires_at: '2099-01-01T00:00:00Z', registry: { name: 'Research desk' } }, true),
    pendingFacts({ id: 'req-2', agent_id: 'mailbot', callee: 'fabric-inbox', capabilities: ['send_email'], resources: ['cloudflare:support@example.com'],
      reason: 'answer the support box', asked_by_binding: null, requested_at: STAMP, expires_at: '2099-01-01T00:00:00Z', registry: null }, true)
  ] } as unknown as Parameters<typeof attentionOf>[0])
  const stubAccess = () => {
    // The queue is read back unchanged: the projection has not caught up with the decision yet.
    const query = vi.fn(async () => whole(two))
    const decide = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, {
      fabric: { board: { query, resolved: vi.fn(async () => noneResolved), deferred: vi.fn(async () => noneResolved) }, hub: { decide }, proposals: { decide: vi.fn() }, attention: { grant: vi.fn() } }
    }))
    return { query, decide }
  }
  const title = (name: string) => en['access.queue.title'].replace('{name}', name).replace('{product}', 'Fabric Inbox')

  it('allowing one request and opening the next shows the next one\'s own Deny and Allow', async () => {
    const { decide } = stubAccess()
    render_()
    await openRow(title('Research desk'))
    fireEvent.click(await screen.findByRole('button', { name: 'Allow Research desk' }))
    await waitFor(() => expect(decide).toHaveBeenCalledWith('req-1', 'allowed'))
    await openRow(title('mailbot'))
    expect(await screen.findByRole('button', { name: 'Deny mailbot' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Allow mailbot' })).toBeTruthy()
    expect(screen.queryByText(en['access.allowedHere'])).toBeNull()
    expect(decide).toHaveBeenCalledTimes(1)
  })

  it('and the same after Deny; the board is read again and keeps saying what was decided about whom', async () => {
    const { decide, query } = stubAccess()
    render_()
    await openRow(title('Research desk'))
    const reads = query.mock.calls.length
    fireEvent.click(await screen.findByRole('button', { name: 'Deny Research desk' }))
    await waitFor(() => expect(decide).toHaveBeenCalledWith('req-1', 'denied'))
    await waitFor(() => expect(query.mock.calls.length).toBeGreaterThan(reads))
    await openRow(title('mailbot'))
    expect(await screen.findByRole('button', { name: 'Allow mailbot' })).toBeTruthy()
    expect(screen.queryByText(en['access.deniedHere'])).toBeNull()
    expect(screen.getByText(en['access.queue.denied'].replace('{name}', 'Research desk').replace('{product}', 'Fabric Inbox'))).toBeTruthy()
  })
})

// Verification iteration 2 for 0.3.1, UX-4: an unscoped `.lp-facts{display:flex}` added for the access block
// came after the prototype's grid and flattened every fact grid on the board and the releases screen.
describe('the board\'s fact grid is the prototype\'s (UX-4, iteration 2)', () => {
  it('a row\'s State and Waiting facts sit in the prototype\'s grid, not one stacked column', async () => {
    const el = document.createElement('style')
    el.textContent = readFileSync(path.join(process.cwd(), 'src/renderer/src/launch/launch.css'), 'utf8')
    document.head.appendChild(el)
    try {
      stub({ ok: true })
      render_()
      await openRow()
      const dl = await waitFor(() => document.querySelector('dl.lp-facts') as HTMLElement)
      expect(getComputedStyle(dl).display).toBe('grid')
    } finally { el.remove() }
  })
})
