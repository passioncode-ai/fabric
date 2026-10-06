// An entity had no address (AX-05).
//
// The shell could say which PROJECT it was at and nothing narrower. The thing
// the operator had actually opened lived in a `Focus` state BESIDE the route —
// and its own doc said why: "separate from the route because it is CONSUMED".
// That was true, and it was the defect. The screen honouring the request
// cleared it, so a moment later the route could no longer say where the
// operator was: nothing to link to, nothing to compare, nothing to restore.
// AX-03, AX-04 and AX-06 all wait on this by AX-05's own `depends_on`.
//
// THESE CASES DRIVE THE SHELL, because the fix is wiring: `revealAt` derives
// the reveal from the route, `routeToEntity` refuses an address no surface can
// reach, and a unit test of either says nothing about whether the shell calls
// them. The previous iteration closed with exactly this gap recorded.
//
// WHAT THEY DO NOT COVER, stated rather than implied: that `ProjectHome`
// consumes the address and scrolls to the entity. That is three lines of prop
// wiring over a mounted screen this harness cannot drive without stubbing the
// whole project surface; the address's own semantics — latch, revision,
// refusal — are proven in `appRoute.test.ts`.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from './App'
import { en } from './i18n/en'
import { coverageOfStore, type SearchGroup } from '../../shared/search'
import { whole } from '../../../test/envelopes'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const hit = (over: Partial<SearchGroup['hits'][number]>) => ({
  id: 'x',
  projectId: 'p1',
  projectName: 'Atlas',
  text: 'the ledger',
  at: '2026-09-10',
  ...over
})

const group = (over: Partial<SearchGroup> & Pick<SearchGroup, 'store'>): SearchGroup => ({
  method: 'words',
  hits: [],
  problem: null,
  labelProblem: null,
  coverage: coverageOfStore(over.hits?.length ?? 0),
  ...over
})

function stub(groups: SearchGroup[], savedTabs?: unknown) {
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
    feed: { replay: async () => [] },
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
    attention: { list: async () => whole([]) },
    quota: { read: async () => null },
    favourites: { list: async () => [] },
    board: { query: async () => ({ rows: [], total: 0 }) },
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
  return { api, write }
}

/** The last route the shell wrote to disk — the address as it will be restored,
 *  which is the only place a test can SEE it. */
const persistedActive = (write: ReturnType<typeof vi.fn>): Record<string, unknown> | null => {
  const calls = write.mock.calls
  return calls.length ? ((calls[calls.length - 1][0] as { active: Record<string, unknown> | null }).active) : null
}

/** Open the search panel and run one query. */
const searchFor = async (text: string): Promise<void> => {
  await waitFor(() => expect(document.querySelector('.search-button')).toBeTruthy())
  fireEvent.click(document.querySelector('.search-button') as HTMLElement)
  await waitFor(() => expect(document.querySelector('input')).toBeTruthy())
  fireEvent.change(document.querySelector('input') as HTMLInputElement, { target: { value: text } })
}

describe('opening an entity puts the shell AT it, not merely near it', () => {
  it('lands on the project and offers the way back', async () => {
    // A task IS focusable, so this is the addressed half: `routeToEntity`
    // answers with an address and the shell goes to it.
    const { write } = stub([group({ store: 'tasks', method: 'substring', hits: [hit({ id: 't-1' })] })])
    render(<App />)
    await searchFor('ledger')
    await waitFor(() => expect(screen.getByText('the ledger')).toBeTruthy())
    fireEvent.click(screen.getByText('the ledger'))
    // The project is open and on show...
    await waitFor(() => expect(screen.getAllByText(/Atlas/).length).toBeGreaterThan(0))
    // ...and Back goes back to where the search was run from, which is the
    // field AX-05b gave a reader and this navigation must keep feeding.
    expect(screen.getByText(en['nav.back'])).toBeTruthy()
    // THE ADDRESS ITSELF, and this is the assertion that can fail. Landing on
    // the project is true of a shell with no address at all — it was true
    // before this change — so a case that stops there cannot tell the fix from
    // the defect. The route the shell persists is where the address is
    // observable, and persisting it is also what lets a restart restore it.
    await waitFor(() =>
      expect(persistedActive(write)).toMatchObject({
        kind: 'project',
        id: 'p1',
        at: { kind: 'task', id: 't-1' }
      })
    )
  })

  it('and a hit NOTHING can focus still lands somewhere, rather than nowhere', async () => {
    // THE REFUSAL, through the wiring. A memory fact has no surface that can
    // focus it — `destinationOf` answers `at: 'project'` — and the panel hands
    // the fact's own ref to the shell anyway. Assembling `{ at: ref }` by hand
    // would put a location on screen that no screen can reach; `routeToEntity`
    // refuses it and hands back the project as the fallback, so the click is
    // honoured instead of being dropped.
    const { write } = stub([group({ store: 'facts', hits: [hit({ id: 'f-1', text: 'we chose the ledger' })] })])
    render(<App />)
    await searchFor('ledger')
    await waitFor(() => expect(screen.getByText('we chose the ledger')).toBeTruthy())
    fireEvent.click(screen.getByText('we chose the ledger'))
    await waitFor(() => expect(screen.getAllByText(/Atlas/).length).toBeGreaterThan(0))
    expect(screen.getByText(en['nav.back'])).toBeTruthy()
    // AND NO ADDRESS WAS INVENTED. The click is honoured and the route stays
    // one a screen can actually reach.
    await waitFor(() => expect(persistedActive(write)).toMatchObject({ kind: 'project', id: 'p1' }))
    expect(persistedActive(write), 'a fact is not focusable, so it is not an address').not.toHaveProperty('at')
  })

  it('and the address comes BACK after a restart', async () => {
    // "Cannot be linked to, compared, or RESTORED" — the third of the three
    // things AX-05 says an entity had no address for. The shell used to reopen
    // the project and lose the entity.
    const { write } = stub([], {
      tabs: [{ kind: 'project', id: 'p1' }],
      active: { kind: 'project', id: 'p1', at: { kind: 'task', id: 't-9' }, asOf: '512' }
    })
    render(<App />)
    await waitFor(() => expect(screen.getAllByText(/Atlas/).length).toBeGreaterThan(0))
    await waitFor(() =>
      expect(persistedActive(write)).toMatchObject({
        kind: 'project',
        id: 'p1',
        at: { kind: 'task', id: 't-9' },
        asOf: '512'
      })
    )
  })

  it('but a corrupt address on disk is not restored as one', async () => {
    // It comes off a file. A kind no surface knows would put a location on
    // screen that nothing can reach — the same defect as inventing one, only
    // arriving by a different door.
    const { write } = stub([], {
      tabs: [{ kind: 'project', id: 'p1' }],
      active: { kind: 'project', id: 'p1', at: { kind: 'wormhole', id: 'x' } }
    })
    render(<App />)
    await waitFor(() => expect(screen.getAllByText(/Atlas/).length).toBeGreaterThan(0))
    await waitFor(() => expect(persistedActive(write)).toMatchObject({ kind: 'project', id: 'p1' }))
    expect(persistedActive(write)).not.toHaveProperty('at')
  })
})
