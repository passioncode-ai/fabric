// The one door an EXISTING task walks through to run (FA-02).
//
// The operator's Run and the chain advance ask the same question — may this
// task start — and before this they asked it in two different places with two
// different mechanisms. The IPC handler called `admit_task_launch`, which takes
// the launch lease under the estate lock, checks the blocking set, refuses a
// terminal or already-running task, and bears the TaskRun. The chain ran its own
// conditional update to `status = 'dispatching'`, which
// `project_tasks_status_check` has never allowed, and read the rejected write as
// another process winning the race.
//
// One caller had the whole contract and the other had a mechanism that could not
// work. That is what "one shared admission" means here: not a tidier arrangement
// of two paths, but the deletion of the second one.

import type { SupabaseClient } from '@supabase/supabase-js'
import { admissionOutcome, type AdmitOutcome } from '../shared/admission.ts'

export interface AdmitInput {
  estateId: string
  taskId: string
  actor: { kind: string; id: string }
  /** Minted BEFORE the spawn, because admission happens before anything runs.
   *  The pty receives this same identity; no raw lease re-pointing is allowed. */
  sessionId: string
  /** Who asked. `operator` is a person's hands; `chain` is a timer. */
  personId?: string
  revision?: number
  trigger: 'operator' | 'chain' | 'routine' | 'answer'
}

export function createAdmitExisting(db: SupabaseClient) {
  return async function admitExistingTask(input: AdmitInput): Promise<AdmitOutcome> {
    const { data, error } = await db.rpc('admit_task_launch', {
      p_estate_id: input.estateId,
      p_task_id: input.taskId,
      p_actor: input.actor,
      p_session_id: input.sessionId,
      p_trigger: input.trigger,
      p_person_id: input.personId ?? null,
      p_revision: input.revision ?? null
    })
    return admissionOutcome(data, error)
  }
}
