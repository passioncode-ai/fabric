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
import { en } from './i18n/en'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from './i18n'
import { EstateHome } from './EstateHome'
import { ProjectStar } from './launch/ProjectStar'
import { ProjectStatusBar } from './ProjectHome'
import type { ProjectRow, ProjectStats, RepoState } from '../../shared/types'
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
    wrap(<ProjectStatusBar stats={s} repos={r} running={0} />)

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
    wrap(<ProjectStatusBar stats={s} repos={[repo()]} running={0} />)

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

// CO-460: a project is pinned from its own page (SCN-043); the home has no projects table and so no pin control.
describe('the star on a project page, the limit, and what the operator is asked (UX28-10)', () => {
  const project = (id: string): ProjectRow =>
    ({ id, name: `p-${id}`, purpose: '', repo_path: null }) as ProjectRow
  const stubPins = (fav: Record<string, unknown>, projects: ProjectRow[] = []) => {
    ;(window as unknown as { fabric: unknown }).fabric = { favourites: fav, projects: { list: async () => projects } }
  }

  it('pins and unpins the project it is on, saying which it is', async () => {
    const toggle = vi.fn(async () => ({ pins: ['p6'], saved: true }))
    stubPins({ list: async () => [], toggle, replace: vi.fn() })
    render(<I18nProvider locale="en"><ProjectStar project={project('p6')} /></I18nProvider>)
    const star = await screen.findByRole('button', { name: `${en['estate.pin']}: p-p6` })
    await waitFor(() => expect((star as HTMLButtonElement).disabled).toBe(false))
    expect(star.getAttribute('aria-pressed')).toBe('false')
    star.click()
    await waitFor(() => expect(screen.getByRole('button', { name: `${en['estate.unpin']}: p-p6` }).getAttribute('aria-pressed')).toBe('true'))
    expect(toggle).toHaveBeenCalledWith('p6')
  })

  it('asks which to release when the set is full, and writes nothing until told', async () => {
    // The pin comes back `atLimit`: nothing written, nothing dropped. The operator is shown one release per pinned
    // project, because "pick one" with no list is a question nobody can answer.
    const five = ['p0', 'p1', 'p2', 'p3', 'p4']
    const toggle = vi.fn(async () => ({ pins: five, saved: true, atLimit: { limit: 5 } }))
    const replace = vi.fn(async () => ({ pins: ['p1', 'p2', 'p3', 'p4', 'p6'], saved: true }))
    stubPins({ list: async () => five, toggle, replace }, [...five, 'p6'].map(project))
    render(<I18nProvider locale="en"><ProjectStar project={project('p6')} /></I18nProvider>)
    const star = await screen.findByRole('button', { name: `${en['estate.pin']}: p-p6` })
    await waitFor(() => expect((star as HTMLButtonElement).disabled).toBe(false))
    star.click()
    await waitFor(() => expect(screen.queryByTestId('pin-full')).toBeTruthy())
    expect(screen.getAllByText(/^Release /).length).toBe(five.length)
    expect(replace).not.toHaveBeenCalled()
    screen.getAllByText(/^Release /)[0].click()
    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1))
    // ONE write, and it names both halves of the swap.
    expect(replace.mock.calls[0]).toEqual(['p0', 'p6'])
  })

  it('says when the favourites could not be read, and offers no star to press', async () => {
    stubPins({ list: async () => { throw new Error('settings unreadable') }, toggle: vi.fn(), replace: vi.fn() })
    render(<I18nProvider locale="en"><ProjectStar project={project('p6')} /></I18nProvider>)
    await waitFor(() => expect(screen.getByText(en['estate.pinsUnread'])).toBeTruthy())
    expect((screen.getByRole('button', { name: `${en['estate.pin']}: p-p6` }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('the home offers no pin control and no folded «Ещё»', async () => {
    stubPins({ list: async () => [], toggle: vi.fn(), replace: vi.fn() })
    ;(window as unknown as { fabric: Record<string, unknown> }).fabric = {
      ...(window as unknown as { fabric: Record<string, unknown> }).fabric,
      attention: { list: async () => whole([]) },
      workspace: { state: async () => ({ git: 'declined' }) },
      board: { query: async () => ({ rows: [], total: 0 }) }
    }
    wrap(<EstateHome projects={[project('p0'), project('p1')]} sessions={[]} feed={[]} marks={NO_MARKS} onOpen={() => {}} onNew={() => {}} />)
    await waitFor(() => expect(document.querySelector('.lh-hero')).toBeTruthy())
    expect(screen.queryByRole('button', { name: new RegExp(`^${en['estate.pin']}: `) })).toBeNull()
    expect(document.getElementById('sec-estate-more')).toBeNull()
  })
})


describe('CO-476: the home keeps its narrow reading order in the DOM', () => {
  const media = (narrow: boolean) => vi.fn((query: string) => ({ matches: narrow && query === '(max-width: 1100px)', media: query, addEventListener: () => {}, removeEventListener: () => {} }))
  for (const narrow of [false, true]) it(`«Нужны вы» ${narrow ? 'sits in the main column, after the strip' : 'is the side column beside the main one'} at ${narrow ? 'a narrow' : 'a wide'} window`, async () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: media(narrow) })
    wrap(<EstateHome projects={[]} sessions={[]} feed={[]} marks={NO_MARKS} onOpen={() => {}} onNew={() => {}} />)
    const side = await waitFor(() => { const s = document.querySelector('.lh-side-column'); expect(s).not.toBeNull(); return s as Element })
    const main = document.querySelector('.lh-main-column') as Element
    expect(main.contains(side)).toBe(narrow)
    const hero = document.querySelector('.lh-hero') as Element
    expect(!!(hero.compareDocumentPosition(side) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: undefined })
  })
})
