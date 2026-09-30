/**
 * The widget's half of one observation (AX-02).
 *
 * `runs.status` built `deriveLiveness`'s input as a literal and decided for
 * itself what it did not know: no observation gap, `orientedAt: null` on every
 * call, and the wait target SELECTED AND THEN DROPPED. Measured against one
 * fresh, oriented, beating session:
 *
 *   watcher: working | available
 *   widget : stalled | available
 *
 * A healthy agent reported stalled, at complete coverage, with the reason
 * "Fabric has no record of it reading its rules" — for a record that existed
 * and that this reader never asked for.
 *
 * Sixth extraction of this shape after `digestRead`, `harnessRead`,
 * `memoryOverviewRead`, `searchRead` and `projectSettingsCommand`. The
 * assembly itself is shared with the watcher in `shared/livenessInput.ts`; what
 * is here is the READ, because the two consumers have genuinely different
 * access patterns — the watcher samples every session in one pass, this answers
 * one — and pretending otherwise would give one of them the other's query.
 *
 * EVERY SOURCE ANSWERS FOR ITSELF. A failed read becomes an explicit unknown in
 * the receipt, never a zero: `blockers` was `(read.data ?? []).length`, so a
 * refused query reported a task with no blockers at all — the sixth appearance
 * this cycle of a refusal arriving as a confident measurement.
 */

import { livenessInputFrom, unreadInputs, type BeatRow, type LivenessInput } from '../shared/livenessInput.ts'
import type { SourceReceipt } from '../shared/readEnvelope.ts'
import { classifyObservationGap, type HostWindow } from '../shared/harnessBreak.ts'
import type { Thresholds } from '../shared/liveness.ts'
import type { ScopedStore } from './scopedStore.ts'

/** A count that was read, or a reason it was not. Never a zero standing in for
 *  a failure — `blockers: 0` and "the blockers could not be read" are different
 *  facts and only one of them is safe to act on. */
export type CountRead = { known: true; count: number } | { known: false; why: string }

export interface LivenessSnapshot {
  input: LivenessInput
  /** What each source said, for a surface that shows its working. */
  sources: SourceReceipt[]
  /** Which inputs nobody read, in the reader's own words. */
  unread: string[]
  blockers: CountRead
  taskTitle: string | null
  run: { task_run_id: string; task_id: string; run_ordinal: number; state: string; outcome: string | null } | null
}

export async function livenessFor(
  store: ScopedStore,
  deps: {
    sessionId: string
    session: { processEnded: boolean; lastOutputAt?: number; startedAt: number } | null
    beatsSupported: boolean
    /**
     * THE HOST WINDOW, not a pre-classified gap (AX-02).
     *
     * It was `gap: ObservationGap | undefined`, and a plant proved why that was
     * wrong: removing the classification from the handler left every case here
     * green, because the omission lived in the CALLER and this service only
     * received whatever it was handed. A required host window that this service
     * classifies itself removes the ability to forget — which is the same move
     * that closed the divergence in the first place.
     */
    host: HostWindow
    thresholds: Thresholds
    now: number
  }
): Promise<LivenessSnapshot> {
  const at = new Date(deps.now).toISOString()
  const sources: SourceReceipt[] = []
  const receipt = (name: string, error: { message: string } | null): void => {
    sources.push(
      error
        ? { name, status: 'error', asOf: null, errorCode: error.message }
        : { name, status: 'ok', asOf: at }
    )
  }

  const [beatRead, runRead, orientRead] = await Promise.all([
    store
      .select('session_heartbeats', 'beat_seq,phase,last_received_at,waiting_kind,waiting_id')
      .eq('session_id', deps.sessionId)
      .maybeSingle(),
    store
      .select('task_runs', 'task_run_id,task_id,run_ordinal,state,outcome')
      .eq('session_id', deps.sessionId)
      .order('run_ordinal', { ascending: false })
      .limit(1),
    // THE ORIENTATION, ASKED FOR — AND FOR THIS SESSION.
    //
    // This is the read the widget never made, and the whole of the divergence:
    // `session.oriented@1` is what says the session read its rules, and a
    // reader that does not ask cannot report a missing record as a fault.
    //
    // Filtered on the payload's own `session_id` rather than read whole and
    // matched here. The first version of this query fetched every orientation
    // event in the estate — 121 of them on this machine — and would have
    // reported "oriented" for a session because SOME OTHER session was: the
    // count was non-zero, so the answer looked right and was about nobody.
    store
      .select('journal', 'seq')
      .eq('type', 'session.oriented@1')
      .eq('payload->>session_id', deps.sessionId)
      .limit(1)
  ])
  receipt('heartbeat', beatRead.error)
  receipt('run', runRead.error)
  receipt('orientation', orientRead.error)

  const beat = (beatRead.data ?? null) as BeatRow | null
  const run = ((runRead.data ?? [])[0] ?? null) as LivenessSnapshot['run']

  // The wait target's resolution belongs to the THING, not to the heartbeat:
  // `session_heartbeats` has no resolution column because a question's
  // `answered_at` is where that fact lives.
  let wait: Parameters<typeof livenessInputFrom>[0]['wait']
  if (beat?.waiting_kind === 'question' && beat.waiting_id) {
    const answered = await store
      .select('questions', 'answered_at')
      .eq('id', beat.waiting_id)
      .maybeSingle()
    receipt('wait-target', answered.error)
    const when = (answered.data as { answered_at?: string | null } | null)?.answered_at
    wait = answered.error
      ? { resolved: 'unread', why: `the question could not be read: ${answered.error.message}` }
      : when
        ? { resolved: 'at', when: Date.parse(when) }
        : { resolved: 'open' }
  } else if (beat?.waiting_kind) {
    // A grant or a continuation. Named as unread rather than guessed, because
    // this reader resolves questions and nothing else yet.
    wait = { resolved: 'unread', why: `this reader does not resolve a ${beat.waiting_kind} target` }
  }

  let blockers: CountRead = { known: true, count: 0 }
  let taskTitle: string | null = null
  if (run?.task_id) {
    const [blockRead, taskRead] = await Promise.all([
      store.select('question_blocks', 'question_id').eq('task_id', run.task_id),
      store.select('project_tasks', 'title,instruction').eq('id', run.task_id).maybeSingle()
    ])
    receipt('blockers', blockRead.error)
    receipt('task', taskRead.error)
    blockers = blockRead.error
      ? { known: false, why: `the blocking questions could not be read: ${blockRead.error.message}` }
      : { known: true, count: (blockRead.data ?? []).length }
    const row = taskRead.data as { title?: string | null; instruction?: string } | null
    taskTitle = row?.title ?? row?.instruction ?? null
  }

  const orientedSeqs = orientRead.error ? null : (orientRead.data ?? [])
  const session = deps.session ?? { processEnded: true, startedAt: deps.now }

  const assembled = {
    session,
    beat,
    beatsSupported: deps.beatsSupported,
    orientation: orientRead.error
      ? ({ read: false, why: `session.oriented@1 could not be read: ${orientRead.error.message}` } as const)
      : ({ read: true, orientedAt: (orientedSeqs?.length ?? 0) > 0 ? session.startedAt : null } as const),
    wait,
    // Classified HERE, so no caller can omit it. Host sleep is the OBSERVER'S
    // silence and must never arrive as an agent's fault.
    gap: classifyObservationGap({
      since: deps.session?.startedAt ?? deps.now,
      now: deps.now,
      host: deps.host
    }),
    thresholds: deps.thresholds,
    now: deps.now
  }

  return {
    input: livenessInputFrom(assembled),
    sources,
    unread: unreadInputs(assembled),
    blockers,
    taskTitle,
    run
  }
}
