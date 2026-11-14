// CO-457: what `agents.switchboardSessions` answers (`main/switchboardSessions.ts`), shared with the renderer.
import type { SessionRow } from './vendor/dashboardsSessions.ts'

export interface SwitchboardSessions {
  /** Whether Switchboard is installed on this Mac; without it there is nothing to list, and that is not a failure. */
  installed: boolean
  rows: SessionRow[]
  /** The sources that did not answer, each with its reason; empty when both answered. */
  unread: Array<{ source: 'sessions' | 'recovery'; reason: string }>
}

/** CO-585: how a session a Switchboard session host holds opens in a Fabric console. On `ok`, the renderer opens a plain
 *  shell console in `projectId` and types `command` (`exec switchboard attach <launch_id>`): the console shows the same
 *  session other apps show; Ctrl-] detaches and leaves it running. `not-attachable`: no running hosted session has that
 *  launch id now; `no-project`: no Fabric project holds its folder (or two do); `unsupported`: not on Windows (attach is
 *  macOS and Linux); `unread`: Switchboard did not answer. */
export type SwitchboardAttachPlan =
  | { ok: true; projectId: string; command: string }
  | { ok: false; reason: 'not-attachable' | 'no-project' | 'unsupported' | 'unread' }
