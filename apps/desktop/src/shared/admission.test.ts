import { describe, expect, it } from 'vitest'
import { admissionOutcome, type AdmissionReceipt } from './admission.ts'

const receipt = (over: Partial<AdmissionReceipt> = {}): AdmissionReceipt => ({
  admitted: true,
  task_id: 't1',
  project_id: 'p1',
  instruction: 'do it',
  option_id: 'claude-code',
  task_run_id: 'r1',
  run_ordinal: 1,
  receipt_seq: 42,
  ...over
})

describe('an admission that could not be asked is not an admission (FA-02)', () => {
  it('admits when the command admitted', () => {
    const got = admissionOutcome(receipt(), null)
    expect(got.admitted).toBe(true)
    if (got.admitted) expect(got.receipt.task_run_id).toBe('r1')
  })

  it('keeps a lost admission reply uncertain and never retries with a new identity', () => {
    const got = admissionOutcome(null, { message: 'connection refused' })
    expect(got.admitted).toBe(false)
    if (!got.admitted) {
      expect(got.reasonCode).toBe('unavailable')
      expect(got.retryable).toBe(false)
      expect(got.says).not.toContain('connection refused')
      expect(got.says).toContain('receipt is unavailable')
    }
  })

  it('REFUSES a NULL answer rather than reading it as a lost race', () => {
    // MEASURED at d28c321, and this is the defect the whole card turns on. The
    // chain's dispatch read `const { data: casWon } = await store.update(...)`,
    // dropped `error`, and treated an empty answer as "another process won".
    // The write was in fact REJECTED — `dispatching` is not in the status CHECK
    // — so the chain stood down every time, for a reason nobody could see, and
    // no follower has ever been dispatched.
    const got = admissionOutcome(null, null)
    expect(got.admitted).toBe(false)
    if (!got.admitted) expect(got.reasonCode).toBe('unavailable')
  })

  it('passes a real refusal through with its code and its remedy', () => {
    const got = admissionOutcome(
      { admitted: false, reason_code: 'blocked', says: 'two questions are open', remedy: 'answer them', open_blockers: 2 },
      null
    )
    expect(got.admitted).toBe(false)
    if (!got.admitted) {
      expect(got.reasonCode).toBe('blocked')
      expect(got.openBlockers).toBe(2)
      expect(got.retryable).toBe(false)
    }
  })

  it('does not call a refusal retryable, because retrying a refusal is a loop', () => {
    for (const code of ['blocked', 'terminal', 'already_running', 'lease_held', 'not_found']) {
      const got = admissionOutcome({ admitted: false, reason_code: code, says: 'no' }, null)
      if (!got.admitted) expect(got.retryable).toBe(false)
    }
  })

  it('REFUSES an admission that says yes without naming the run it created', () => {
    // A TaskRun is what a spawn is attached to. An admission with no run id is
    // an answer that cannot be acted on, and treating it as a yes would spawn a
    // session belonging to nothing.
    const { task_run_id: _dropped, ...without } = receipt()
    const got = admissionOutcome(without, null)
    expect(got.admitted).toBe(false)
    if (!got.admitted) expect(got.reasonCode).toBe('unavailable')
  })

  it('REFUSES an admission missing what the spawn needs to run', () => {
    for (const missing of ['project_id', 'instruction'] as const) {
      const partial = { ...receipt() }
      delete (partial as Record<string, unknown>)[missing]
      expect(admissionOutcome(partial, null).admitted).toBe(false)
    }
  })
})
