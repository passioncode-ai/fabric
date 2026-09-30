// What `admit_task_launch` answers, read once (FA-02 · R-005).
//
// ONE command admits an existing task, and every caller — the operator's Run,
// the chain advance, an answered blocker, a routine — reads its answer through
// this. The card's title is "one shared admission", and a second reading of the
// same receipt is how two callers come to disagree about what admitted means.
//
// MEASURED at d28c321, and it is why this file exists rather than a boolean:
// the chain did not call the command at all. It ran its own conditional update
// to a status the database does not allow —
//
//   const { data: casWon } = await store.update('project_tasks', { status: 'dispatching' })
//     .eq('id', follower.id).eq('status', 'backlog').select('id')
//   if (!casWon?.length) continue
//
// — and `error` was destructured away. Postgres rejected every one of those
// writes with `violates check constraint "project_tasks_status_check"`, the
// answer came back null, and `!casWon?.length` read it as "another process won
// the race". No follower has ever been dispatched, and the failure looked
// exactly like healthy contention.

export interface AdmissionReceipt {
  admitted: boolean
  task_id?: string
  project_id?: string
  instruction?: string
  option_id?: string
  /** The run this admission created. A spawn attaches to it or to nothing. */
  task_run_id?: string
  run_ordinal?: number
  session_id?: string
  state?: string
  repeated?: boolean
  receipt_seq?: number
  reason_code?: string
  says?: string
  remedy?: string
  open_blockers?: number
}

export type AdmitOutcome =
  | { admitted: true; receipt: AdmissionReceipt }
  | {
      admitted: false
      reasonCode: string
      says: string
      remedy?: string
      openBlockers?: number
      /** No automatic retry with a new identity: an unreachable command may
       *  have committed. Read the original attempt before any new launch. */
      retryable: boolean
    }

/** What an admitted receipt must carry before anything is spawned against it. */
const REQUIRED: (keyof AdmissionReceipt)[] = ['task_run_id', 'project_id', 'instruction']

export function admissionOutcome(data: unknown, error: { message: string } | null): AdmitOutcome {
  if (error)
    return {
      admitted: false,
      reasonCode: 'unavailable',
      says: 'The admission receipt is unavailable. Refresh the task before another launch.',
      retryable: false
    }

  const receipt = data as AdmissionReceipt | null
  if (!receipt || typeof receipt.admitted !== 'boolean')
    return {
      admitted: false,
      reasonCode: 'unavailable',
      // NOT a lost race. An absent answer and a refusal are different, and the
      // whole defect this replaces was reading the first as the second.
      says: 'The admission command returned no verdict. Its outcome is unknown.',
      retryable: false
    }

  if (!receipt.admitted)
    return {
      admitted: false,
      reasonCode: receipt.reason_code ?? 'refused',
      says: receipt.says ?? 'that task cannot start',
      remedy: receipt.remedy,
      openBlockers: receipt.open_blockers,
      // A refusal is a DECISION. Retrying it is a loop that looks like patience.
      retryable: false
    }

  const missing = REQUIRED.filter((k) => receipt[k] === undefined || receipt[k] === null)
  if (missing.length)
    return {
      admitted: false,
      reasonCode: 'unavailable',
      says: `the admission said yes without ${missing.join(', ')} — a yes that cannot be acted on is not one`,
      retryable: false
    }

  return { admitted: true, receipt }
}
