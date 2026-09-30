// The plan (M146 step 7 · SCR-33).
//
// Read-only about structure and writable about two things only: defining a
// goal, and putting a task under one. The grouping itself lives in
// `shared/plan.ts` with its invariant under test — every task comes out exactly
// once — because a planning surface that can drop a row looks exactly like a
// project with less to do.
//
// THE UNATTACHED LIST IS THE POINT. It sits below the goals, always rendered,
// and it says what it is: work nobody has connected to a direction. Hiding it
// is how a backlog becomes a place things go to be forgotten.
//
// What is NOT here, and why: no diagram. The links between tasks are drawn as
// text on the task page, where they are read one task at a time. A picture of
// six nodes is decoration; a picture of sixty needs a layout engine and a
// legend, and neither is what an operator asks a plan for.

import { useEffect, useState } from 'react'
import type { GoalRow, ProjectRow, TaskRow } from '../../shared/types'
import { planOf } from '../../shared/plan.ts'
import { Button, EmptyState, Field, Panel, Row, Toolbar } from './components'
import { useT } from './i18n'
import { goalProgress, type GoalProgress } from '../../shared/planProgress'
import type { TaskList } from '../../shared/types'

export function PlanSection({
  project,
  feedMark,
  tasks,
  closedCoverage,
  onChanged,
  onError
}: {
  project: ProjectRow
  /** The journal's high-water mark. Without it this panel reads once and then
   *  disagrees with the board beside it — one screen showing the same estate at
   *  two different times (audit, 2026-09-05). */
  feedMark: number
  tasks: TaskRow[] | null
  /** Whether the finished half of `tasks` was capped (M190). A fraction
   *  computed from a truncated read is a floor, not a total. */
  closedCoverage: TaskList['closed'] | null
  onChanged: () => Promise<void>
  onError: (message: string) => void
}): React.JSX.Element {
  const t = useT()
  const [goals, setGoals] = useState<GoalRow[] | null>(null)
  const [title, setTitle] = useState('')

  const load = async (): Promise<void> => {
    try {
      setGoals(await window.fabric.goals.list(project.id))
    } catch (e) {
      onError(String(e))
    }
  }
  useEffect(() => {
    void load()
  }, [project.id, feedMark])

  const addGoal = async (): Promise<void> => {
    if (!title.trim()) return
    try {
      await window.fabric.goals.define(project.id, title)
      setTitle('')
      await load()
    } catch (e) {
      onError(String(e))
    }
  }

  const attach = async (taskId: string, goalId: string): Promise<void> => {
    try {
      // Appended to the end of that goal: a position the operator did not
      // choose is the end of the queue, never the front of it.
      const current = plan.goals.find((g) => g.goal.id === goalId)?.tasks.length ?? 0
      await window.fabric.tasks.prioritise(taskId, goalId, current + 1)
      await onChanged()
    } catch (e) {
      onError(String(e))
    }
  }

  // Only open work is planned. A done task under a goal is history, and history
  // belongs on the board's done column rather than in a plan of what is next.
  const open = (tasks ?? []).filter(
    (task) => task.status === 'backlog' || task.status === 'running' || task.status === 'review'
  )
  const plan = planOf(goals ?? [], open)

  // M190 — THE DENOMINATOR. This showed the count of OPEN tasks as a bare
  // figure beside the goal, so a goal with three open and forty done read "3":
  // an amount of work rather than a remainder, and no way to ask how far along
  // anything is. The closed half may have been capped, and when it was the
  // fraction is reported as a FLOOR rather than drawn as a bar.
  const closedUnder = (goalId: string): number =>
    (tasks ?? []).filter(
      (t) => t.goal_id === goalId && (t.status === 'done' || t.status === 'cancelled')
    ).length
  const progressFor = (goalId: string, openCount: number): GoalProgress =>
    goalProgress({
      goalId,
      open: openCount,
      closed: closedUnder(goalId),
      // THREE ANSWERS, NOT TWO (UX28-08). `coverageOfList` returns `true`,
      // `false` and `'unknown'`, and the last means nobody counted how many
      // closed tasks exist. `=== true` read that as "nothing was cut", so the
      // goal reported a real fraction built on a number nobody verified —
      // which `planProgress.ts` forbids in its own words: "reporting it as
      // complete is how a capped read becomes a total one screen along."
      //
      // A MISSING coverage is the same claim as `'unknown'`: no count was
      // taken. `DecisionsSection` already reads the value this way, six files
      // away — one value, two readings, in one codebase.
      closedTruncated: closedCoverage?.truncated !== false
    })

  return (
    <Panel id="sec-plan" title={t('plan.title')}>
      <p className="muted">{t('plan.lede')}</p>

      {goals !== null && goals.length === 0 && <EmptyState read>{t('plan.noGoals')}</EmptyState>}

      {plan.goals.map(({ goal, tasks: under }) => (
        <div key={goal.id} className="widget-list">
          <Row lead={<span className="mono">{under.length}</span>}>
            {goal.title}{' '}
            <span className="muted">{progressFor(goal.id, under.length).says}</span>
          </Row>
          {under.length === 0 ? (
            <EmptyState read>{t('plan.emptyGoal')}</EmptyState>
          ) : (
            under.map((task, index) => (
              <Row key={task.id} quiet lead={<span className="mono">{index + 1}</span>}>
                {task.title ?? task.instruction}
              </Row>
            ))
          )}
        </div>
      ))}

      <h3 className="task-history-head">{t('plan.unattached')}</h3>
      <p className="muted">{t('plan.unattachedLede')}</p>
      {plan.unattached.length === 0 ? (
        <EmptyState read={tasks !== null}>{t('plan.allAttached')}</EmptyState>
      ) : (
        plan.unattached.map((task) => (
          <Row
            key={task.id}
            trail={
              goals && goals.length > 0 ? (
                <select
                  aria-label={t('plan.attach')}
                  value=""
                  onChange={(e) => {
                    if (e.target.value) void attach(task.id, e.target.value)
                  }}
                >
                  <option value="">{t('plan.attach')}</option>
                  {goals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.title}
                    </option>
                  ))}
                </select>
              ) : undefined
            }
          >
            {task.title ?? task.instruction}
          </Row>
        ))
      )}

      <Field label={t('plan.newGoal')} hint={t('plan.autonomyNote')}>
        {(id) => (
          <input
            id={id}
            value={title}
            placeholder={t('plan.newGoalPlaceholder')}
            onChange={(e) => setTitle(e.target.value)}
          />
        )}
      </Field>
      <Toolbar align="end">
        <Button onClick={() => void addGoal()}>{t('plan.addGoal')}</Button>
      </Toolbar>
    </Panel>
  )
}
