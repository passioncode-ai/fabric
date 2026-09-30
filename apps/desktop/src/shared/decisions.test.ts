import { describe, expect, it } from 'vitest'
import { MAX_DEPTH, lineagesOf, orphansOf, type DecisionFact } from './decisions.ts'

/** `replacedBy` is the only direction the store keeps: this fact was later
 *  replaced by that one. Walking back is an inversion. */
const f = (id: string, replacedBy?: string): DecisionFact => ({
  id,
  claim: 'decision ' + id,
  source_ref: null,
  actor_kind: 'person',
  recorded_at: '2026-09-05T00:00:00Z',
  superseded_by: replacedBy ?? null
})

describe('decision lineages', () => {
  it('a decision made once is a lineage of one, with nothing replaced', () => {
    // The lineage now carries whether it is WHOLE (M173), so the shape is
    // asserted rather than the whole object — a completeness field added later
    // must not make this read as a change in what was replaced.
    const got = lineagesOf([f('a')])
    expect(got).toHaveLength(1)
    expect(got[0].current).toEqual(f('a'))
    expect(got[0].replaced).toEqual([])
    expect(got[0].completeness.truncatedByDepth).toBe(false)
  })

  it('follows the chain back, newest first', () => {
    const facts = [f('third'), f('second', 'third'), f('first', 'second')]
    const [lineage] = lineagesOf(facts)
    expect(lineage.current.id).toBe('third')
    expect(lineage.replaced.map((x) => x.id)).toEqual(['second', 'first'])
  })

  it('a SUPERSEDED decision is not a root — it belongs inside the one that replaced it', () => {
    // Showing both as equals would put two contradicting decisions side by side
    // with nothing saying which is believed.
    const facts = [f('new'), f('old', 'new')]
    expect(lineagesOf(facts).map((l) => l.current.id)).toEqual(['new'])
  })

  it('a mutually-superseding pair produces no root and renders as nothing', () => {
    // Corrupt data: each claims the other replaced it. Neither is current, so
    // neither is a root, and the walk is never entered.
    //
    // This is also WHY there is no cycle guard. The walk follows a functional
    // map — a fact has exactly one `superseded_by` — so revisiting one would
    // require it to hold two values at once. The first version of this file
    // carried a guard against that; removing it broke no test, which is how
    // the dead code was found.
    const facts = [f('a', 'b'), f('b', 'a')]
    expect(lineagesOf(facts)).toEqual([])
  })

  it('stops at a bounded depth rather than walking forever', () => {
    const long: DecisionFact[] = []
    // 0 is current; 1 was replaced by 0; 2 was replaced by 1; and so on.
    for (let i = 0; i < MAX_DEPTH + 20; i++)
      long.push(f(String(i), i === 0 ? undefined : String(i - 1)))
    const [lineage] = lineagesOf(long)
    expect(lineage.replaced.length).toBe(MAX_DEPTH)
  })

  it('a chain naming a fact we do not hold stops there rather than inventing one', () => {
    // Nothing in the set points at 'a', so its chain ends immediately — the
    // fact it replaced was simply not loaded.
    const [lineage] = lineagesOf([f('a')])
    expect(lineage.replaced).toEqual([])
  })

  it('keeps every current decision, in the order given', () => {
    const facts = [f('a'), f('b'), f('c')]
    expect(lineagesOf(facts).map((l) => l.current.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('a lineage is a DAG, and it says whether it is whole (M173)', () => {
  const fact = (id: string, superseded_by: string | null = null): DecisionFact => ({
    id,
    claim: `decision ${id}`,
    source_ref: null,
    actor_kind: 'person',
    recorded_at: '2026-09-09T00:00:00Z',
    superseded_by
  })

  it('keeps BOTH predecessors when one decision replaced two', () => {
    // The measured defect: the reverse index was a Map<string, DecisionFact>,
    // so the second `set` for the same successor overwrote the first and a
    // predecessor vanished from the screen entirely.
    const got = lineagesOf([fact('new'), fact('old-a', 'new'), fact('old-b', 'new')])
    expect(got).toHaveLength(1)
    expect(got[0].replaced.map((f) => f.id).sort()).toEqual(['old-a', 'old-b'])
  })

  it('follows a chain through a merge', () => {
    const got = lineagesOf([
      fact('new'),
      fact('mid-a', 'new'),
      fact('mid-b', 'new'),
      fact('deep', 'mid-a')
    ])
    expect(got[0].replaced.map((f) => f.id)).toContain('deep')
  })

  it('says the history is whole when it is', () => {
    const got = lineagesOf([fact('new'), fact('old', 'new')])
    expect(got[0].completeness.truncatedByDepth).toBe(false)
    expect(got[0].completeness.says).toMatch(/whole history/)
  })

  it('names a hole in the history the read did not return', () => {
    // A fact naming a successor outside the batch is a hole, usually because
    // the read was capped. THIS CASE USED TO ASSERT THE DEFECT: it drove
    // `lineagesOf([fact('new'), fact('orphan', 'not-in-this-batch')])` and
    // expected the lineage of `new` to carry the hole — while `new` and
    // `orphan` have nothing to do with each other. Rewritten rather than
    // deleted: deleting it would hide that it once passed (AX-06).
    const got = lineagesOf([fact('head'), fact('orphan', 'not-in-this-batch')])
    // `orphan` names a successor nobody returned, so it is not part of any
    // lineage here — and the estate has a hole, which is reported ONCE, against
    // the batch, rather than pinned to an unrelated decision.
    const whole = got.find((l) => l.current.id === 'head')
    expect(whole, 'the fixture must contain an unrelated, complete lineage').toBeTruthy()
    expect(
      whole!.completeness.says,
      'a complete history must not inherit another chain\'s hole'
    ).toMatch(/whole history/)
    // The hole is real and is reported ONCE, against the batch — which is the
    // only level at which it can be detected: a missing PREDECESSOR is a row
    // nobody returned, and you cannot see a row you did not get.
    const orphans = orphansOf([fact('head'), fact('orphan', 'not-in-this-batch')])
    expect(orphans.ids).toEqual(['not-in-this-batch'])
    expect(orphans.says).toMatch(/not shown at all/)
  })

  it('and attributes a hole to the lineage it actually breaks', () => {
    // `mid` was replaced by `head`, and `deep` names a successor the read did
    // not return. The hole belongs to `head`'s history, because that is the
    // chain it interrupts.
    const got = lineagesOf([fact('head'), fact('mid', 'head'), fact('deep', 'gone-from-batch')])
    const head = got.find((l) => l.current.id === 'head')!
    expect(head.replaced.map((f) => f.id)).toEqual(['mid'])
    // Nothing in head's own chain is missing, so head's history is whole —
    // even though the batch as a whole has a hole elsewhere.
    expect(head.completeness.says).toMatch(/whole history/)
    expect(orphansOf([fact('head'), fact('mid', 'head'), fact('deep', 'gone-from-batch')]).ids).toEqual([
      'gone-from-batch'
    ])
  })

  it('and a chain whose own predecessor is missing says SO, keyed to itself', () => {
    // `old` was replaced by `mid`, and `mid` was replaced by a decision the
    // read did not return. Every fact here names a successor, so there is no
    // root and no lineage at all — the history is invisible, which is exactly
    // what `orphansOf` exists to say out loud.
    const got = lineagesOf([fact('mid', 'not-returned'), fact('old', 'mid')])
    expect(got.map((l) => l.current.id), 'no fact here is a root, so there is no lineage').toEqual([])
    expect(orphansOf([fact('mid', 'not-returned'), fact('old', 'mid')]).ids).toEqual(['not-returned'])
  })

  it('stops at the depth bound and SAYS it stopped', () => {
    const chain = [fact('head')]
    let prev = 'head'
    for (let i = 0; i < MAX_DEPTH + 5; i++) {
      const id = `n${i}`
      chain.push(fact(id, prev))
      prev = id
    }
    const got = lineagesOf(chain)
    expect(got[0].completeness.truncatedByDepth).toBe(true)
    expect(got[0].completeness.says).toMatch(/longer than/)
  })

  it('renders a mutually-superseding pair as nothing, because neither is current', () => {
    // No roots at all: the walk never starts. This does NOT exercise the
    // visited set — the first version of this file believed it did, and a
    // plant removing the guard passed.
    expect(lineagesOf([fact('a', 'b'), fact('b', 'a')])).toEqual([])
  })

  it('does not repeat a shared ancestor reached by two paths', () => {
    // THE CASE THE GUARD IS ACTUALLY FOR. `new` replaced both `a` and `b`, and
    // both replaced `shared`. Without the visited set `shared` is walked twice
    // and appears twice in a history a person is reading.
    const got = lineagesOf([
      fact('new'),
      fact('a', 'new'),
      fact('b', 'new'),
      fact('shared', 'a'),
      { ...fact('shared2'), id: 'shared', superseded_by: 'b' }
    ])
    const ids = got[0].replaced.map((f) => f.id)
    expect(ids.filter((id) => id === 'shared')).toHaveLength(1)
  })
})
