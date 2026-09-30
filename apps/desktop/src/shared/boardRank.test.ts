import { describe, expect, it } from 'vitest'
import {
  questionPriority,
  obligationPriority,
  rankBoard,
  KIND_WEIGHT,
  type RankInput,
  type BoardItem
} from './boardRank.ts'

const q = (over: Partial<RankInput> = {}): RankInput => ({
  blocks: 0,
  ageDays: 0,
  kind: 'decision',
  servesActiveGoal: false,
  projectWeight: 25, // an idle `active` project
  ...over
})

describe('a question priority, component by component', () => {
  it('blocking is worth 40 and nothing else on the list is', () => {
    const stopped = questionPriority(q({ blocks: 1 }))
    const idle = questionPriority(q({ blocks: 0 }))
    expect(stopped.components.blocking).toBe(40)
    expect(idle.components.blocking).toBe(0)
  })

  it('breadth rises with blocked tasks and is capped so one fan-out cannot own the board', () => {
    expect(questionPriority(q({ blocks: 2 })).components.breadth).toBe(20)
    expect(questionPriority(q({ blocks: 99 })).components.breadth).toBe(30)
  })

  it('age rises slowly and is capped — a board by date is a backlog, not a board', () => {
    expect(questionPriority(q({ ageDays: 4 })).components.age).toBe(12)
    expect(questionPriority(q({ ageDays: 999 })).components.age).toBe(30)
  })

  it('an access or approval question outweighs a fact one — only the operator settles it', () => {
    expect(questionPriority(q({ kind: 'access' })).components.kind).toBe(KIND_WEIGHT.access)
    expect(questionPriority(q({ kind: 'fact' })).components.kind).toBe(0)
    expect(KIND_WEIGHT.access).toBeGreaterThan(KIND_WEIGHT.decision)
  })

  it('serving an active goal adds a fixed weight — a goal is a commitment', () => {
    expect(questionPriority(q({ servesActiveGoal: true })).components.goal).toBe(20)
    expect(questionPriority(q({ servesActiveGoal: false })).components.goal).toBe(0)
  })

  it('the project weight enters the same scale — a hobby blocker under a paying review', () => {
    const hobby = questionPriority(q({ blocks: 1, projectWeight: 10 }))
    const paying = questionPriority(q({ blocks: 1, projectWeight: 40 }))
    expect(paying.priority).toBeGreaterThan(hobby.priority)
    expect(paying.components.project).toBe(40)
  })

  it('the total is the sum, and every component is on the item so the order can be EXPLAINED', () => {
    const p = questionPriority(q({ blocks: 2, ageDays: 1, kind: 'access', servesActiveGoal: true, projectWeight: 25 }))
    const c = p.components
    expect(p.priority).toBe(c.blocking + c.breadth + c.age + c.kind + c.goal + c.project)
  })
})

describe('derived obligations enter the same scale', () => {
  it('a refused effect is by construction blocking, and ranks like one', () => {
    expect(obligationPriority('refused', 25).priority).toBeGreaterThanOrEqual(40)
  })
  it('a review ranks below a refusal — work finished waiting is not work stopped', () => {
    expect(obligationPriority('review', 25).priority).toBeLessThan(obligationPriority('refused', 25).priority)
  })
  it('the project weight lifts an obligation too', () => {
    expect(obligationPriority('review', 40).priority).toBeGreaterThan(obligationPriority('review', 10).priority)
  })
})

describe('the board is one ranked list, stable under the pointer', () => {
  const item = (id: string, priority: number, ageDays: number): BoardItem =>
    ({ id, priority, ageDays, kind: 'question' })

  it('sorts by priority, highest first', () => {
    const out = rankBoard([item('a', 10, 0), item('b', 90, 0), item('c', 50, 0)])
    expect(out.map((x) => x.id)).toEqual(['b', 'c', 'a'])
  })

  it('breaks ties by age (older first), then by id — never by chance', () => {
    // A board that reshuffles between reading and clicking gets the wrong thing
    // answered. Two items of equal priority must have ONE order, every time —
    // and the id tiebreak is proven by feeding the SAME-age pair in BOTH orders:
    // a stable sort left as-is would pass one and fail the other, so a `return 0`
    // tiebreak (V8's sort is stable) cannot sneak through this.
    const forward = rankBoard([item('y', 50, 1), item('x', 50, 5), item('z', 50, 5)])
    expect(forward.map((v) => v.id)).toEqual(['x', 'z', 'y'])
    const reversed = rankBoard([item('z', 50, 5), item('x', 50, 5), item('y', 50, 1)])
    expect(reversed.map((v) => v.id)).toEqual(['x', 'z', 'y']) // same result from the reverse input
  })

  it('is a pure function of its input — the same list gives the same order', () => {
    const items = [item('a', 30, 2), item('b', 30, 2), item('c', 70, 0)]
    expect(rankBoard(items).map((x) => x.id)).toEqual(rankBoard(items).map((x) => x.id))
  })
})
