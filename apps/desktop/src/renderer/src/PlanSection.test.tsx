// "Nobody counted" is not "nothing was cut" (UX28-08).
//
// M190 built the honest contract and the panel wired it: `goalProgress`
// distinguishes a measured fraction from one whose closed half was capped, and
// `planProgress.ts` says in its own words why `available === null` matters —
// "it is 'nobody counted', and reporting it as complete is how a capped read
// becomes a total one screen along".
//
// The panel then wrote `closedCoverage?.truncated === true`.
//
// `coverageOfList` returns three answers, not two: `true`, `false`, and
// `'unknown'` — the last meaning nobody counted how many closed tasks exist. A
// strict `=== true` reads `'unknown'` as "not truncated", so the goal reports a
// REAL fraction built on a number nobody verified. That is the card's negative
// acceptance word for word: a partial source must never create false
// completion.
//
// And the honest reading was already written six files away:
// `DecisionsSection.tsx` handles `truncated === true || truncated ===
// 'unknown'`. One value, two readings, in one codebase.
//
// A goal with three open and forty done is the case that hurts: capped at
// twenty, `'unknown'`, and the panel says "20 of 23 done" as though it were
// counted.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { PlanSection } from './PlanSection'
import { I18nProvider } from './i18n'
import { coverageOfList } from '../../shared/planProgress'
import type { GoalRow, ProjectRow, TaskList, TaskRow } from '../../shared/types'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const project = { id: 'p1', name: 'atlas', estate_id: 'e1' } as ProjectRow
const goal: GoalRow = { id: 'g1', project_id: 'p1', title: 'Ship the launch' } as GoalRow

const task = (over: Partial<TaskRow>): TaskRow =>
  ({
    id: 't1',
    project_id: 'p1',
    goal_id: 'g1',
    title: 'Do it',
    instruction: 'do it',
    status: 'backlog',
    task_type: null,
    ...over
  }) as TaskRow

function stub() {
  const api = {
    goals: { list: vi.fn(async () => [goal]), define: vi.fn(async () => ({ ok: true })) },
    tasks: { attach: vi.fn(async () => ({ ok: true })) }
  }
  vi.stubGlobal('window', Object.assign(globalThis.window ?? {}, { fabric: api }))
  return api
}

const show = (tasks: TaskRow[], closedCoverage: TaskList['closed'] | null) =>
  render(
    <I18nProvider locale="en">
      <PlanSection
        project={project}
        feedMark={0}
        tasks={tasks}
        closedCoverage={closedCoverage}
        onChanged={async () => {}}
        onError={vi.fn()}
      />
    </I18nProvider>
  )

/** The three tasks the cap actually returned, of however many exist. */
const capped = [
  task({ id: 'open-1', status: 'backlog' }),
  task({ id: 'done-1', status: 'done' }),
  task({ id: 'done-2', status: 'done' })
]

describe('a fraction built on a count nobody took says so', () => {
  it('treats "nobody counted" as a floor, not as a measurement', async () => {
    // THE MEASURED DEFECT. `coverageOfList` with `available: null` and a
    // returned count under the cap answers `'unknown'`, and `=== true` read
    // that as "nothing was cut".
    const coverage = coverageOfList({ returned: 3, available: null, cap: 20 })
    expect(coverage.truncated, 'the fixture must be the unknown case, or this proves nothing').toBe(
      'unknown'
    )
    stub()
    show(capped, coverage)
    await waitFor(() => expect(screen.getByText(/Ship the launch/)).toBeTruthy())
    // "at least N of M … both numbers are floors" — never a bare fraction.
    expect(screen.getByText(/at least/i)).toBeTruthy()
    expect(screen.queryByText(/^2 of 3 done$/)).toBeNull()
  })

  it('and a source known to be cut short is a floor too', async () => {
    const coverage = coverageOfList({ returned: 20, available: 43, cap: 20 })
    expect(coverage.truncated).toBe(true)
    stub()
    show(capped, coverage)
    await waitFor(() => expect(screen.getByText(/at least/i)).toBeTruthy())
  })

  it('but a source known to be whole gives a real fraction', async () => {
    // The other direction, so the fix is not "always say at least" — which
    // would make the caveat meaningless by making it universal.
    const coverage = coverageOfList({ returned: 3, available: 3, cap: 20 })
    expect(coverage.truncated).toBe(false)
    stub()
    show(capped, coverage)
    await waitFor(() => expect(screen.getByText(/2 of 3 done/)).toBeTruthy())
    expect(screen.queryByText(/at least/i)).toBeNull()
  })

  it('and no coverage at all is treated as unverified rather than whole', async () => {
    // `closedCoverage` is nullable on the prop. A null coverage is the same
    // claim as `'unknown'` — nobody counted — and used to fall through to a
    // real fraction as well.
    stub()
    show(capped, null)
    await waitFor(() => expect(screen.getByText(/Ship the launch/)).toBeTruthy())
    expect(screen.getByText(/at least/i)).toBeTruthy()
  })
})

describe('the plan says what nobody has connected to a direction', () => {
  it('lists work under no goal, always', async () => {
    // The panel's own header calls this the point: "Hiding it is how a backlog
    // becomes a place things go to be forgotten." Asserted rather than trusted,
    // because the card asks for orphan work to be represented.
    stub()
    show([task({ id: 'orphan', goal_id: null, title: 'Nobody asked for this' })], null)
    await waitFor(() => expect(screen.getByText('Nobody asked for this')).toBeTruthy())
  })

  it('and a goal nobody has broken down is not nought per cent', async () => {
    // An undecomposed goal has not started badly — nobody has said what it
    // involves, and those two need different next acts.
    stub()
    show([], null)
    await waitFor(() => expect(screen.getByText(/nothing planned/i)).toBeTruthy())
    expect(screen.queryByText(/0 of 0/)).toBeNull()
  })
})
