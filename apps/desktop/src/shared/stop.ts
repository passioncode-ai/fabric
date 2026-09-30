// Public Stop receipts distinguish execution truth from transport success.
export type StopReason = 'operator_stop' | 'app_shutdown' | 'natural_exit' | 'launch_failure'
export type StopOutcome = 'completed' | 'failed_known' | 'cancelled'
export interface StopTarget { taskId: string; runId: string; sessionId: string }
export interface StopResult extends StopTarget {
  state: 'stopped' | 'outcome_unknown' | 'refused'
  commandId?: string
  receiptSeq?: number
  basis?: 'observed' | 'never_spawned'
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
