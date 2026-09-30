// "No agents" was a measurement nobody took (UXA-C05).
//
// M108 is this codebase's own rule and `EstateHome` states it in its props in as
// many words: "null until it has been read; the empty array is a MEASUREMENT".
// MEASURED at `ab3a42b`, the same two values reach three other surfaces and lose
// that distinction at the door:
//
//   * `App.tsx` renders `EstateHome` with `sessions={sessions}` and, FIVE LINES
//     ABOVE, `EstateAgents` with `sessions={sessions ?? []}`. The agents view
//     then says `EmptyState read` — this codebase's marker for a measurement —
//     over a list nobody has read yet.
//   * `ProjectHome` passes `sessions={sessions ?? []}` into `AgentsSection`,
//     whose `EmptyState read={sessions !== null}` therefore CANNOT be false.
//     The waiting string it carries is unreachable copy.
//   * `ProjectStatusBar` takes `running={(sessions ?? []).filter(…).length}`,
//     and a number has no read-marker at all: the cell says "no agents running"
//     before anyone looked. Its own prop list argues against exactly this, about
//     the field NEXT TO IT — `blocked` is optional on purpose because "a
//     hardcoded zero renders as 'nothing is blocked', which is a measurement
//     nobody took".
//
// One value, four doors, one of them right. Eighth instance this cycle of a rule
// held in some places and not all, and the first where the argument against the
// defect is written in the same prop list as the defect.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { AgentsSection, ProjectStatusBar } from './ProjectHome'
import { EstateAgents } from './EstateAgents'
import { I18nProvider } from './i18n'
import { en } from './i18n/en'
import type { ProjectRow, ProjectStats, TerminalSession } from '../../shared/types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const project = (): ProjectRow =>
  ({
    id: 'p1',
    estate_id: 'e1',
    name: 'Atlas',
    purpose: null,
    repo_path: '/repo/atlas',
    status: 'active',
    config_revision: 1,
    created_at: '2026-09-11T00:00:00Z',
    memory_backend: 'local',
    default_agent: 'claude-code',
    mcp_servers: []
  }) as ProjectRow

/** The real shape, so a field the bar reads cannot be absent from the fixture. */
const stats: ProjectStats = {
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
  code: null
}

function stub(): void {
  vi.stubGlobal(
    'window',
    Object.assign(globalThis.window ?? {}, {
      fabric: {
        terminal: {
          options: async () => [{ id: 'claude-code', available: true }],
          claims: async () => []
        },
        agents: { list: async () => [] },
        projects: { repoStates: async () => [] }
      }
    })
  )
}

const wrap = (ui: React.ReactNode) => render(<I18nProvider locale="en">{ui}</I18nProvider>)

describe('the status bar does not call an unread list idle', () => {
  it('says "no agents running" when the read ANSWERED with none — the fixture is the measured case', () => {
    // Asserted first: without it the case below would pass on a cell that never
    // said anything either way.
    wrap(<ProjectStatusBar stats={stats} repos={null} quota={null} running={0} />)
    expect(screen.getByText(en['status.idleAgents'])).toBeTruthy()
  })

  it('but says NOTHING of the kind before anyone has looked', () => {
    // The argument is in this component's own prop list, about the field beside
    // this one: a hardcoded zero renders as a measurement nobody took.
    wrap(<ProjectStatusBar stats={stats} repos={null} quota={null} running={null} />)
    expect(screen.queryByText(en['status.idleAgents'])).toBeNull()
  })

  it('and still counts what is running when the read answered with some', () => {
    wrap(<ProjectStatusBar stats={stats} repos={null} quota={null} running={2} />)
    expect(screen.getByText(/2/)).toBeTruthy()
  })
})

describe('the project agents panel keeps the unread state it was given', () => {
  const show = (sessions: TerminalSession[] | null) =>
    wrap(
      <AgentsSection
        project={project()}
        sessions={sessions}
        claims={[]}
        onSessionsChanged={vi.fn()}
        onError={vi.fn()}
      />
    )

  it('says the estate holds no agent HERE only once the read answered', async () => {
    stub()
    show([])
    await waitFor(() => expect(screen.getByText(en['agents.empty'])).toBeTruthy())
  })

  it('and shows the waiting line while the read is still out', async () => {
    // `read={sessions !== null}` was already written here and could never be
    // false, because the parent collapsed the null at the call site. The string
    // it carries was unreachable copy.
    stub()
    show(null)
    await waitFor(() => expect(screen.getByText(en['agents.reading'])).toBeTruthy())
    expect(screen.queryByText(en['agents.empty'])).toBeNull()
  })
})

describe('the estate agents view says which question it is answering', () => {
  const show = (sessions: TerminalSession[] | null) =>
    wrap(
      <EstateAgents sessions={sessions} projects={[project()]} onOpen={vi.fn()} onError={vi.fn()} />
    )

  it('states that nothing is running once the read answered', () => {
    stub()
    show([])
    expect(screen.getByText(en['agents.none'])).toBeTruthy()
  })

  it('but does not state it before the read has happened', () => {
    // `EmptyState read` with no condition at all: a claim about the whole
    // estate, made on the first paint.
    stub()
    show(null)
    expect(screen.queryByText(en['agents.none'])).toBeNull()
  })
})
