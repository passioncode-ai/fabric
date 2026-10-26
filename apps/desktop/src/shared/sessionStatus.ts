// #region session-status — docs: docs/ux/2026-10-26-simple-fabric-v2.md#45-session-status-r-19
/**
 * A session's status in one word and colour (the operator's second review, 2026-10-26, v2 §4.5, R-19), from signals
 * Fabric already has, observed first and the agent's own word second; the first that holds wins:
 * error (a console ended with a non-zero exit, or the agent's heartbeat says `blocked`), ended (a console ended
 * cleanly), waiting (the heartbeat says `waiting`, or a Fabric console stopped and waits for input), working (a sign
 * within the window), idle (gone quiet). «Дежурит» (monitoring) needs roles and is 0.3.15's; a limit stop read from
 * Switchboard is CO-457's. The screens show the word beside the colour, never the colour alone.
 */
export const SESSION_STATUSES = ['error', 'waiting', 'working', 'idle', 'ended'] as const
export type SessionStatus = typeof SESSION_STATUSES[number]

export function sessionStatus(input: {
  stale?: boolean
  phase?: string | null
  terminal?: { state: 'running' | 'idle' | 'ended'; exitCode: number | null } | null
}): SessionStatus {
  const term = input.terminal ?? null
  if (term?.state === 'ended') return term.exitCode !== null && term.exitCode !== 0 ? 'error' : 'ended'
  if (input.phase === 'blocked') return 'error'
  if (input.phase === 'waiting' || term?.state === 'idle') return 'waiting'
  if (input.stale) return 'idle'
  return 'working'
}
// #endregion session-status
