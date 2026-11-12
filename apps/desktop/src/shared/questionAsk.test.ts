import { describe, expect, it } from 'vitest'
import { QUESTION_KINDS, normaliseAsk } from './questionAsk.ts'

const base = { text: 'Which database version do we target?' }

describe('what an agent may ask, and what the server decides for it', () => {
  it('accepts a plain question with no options and no blocks', () => {
    // A question that blocks nothing is legitimate: an agent can want a decision
    // without being stuck on it, and refusing that would teach it to invent a
    // blocked task to get a hearing.
    const got = normaliseAsk(base)
    expect(got.ok).toBe(true)
    if (got.ok) {
      expect(got.value.blocks).toEqual([])
      expect(got.value.options).toEqual([])
      expect(got.value.kind).toBe('decision')
    }
  })

  it('refuses an empty question, because an empty one cannot be answered', () => {
    const got = normaliseAsk({ text: '   ' })
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.reason).toMatch(/text/i)
  })

  it('gives every option a stable id when the caller did not', () => {
    const got = normaliseAsk({ ...base, options: [{ label: 'postgres', recommended: true }, { label: 'sqlite' }] })
    expect(got.ok).toBe(true)
    if (got.ok) {
      const ids = got.value.options.map((o) => o.id)
      expect(new Set(ids).size).toBe(2)
      expect(ids.every(Boolean)).toBe(true)
    }
  })

  it('refuses duplicate option ids rather than silently merging them', () => {
    // `chosen_option` has to name exactly one thing later. Two options sharing
    // an id makes the answer ambiguous at the moment it matters most.
    const got = normaliseAsk({
      ...base,
      options: [
        { id: 'a', label: 'postgres' },
        { id: 'a', label: 'sqlite' }
      ]
    })
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.reason).toMatch(/option/i)
  })

  it('refuses an option with no label — an unlabelled choice is not a choice', () => {
    const got = normaliseAsk({ ...base, options: [{ id: 'a', label: '  ' }] })
    expect(got.ok).toBe(false)
  })

  it('deduplicates the blocked task list', () => {
    const t = '11111111-1111-1111-1111-111111111111'
    const got = normaliseAsk({ ...base, blocks: [t, t] })
    expect(got.ok).toBe(true)
    if (got.ok) expect(got.value.blocks).toEqual([t])
  })

  it('accepts a topic beside kind=decision, and refuses kind=process', () => {
    // M184 produces recurring-trap questions. They are DECISIONS about process,
    // not a fifth kind: adding one would change every priority weight that
    // switches on kind, for a label.
    const withTopic = normaliseAsk({ ...base, kind: 'decision', topic: 'process' })
    expect(withTopic.ok).toBe(true)
    if (withTopic.ok) expect(withTopic.value.topic).toBe('process')
    expect(normaliseAsk({ ...base, kind: 'process' as never }).ok).toBe(false)
  })

  it('knows exactly the kinds the schema allows', () => {
    expect(QUESTION_KINDS).toEqual(['decision', 'access', 'priority', 'fact', 'approval'])
  })

  it('ignores anything the CLIENT tried to decide for the server', () => {
    // Priority is the CEO's, the estate is the credential's, and the author is
    // the session. A client that could set them could put itself at the top of
    // the operator's board.
    const got = normaliseAsk({
      ...base,
      priority: 99,
      estate_id: 'someone-elses',
      asked_by_id: 'the-operator'
    } as never)
    expect(got.ok).toBe(true)
    if (got.ok) {
      expect(got.value).not.toHaveProperty('priority')
      expect(got.value).not.toHaveProperty('estate_id')
      expect(got.value).not.toHaveProperty('asked_by_id')
    }
  })

  it('caps the text rather than carrying an essay into the operator board', () => {
    const got = normaliseAsk({ text: 'x'.repeat(9_000) })
    expect(got.ok).toBe(false)
    if (!got.ok) expect(got.reason).toMatch(/too long|shorter/i)
  })

  // The operator, 2026-11-12: a question with options always names the option the agent recommends.
  it('marks the option the agent recommends, by id or by flag', () => {
    const byId = normaliseAsk({ ...base, options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], recommended: 'b' })
    expect(byId.ok && byId.value.options.map((o) => o.recommended ?? false)).toEqual([false, true])
    const byFlag = normaliseAsk({ ...base, options: [{ id: 'a', label: 'A', recommended: true }, { id: 'b', label: 'B' }] })
    expect(byFlag.ok && byFlag.value.options.map((o) => o.recommended ?? false)).toEqual([true, false])
  })

  it('refuses options without a recommendation, two recommendations, or one that names no option', () => {
    const none = normaliseAsk({ ...base, options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] })
    expect(none.ok).toBe(false)
    if (!none.ok) expect(none.reason).toMatch(/recommend/)
    const two = normaliseAsk({ ...base, options: [{ id: 'a', label: 'A', recommended: true }, { id: 'b', label: 'B' }], recommended: 'b' })
    expect(two.ok).toBe(false)
    const stray = normaliseAsk({ ...base, options: [{ id: 'a', label: 'A' }], recommended: 'z' })
    expect(stray.ok).toBe(false)
  })

  it('asks no recommendation of a question without options', () => {
    expect(normaliseAsk({ ...base }).ok).toBe(true)
  })
})
