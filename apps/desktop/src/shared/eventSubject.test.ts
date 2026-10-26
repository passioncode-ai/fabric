// A feed row that opens the wrong thing is worse than one that opens nothing
// (UXA-C06).

import { describe, expect, it } from 'vitest'
import { DECLARED_EVENT_TYPES, subjectOfEvent } from './eventSubject.ts'

const row = (type: string, payload: Record<string, unknown> = {}, seq = 7) => ({
  type,
  seq,
  payload
})

describe('what a journal row is about', () => {
  it('reads the task id from the key that event actually writes', () => {
    expect(subjectOfEvent(row('task.created@1', { id: 't-1' }))).toEqual({
      known: true,
      ref: { kind: 'task', id: 't-1' }
    })
  })

  it('and a DIFFERENT key for a different event in the same family', () => {
    // The whole reason this is a declared table rather than a prefix rule:
    // `task.created` writes `id` and `task.closed` writes `task_id`. A rule
    // that assumed one would open a task page for an id that was not there.
    expect(subjectOfEvent(row('task.closed@1', { task_id: 't-2' }))).toEqual({
      known: true,
      ref: { kind: 'task', id: 't-2' }
    })
    expect(
      subjectOfEvent(row('task.closed@1', { id: 't-2' })).known,
      'the OTHER key must not be accepted by accident'
    ).toBe(false)
  })

  it('addresses a refusal by the sequence of the row that recorded it', () => {
    // No payload key, because the thing addressed IS this journal row — the
    // same ref `attention.ts` builds for the same event.
    expect(subjectOfEvent(row('policy.decided@1', { verdict: 'refuse' }, 512))).toEqual({
      known: true,
      ref: { kind: 'refusal', id: '512' }
    })
  })

  it('refuses an UNDECLARED event in a declared family — the prefix is not the rule', () => {
    // The plant that proved this case was missing: a fallback reading
    // `payload.id` for anything named `task.*`. Ten task types are not in the
    // table, and `task.started@1` carrying some other id would have opened a
    // task page for it. A probe that only tries `agent.heartbeat@1` for the
    // unknown case never asks the question the table exists to answer.
    const got = subjectOfEvent(row('task.started@1', { id: 't-9' }))
    expect(got.known, 'declared-by-family is exactly the invention forbidden here').toBe(false)
  })

  it('REFUSES an event nobody has verified, and says so', () => {
    const got = subjectOfEvent(row('agent.heartbeat@1', { anything: 'x' }))
    expect(got.known).toBe(false)
    if (got.known) throw new Error('unreachable')
    expect(got.why).toMatch(/verified/)
    expect(got.reason, 'the interface translates the code, CO-225 (5)').toBe('undeclared')
  })

  it('and refuses a DECLARED event whose row does not carry the key', () => {
    // Declared is not the same as present. An older row, another path, a bug —
    // refusing is the only answer that does not make one up.
    const got = subjectOfEvent(row('task.created@1', { title: 'no id here' }))
    expect(got.known).toBe(false)
    if (got.known) throw new Error('unreachable')
    expect(got.why).toMatch(/does not carry/)
    expect(got.reason).toBe('missing-key')
  })

  it('and never accepts a non-string id', () => {
    expect(subjectOfEvent(row('task.created@1', { id: 42 })).known).toBe(false)
    expect(subjectOfEvent(row('task.created@1', { id: '' })).known).toBe(false)
    expect(subjectOfEvent(row('task.created@1', { id: null })).known).toBe(false)
  })

  it('states its coverage as a number, so nobody has to count the table', () => {
    // Ten of the seventy-two types the feed can describe — a tenth, verified
    // one writer at a time. A gate or a document quoting this cannot drift from
    // the table it describes.
    expect(DECLARED_EVENT_TYPES).toBe(12)
  })

  // 0.3.14: every writer of `task.moved@1` writes `task_id` (main/actExecutors.ts, main/workTools.ts,
  // main/workRelease.ts, main/agentSurface.ts, migrations 61 and 115), and the table read `id`, so no move row was ever
  // about its task. `work.released@1` writes `work` like `work.claimed@1` (main/workTools.ts, main/agentSurface.ts).
  it('reads a move\'s task from task_id, still from id for an older row', () => {
    expect(subjectOfEvent(row('task.moved@1', { task_id: 't-3', to: 'done' }))).toEqual({ known: true, ref: { kind: 'task', id: 't-3' } })
    expect(subjectOfEvent(row('task.moved@1', { id: 't-4' }))).toEqual({ known: true, ref: { kind: 'task', id: 't-4' } })
  })

  // 0.3.14 wave 2: a claim's `work` is a task (`work_claims.work_id` references `project_tasks`, migration
  // 20261011000095_work_claims.sql), so a claim row and its release open that task.
  it('reads a claim and a released claim as about the task they name in `work`', () => {
    expect(subjectOfEvent(row('work.released@1', { work: 't-2', how: 'done' }))).toEqual({ known: true, ref: { kind: 'task', id: 't-2' } })
    expect(subjectOfEvent(row('work.claimed@1', { work: 't-1' }))).toEqual({ known: true, ref: { kind: 'task', id: 't-1' } })
    expect(subjectOfEvent(row('work.released@1', { task_id: 't-2' })).known).toBe(false)
  })
})
