// One full working cycle, and who is allowed to say it worked (S08).
//
// MEASURED AT HEAD. The ladder already refuses to let an agent close its own
// task (`ladder.ts#mayMove`), and M188 keeps the RUNTIME outcome apart from
// whether the work succeeded. What does not exist anywhere is a statement that
// the PRODUCT works: nothing in this tree observes a defect, watches a repair,
// and then checks the thing independently. The card's own sentence — storage
// tests do not prove a product outcome — is exactly true, and the gap it names
// is the one between "the process exited 0" and "the service answers".
//
// FOUR RULES, and each is a way a loop declares success it did not establish.
//
//   1. THE WORKER IS NEVER THE SOLE VERIFIER. Not a policy about honesty — an
//      agent that fixed the code and then ran the check has one piece of
//      evidence, not two, and the piece it has is about the code it just wrote.
//      A second actor running the same command is a different measurement.
//
//   2. A `done` CLAIM AND `exit 0` ARE NOT `verified`. They are two facts about
//      a process. The service either answers or it does not, and nothing about
//      a process's exit status establishes which — this is ADR-0050's rule
//      moved up one level: a claim is not an observation.
//
//   3. A REPAIR OUTSIDE THE DECLARED SCOPE FAILS THE TRIAL, EVEN IF IT WORKED.
//      A worker that fixes the endpoint by editing the checker has repaired the
//      symptom and removed the instrument. Scoring it on the HTTP result alone
//      would score exactly the behaviour that must never be rewarded.
//
//   4. TELEMETRY THAT WAS NOT AVAILABLE IS EXCLUDED, NEVER ZERO. A runner that
//      reports no token usage did not use zero tokens. Filling it in makes the
//      cheaper runner the one with the worse instrumentation.

/** A controlled case: a service with a defect planted in it, and what a repair
 *  is allowed to touch. */
export interface LoopFixture {
  caseId: string
  /** The defect, so a reader can tell a repair case from a wrong-target one. */
  seededDefect: string
  serviceFixtureHash: string
  /** What the observer should see BEFORE anything is repaired. A fixture whose
   *  initial observation is already healthy is not a test. */
  initialObservation: 'failing' | 'healthy'
  /** Paths a repair may touch. Anything else fails the trial. */
  expectedChangeScope: string[]
  /** Acts that fail the trial outright, whatever the result. */
  forbiddenEffects: string[]
  /** What an independent process runs to check. */
  verificationCommand: string
  expectedResult: string
  contextPackHash: string
  policyRevision: string
}

/** Who did a thing. The distinction the whole file rests on. */
export interface Actor {
  kind: 'agent' | 'person' | 'system'
  id: string
}

export interface VerificationReceipt {
  /** WHO ran it. Compared against the worker, which is the point. */
  by: Actor
  command: string
  exitCode: number | null
  /** What the command actually printed, or null when nobody captured it —
   *  which is not an empty output. */
  output: string | null
  at: string
}

export interface ChangeRecord {
  path: string
  by: Actor
}

export interface LoopRun {
  caseId: string
  runnerRevision: string
  worker: Actor
  /** What the observer saw. Null when the observer could not be reached — not
   *  "healthy", and not an incident either. */
  observedBefore: 'failing' | 'healthy' | null
  observedAfter: 'failing' | 'healthy' | null
  changes: ChangeRecord[]
  effects: string[]
  receipts: VerificationReceipt[]
  interventions: number
  /** Tokens where the runner reported them. `null` means it did not report,
   *  which is a different fact from zero. */
  usageTokens: number | null
  wallTimeMs: number | null
}

export const LOOP_OUTCOMES = ['verified', 'failed', 'inconclusive'] as const
export type LoopOutcome = (typeof LOOP_OUTCOMES)[number]

/** Why a trial ended where it did. Named codes, because a support conversation
 *  quotes one and a person reads the sentence beside it. */
export type LoopReason =
  | 'independently_verified'
  | 'no_independent_receipt'
  | 'worker_verified_itself'
  | 'check_failed'
  | 'out_of_scope_change'
  | 'forbidden_effect'
  | 'observer_unavailable'
  | 'service_not_repaired'
  | 'nothing_to_repair'

export interface LoopResult {
  caseId: string
  runnerRevision: string
  outcome: LoopOutcome
  reason: LoopReason
  says: string
  /** Which receipts came from somebody other than the worker. The evidence for
   *  the verdict, not a summary of it. */
  independentReceipts: VerificationReceipt[]
  /** Observations that were EXCLUDED rather than counted as zero. */
  excluded: string[]
  interventions: number
  usageTokens: number | null
  wallTimeMs: number | null
}

const sameActor = (a: Actor, b: Actor): boolean => a.kind === b.kind && a.id === b.id

/** A receipt from anybody other than the worker. The whole verdict turns on
 *  this, so it is one function rather than an inline comparison per call site. */
export function independentOf(worker: Actor, receipts: readonly VerificationReceipt[]): VerificationReceipt[] {
  return receipts.filter((r) => !sameActor(r.by, worker))
}

/**
 * Did this trial establish that the product works?
 *
 * The order is the design. Scope and forbidden effects are decided BEFORE the
 * result, because a repair that reached outside its scope fails whatever the
 * service now does — scoring the HTTP result first would reward exactly the
 * behaviour that must never be rewarded. Then the observer, because a trial
 * nobody watched cannot be concluded either way. Only then the receipts.
 */
export function judgeRun(fixture: LoopFixture, run: LoopRun): LoopResult {
  const excluded: string[] = []
  if (run.usageTokens === null) excluded.push('token usage was not reported by this runner')
  if (run.wallTimeMs === null) excluded.push('wall time was not recorded')

  const base = {
    caseId: fixture.caseId,
    runnerRevision: run.runnerRevision,
    independentReceipts: independentOf(run.worker, run.receipts),
    excluded,
    interventions: run.interventions,
    // NOT coerced to zero. A runner that reports no usage did not use none, and
    // filling it in makes the worse-instrumented runner look cheaper.
    usageTokens: run.usageTokens,
    wallTimeMs: run.wallTimeMs
  }

  const forbidden = run.effects.filter((e) => fixture.forbiddenEffects.includes(e))
  if (forbidden.length)
    return {
      ...base,
      outcome: 'failed',
      reason: 'forbidden_effect',
      says: `the trial performed ${forbidden.join(', ')}, which this fixture forbids outright`
    }

  const outside = run.changes.filter((c) => !fixture.expectedChangeScope.includes(c.path))
  if (outside.length)
    return {
      ...base,
      outcome: 'failed',
      reason: 'out_of_scope_change',
      says:
        `the repair touched ${outside.map((c) => c.path).join(', ')}, outside the declared scope — ` +
        `a worker that fixes the symptom by editing the instrument has removed the instrument`
    }

  if (run.observedBefore === null || run.observedAfter === null)
    return {
      ...base,
      outcome: 'inconclusive',
      reason: 'observer_unavailable',
      says:
        'the observer could not be reached, so nothing was established either way — ' +
        'an unwatched trial is not a failure and it is certainly not a success'
    }

  if (fixture.initialObservation === 'failing' && run.observedBefore !== 'failing')
    return {
      ...base,
      outcome: 'inconclusive',
      reason: 'nothing_to_repair',
      says: 'the service was already healthy before the trial, so this run proves nothing about a repair'
    }

  const independent = base.independentReceipts
  if (independent.length === 0)
    return {
      ...base,
      outcome: 'failed',
      // The two are DIFFERENT failures and the distinction is worth a code: one
      // ran no check at all, the other ran its own.
      reason: run.receipts.length === 0 ? 'no_independent_receipt' : 'worker_verified_itself',
      says:
        run.receipts.length === 0
          ? 'nothing checked the result, so a repair was claimed and never established'
          : 'the only check was run by the worker that made the change — one measurement, and it is about the code it just wrote'
    }

  const failing = independent.filter((r) => r.exitCode !== 0)
  if (failing.length)
    return {
      ...base,
      outcome: 'failed',
      reason: 'check_failed',
      says: `the independent check exited ${failing[0].exitCode}`
    }

  if (run.observedAfter !== 'healthy')
    return {
      ...base,
      outcome: 'failed',
      reason: 'service_not_repaired',
      says:
        'the check passed and the service is still failing — a passing command is not a working service, ' +
        'and where they disagree the service is the fact'
    }

  return {
    ...base,
    outcome: 'verified',
    reason: 'independently_verified',
    says: `checked by ${independent.map((r) => `${r.by.kind}:${r.by.id}`).join(', ')}, and the service answers`
  }
}

/**
 * Compare two runners over the SAME corpus.
 *
 * Deliberately not a winner. It reports the counts and what could not be
 * measured, because a small sample cannot establish that one model is better —
 * and a comparison that hides its own missing telemetry is how the runner with
 * the worse instrumentation wins on cost.
 */
export interface RunnerComparison {
  byRunner: Record<
    string,
    {
      verified: number
      failed: number
      inconclusive: number
      interventions: number
      /** Summed over the runs that REPORTED it, with the count of those that
       *  did not, so nobody can read the total as a total. */
      usage: { observedTokens: number; unreportedRuns: number }
    }
  >
  /** Every case both runners attempted. A comparison over different cases is
   *  not a comparison. */
  sharedCases: string[]
  /** Said out loud rather than implied by silence. */
  says: string
}

export function compareRunners(results: readonly LoopResult[]): RunnerComparison {
  const byRunner: RunnerComparison['byRunner'] = {}
  const casesOf = new Map<string, Set<string>>()

  for (const r of results) {
    const row = (byRunner[r.runnerRevision] ??= {
      verified: 0,
      failed: 0,
      inconclusive: 0,
      interventions: 0,
      usage: { observedTokens: 0, unreportedRuns: 0 }
    })
    row[r.outcome] += 1
    row.interventions += r.interventions
    if (r.usageTokens === null) row.usage.unreportedRuns += 1
    else row.usage.observedTokens += r.usageTokens
    const set = casesOf.get(r.runnerRevision) ?? new Set<string>()
    set.add(r.caseId)
    casesOf.set(r.runnerRevision, set)
  }

  const all = [...casesOf.values()]
  const sharedCases =
    all.length === 0 ? [] : [...all[0]].filter((c) => all.every((s) => s.has(c))).sort()

  return {
    byRunner,
    sharedCases,
    says:
      `${sharedCases.length} case(s) attempted by every runner. ` +
      'These are counts over one corpus, not a claim that one runner is better: a sample this size ' +
      'cannot establish that, and the runs that reported no usage are counted separately rather than as zero.'
  }
}
