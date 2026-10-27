// #region session-status — docs: docs/ux/2026-10-26-simple-fabric-v2.md#45-session-status-r-19
/**
 * A session's status in one word and colour (the operator's second review, 2026-10-26, v2 §4.5, R-19), from signals
 * Fabric already has, observed first and the agent's own word second; the first that holds wins:
 * error (a console Fabric did not stop ended with a non-zero exit, or by a signal Fabric did not send, a crash or an
 * out-of-memory kill; or the agent's FRESH heartbeat says `blocked`), ended (a console ended cleanly, or by Fabric's own
 * stop whatever its exit code, ER-27), waiting (Fabric observed a wait: the agent's fresh heartbeat says `waiting`; an
 * open question counts only when a caller passes `asking`, and no screen does in 0.3.14, DA-10),
 * working (a sign within the window), idle (gone quiet; a Fabric console silent for a minute is idle, never «waiting»:
 * silence is not an observed wait, the 0.3.14 review, iteration 2, DA-5). «Дежурит» (monitoring) needs roles and is
 * 0.3.15's; a limit stop read from Switchboard is CO-457's. The screens show the word beside the colour.
 *
 * ONE function for every screen (the left column, «В работе», the agent page; ER-18): an agent's own word counts only
 * while it is fresh, newer than the agent's last sign of life or within the quiet window (`PHASE_FRESH_MS`, the stale
 * window the home already uses); an older heartbeat falls back to what Fabric observes.
 */
import { SESSION_STALE_MS } from './workClaims.ts'

export const SESSION_STATUSES = ['error', 'waiting', 'working', 'idle', 'ended'] as const
export type SessionStatus = typeof SESSION_STATUSES[number]

/** How long an agent's own heartbeat word holds when nothing newer was heard (the home's stale window, 10 min). */
export const PHASE_FRESH_MS = SESSION_STALE_MS

export interface StatusTerminal {
  state: 'running' | 'idle' | 'ended'
  exitCode: number | null
  exitSignal?: number | null
  stoppedByFabric?: boolean
}

export function sessionStatus(input: {
  stale?: boolean
  phase?: string | null
  /** When the phase was said; without it the phase is not trusted (an older caller). */
  phaseAt?: string | null
  /** The agent's newest sign of life, to tell a fresh phase from an old one. */
  heardAt?: string | null
  /** An open question from this session to the person. */
  asking?: boolean
  now?: number
  terminal?: StatusTerminal | null
}): SessionStatus {
  const term = input.terminal ?? null
  if (term?.state === 'ended') {
    // ER-27 (0.3.14 review, iteration 3): Fabric's own stop is ended whatever the program answers it with (a signal,
    // or an exit code such as 143 or 130 from an agent that catches SIGTERM).
    if (term.stoppedByFabric) return 'ended'
    if (term.exitCode !== null && term.exitCode !== 0) return 'error'
    if (term.exitSignal && !term.stoppedByFabric) return 'error'
    return 'ended'
  }
  const phase = freshPhase(input)
  if (phase === 'blocked') return 'error'
  if (phase === 'waiting' || input.asking) return 'waiting'
  if (input.stale || term?.state === 'idle') return 'idle'
  return 'working'
}

/** The one call every screen makes for a live agent (ER-18): its observed staleness, its newest heartbeat, the console
 *  Fabric holds for it. `phase` overrides the heartbeat when a screen read a newer one from the agent's history. */
export function agentStatus(
  a: { stale: boolean; lastSignAt: string | null; startedAt: string; console: boolean; heartbeat?: { phase: string; at: string } | null },
  terminal: StatusTerminal | null | undefined,
  opts: { phase?: { phase: string; at: string } | null; now?: number } = {}
): SessionStatus {
  const beat = newer(opts.phase ?? null, a.heartbeat ?? null)
  return sessionStatus({
    stale: a.stale,
    phase: beat?.phase ?? null,
    phaseAt: beat?.at ?? null,
    heardAt: a.lastSignAt ?? a.startedAt,
    now: opts.now,
    terminal: a.console ? (terminal ?? null) : null
  })
}

function newer(x: { phase: string; at: string } | null, y: { phase: string; at: string } | null): { phase: string; at: string } | null {
  if (!x) return y
  if (!y) return x
  return Date.parse(x.at) >= Date.parse(y.at) ? x : y
}

function freshPhase(input: { phase?: string | null; phaseAt?: string | null; heardAt?: string | null; now?: number }): string | null {
  if (!input.phase || !input.phaseAt) return null
  const at = Date.parse(input.phaseAt)
  if (!Number.isFinite(at)) return null
  const heard = input.heardAt ? Date.parse(input.heardAt) : NaN
  if (Number.isFinite(heard) && at >= heard) return input.phase
  return (input.now ?? Date.now()) - at <= PHASE_FRESH_MS ? input.phase : null
}
// #endregion session-status
