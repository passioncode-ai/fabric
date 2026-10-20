// #region act-run-over — docs: docs/adr/0170-the-person-says-an-ended-runs-work-is-over.md#decision
// «Работа закончена» (CO-327, ADR-0170): the person's explicit attestation that the work of a run whose Stop has an
// unknown outcome is over, once its session's process has ended, and its undo. Both go through the SQL commands of
// migration 115 (attest_task_run_over, revoke_task_run_attestation), which keep the hold rules: only a person, never
// while the process runs, never for a Stop the host already proved, and the undo only while the task has not moved on.
import type { ActArgs, ActOutcome } from '../shared/acts.ts'
import type { ActCheck, ActExecutor } from './acts.ts'
import type { TerminalStopResult, TerminalTermination } from '../shared/stop.ts'

type RunOverArgs = { run_id: string; session_id: string; command_id: string; task_id: string }

export interface RunOverDeps {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>
  estateId: string
  actor: { kind: 'person'; id: string }
  /** The task's title, for the sentence; null words it «без названия». */
  taskTitle(taskId: string): Promise<string | null>
  projectOf(taskId: string): Promise<string | null>
  /** The Stop command's state and basis, read before an act runs; null when it is gone. */
  stopOf(commandId: string): Promise<{ state: string; basis: string | null } | null>
  /** After the SQL said yes: the console of that session follows the record (`createRunOverConsole`). */
  settled?(kind: 'run.attest' | 'run.unattest', args: RunOverArgs, receiptSeq: number | null): void
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
      d.settled?.(kind, a, typeof r.receipt_seq === 'number' ? r.receipt_seq : null)
      return outcome(kind, a, r.receipt_seq)
    }
  })
  return {
    'run.attest': executor('run.attest', 'attest_task_run_over', 'recorded'),
    'run.unattest': executor('run.unattest', 'revoke_task_run_attestation', 'revoked')
  }
}

/** A refused attestation in the act line's terms: a code `act.why.<code>` words, and the machine's own words apart.
 *  A refusal the SQL gave is thrown by the executor as its code, which the act service reports as `failed` with that
 *  code as `says`; it is read back here so the person reads «сессия ещё работает», not "Error: run_still_running". */
const WHY_CODES = new Set(Object.values(WHY_OF))
export function runOverRefusal(r: { reason: string; says?: string }): { why: string; says?: string } {
  if (r.reason === 'failed' && r.says && WHY_CODES.has(r.says)) return { why: r.says }
  return { why: r.reason, ...(r.says ? { says: r.says } : {}) }
}
// #endregion act-run-over

// #region run-over-console — docs: docs/adr/0170-the-person-says-an-ended-runs-work-is-over.md#decision
// The console's own view of the act (0.3.7 review UX-1, ER-7). The Stop's record lives in SQL; what the console shows
// lives in the main process (`PtyManager.setTermination`). «Работа закончена» settles it, and «Отменить» (from the act
// line or История) puts back the unknown end it had before, with its reason and its run, so the console offers
// «Работа закончена» again and never offers dismissal of a Stop that is unresolved again. The way back carries the
// undo's receipt seq, newer than the attestation's, which is how the console tells it from a stale reading.
export function createRunOverConsole(deps: {
  get(sessionId: string): TerminalTermination | undefined
  set(termination: TerminalStopResult): void
}): { settled: NonNullable<RunOverDeps['settled']> } {
  const before = new Map<string, TerminalStopResult>()
  return {
    settled(kind, a, receiptSeq) {
      const current = deps.get(a.session_id)
      if (!current || current.state === 'requested' || current.commandId !== a.command_id) return
      const seq = receiptSeq !== null ? { receiptSeq } : {}
      if (kind === 'run.attest') {
        if (current.state === 'outcome_unknown') before.set(a.session_id, current)
        deps.set({ ...current, state: 'stopped', basis: 'attested', reasonCode: 'attested', ...seq })
        return
      }
      if (current.state !== 'stopped' || current.basis !== 'attested') return
      const prior = before.get(a.session_id)
      before.delete(a.session_id)
      // Without the reading from before (the attestation was said in another window's lifetime), the end is the one
      // an ended run's Stop has: the process tree went quiet and the provider's stop is unproved.
      const back: TerminalStopResult = { ...(prior ?? { ...current, reasonCode: 'provider_termination_unproved' }), state: 'outcome_unknown', ...seq }
      delete back.basis
      deps.set(back)
    }
  }
}
// #endregion run-over-console
