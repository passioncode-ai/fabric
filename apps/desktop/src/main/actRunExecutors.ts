// #region act-run-over — docs: docs/adr/0170-the-person-says-an-ended-runs-work-is-over.md#decision
// «Работа закончена» (CO-327, ADR-0170): the person's explicit attestation that the work of a run whose Stop has an
// unknown outcome is over, once its session's process has ended, and its undo. Both go through the SQL commands of
// migration 115 (attest_task_run_over, revoke_task_run_attestation), which keep the hold rules: only a person, never
// while the process runs, never for a Stop the host already proved, and the undo only while the task has not moved on.
import type { ActArgs, ActOutcome } from '../shared/acts.ts'
import type { ActCheck, ActExecutor } from './acts.ts'

export interface RunOverDeps {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>
  estateId: string
  actor: { kind: 'person'; id: string }
  /** The task's title, for the sentence; null words it «без названия». */
  taskTitle(taskId: string): Promise<string | null>
  projectOf(taskId: string): Promise<string | null>
  /** The Stop command's state and basis, read before an act runs; null when it is gone. */
  stopOf(commandId: string): Promise<{ state: string; basis: string | null } | null>
}

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const ARGS = ['run_id', 'session_id', 'command_id', 'task_id'] as const
const argsOf = (a: ActArgs) => {
  const out = Object.fromEntries(ARGS.map((k) => [k, str(a[k])])) as Record<(typeof ARGS)[number], string | null>
  return ARGS.every((k) => out[k]) ? (out as Record<(typeof ARGS)[number], string>) : null
}

/** The SQL refusal codes, as the act line words them (`act.why.<code>`). */
const WHY_OF: Record<string, string> = {
  session_running: 'run_still_running', already_resolved: 'run_resolved', person_required: 'person_required',
  not_attested: 'not_attested', task_moved_on: 'task_moved_on', unknown_command: 'run_gone', generation_changed: 'run_gone'
}

export function createRunOverExecutors(d: RunOverDeps): Record<'run.attest' | 'run.unattest', ActExecutor> {
  const call = async (fn: string, a: NonNullable<ReturnType<typeof argsOf>>): Promise<Record<string, unknown>> => {
    const { data, error } = await d.rpc(fn, { p_estate_id: d.estateId, p_run_id: a.run_id, p_session_id: a.session_id, p_command_id: a.command_id, p_actor: d.actor })
    if (error) throw new Error(error.message)
    return (data ?? {}) as Record<string, unknown>
  }
  const outcome = async (kind: 'run.attest' | 'run.unattest', a: NonNullable<ReturnType<typeof argsOf>>, seq: unknown): Promise<ActOutcome> => {
    const title = await d.taskTitle(a.task_id)
    return {
      kind,
      projectId: await d.projectOf(a.task_id),
      ...(typeof seq === 'number' ? { refSeq: seq } : {}),
      subject: { type: 'task', id: a.task_id, label: title },
      said: { key: kind === 'run.attest' ? 'act.run.attest' : 'act.run.unattest', params: { task: title } },
      inverse: { kind: kind === 'run.attest' ? 'run.unattest' : 'run.attest', args: { ...a } }
    }
  }
  const executor = (kind: 'run.attest' | 'run.unattest', fn: string, done: string): ActExecutor => ({
    async check(args: ActArgs): Promise<ActCheck> {
      const a = argsOf(args)
      if (!a) return { ok: false, why: 'invalid' }
      const stop = await d.stopOf(a.command_id)
      if (!stop) return { ok: false, why: 'run_gone' }
      const attested = stop.state === 'stopped' && stop.basis === 'attested'
      if (kind === 'run.attest' && stop.state === 'stopped') return { ok: false, why: attested ? 'already_there' : 'run_resolved' }
      if (kind === 'run.unattest' && !attested) return { ok: false, why: 'not_attested' }
      return { ok: true }
    },
    async run(args: ActArgs): Promise<ActOutcome> {
      const a = argsOf(args)
      if (!a) throw new Error('invalid')
      const r = await call(fn, a)
      if (r[done] !== true) {
        const code = String(r.reason_code ?? 'failed')
        throw Object.assign(new Error(WHY_OF[code] ?? code), { why: WHY_OF[code] ?? 'failed' })
      }
      return outcome(kind, a, r.receipt_seq)
    }
  })
  return {
    'run.attest': executor('run.attest', 'attest_task_run_over', 'recorded'),
    'run.unattest': executor('run.unattest', 'revoke_task_run_attestation', 'revoked')
  }
}
// #endregion act-run-over
