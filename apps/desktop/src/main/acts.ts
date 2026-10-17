// #region acts-service — docs: docs/adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md#decision
/**
 * Acts: do, record, undo (ADR-0160 §2; 0.3.7 wave 2; SCN-168, SCN-169).
 *
 * The one door for an operator act that has an inverse. `perform` runs the act through its executor, then writes ONE
 * record of it (`act.recorded@1`: the actor, the sentence, the inverse or why there is none). `undo` is `perform` of
 * the recorded inverse with `undoes` naming the act it reverses — so an undo has an inverse of its own and can be
 * redone, and both acts are in the journal with their actor. `history` reads the records newest first with each
 * act's undo state, looking at the world (the executor's `check`) only for the acts that can still be undone.
 *
 * What it does not do: decide anything about the act. Rules live in the executors (the board's ladder, the folder
 * admission, the claim's lease), so an undo meets exactly the rules the act did.
 */
import {
  analyseActs, buildRecord, undoStateOf,
  type ActActor, type ActArgs, type ActHistoryQuery, type ActKind, type ActOutcome, type ActRow, type ActView
} from '../shared/acts.ts'

export type ActCheck = { ok: true; changedSince?: string } | { ok: false; why: string; says?: string }
export type ActResult =
  | { ok: true; seq: number | null; outcome: ActOutcome }
  | { ok: false; reason: string; says?: string }
export interface ActExecutor {
  /** Is the act possible now; `changedSince` says what moved since the act it reverses (the button says it too). */
  check(args: ActArgs): Promise<ActCheck>
  /** Does the act. Throws when it could not (nothing is recorded then); returns what to record. */
  run(args: ActArgs): Promise<ActOutcome>
}

export type HistoryQuery = ActHistoryQuery
/** What the log is asked, as the real one (`actLog.ts`) and the in-memory one of the tests are asked it. */
export interface ActLog {
  append(record: ReturnType<typeof buildRecord>, projectId: string | null, actor: ActActor): Promise<{ seq: number }>
  page(q: Required<Pick<HistoryQuery, 'limit'>> & Omit<HistoryQuery, 'limit'>): Promise<ActRow[]>
  /** The acts that reverse any of these. */
  reversersOf(seqs: number[]): Promise<ActRow[]>
  get(seq: number): Promise<ActRow | null>
}

export interface ActsDeps {
  log: ActLog
  executors: Partial<Record<ActKind, ActExecutor>>
  /** The operator: established by the caller's bootstrap, never read from a request. */
  actor: ActActor
  /** A record that could not be written: the act stands, and this is how the loss is seen (never silence). */
  onRecordFailed: (kind: ActKind, error: Error) => void
}

const DEPTH = 8
const PAGE_MAX = 100
const asError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)))

export function createActs(deps: ActsDeps) {
  const inflight = new Set<number>()

  async function write(outcome: ActOutcome, undoes: number | null, actor: ActActor): Promise<number | null> {
    try {
      const { seq } = await deps.log.append(buildRecord(outcome, undoes), outcome.projectId, actor)
      return seq
    } catch (e) {
      // Not silence: the caller's `onRecordFailed` is `ops.failed('acts.record', …)` (index.ts); the act itself stands.
      deps.onRecordFailed(outcome.kind, asError(e))
      return null
    }
  }

  /** The reversals of these acts, and of those, and so on: what is needed to say which of them is in force. */
  async function chainOf(seqs: number[]): Promise<ActRow[]> {
    const found: ActRow[] = []
    let frontier = seqs
    for (let depth = 0; depth < DEPTH && frontier.length; depth++) {
      const rows = await deps.log.reversersOf(frontier)
      found.push(...rows)
      frontier = rows.map((r) => r.seq)
    }
    return found
  }

  async function perform(kind: ActKind, args: ActArgs, opts: { undoes?: number } = {}): Promise<ActResult> {
    const executor = deps.executors[kind]
    if (!executor) return { ok: false, reason: 'unavailable', says: `no executor for ${kind}` }
    let checked: ActCheck
    // Not silence in either catch: the failure comes back as the act's refusal, reason `failed`, with its own words.
    try { checked = await executor.check(args) } catch (e) { return { ok: false, reason: 'failed', says: asError(e).message } }
    if (!checked.ok) return { ok: false, reason: checked.why, ...(checked.says ? { says: checked.says } : {}) }
    let outcome: ActOutcome
    try { outcome = await executor.run(args) } catch (e) { return { ok: false, reason: 'failed', says: asError(e).message } }
    return { ok: true, seq: await write(outcome, opts.undoes ?? null, deps.actor), outcome }
  }

  /** An act that was done elsewhere (a command with its own door) is recorded the same way. */
  async function note(outcome: ActOutcome, opts: { actor?: ActActor } = {}): Promise<{ recorded: boolean; seq: number | null }> {
    const seq = await write(outcome, null, opts.actor ?? deps.actor)
    return { recorded: seq !== null, seq }
  }

  async function undo(seq: number): Promise<ActResult> {
    if (inflight.has(seq)) return { ok: false, reason: 'already_undone' }
    inflight.add(seq)
    try {
      const row = await deps.log.get(seq)
      if (!row) return { ok: false, reason: 'not_an_act' }
      const state = undoStateOf(row, analyseActs([row, ...(await chainOf([seq]))]))
      if (state.state === 'undone') return { ok: false, reason: 'already_undone' }
      if (state.state === 'cannot') return { ok: false, reason: state.why }
      return await perform(state.inverse.kind, state.inverse.args, { undoes: seq })
    } finally {
      inflight.delete(seq)
    }
  }

  async function history(query: HistoryQuery = {}): Promise<{ rows: ActView[]; next: number | null }> {
    const limit = Math.max(1, Math.min(PAGE_MAX, Math.floor(query.limit ?? 50)))
    const got = await deps.log.page({ ...query, limit: limit + 1 })
    const page = got.slice(0, limit)
    const next = got.length > limit ? page[page.length - 1].seq : null
    const analysis = analyseActs([...page, ...(await chainOf(page.map((r) => r.seq)))])
    const rows = await Promise.all(page.map(async (row): Promise<ActView> => {
      const state = undoStateOf(row, analysis)
      if (state.state !== 'available') return { ...row, undo: state.state === 'undone' ? state : { state: 'cannot', why: state.why } }
      const executor = deps.executors[state.inverse.kind]
      if (!executor) return { ...row, undo: { state: 'cannot', why: 'unavailable' } }
      try {
        const c = await executor.check(state.inverse.args)
        return { ...row, undo: c.ok ? { state: 'available', ...(c.changedSince ? { changedSince: c.changedSince } : {}) } : { state: 'cannot', why: c.why } }
      } catch {
        // Not silence: the world could not be read, so the act is not offered as undoable.
        return { ...row, undo: { state: 'cannot', why: 'unreadable' } }
      }
    }))
    return { rows, next }
  }

  return { perform, note, undo, history }
}
// #endregion acts-service
