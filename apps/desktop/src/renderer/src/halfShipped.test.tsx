// The half that was marked shipped and was not there (M113).
//
// M56, M57 and M83 all said "shipped 2026-09-01". The data for two of them was
// measured, cached and unit-tested from that day and rendered NOWHERE — so
// `verification.md` was honest, because it verifies the READER, and the board
// was not, and the board is what someone acts on.
//
// These tests are the difference. Each one fails the moment its number stops
// reaching a screen, which is the only thing that would ever notice: nothing
// breaks, nothing throws, and a unit test on the reader stays green.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { NO_MARKS } from '../../shared/feedMarks'
import { FAVOURITE_THRESHOLD } from '../../shared/favourites'
import { en } from './i18n/en'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from './i18n'
import { EstateHome } from './EstateHome'
import { QuotaPanel } from './launch/QuotaPanel'
import { ProjectStatusBar } from './ProjectHome'
import type { ProjectRow, ProjectStats, Quota, RepoState } from '../../shared/types'
import { whole } from '../../../test/envelopes'

afterEach(cleanup)

const wrap = (ui: React.ReactNode): void => {
  // Only what this panel reaches for on mount. A fake that answers everything
  // would hide the day one of these becomes required.
  ;(window as unknown as { fabric: unknown }).fabric = {
    favourites: { list: async () => [], toggle: async () => [] },
    attention: { list: async () => whole([]) },
    workspace: { state: async () => ({ git: 'declined' }) },
    estate: { profile: async () => null, summary: async () => null },
    memory: { overview: async () => null }
  }
  render(<I18nProvider locale="en">{ui}</I18nProvider>)
}

const quota: Quota = {
  fiveHour: { utilization: 42, resetsAt: new Date(Date.now() + 3600_000).toISOString() },
  sevenDay: { utilization: 91, resetsAt: new Date(Date.now() + 86_400_000).toISOString() },
  byModel: {
    opus: { utilization: 77, resetsAt: new Date(Date.now() + 86_400_000).toISOString() }
  },
  problem: null,
  readAt: new Date().toISOString(),
  ageSeconds: 0,
  account: 'acct-a'
}

describe('M83 — the quota on the HOME, not only on a project', () => {
  it('shows both windows', () => {
    wrap(<QuotaPanel quota={{ read: true, quota }} />)
    expect(screen.getByText('42%')).toBeTruthy()
    expect(screen.getByText('91%')).toBeTruthy()
  })

  it('shows the PER-MODEL breakdown, which nothing rendered at all', () => {
    // `byModel` was computed by the reader from the first day and read by no
    // component in the product. It is the part that answers WHICH model to
    // reach for, which is what "can I start a big job now" is really asking.
    wrap(<QuotaPanel quota={{ read: true, quota }} />)
    expect(screen.getByText('opus')).toBeTruthy()
    expect(screen.getByText('77%')).toBeTruthy()
  })

  it('a spent window is not shown in the same tone as an empty one', () => {
    wrap(<QuotaPanel quota={{ read: true, quota }} />)
    expect(screen.getByText('91%').className).toContain('danger')
    expect(screen.getByText('42%').className).not.toContain('danger')
  })

  it('no quota is a state with a sentence, not an empty panel', () => {
    // Claude Code not signed in on this machine is an ANSWER — the reader's
    // `no-credential`, not a null (release review 2026-10-03).
    wrap(<QuotaPanel quota={{ read: true, quota: { ...quota, fiveHour: null, sevenDay: null, byModel: {}, problem: 'no-credential', account: null } }} />)
    expect(screen.getByText(/not signed in/i)).toBeTruthy()
  })
})

const repo = (over: Partial<RepoState> = {}): RepoState => ({
  path: '/w/a',
  branch: 'main',
  ahead: 0,
  behind: 0,
  changed: 0,
  untracked: 0,
  lastCommit: { sha: 'abc12345', subject: 'teach the projector about chains', at: new Date(Date.now() - 7200_000).toISOString() },
  readAt: new Date().toISOString(),
  error: null,
  ...over
})

const stats = (over: Partial<ProjectStats> = {}): ProjectStats => ({
  agentsRunning: 0,
  repos: 1,
  memoryFacts: 0,
  memorySuperseded: 0,
  transcripts: 0,
  transcriptChars: 0,
  retrievals: 0,
  retrievalMisses: 0,
  events: 0,
  lastActivityAt: null,
  code: {
    trackedFiles: 600,
    trackedLines: 184135,
    commits: 162,
    linesAdded: 175691,
    linesRemoved: 4273,
    windowDays: 7,
    readAt: new Date().toISOString(),
    error: null
  },
  ...over
})

describe('M56 — the last commit, measured since 2026-09-01 and rendered nowhere', () => {
  const bar = (r: RepoState[] | null, s = stats()): void =>
    wrap(<ProjectStatusBar stats={s} repos={r} quota={null} running={0} />)

  it('shows its age', () => {
    bar([repo()])
    expect(screen.getByText(/last commit 2h ago/)).toBeTruthy()
  })

  it('and what it was — an age alone says the repository is alive, not what it did', () => {
    bar([repo()])
    expect(screen.getByText('teach the projector about chains')).toBeTruthy()
  })

  it('a repository with no commits says so rather than showing nothing', () => {
    bar([repo({ lastCommit: null })])
    expect(screen.getByText(/no commits yet/)).toBeTruthy()
  })

  it('and a FAILED read shows no commit age at all — it is as stale as the branch', () => {
    bar([repo({ error: 'fatal: not a git repository' })])
    expect(screen.queryByText(/last commit/)).toBeNull()
  })
})

describe('M57 — numbers about the code, not about our own storage', () => {
  const bar = (s: ProjectStats): void =>
    wrap(<ProjectStatusBar stats={s} repos={[repo()]} quota={null} running={0} />)

  it('shows commits WITH the window they were counted over', () => {
    // "162 commits" is not a fact without the window.
    bar(stats())
    expect(screen.getByText('162 commits / 7d')).toBeTruthy()
  })

  it('shows the lines those commits moved', () => {
    bar(stats())
    expect(screen.getByText(/175691/)).toBeTruthy()
  })

  it('names the tracked count for what it counts, never as "lines of code"', () => {
    // In this repository the two largest tracked files are a 32 582-line icon
    // JSON and a 20 185-line font licence. A number called "lines of code" that
    // is a third data files is the over-claim M113 exists to end.
    bar(stats())
    expect(screen.getByText(/tracked lines/)).toBeTruthy()
    expect(screen.queryByText(/lines of code/i)).toBeNull()
  })

  it('a project with no repository shows no code numbers rather than zeros', () => {
    bar(stats({ code: null }))
    expect(screen.queryByText(/commits/)).toBeNull()
  })

  it('an unreadable repository says so rather than reporting zero commits', () => {
    bar(stats({ code: { ...stats().code!, error: 'fatal: not a git repository' } }))
    expect(screen.getByText(/unreadable/)).toBeTruthy()
    expect(screen.queryByText(/commits \/ 7d/)).toBeNull()
  })
})

describe('the favourites threshold, the limit, and what the operator is asked (UX28-10)', () => {
  const project = (id: string): ProjectRow =>
    ({ id, name: `p-${id}`, purpose: '', repo_path: null }) as ProjectRow
  const many = (n: number): ProjectRow[] => Array.from({ length: n }, (_, i) => project(`p${i}`))

  it('offers no pin control at or below the threshold', async () => {
    // SCN-043 step 3 as amended 2026-09-29 to the launch design (SCR-30/SCR-01):
    // ★ ↑ ↓ from the second project on; ranking one of one is still ceremony.
    // The fixture is asserted to BE the boundary case.
    expect(FAVOURITE_THRESHOLD).toBe(1)
    wrap(
      <EstateHome
        projects={many(FAVOURITE_THRESHOLD)}
        sessions={[]}
        feed={[]}
        marks={NO_MARKS}
        readThroughSeq={0}
      onRead={async () => {}}
      onOpen={() => {}}
        onNew={() => {}}
      />
    )
    await waitFor(() => expect(screen.getAllByText('p-p0').length).toBeGreaterThan(0))
    expect(screen.queryByRole('button', { name: new RegExp(`^${en['estate.pin']}: `) })).toBeNull()
  })

  it('and offers it above the threshold', async () => {
    wrap(
      <EstateHome
        projects={many(FAVOURITE_THRESHOLD + 1)}
        sessions={[]}
        feed={[]}
        marks={NO_MARKS}
        readThroughSeq={0}
      onRead={async () => {}}
      onOpen={() => {}}
        onNew={() => {}}
      />
    )
    await waitFor(() => expect(screen.getAllByRole('button', { name: new RegExp(`^${en['estate.pin']}: `) }).length).toBeGreaterThan(0))
  })

  it('says when a pinned project is not in the list, and keeps it pinned', async () => {
    // SCN-043's alt path. The skip is deliberate — deleting the id on a read
    // would mean a transient failure to load a project quietly unpins it — so
    // the surface must SAY so, or a pinned project is simply absent.
    const pins = ['p0', 'gone']
    const toggle = vi.fn(async () => ({ pins, saved: true }))
    ;(window as unknown as { fabric: unknown }).fabric = {
      favourites: { list: async () => pins, toggle, replace: vi.fn() },
      attention: { list: async () => whole([]) },
      workspace: { state: async () => ({ git: 'declined' }) },
      estate: { profile: async () => null, summary: async () => null },
      memory: { overview: async () => null },
      board: { query: async () => ({ rows: [], total: 0 }) },
      questions: { answer: async () => ({ ok: true }) }
    }
    render(
      <I18nProvider locale="en">
        <EstateHome
          projects={many(8)}
          sessions={[]}
          feed={[]}
          marks={NO_MARKS}
          readThroughSeq={0}
      onRead={async () => {}}
      onOpen={() => {}}
          onNew={() => {}}
        />
      </I18nProvider>
    )
    await waitFor(() => expect(screen.queryByTestId('pin-missing')).toBeTruthy())
    expect(screen.getByTestId('pin-missing').textContent).toMatch(/1 pinned project/)
    // And nothing was written to make it go away.
    expect(toggle).not.toHaveBeenCalled()
  })

  it('asks which to release when the set is full, and writes nothing until told', async () => {
    // The pin comes back `atLimit`: nothing written, nothing dropped. The
    // operator is shown one release per pinned project, because "pick one" with
    // no list is a question nobody can answer.
    const five = ['p0', 'p1', 'p2', 'p3', 'p4']
    const toggle = vi.fn(async () => ({ pins: five, saved: true, atLimit: { limit: 5 } }))
    const replace = vi.fn(async () => ({ pins: ['p1', 'p2', 'p3', 'p4', 'p6'], saved: true }))
    ;(window as unknown as { fabric: unknown }).fabric = {
      favourites: { list: async () => five, toggle, replace },
      attention: { list: async () => whole([]) },
      workspace: { state: async () => ({ git: 'declined' }) },
      estate: { profile: async () => null, summary: async () => null },
      memory: { overview: async () => null },
      board: { query: async () => ({ rows: [], total: 0 }) },
      questions: { answer: async () => ({ ok: true }) }
    }
    render(
      <I18nProvider locale="en">
        <EstateHome
          projects={many(8)}
          sessions={[]}
          feed={[]}
          marks={NO_MARKS}
          readThroughSeq={0}
      onRead={async () => {}}
      onOpen={() => {}}
          onNew={() => {}}
        />
      </I18nProvider>
    )
    const pin = new RegExp(`^${en['estate.pin']}: `)
    await waitFor(() => expect(screen.getAllByRole('button', { name: pin }).length).toBeGreaterThan(0))
    screen.getAllByRole('button', { name: pin })[0].click()

    await waitFor(() => expect(screen.queryByTestId('pin-full')).toBeTruthy())
    // One release per pinned project — five of them.
    expect(screen.getAllByText(/^Release /).length).toBe(five.length)
    // NOTHING has been replaced yet.
    expect(replace).not.toHaveBeenCalled()

    screen.getAllByText(/^Release /)[0].click()
    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1))
    // ONE write, and it names both halves of the swap.
    expect(replace.mock.calls[0]).toHaveLength(2)
  })
})
