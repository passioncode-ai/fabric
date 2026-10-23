// The act line in the shell (ADR-0160 §1, SCN-169; 0.3.7 wave 3): the person's newest act, read from the journal the
// shell already reads, shows at the foot of the place with «Отменить», and the press reaches wave 2's `acts.undo`
// with that act's own seq. An agent's act is not the person's line.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from './App'
import { en } from './i18n/en'
import { whole } from '../../../test/envelopes'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const act = (seq: number, actor: 'person' | 'agent') => ({
  estate_id: 'e1', seq, type: 'act.recorded@1', actor: { kind: actor, id: 'x' }, project_id: 'p1', occurred_at: '2026-10-18T10:00:00Z',
  payload: { v: 1, kind: 'repo.detach', category: 'folders', subject: { type: 'repo', id: 'r1', label: 'site' }, said: { key: 'act.repo.detach', params: { folder: 'site' } },
    inverse: { kind: 'repo.attach', args: { path: '/x' } }, why_not: null, undoes: null, ref_seq: seq - 1 }
})

function stub(feed: unknown[], undo: ReturnType<typeof vi.fn>) {
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
    attention: { list: async () => whole([]) },
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


describe('the act line in the shell', () => {
  it('shows the person\u2019s act at the foot of the place, and «Отменить» undoes that act', async () => {
    const undo = vi.fn(async () => ({ ok: true, seq: 9 }))
    stub([act(7, 'person'), act(8, 'agent')], undo)
    render(<App />)
    const line = await screen.findByText(/Folder «site» removed from the project/)
    expect(line.closest('.act-line')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['act.undo'] }))
    await waitFor(() => expect(undo).toHaveBeenCalledWith(7))
  })
})
