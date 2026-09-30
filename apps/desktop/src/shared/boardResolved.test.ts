import { describe, expect, it } from 'vitest'
import { deferredEntries, resolvedEntries } from './boardResolved.ts'

const row = (over: Record<string, unknown> = {}) => ({
  id: 'q1', project_id: 'p1', text: 'Which version?', kind: 'decision', asked_at: '2026-09-28T10:00:00Z',
  answered_at: '2026-09-28T11:00:00Z', answer: 'The first.', chosen_option: 'a', answered_by_kind: 'person',
  options: [{ id: 'a', label: 'First' }, { id: 'b', label: 'Second' }], ...over
})

describe('what the board has already resolved', () => {
  it('names each answered question with its project, its answer and the option chosen, newest first', () => {
    const out = resolvedEntries([row(), row({ id: 'q2', answered_at: '2026-09-29T09:00:00Z', project_id: 'p2' })], new Map([['p1', 'Atlas']]))
    expect(out.map((e) => e.questionId)).toEqual(['q2', 'q1'])
    expect(out[1]).toMatchObject({ ref: 'question:q1', projectName: 'Atlas', answer: 'The first.', chosenLabel: 'First', answeredBy: 'person' })
    expect(out[0].projectName, 'a project the read did not return is unnamed, not invented').toBeNull()
  })

  it('an option id that no longer matches any option is shown as the id, never as a guess', () => {
    expect(resolvedEntries([row({ chosen_option: 'gone' })], new Map())[0].chosenLabel).toBe('gone')
  })

  it('a free-text answer has no chosen option', () => {
    expect(resolvedEntries([row({ chosen_option: null })], new Map())[0].chosenLabel).toBeNull()
  })

  it('skips a row that is not answered, whatever the read returned', () => {
    expect(resolvedEntries([row({ answered_at: null })], new Map())).toEqual([])
  })
})

describe('what the owner set aside for next time', () => {
  const q = (over: Record<string, unknown> = {}) => ({ id: 'q1', project_id: 'p1', text: 'Which scope?', kind: 'decision', asked_at: '2026-09-28T10:00:00Z', status: 'open', ...over })
  const d = (over: Record<string, unknown> = {}) => ({ question_id: 'q1', reason: 'after the pilot', deferred_at: '2026-09-28T12:00:00Z', ...over })

  it('joins each deferral to its open question, with the reason, newest first', () => {
    const out = deferredEntries([d(), d({ question_id: 'q2', deferred_at: '2026-09-29T08:00:00Z' })], [q(), q({ id: 'q2' })], new Map([['p1', 'Atlas']]))
    expect(out.map((e) => e.questionId)).toEqual(['q2', 'q1'])
    expect(out[1]).toMatchObject({ ref: 'question:q1', projectName: 'Atlas', reason: 'after the pilot', title: 'Which scope?' })
  })

  it('drops a deferral whose question is settled or was not read, rather than showing it bare', () => {
    expect(deferredEntries([d()], [q({ status: 'answered' })], new Map())).toEqual([])
    expect(deferredEntries([d()], [], new Map())).toEqual([])
  })
})
