import { describe, expect, it } from 'vitest'
import { planOf, type GoalRow, type Positioned } from './plan.ts'

const goal = (id: string): GoalRow => ({
  id,
  project_id: 'p',
  title: `goal ${id}`,
  autonomy: 'safe',
  created_at: '2026-09-05T00:00:00Z'
})
const task = (id: string, goal_id: string | null, position: number | null): Positioned => ({
  id,
  goal_id,
  position
})

describe('the plan', () => {
  it('lets no task vanish: every one comes out exactly once', () => {
    const goals = [goal('g1'), goal('g2')]
    const tasks = [
      task('a', 'g1', 2),
      task('b', null, null),
      task('c', 'g2', 1),
      task('d', 'g1', 1),
      task('e', 'gone', 1)
    ]
    const plan = planOf(goals, tasks)
    const seen = [...plan.goals.flatMap((g) => g.tasks), ...plan.unattached].map((t) => t.id).sort()
    expect(seen).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(seen.length).toBe(new Set(seen).size)
  })

  it('a task pointing at a goal that no longer exists is UNATTACHED, not invisible', () => {
    const plan = planOf([goal('g1')], [task('orphan', 'deleted-goal', 1)])
    expect(plan.unattached.map((t) => t.id)).toEqual(['orphan'])
  })

  it('orders by position, and an unranked task sorts after every ranked one', () => {
    const plan = planOf(
      [goal('g1')],
      [task('third', 'g1', null), task('first', 'g1', 1), task('second', 'g1', 5)]
    )
    expect(plan.goals[0].tasks.map((t) => t.id)).toEqual(['first', 'second', 'third'])
  })

  it('keeps a goal with no tasks — a direction nobody is working on is a fact worth seeing', () => {
    const plan = planOf([goal('g1'), goal('empty')], [task('a', 'g1', 1)])
    expect(plan.goals.map((g) => g.goal.id)).toEqual(['g1', 'empty'])
    expect(plan.goals[1].tasks).toEqual([])
  })

  it('with no goals at all, every task is unattached rather than lost', () => {
    const plan = planOf([], [task('a', null, null), task('b', 'g1', 1)])
    expect(plan.unattached.map((t) => t.id).sort()).toEqual(['a', 'b'])
  })

  it('does not mutate what it is given', () => {
    const tasks = [task('b', 'g1', 2), task('a', 'g1', 1)]
    planOf([goal('g1')], tasks)
    expect(tasks.map((t) => t.id)).toEqual(['b', 'a'])
  })
})
