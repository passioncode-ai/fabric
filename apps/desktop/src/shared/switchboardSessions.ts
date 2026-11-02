// CO-457: what `agents.switchboardSessions` answers (`main/switchboardSessions.ts`), shared with the renderer.
import type { SessionRow } from './vendor/dashboardsSessions.ts'

export interface SwitchboardSessions {
  /** Whether Switchboard is installed on this Mac; without it there is nothing to list, and that is not a failure. */
  installed: boolean
  rows: SessionRow[]
  /** The sources that did not answer, each with its reason; empty when both answered. */
  unread: Array<{ source: 'sessions' | 'recovery'; reason: string }>
}
