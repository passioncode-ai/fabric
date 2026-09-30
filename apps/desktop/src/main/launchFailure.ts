import { ops } from './opsSink.ts'

/** A launch whose native process may exist even though open() failed — a PTY or an owned
 * backend alike (B1). Callers must reconcile this exact session, never compensate it as a
 * failure before spawn. `reason` is a fixed code, never native text. */
export class ProcessLaunchFailure extends Error {
  readonly sessionId: string
  readonly processStarted = true
  readonly reason: string
  constructor(sessionId: string, reason = 'setup_failed_after_spawn', message = 'The session started, but setup failed. Its termination must be checked before another launch.') {
    super(message)
    this.name = 'ProcessLaunchFailure'
    this.sessionId = sessionId
    this.reason = reason
  }
}
/** A native process exists even though the PTY open failed. */
export class PtyLaunchFailure extends ProcessLaunchFailure {
  constructor(sessionId: string) {
    super(sessionId, 'pty_setup_failed')
    this.name = 'PtyLaunchFailure'
  }
}
/** The launch was refused before any child existed: a clean "not started", even if a marker
 * file was written for the attempt. Only a typed refusal with no child produces this. */
export class LaunchRefusedBeforeSpawn extends Error {
  readonly sessionId: string
  readonly processStarted = false
  readonly reason: string
  constructor(sessionId: string, reason: string) {
    super('The launch was refused before a process was started.')
    this.name = 'LaunchRefusedBeforeSpawn'
    this.sessionId = sessionId
    this.reason = reason
  }
}

/** Retain the failed session before awaiting any durable reconciliation. A
 * second failure must not erase the evidence that a native process existed. */
export async function retainFailedLaunch(error: unknown, deps: {
  track(sessionId: string): void
  get(sessionId: string): { running: boolean; exitCode: number | null } | null
  close(sessionId: string, exitCode: number | null): Promise<void>
}): Promise<boolean> {
  if (!(error instanceof ProcessLaunchFailure) || !error.processStarted) return false
  deps.track(error.sessionId)
  const session = deps.get(error.sessionId)
  if (session && !session.running) {
    try { await deps.close(error.sessionId, session.exitCode) }
    catch { ops.failed('launch.exit-reconcile', new Error('failed launch exit receipt remains pending'), { sessionId: error.sessionId }) }
  }
  return true
}
