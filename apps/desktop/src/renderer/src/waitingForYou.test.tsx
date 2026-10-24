// One reading of "what waits for you" (0.3.12 review, iteration 2, UX-1): the greeting, the strip's «ждут вас» and the
// rail's gold count beside Главная and beside each project all count «Нужны вы» (`PERSON_KINDS`: questions, access
// requests, refusals). Reviews and proposals are the person's to look at, not what blocks an agent: they are not counted
// here. Rendered through the real shell, because the defect was three readers wired to three different reads.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { App } from './App'
import { en } from './i18n/en'
import { whole } from '../../../test/envelopes'
import type { AttentionItem } from '../../shared/attention'
import { boardEntries, cutBoard, PERSON_KINDS, type BoardQuestion } from '../../shared/board'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const STAMP = '2026-10-24T10:00:00Z'

function stub(board: (q?: { personOnly?: boolean; limit?: number }) => unknown, attention: unknown) {
  const feed: Array<{ seq: number; type: string; occurred_at: string; payload: unknown; project_id: string | null }> = []
  const undo = vi.fn()
  const groups: unknown[] = []
  const savedTabs: unknown = undefined
  const write = vi.fn(async () => {})
  const api = {
    settings: { read: async () => ({ theme: 'dark', locale: 'en', keepAwake: 'never' }) },
    meta: {
      // THE WHOLE SHAPE. `meta.info` is the boot gate — `sessionId: undefined`
      // holds the shell at its booting div for ever — and the diagnostics
      // section reads `buildLine`/`compatibility` off the same answer, so a
      // stub carrying half of it takes the screen down after it has rendered.
      info: async () => ({
        estateId: 'e1',
        estateName: 'org #1',
        filePath: null,
        sessionId: null,
        build: null,
        buildLine: { says: 'a build that cannot say what it is', short: 'unknown', unidentified: true },
        compatibility: { compatibility: 'compatible', reasonCode: 'in_window', says: 'in window' }
      })
    },
    tabs: {
      read: async () => savedTabs ?? { tabs: [], active: null },
      write,
      onCloseActive: () => () => {}
    },
    projects: {
      list: async () => [{ id: 'p1', name: 'Atlas', estate_id: 'e1' }],
      onRepoChanged: () => () => {},
      repoStates: async () => [],
      stats: async () => null,
      saveSettings: async () => ({ state: 'committed', revision: '1' })
    },
    terminal: {
      list: async () => [],
      options: async () => [],
      memoryBackends: async () => [],
      claims: async () => [],
      open: async () => ({ ok: true }),
      end: async () => ({ ok: true }),
      dismiss: async () => ({ ok: true })
    },
    feed: { replay: vi.fn(async (from: number) => (feed as Array<{ seq: number }>).filter((e) => e.seq > from)) },
    acts: { undo, history: async () => ({ rows: [], next: null }) },
    drafts: { read: async () => ({ drafts: {}, status: 'ready', problem: null }), save: async () => ({ saved: true, reason: null }) },
    gateway: { offer: async () => ({ reachable: false, servers: [] }) },
    memory: {
      backends: async () => [],
      overview: async () => null,
      misses: async () => [],
      remember: async () => ({ ok: true }),
      retro: async () => null,
      search: async () => []
    },
    estate: { summary: async () => null, profile: async () => null },
    attention: { list: async () => attention },
    favourites: { list: async () => [] },
    board: { query: vi.fn(async (q?: { personOnly?: boolean; limit?: number }) => board(q)), resolved: async () => whole([]), deferred: async () => whole([]) },
    workspace: { state: async () => ({ path: null, git: 'declined' }) },
    windows: { openSession: async () => {} },
    search: { run: vi.fn(async () => groups) },
    // THE PROJECT SCREEN'S OWN SEAMS. This probe mounts the real one — that is
    // the whole point, since the defect was in the wiring between the route and
    // the screen — so every read it makes on mount needs an answer here.
    projectsExtra: null,
    agents: { list: async () => [], create: async () => ({ ok: true }) },
    digest: { read: async () => null, seen: async () => {} },
    goals: { list: async () => [], define: async () => ({ ok: true }) },
    harness: { read: async () => null },
    tasks: { list: async () => ({ tasks: [], closed: { truncated: false, says: 'all of them' } }), close: async () => ({ ok: true }), move: async () => ({ ok: true }), prioritise: async () => ({ ok: true }) },
    repos: { list: async () => [], attach: async () => ({ ok: true }), detach: async () => ({ ok: true }), choose: async () => null },
    routines: { list: async () => [], define: async () => ({ ok: true }), setEnabled: async () => ({ ok: true }) },
    transcripts: { list: async () => [], get: async () => null },
    runs: { list: async () => [] },
    automations: { list: async () => [] },
    diagnostics: { read: async () => ({ records: [], file: null }) },
    stack: { exposure: async () => null },
    // `orphans` is part of the contract since AX-06. A fake that falls behind
    // the declaration is the same defect as one that was never right: it
    // took the mounted screen down after it had rendered.
    decisions: {
      list: async () => ({
        lineages: [],
        coverage: { truncated: false, says: 'all of them' },
        orphans: { ids: [], says: 'every decision read here belongs to a history whose current version was read too' }
      })
    }
  }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: api }))
  return { api, write, feed }
}


const q = (id: string): BoardQuestion => ({ id, projectId: 'p1', projectName: 'Atlas', text: 'Question ' + id, kind: 'decision', askedAt: STAMP, blocks: 0, servesActiveGoal: false, revision: 1, options: [] })
const att = (kind: 'review' | 'proposal', id: string): AttentionItem => ({ kind, ref: kind === 'review' ? { kind: 'task', id } : { kind: 'proposal', id }, projectId: 'p1', projectName: 'Atlas', title: kind + ' ' + id, detail: null, since: STAMP,
  ...(kind === 'proposal' ? { proposal: { id, depth: 1, bound: 3 } } : {}) } as AttentionItem)
const items = [att('review', 'r1'), att('review', 'r2'), att('proposal', 'pr1')]
const entries = boardEntries({ questions: [q('q1'), q('q2')], attention: items, projectWeightOf: () => 1, now: new Date(STAMP) })
/** Read as main reads it: the person's part or the whole board, cut at the limit asked for. */
const board = (query?: { personOnly?: boolean; limit?: number }) => whole(cutBoard(query?.personOnly ? entries.filter((e) => PERSON_KINDS.has(e.kind)) : entries, query?.limit ?? 100))
const strip = () => screen.getByRole('group', { name: en['launch.home.stats.label'] })

describe('what waits for you, counted once', () => {
  it('two questions, two reviews and a proposal: the greeting, the strip and the rail all say 2', async () => {
    stub(board, whole(items))
    render(<App />)
    await waitFor(() => expect(screen.getByTestId('home-greeting').textContent).toContain(en['launch.home.greet.waiting.few'].replace('{count}', '2')))
    const strip = screen.getByRole('group', { name: en['launch.home.stats.label'] })
    const cell = within(strip).getByRole('button', { name: new RegExp(en['launch.home.stats.waiting']) })
    expect(cell.querySelector('b')?.textContent).toBe('2')
    await waitFor(() => expect(screen.getByLabelText(en['rail.waiting'].replace('{count}', '2'))).toBeTruthy())
    expect(screen.getByLabelText(en['rail.waitingProject'].replace('{count}', '2'))).toBeTruthy()
  })

  // 0.3.12 review, iteration 3, UX-1: the rail beside the project said 2 while the project page's «Questions for you» said 5
  // and its «Needs you» listed the proposal and the reviews as the person's.
  it('the project page says the 2 the rail beside it says, and counts the 3 to review apart', async () => {
    stub(board, whole(items))
    render(<App />)
    await waitFor(() => expect(screen.getByLabelText(en['rail.waitingProject'].replace('{count}', '2'))).toBeTruthy())
    fireEvent.click(await waitFor(() => document.querySelector('.lp-project-name') as HTMLElement))
    const panel = (await screen.findByText(en['launch.project.questions'])).closest('section')!
    await waitFor(() => expect(within(panel).getByText('Question q2')).toBeTruthy())
    expect(within(panel).getByText('2', { selector: '.lp-pill' })).toBeTruthy()
    expect(within(panel).queryByText(/^(review r1|proposal pr1)$/)).toBeNull()
    await waitFor(() => expect(within(panel).getByRole('button', { name: en['launch.project.toReview'].replace('{count}', '3') })).toBeTruthy())
    const needs = document.getElementById('sec-needs-you')!
    await waitFor(() => expect(within(needs).getByText('Question q1')).toBeTruthy())
    expect(within(needs).queryByText(/review r1|proposal pr1/)).toBeNull()
    expect(screen.getByLabelText(en['rail.waitingProject'].replace('{count}', '2'))).toBeTruthy()
  })

  // 0.3.12 review, iteration 3, UX-2: proposals and abandoned work left no mark in the window but the Board's second tab.
  it('the strip\'s «to review» counts the reviews and the proposal, 3, and opens the Board on «To review»', async () => {
    stub(board, whole(items))
    render(<App />)
    const cell = await waitFor(() => {
      const c = within(strip()).getByRole('button', { name: new RegExp(en['launch.home.stats.review']) })
      expect(c.querySelector('b')?.textContent).toBe('3')
      return c
    })
    fireEvent.click(cell)
    await waitFor(() => expect(screen.getByRole('button', { name: en['launch.board.tab.reviewCount'].replace('{count}', '3') }).getAttribute('aria-pressed')).toBe('true'))
  })

  // 0.3.12 review, iteration 3, ER-5 and UX-7: when the person's count failed, each card's «waiting on you» vanished and a
  // project row could say «idle».
  it('a count that could not be read is said on every card, never as nothing waiting or idle', async () => {
    stub((query) => { if (query?.personOnly) throw new Error('statement timeout'); return board(query) }, whole(items))
    render(<App />)
    await waitFor(() => expect(screen.getByText(/What needs you could not be read: statement timeout/)).toBeTruthy())
    const row = document.querySelector('.lp-project-row') as HTMLElement
    expect(within(row).getByText(en['estate.waitingUnknown'])).toBeTruthy()
    expect(within(row).queryByText(en['estate.idle'])).toBeNull()
  })

  // 0.3.12 review, iteration 3, UX-3: the Board did not follow `access`, so a new access request moved the rail and not
  // the list the rail leads to.
  it('an access request re-reads the Board\'s list, as it moves the rail', async () => {
    const { api, feed } = stub(board, whole(items))
    render(<App />)
    fireEvent.click(await waitFor(() => within(strip()).getByRole('button', { name: new RegExp(en['launch.home.stats.waiting']) })))
    const boardReads = () => api.board.query.mock.calls.filter(([qq]) => qq?.limit === 100 && qq.personOnly === true).length
    await waitFor(() => expect(boardReads()).toBeGreaterThan(0))
    const before = boardReads()
    feed.push({ seq: 7, type: 'access.requested@1', occurred_at: STAMP, payload: {}, project_id: 'p1' })
    await waitFor(() => expect(boardReads()).toBeGreaterThan(before), { timeout: 5000 })
  })
})
