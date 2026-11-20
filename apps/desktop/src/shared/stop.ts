// Public Stop receipts distinguish execution truth from transport success.
export type StopReason = 'operator_stop' | 'app_shutdown' | 'natural_exit' | 'launch_failure'
export type StopOutcome = 'completed' | 'failed_known' | 'cancelled'
export interface StopTarget { taskId: string; runId: string; sessionId: string }
export interface StopResult extends StopTarget {
  state: 'stopped' | 'outcome_unknown' | 'refused'
  commandId?: string
  receiptSeq?: number
  basis?: 'observed' | 'never_spawned' | 'attested'
  reasonCode: string
}

export interface TerminalStopResult {
  sessionId: string
  state: StopResult['state']
  reasonCode: string
  taskId?: string
  runId?: string
  commandId?: string
  receiptSeq?: number
  basis?: StopResult['basis']
  managed?: boolean
}
export type TerminalTermination = TerminalStopResult | { sessionId: string; state: 'requested'; reasonCode: string }

/**
 * The reasons the stop runtime gives only after it saw the root process exit and the whole process tree go quiet
 * (`main/nativeStopRuntime.ts`): what stays unproved is the provider's background work or a finalisation, never the
 * process. Nothing is left to stop.
 */
export const QUIET_TREE_REASONS: ReadonlySet<string> = new Set(['provider_termination_unproved', 'exit_outcome_unavailable', 'finalization_unproved', 'exit_receipt_unavailable'])

/**
 * The operator, 2026-11-19: «Завершить сессию» closes it at once. A session whose process is gone, stopped or ended
 * with only the provider's work unproved, leaves the board and its window with the press (`pty.ts#dismiss`).
 */
export function processGone(t: TerminalTermination | null | undefined): boolean {
  return !!t && (t.state === 'stopped' || (t.state === 'outcome_unknown' && QUIET_TREE_REASONS.has(t.reasonCode)))
}
