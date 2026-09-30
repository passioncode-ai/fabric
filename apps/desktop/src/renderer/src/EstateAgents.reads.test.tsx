// A payload that knows whose it is (UX28-02).
//
// Three defects in four lines, and they were coupled by one `Promise.all`:
//
//   1. A rejected `repoStates` discarded a `history` that had come back fine,
//      because one catch covered both.
//   2. Selecting agent B rendered A's history until the new read resolved —
//      `alive` stops a LATE write and says nothing about a stale one that was
//      written on time, for somebody else.
//   3. A failed refresh left the previous payload on screen as current.
//
// And one more, measured in App.tsx's own comment at the feed cap: EstateHome
// watched `feed?.length`, the feed is capped at 500, so after the
// five-hundredth event the estate Board and the attention count froze for the
// rest of the session.
//
// These are checked by RENDERING, not by reading the types: the point of a
// keyed read is that a component cannot show the wrong subject, and only a
// render can say whether it does.

import type React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { EstateAgents } from './EstateAgents'
import { EstateHome } from './EstateHome'
import { I18nProvider } from './i18n'
import { en } from './i18n/en'
import { NO_MARKS, advance, type FeedMarks } from '../../shared/feedMarks'
import {
  failed,
  forSubject,
  pending,
  settled,
  staleness,
  subjectOf,
  failures,
  sameSubject
} from '../../shared/keyedRead'
import { FACTS_QUERY_KEYS, factsSubject, type FactsQuery } from '../../shared/factsQuery'
import { INSIGHT_CATEGORIES } from '../../shared/memoryContract'
import { Tasks } from './Tasks'
import { ReposSection } from './ProjectHome'
import type { RepoRow } from '../../shared/types'
import type { TaskRow } from '../../shared/types'
import type { FeedEvent, ProjectRow, TerminalSession } from '../../shared/types'
import { whole } from '../../../test/envelopes'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const project = (id: string): ProjectRow => ({ id, name: id, estate_id: 'e1' }) as ProjectRow

const session = (sessionId: string, projectId: string): TerminalSession =>
  ({
    sessionId,
    projectId,
    cwd: '/tmp',
    program: 'claude',
    optionId: 'claude-code',
    permissionMode: 'ask',
    excerpt: '',
    written: 0,
    running: true,
    state: 'running',
    startedAt: '2026-09-10T00:00:00.000Z',
    lastActivityAt: '2026-09-10T00:00:00.000Z',
    tail: '',
    exitCode: null
  }) as TerminalSession

const event = (seq: number, says: string): FeedEvent =>
  ({
    seq,
    type: 'agent.stage.reported@1',
    project_id: 'p1',
    occurred_at: '2026-09-10T00:00:00.000Z',
    actor: { kind: 'agent', id: 'a' },
    payload: { note: says }
  }) as unknown as FeedEvent

/** The renderer's window surface, with each read separately controllable. */
function stubFabric(over: Record<string, unknown> = {}) {
  const api = {
    // The panel attaches a real terminal for a LIVE session now (UX28-13), so
    // the PTY channels have to exist here even though this file's subject is
    // the reads. Each hands back an unsubscribe, as the preload's do.
    runs: { status: vi.fn(async () => null) },
    terminal: {
      history: vi.fn(async () => [] as FeedEvent[]),
      onData: vi.fn(() => () => {}),
      onExit: vi.fn(() => () => {}),
      scrollback: vi.fn(async () => null),
      write: vi.fn(),
      resize: vi.fn()
    },
    projects: {
      repoStates: vi.fn(async () => [] as never[]),
      onRepoChanged: vi.fn(() => () => {}),
      list: vi.fn(async () => [])
    },
    attention: { list: vi.fn(async () => whole([])) },
    board: { query: vi.fn(async () => ({ rows: [], total: 0 })) },
    questions: { answer: vi.fn(async () => ({ ok: true })) },
    favourites: { list: vi.fn(async () => []), toggle: vi.fn(async () => []) },
    workspace: { state: vi.fn(async () => ({ git: 'declined' })) },
    estate: { profile: vi.fn(async () => null), summary: vi.fn(async () => null) },
    memory: { overview: vi.fn(async () => null) }
  }
  // ONE LEVEL DEEP, because a whole-namespace override drops its siblings.
  // Measured: a case overriding `terminal` to make `history` reject also
  // removed `onData`, so `TerminalView` threw, React unmounted the tree, and
  // the assertion about the history failure line reported `expected null to be
  // truthy` against an empty body — three files from the cause. A test helper
  // that silently drops a channel is the same trap as a polyfill hidden in one
  // spec.
  //
  // The FIRST version of this merge spread `...over` into the literal above and
  // then merged each namespace with itself, which changed nothing — the base
  // has to be read before the override lands on it.
  for (const [namespace, replacement] of Object.entries(over)) {
    const base = (api as Record<string, unknown>)[namespace]
    ;(api as Record<string, unknown>)[namespace] =
      base && replacement && typeof base === 'object' && typeof replacement === 'object'
        ? { ...base, ...(replacement as object) }
        : replacement
  }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: api }))
  return api
}

const agents = (sessions: TerminalSession[], onError = vi.fn()) =>
  render(
    <I18nProvider locale="en">
      <EstateAgents
        sessions={sessions}
        projects={[project('p1'), project('p2')]}
        onOpen={vi.fn()}
        onError={onError}
      />
    </I18nProvider>
  )

describe('one source rejecting does not discard the other', () => {
  it('keeps a history that resolved when the repositories failed', async () => {
    const onError = vi.fn()
    stubFabric({
      terminal: {
        history: vi.fn(async () => [event(1, 'the agent said this')]),
        onData: vi.fn(() => () => {}),
        onExit: vi.fn(() => () => {}),
        scrollback: vi.fn(async () => null),
        write: vi.fn(),
        resize: vi.fn()
      },
      projects: {
        repoStates: vi.fn(async () => {
          throw new Error('git is unreachable')
        }),
        onRepoChanged: vi.fn(() => () => {})
      }
    })
    const { container } = agents([session('s1', 'p1')], onError)
    // Select the agent — the panel reads on selection.
    const button = container.querySelector('button')
    button?.click()
    await waitFor(() => expect(screen.queryByTestId('repos-failed')).toBeTruthy())
    expect(screen.getByTestId('repos-failed').textContent).toMatch(/git is unreachable/)
    // THE POINT, and it has to be LOOKED at rather than assumed: the history
    // that came back fine is still on screen. Under one `Promise.all` and one
    // catch it was discarded with the failure next to it.
    expect(screen.getByText('agent.stage.reported@1')).toBeTruthy()
    expect(onError).toHaveBeenCalled()
  })

  it('and reports WHICH source failed, not only that something did', async () => {
    stubFabric({
      terminal: {
        history: vi.fn(async () => {
          throw new Error('the session is gone')
        })
      }
    })
    const { container } = agents([session('s1', 'p1')])
    container.querySelector('button')?.click()
    await waitFor(() => expect(screen.queryByTestId('history-failed')).toBeTruthy())
    expect(screen.getByTestId('history-failed').textContent).toMatch(/the session is gone/)
    // The repositories resolved, so their failure line is absent.
    expect(screen.queryByTestId('repos-failed')).toBeNull()
  })
})

describe('a new subject never inherits the old subject payload', () => {
  it('refuses another subject’s value, which is the mechanism rather than a check', () => {
    const forA = settled<string[]>(pending<string[]>('A'), { subject: 'A', value: ['a-1'], at: 1 })
    expect(forA?.value).toEqual(['a-1'])
    // Asking for B's read while holding A's gets `loading`, not A's payload.
    const asB = forSubject(forA, 'B')
    expect(asB.state).toBe('loading')
    expect(asB.value).toBeNull()
    expect(asB.subject).toBe('B')
  })

  it('drops a late answer for the subject that was left', () => {
    const showingB = pending<string[]>('B')
    const lateA = settled(showingB, { subject: 'A', value: ['a-1'], at: 2 })
    expect(lateA).toBe(showingB)
    expect(lateA?.value).toBeNull()
  })

  it('drops a late FAILURE for the subject that was left, too', () => {
    // The mirror case, and the one an `alive` closure usually forgets: a
    // rejection for A must not mark B as failed.
    const showingB = settled<string[]>(pending<string[]>('B'), { subject: 'B', value: ['b-1'], at: 3 })
    const lateFailure = failed(showingB, { subject: 'A', why: 'A is gone' })
    expect(lateFailure?.state).toBe('ready')
    expect(lateFailure?.value).toEqual(['b-1'])
  })
})

describe('a failed read does not leave the old value on screen as current', () => {
  it('drops the payload with the failure', () => {
    const ready = settled<string[]>(pending<string[]>('A'), { subject: 'A', value: ['a-1'], at: 1 })
    const broken = failed(ready, { subject: 'A', why: 'the transport died' })
    expect(broken?.state).toBe('failed')
    expect(broken?.value).toBeNull()
    expect(broken?.failedWhy).toMatch(/transport died/)
  })

  it('and has no age to show, which is different from an age of zero', () => {
    const broken = failed(pending<string[]>('A'), { subject: 'A', why: 'no' })
    const age = staleness(broken!, 1000, 60)
    expect(age.known).toBe(false)
  })
})

describe('age and staleness are visible rather than assumed', () => {
  it('reports the age of an answer', () => {
    const ready = settled<string[]>(pending<string[]>('A'), { subject: 'A', value: [], at: 0 })
    const age = staleness(ready!, 90_000, 60)
    expect(age.known && age.ageSeconds).toBe(90)
    expect(age.known && age.stale).toBe(true)
  })

  it('and says nothing has been read rather than reporting an age of zero', () => {
    const age = staleness(pending<string[]>('A'), 1000, 60)
    expect(age.known).toBe(false)
    expect(age.known === false && age.why).toMatch(/nothing has been read/)
  })
})

describe('two reads for one subject, told apart', () => {
  it('notices when two reads are about different subjects', () => {
    const a = settled<string[]>(pending<string[]>('A'), { subject: 'A', value: [], at: 1 })!
    const b = settled<string[]>(pending<string[]>('B'), { subject: 'B', value: [], at: 1 })!
    expect(sameSubject([a, a])).toBe(true)
    expect(sameSubject([a, b])).toBe(false)
  })

  it('and lists every failure, so one cannot hide another', () => {
    const one = failed<string[]>(pending<string[]>('A'), { subject: 'A', why: 'first' })!
    const two = failed<string[]>(pending<string[]>('A'), { subject: 'A', why: 'second' })!
    const all = failures([
      { name: 'history', read: one },
      { name: 'repos', read: two }
    ])
    expect(all.map((f) => f.name)).toEqual(['history', 'repos'])
    expect(all.map((f) => f.why)).toEqual(['first', 'second'])
  })
})

describe('the estate Board follows a monotonic mark, not a capped count', () => {
  it('moves past the display cap', () => {
    // The measured defect: `feed.length` stops at 500 and every reader watching
    // it freezes. A mark is the journal's own sequence and keeps going.
    let marks = NO_MARKS
    for (const seq of [1, 500, 501, 5000])
      marks = advance(marks, [{ seq, type: 'task.moved@1' }])
    expect(marks.all).toBe(5000)
    expect(marks.byFamily.task).toBe(5000)
  })

  it('and EstateHome re-reads on the MARK, never on the feed length', async () => {
    // The property, not the fixture: hold the mark still and grow the feed —
    // nothing must re-read, because a capped array is not news. Then advance
    // the mark alone and the read must fire. Under `feedMark={feed?.length}`
    // these two assertions swap over, which is the defect.
    const api = stubFabric()
    const home = (marks: FeedMarks, feed: FeedEvent[]): React.ReactElement => (
      <I18nProvider locale="en">
        <EstateHome
          projects={[project('p1')]}
          sessions={[]}
          feed={feed}
          marks={marks}
          onOpen={vi.fn()}
          onNew={vi.fn()}
        readThroughSeq={0}
        onRead={async () => {}}
      />
      </I18nProvider>
    )
    const held = advance(NO_MARKS, [{ seq: 500, type: 'task.moved@1' }])
    const { rerender } = render(home(held, []))
    await waitFor(() => expect(api.attention.list).toHaveBeenCalledTimes(1))

    // 500 more events arrive and the display array is capped, so its length no
    // longer moves. Nothing may re-read from that.
    rerender(home(held, [event(1, 'a'), event(2, 'b')]))
    await waitFor(() => expect(api.attention.list).toHaveBeenCalledTimes(1))

    // The journal moved. THAT is news, past the cap.
    rerender(home(advance(held, [{ seq: 1200, type: 'task.moved@1' }]), []))
    await waitFor(() => expect(api.attention.list).toHaveBeenCalledTimes(2))
  })
})

describe('a subject built from parts cannot collide with another', () => {
  it('length-prefixes, because a separator is a character the data may contain', () => {
    // Joined on '|' these two are the same string and they are two different
    // questions. Length-prefixed they cannot be.
    expect(subjectOf(['a|b', 'c'])).not.toBe(subjectOf(['a', 'b|c']))
    expect(subjectOf(['a', 'b'])).toBe(subjectOf(['a', 'b']))
  })

  it('tells an absent part from an empty one', () => {
    expect(subjectOf([null])).not.toBe(subjectOf(['']))
  })
})

describe('the facts panel asks its WHOLE question', () => {
  const base: FactsQuery = { projectId: 'p1', query: '', showSuperseded: false, category: null }

  it('every field of the query changes the subject', () => {
    // Walked from the key list rather than written out: a fifth filter added to
    // FactsQuery and left out of the fence fails HERE, which is the only place
    // that would notice before an operator does.
    const others: Record<keyof FactsQuery, unknown> = {
      projectId: 'p2',
      query: 'ledger',
      showSuperseded: true,
      category: INSIGHT_CATEGORIES[1]
    }
    for (const key of FACTS_QUERY_KEYS) {
      const changed = { ...base, [key]: others[key] } as FactsQuery
      expect(factsSubject(changed), `${key} does not participate in the subject`).not.toBe(factsSubject(base))
    }
  })

  it('and the key list matches the interface, so the walk above cannot go blind', () => {
    // The list is data; if it drifts from the interface the loop silently tests
    // fewer fields than exist. `base` has one key per field by construction.
    expect([...FACTS_QUERY_KEYS].sort()).toEqual(Object.keys(base).sort())
  })

  it('so the same text under a different category is a different question', () => {
    // THE MEASURED CASE. The old fence compared the search string alone: both
    // requests carried '', both passed, and the later answer won whichever
    // category it belonged to.
    const asOne = factsSubject({ ...base, category: INSIGHT_CATEGORIES[0] })
    const asAnother = factsSubject({ ...base, category: INSIGHT_CATEGORIES[1] })
    expect(asOne).not.toBe(asAnother)
    expect(forSubject(settled(pending(asOne), { subject: asOne, value: ['a'], at: 1 }), asAnother).value)
      .toBeNull()
  })
})

describe('an unreadable backlog is not an empty backlog', () => {
  const project = { id: 'p1', name: 'Fabric', default_agent: 'claude-code' } as ProjectRow
  const mountTasks = (over: Record<string, unknown>): void => {
    stubFabric({
      tasks: { list: vi.fn(async () => ({ tasks: [] as TaskRow[], closed: { truncated: false, says: 'all 0' } })) },
      agents: { list: vi.fn(async () => []) },
      terminal: {
        options: vi.fn(async () => [
          { id: 'claude-code', label: 'Claude Code', available: true, permissionModes: [] }
        ])
      },
      ...over
    })
    render(
      <I18nProvider locale="en">
        <Tasks project={project} onStarted={() => {}} onError={() => {}} feedMark={0} />
      </I18nProvider>
    )
  }

  it('says the read failed rather than quietly offering fewer presets', async () => {
    // MEASURED: the catch was `() => setSources({})`. A database that would not
    // answer produced the same screen as an empty board — the data-backed
    // presets were simply absent, and nothing said why.
    mountTasks({
      tasks: {
        list: vi.fn(async () => {
          throw new Error('the board could not be read')
        })
      }
    })
    await waitFor(() => expect(screen.queryByTestId('presets-failed')).toBeTruthy())
    expect(screen.getByTestId('presets-failed').textContent).toMatch(/the board could not be read/)
  })

  it('and an empty board says nothing, because there is nothing wrong with it', async () => {
    mountTasks({})
    await waitFor(() => expect(screen.getByText('Run')).toBeTruthy())
    expect(screen.queryByTestId('presets-failed')).toBeNull()
  })
})

describe('a repository list tells its three states apart', () => {
  const project = { id: 'p1', name: 'Fabric', default_agent: 'claude-code' } as ProjectRow
  const show = (read: Parameters<typeof ReposSection>[0]['read']): void => {
    stubFabric()
    render(
      <I18nProvider locale="en">
        <ReposSection project={project} read={read} onChanged={() => {}} onError={vi.fn()} />
      </I18nProvider>
    )
  }

  it('a read that failed says so instead of "no repositories"', () => {
    // MEASURED: this read had no fence at all and its failure raised a banner
    // while the panel kept the previous project's list. `null` meant "loading"
    // and there was no third state for "asked and refused".
    show(failed<RepoRow[]>(pending<RepoRow[]>('p1'), { subject: 'p1', why: 'the store refused' })!)
    expect(screen.getByTestId('repos-list-failed').textContent).toMatch(/the store refused/)
    expect(screen.queryByText(en['onboarding.noRepos'])).toBeNull()
  })

  it('an empty answer is an answer', () => {
    show(settled<RepoRow[]>(pending<RepoRow[]>('p1'), { subject: 'p1', value: [], at: 1 })!)
    expect(screen.queryByTestId('repos-list-failed')).toBeNull()
    expect(screen.getByText(en['onboarding.noRepos'])).toBeTruthy()
  })

  it('and not having asked yet is neither of those', () => {
    show(pending<RepoRow[]>('p1'))
    expect(screen.queryByTestId('repos-list-failed')).toBeNull()
    // The waiting state, not the empty one: the panel has not asked.
    expect(screen.getByText(en['app.loading'])).toBeTruthy()
  })
})
