// The watcher that runs OUTSIDE the agent (M179, ADR-0040 §2).
//
// MEASURED: M178 built `deriveLiveness` and NOTHING CALLED IT. The derivation
// had exactly one caller in the tree and it was its own test — so every rule
// about stalls, waits and harness breaks was correct, tested, and never once
// applied to a running session. A judgement nobody asks for is a judgement
// nobody gets.
//
// A heartbeat is the agent's own account, and the thing most likely to be
// broken is the reporter. So this samples from the harness side: the process
// (which the pty knows), the beats (which the estate recorded), the orientation
// (which the surface journalled) — and, before any of it is attributed, whether
// the observer itself was awake for the interval it is judging.
//
// ONE FINDING PER CONDITION, NOT ONE PER TICK. A stalled session sampled every
// thirty seconds would produce a Board obligation every thirty seconds, and the
// operator would learn to scroll past the whole list. A transition into a
// condition appends once; the same condition next pass updates when it was last
// seen and appends nothing.

import type { ScopedStore } from './scopedStore.ts'
import type { Journal } from '@fabric/journal'
import { deriveLiveness, type Liveness, type Thresholds } from '../shared/liveness.ts'
import { classifyObservationGap, type HostWindow } from '../shared/harnessBreak.ts'
import { ops } from './opsSink.ts'
import { AGENTS } from '../shared/agents.ts'
import { declaredCapabilities, isAvailable, type CapabilityReport } from '../shared/capabilityReport.ts'
import { livenessInputFrom, type BeatRow } from '../shared/livenessInput.ts'

/** One report per runner, built from what the descriptor DECLARES. Nothing here
 *  is verified — that only happens when a capability is observed happening. */
const reportCache = new Map<string, CapabilityReport>()
function capabilitiesFor(optionId: string | undefined): CapabilityReport {
  const id = optionId ?? 'claude-code'
  const cached = reportCache.get(id)
  if (cached) return cached
  const agent = AGENTS.find((a) => a.id === id)
  const report = declaredCapabilities({
    runnerId: id,
    // A runner the product does not know is treated as having NO surface. The
    // alternative — assuming it behaves like Claude Code — is the exact
    // "recognised by name" inference this whole module refuses.
    adapter: agent?.surfaceAdapter ?? 'none',
    connectsToSurface: agent?.connectsToSurface ?? false,
    now: Date.now()
  })
  reportCache.set(id, report)
  return report
}

/** Sensible for a desktop app watching local CLIs. Ordered, and
 *  `validateThresholds` refuses an order in which `stalled` precedes `quiet`. */
export const DEFAULT_THRESHOLDS: Thresholds = {
  expectedIntervalMs: 60_000,
  quietAfterMs: 180_000,
  stallAfterMs: 900_000,
  orientationGraceMs: 180_000,
  resumeGraceMs: 300_000
}

/** What the observer watched, per session, so a repeat is recognisable. */
interface Seen {
  state: Liveness
  since: number
  lastSampledAt: number
}

export interface ObservedSession {
  sessionId: string
  projectId: string | null
  /** Which runner this session is on. M181 — the capability report is derived
   *  from it, because `beatsSupported: true` used to be a LITERAL here and
   *  three of the four runners cannot beat at all. */
  optionId?: string
  processEnded: boolean
  lastOutputAt?: number
  startedAt: number
}

export interface RuntimeObserverDeps {
  store: ScopedStore
  journal: Journal
  estateId: string
  /** What the pty knows right now. Passed in rather than reached for: the
   *  observer must not become a second owner of session state. */
  sessions: () => ObservedSession[]
  /** The host window this pass is judging against. */
  host: () => HostWindow
  now?: () => number
  thresholds?: Thresholds
}

export interface RuntimeObserver {
  /** One pass. Returns what it found, so a caller can test it without reading
   *  the journal back. */
  sample(): Promise<{ sessionId: string; state: Liveness; appended: boolean }[]>
}

export function createRuntimeObserver(deps: RuntimeObserverDeps): RuntimeObserver {
  const now = deps.now ?? (() => Date.now())
  const thresholds = deps.thresholds ?? DEFAULT_THRESHOLDS
  const seen = new Map<string, Seen>()

  return {
    async sample() {
      const at = now()
      const sessions = deps.sessions()
      if (sessions.length === 0) return []

      // THE WAIT TARGET IS SELECTED NOW (AX-02). This query asked for four
      // columns and `session_heartbeats` has held `waiting_kind` and
      // `waiting_id` since M178 — so a session that had said what it was
      // blocked on was read as merely quiet, and branch 5 of the derivation,
      // which exists to expire a resolved wait, could never fire from here.
      let beats: Record<string, BeatRow> = {}
      let oriented = new Set<string>()
      let sourceHealthy = true
      try {
        const { data, error } = await deps.store.select(
          'session_heartbeats',
          'session_id,beat_seq,phase,last_received_at,waiting_kind,waiting_id'
        )
        if (error) throw new Error(error.message)
        beats = Object.fromEntries(
          (data ?? []).map((r) => [r.session_id as string, r as (typeof beats)[string]])
        )
        const { data: rows, error: orientError } = await deps.store
          .select('journal', 'payload')
          .eq('type', 'session.oriented@1')
        if (orientError) throw new Error(orientError.message)
        oriented = new Set(
          (rows ?? [])
            .map((r) => (r.payload as { session_id?: string } | null)?.session_id)
            .filter((v): v is string => typeof v === 'string')
        )
      } catch (e) {
        // The observer is blind this pass. It does NOT fall back to judging
        // from the process alone: a source outage is exactly the case
        // `classifyObservationGap` suppresses blame for.
        sourceHealthy = false
        ops.failed('observer.read', e)
      }

      // WHEN EACH WAIT TARGET WAS RESOLVED (AX-02).
      //
      // Branch 5 of the derivation exists to expire a wait: an agent said it
      // was blocked on a question, the operator answered it, and the old
      // self-report must stop explaining the silence. Without the resolution
      // that branch is UNREACHABLE from the watcher, so the one consumer that
      // writes findings to the attention queue would report `waiting` forever
      // for an agent that had been unblocked and never spoke again.
      //
      // `selectIn`, not a filter built from a list whose length is the data —
      // that is the HTTP 414 lesson, and the chunking lives in the store.
      const waits: Record<string, number> = {}
      const questionIds = Object.entries(beats)
        .filter(([, b]) => b.waiting_kind === 'question' && b.waiting_id)
        .map(([, b]) => b.waiting_id as string)
      if (questionIds.length) {
        const answered = await deps.store.selectIn('questions', 'id,answered_at', 'id', questionIds)
        if (answered.failed) sourceHealthy = false
        const byId = new Map(
          answered.rows
            .filter((r) => r.answered_at)
            .map((r) => [String(r.id), Date.parse(String(r.answered_at))])
        )
        for (const [sessionId, b] of Object.entries(beats)) {
          const when = b.waiting_id ? byId.get(b.waiting_id) : undefined
          if (when !== undefined) waits[sessionId] = when
        }
      }

      const host = { ...deps.host(), sourceHealthy: deps.host().sourceHealthy && sourceHealthy }
      const out: { sessionId: string; state: Liveness; appended: boolean }[] = []

      for (const s of sessions) {
        const prior = seen.get(s.sessionId)
        const gap = classifyObservationGap({ since: prior?.lastSampledAt ?? s.startedAt, now: at, host })
        const beat = beats[s.sessionId]
        // ONE ASSEMBLY, shared with the widget's reader (AX-02). Neither
        // caller builds this literal any more: each decided for itself what to
        // put where it had no answer, and they decided differently — the same
        // fresh oriented session read `working` here and `stalled` there.
        const reading = deriveLiveness(
          livenessInputFrom({
            session: {
              processEnded: s.processEnded,
              lastOutputAt: s.lastOutputAt,
              startedAt: s.startedAt
            },
            beat: beat ?? null,
            // M181 — ASKED, not assumed. This was `true`, so every session on
            // a runner with no MCP surface — three of the four the product
            // offers — was reported stalled fifteen minutes in, forever. M178
            // built the `unsupported` coverage for exactly this and a literal
            // defeated it.
            beatsSupported: isAvailable(capabilitiesFor(s.optionId), 'heartbeat'),
            orientation: { read: true, orientedAt: oriented.has(s.sessionId) ? s.startedAt : null },
            // The watcher reads every session in one pass and does not look up
            // each wait target's resolution, so it SAYS so rather than passing
            // a null that would read as "still open".
            wait: waits[s.sessionId]
              ? { resolved: 'at', when: waits[s.sessionId] }
              : { resolved: 'unread', why: 'the watcher does not resolve wait targets per pass' },
            gap,
            thresholds,
            now: at
          })
        )

        // ONE FINDING PER CONDITION. The same state next pass updates when it
        // was last seen and appends nothing — otherwise a stalled session
        // produces a Board obligation every tick and the list stops being read.
        const changed = prior?.state !== reading.state
        seen.set(s.sessionId, { state: reading.state, since: changed ? at : (prior?.since ?? at), lastSampledAt: at })

        let appended = false
        if (changed && (reading.state === 'stalled' || reading.state === 'gone')) {
          await deps.journal.append({
            estateId: deps.estateId,
            type: 'session.observed@1',
            actor: { kind: 'system', id: 'runtime-observer' },
            projectId: s.projectId ?? undefined,
            payload: {
              session_id: s.sessionId,
              state: reading.state,
              reason: reading.reason,
              coverage: reading.coverage,
              evidence: reading.evidence
            }
          } as Parameters<Journal['append']>[0])
          appended = true
        }
        out.push({ sessionId: s.sessionId, state: reading.state, appended })
      }
      return out
    }
  }
}
