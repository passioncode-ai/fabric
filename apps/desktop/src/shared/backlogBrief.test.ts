import { describe, expect, it } from 'vitest'
import { backlogBrief, BRIEF_MAX, inPriorityOrder, type BacklogItem } from './backlogBrief.ts'

const item = (id: string, position: number | null = null): BacklogItem => ({
  id,
  title: `task ${id}`,
  instruction: 'x',
  position,
  goalId: null
})

describe('the order the backlog is worked in', () => {
  it('follows the position the operator set', () => {
    // `position` is a field precisely so two surfaces cannot disagree about it.
    // An agent working in arrival order makes choices the operator cannot
    // predict or correct.
    const out = inPriorityOrder([item('c', 3), item('a', 1), item('b', 2)])
    expect(out.map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('puts UNPLACED tasks after every placed one', () => {
    // Unplaced is not "first" and it is not "urgent": nobody has said where it
    // goes, so it goes after everything somebody has.
    const out = inPriorityOrder([item('u'), item('p', 5)])
    expect(out.map((i) => i.id)).toEqual(['p', 'u'])
  })

  it('is stable, so the same backlog briefs the same way twice', () => {
    const rows = [item('x'), item('y'), item('z')]
    expect(inPriorityOrder(rows).map((i) => i.id)).toEqual(
      inPriorityOrder(rows).map((i) => i.id)
    )
  })
})

describe('what the nightly agent is told', () => {
  it('returns NULL for an empty backlog, so no session starts', () => {
    // The rule that costs money if it is wrong. A session started with nothing
    // to do burns quota and writes a transcript saying so, every night, for as
    // long as the routine exists.
    expect(backlogBrief([])).toBeNull()
  })

  it('names the tasks in order and gives the TRUE count', () => {
    const brief = backlogBrief([item('b', 2), item('a', 1)])!
    expect(brief).toContain('It is 2 tasks')
    expect(brief.indexOf('task a')).toBeLessThan(brief.indexOf('task b'))
  })

  it('says how many it did not list rather than ending the list quietly', () => {
    // Same rule as the presets and the sibling panel: a shortened list that does
    // not say so reads as the whole of it, and the agent concludes the backlog
    // holds twelve things.
    const many = Array.from({ length: BRIEF_MAX + 7 }, (_, i) => item(String(i), i))
    const brief = backlogBrief(many)!
    expect(brief).toContain(`It is ${BRIEF_MAX + 7} tasks`)
    expect(brief).toContain('and 7 more below these')
  })

  it('tells it to claim before touching and that it cannot close its own work', () => {
    // The ladder's rule, said where the agent will read it — a nightly agent
    // that closes its own tasks has turned a claim into an outcome while nobody
    // was watching.
    const brief = backlogBrief([item('a', 1)])!
    expect(brief).toContain('fabric_task_claim')
    expect(brief).toContain('cannot close it yourself')
  })

  it('tells it to report a task that is wrong rather than invent work for it', () => {
    expect(backlogBrief([item('a', 1)])!).toContain('rather than inventing work')
  })
})
