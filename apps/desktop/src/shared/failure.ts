// "Failed" is not one thing (M180, ADR-0040 §4).
//
// MEASURED: the whole failure story was one fact. A session exits, and
// `closeTaskForSession` appends `task.finished@1` carrying `exit_code` — which
// the projector turns into `status = 'finished'`. So a crashed agent, a runner
// that was never installed, and a session killed because the operator quit the
// app all mark the task FINISHED, and every surface downstream reads work that
// completed.
//
// AN EXIT CODE ANSWERS A DIFFERENT QUESTION FROM THE ONE ANYBODY ASKS.
//
//   exit 0   the PROCESS ended cleanly. It says nothing about whether the work
//            succeeded — an agent that read the task, concluded it was
//            impossible and quit tidily exits zero.
//   exit 127 the runner is not installed. An operator problem, not an agent's.
//   exit 1   a crash, or the agent honestly reporting the work did not work.
//   killed   the app quit. Not a failure at all.
//
// So the kind is derived from EVIDENCE, and where the evidence is only a gap,
// the certainty says so. `agent-wedged` from silence alone is a suspicion, and
// presenting a suspicion as a diagnosis is how an operator learns to distrust
// the whole taxonomy.

export const FAILURE_KINDS = [
  'runner-missing',
  'skill-failed-to-load',
  'harness-unreachable',
  'agent-crashed',
  'agent-wedged',
  /** The agent did the work and the work did not succeed. NOT a fault of the
   *  runtime, and the only kind here that is a legitimate task RESULT. */
  'task-failed-honestly',
  'advisory-model-failed',
  'notifier-source-down',
  /** No evidence supports any of the above. Better than a confident wrong one. */
  'unknown'
] as const
export type FailureKind = (typeof FAILURE_KINDS)[number]

export type Certainty = 'observed' | 'suspected'
export type Origin = 'spawn' | 'transport' | 'runtime' | 'domain' | 'source'

export type Retryability =
  /** Nothing will change until the input or the environment does. */
  | 'terminal_until_changed'
  /** Infrastructure wobble; a bounded retry is reasonable. */
  | 'transient_bounded'
  /** Something may have happened. Reconcile before replaying (ADR-0050). */
  | 'reconcile_only'

export const RECOVERY_ACTIONS = [
  'inspect_evidence',
  'install_runner',
  'recheck_source',
  'request_authority',
  'reconcile_effect',
  'retry_new_task_run',
  'continue_after_answer'
] as const
export type RecoveryAction = (typeof RECOVERY_ACTIONS)[number]

export interface FailureRecord {
  kind: FailureKind
  origin: Origin
  certainty: Certainty
  retryability: Retryability
  /** For a person, and free of anything the agent supplied. */
  says: string
  /** What may be done about it. Typed, so a surface offers acts rather than
   *  prose, and the server revalidates before doing any of them. */
  recovery: RecoveryAction[]
  /** True when the RUNTIME ended abnormally. Kept apart from the task's own
   *  result: a successful test of impossibility is a task outcome of "no", and
   *  it is not a crash. */
  abnormal: boolean
}

export interface TerminationEvidence {
  /** Null when the process never started, or was killed without a code. */
  exitCode: number | null
  /** Set when the spawn itself failed — the strongest evidence there is. */
  spawnError?: { code?: string; message: string } | null
  /** True when Fabric asked for the shutdown (quit, cancel). Then it is not a
   *  failure at all, whatever the code. */
  requestedByFabric?: boolean
  /** Whether the agent acknowledged the instruction it was sent (M103). */
  deliveryAccepted?: boolean
  /** Whether the session ever read its rules (M177) — request-side evidence
   *  only, so it may only ever make a SUSPICION (M179). */
  orientationConfirmed?: boolean
  /** A loader or protocol error the harness actually reported. Only this may
   *  produce `skill-failed-to-load`; a missing orientation record may not. */
  loaderError?: string | null
  /** Milliseconds since the last heartbeat, when the observer has one. */
  heartbeatGapMs?: number | null
  /** Whether the agent submitted a typed result for the work. */
  agentReportedResult?: 'succeeded' | 'failed' | null
}

/** ENOENT and the shells' 127 both mean the program is not there. */
const missingRunner = (e: TerminationEvidence): boolean =>
  e.spawnError?.code === 'ENOENT' || e.exitCode === 127

export function classifyFailure(e: TerminationEvidence): FailureRecord | null {
  // A shutdown Fabric asked for is not a failure, whatever the exit code. The
  // app quitting used to mark every open task finished.
  if (e.requestedByFabric) return null

  if (missingRunner(e))
    return {
      kind: 'runner-missing',
      origin: 'spawn',
      certainty: 'observed',
      retryability: 'terminal_until_changed',
      says: 'the program this session runs on is not installed on this machine',
      recovery: ['install_runner', 'inspect_evidence'],
      abnormal: true
    }

  if (e.spawnError)
    return {
      kind: 'harness-unreachable',
      origin: 'spawn',
      certainty: 'observed',
      retryability: 'transient_bounded',
      says: 'the session could not be started',
      recovery: ['inspect_evidence', 'retry_new_task_run'],
      abnormal: true
    }

  // ONLY a reported loader error. A missing `session.oriented@1` is request-side
  // evidence and may not produce this kind (M179) — it makes a suspicion below.
  if (e.loaderError)
    return {
      kind: 'skill-failed-to-load',
      origin: 'transport',
      certainty: 'observed',
      retryability: 'terminal_until_changed',
      says: `the harness reported a loading failure: ${e.loaderError}`,
      recovery: ['inspect_evidence', 'retry_new_task_run'],
      abnormal: true
    }

  // THE AGENT'S OWN RESULT outranks the exit code, because it is the only piece
  // of evidence about the WORK rather than about the process.
  if (e.agentReportedResult === 'failed')
    return {
      kind: 'task-failed-honestly',
      origin: 'domain',
      certainty: 'observed',
      retryability: 'terminal_until_changed',
      says: 'the agent did the work and reported that it did not succeed',
      recovery: ['inspect_evidence'],
      // NOT abnormal. A successful test of impossibility is a task outcome, and
      // filing it as a crash loses the finding.
      abnormal: false
    }
  if (e.agentReportedResult === 'succeeded') return null

  if (e.exitCode !== null && e.exitCode !== 0)
    return {
      kind: 'agent-crashed',
      origin: 'runtime',
      certainty: 'observed',
      retryability: 'transient_bounded',
      says: `the session ended with code ${e.exitCode}, and the agent reported no result`,
      recovery: ['inspect_evidence', 'retry_new_task_run'],
      abnormal: true
    }

  // ——— exit 0, and nothing else known.
  //
  // THE CASE THE OLD CODE GOT WRONG. A clean exit was recorded as the task
  // finishing. It is not: the process ended tidily and nobody said the work was
  // done. If the agent never even acknowledged the instruction, the likeliest
  // reading is that it never started.
  if (e.deliveryAccepted === false)
    return {
      kind: 'unknown',
      origin: 'runtime',
      certainty: 'suspected',
      retryability: 'reconcile_only',
      says:
        'the session ended cleanly without ever confirming it received the instruction. It may have exited ' +
        'before reading it; nothing here says the work was done.',
      recovery: ['inspect_evidence', 'retry_new_task_run'],
      abnormal: true
    }

  if (e.heartbeatGapMs != null && e.heartbeatGapMs > 0)
    return {
      kind: 'agent-wedged',
      origin: 'runtime',
      // GAP-ONLY EVIDENCE IS A SUSPICION. Presenting one as a diagnosis is how
      // an operator learns to distrust the whole taxonomy.
      certainty: 'suspected',
      retryability: 'reconcile_only',
      says: 'the session went quiet before it ended, and nothing said why',
      recovery: ['inspect_evidence', 'reconcile_effect'],
      abnormal: true
    }

  return {
    kind: 'unknown',
    origin: 'runtime',
    certainty: 'suspected',
    retryability: 'reconcile_only',
    says: 'the session ended cleanly and reported no result, so what it achieved is not recorded anywhere',
    recovery: ['inspect_evidence'],
    // Clean exit, delivery accepted, no result: the agent worked and said
    // nothing. Not a runtime fault — the record is simply incomplete.
    abnormal: false
  }
}

/** What a surface may offer, given the record. Separate from the record so a
 *  stale screen cannot offer an act the server would now refuse. */
export function availableRecovery(record: FailureRecord | null): RecoveryAction[] {
  return record ? record.recovery : []
}
