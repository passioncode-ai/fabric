// #region console-open — docs: docs/evidence/plans/2026-11-16-screens-waves.md#s3--launching-sessions-next
/**
 * Opening a console for a project (the screens waves S3, 2026-11-16: moved out of `index.ts`'s `terminal.open`
 * handler, where it was a closure over a dozen of the main process's locals). One path for the person's launch: the
 * folder lock (CO-236), where the agent starts (UXA-C04), the fallback order's walk (ADR-0125) and the first
 * instruction's delivery with the attach claim it holds until then (CO-229, M103).
 */
import type { Walk } from '../shared/runnerRoute.ts'
import { FALLBACK_OPTION } from '../shared/runnerRoute.ts'
import { launchPlace } from '../shared/launchPlace.ts'
import { FOLDER_HELD_SAYS } from './launchFolderLock.ts'
import { openWithFallback } from './runnerFallback.ts'
import type { LaunchRoute } from './pty.ts'
import type { DeliveryWriteResult } from './deliveryQueue.ts'

/**
 * What became of a console's first instruction (2026-11-20, the owner's «what blocks work»: a CEO-started session sat
 * 40 minutes on an empty prompt and nothing in the log said why). `delivered`: written, and the runner took it (for
 * Claude Code: its working line appeared after the write, or its own transcript shows the task taken, `reason`
 * `turn_in_transcript`; another runner: written). `resubmitted`: written, the paste was still waiting in Claude Code's box,
 * and one more Enter sent it; or no turn showed and the transcript held none, so the task was typed once more, `reason`
 * `retyped` (SCN-183, amended 2026-11-20). `written_unconfirmed` (0.3.27 review, PL-2): written
 * to Claude Code, but no turn started within two checks; the text may sit in the box, or a trust or update screen may
 * have taken it, so the caller reads the screen before it relies on it. `not_delivered`: never written (after one more
 * wait for readiness), or written with an unknown outcome; `reason` says which.
 */
export type FirstInstructionOutcome = {
  state: 'delivered' | 'resubmitted' | 'written_unconfirmed' | 'not_delivered'
  reason?: string
  attempts: number
}

/** How long after the write the screen is read for a paste left in the box (Claude Code, measured 2026-11-20). */
export const FIRST_INSTRUCTION_CHECK_MS = 3000
/** Claude Code shows a long paste as «[Pasted text #1 +12 lines]» until it is sent. */
const PASTE_WAITING = /\[Pasted text #\d+/
/** Claude Code's working line: a turn started, so the instruction was taken (and an Enter now could answer a prompt). */
const TURN_STARTED = /esc to (?:interrupt|stop)/i
/**
 * A plain shell takes commands, not a task in words (2026-11-20, the CEO: three sessions started with runner «shell» and a
 * task printed the task into zsh, which answered «parse error near `)'»). Its first instruction is never typed.
 */
export const TAKES_NO_TASK: ReadonlySet<string> = new Set(['shell'])
export const SHELL_TAKES_NO_TASK = 'a plain shell takes commands, not a task: start an agent for the task, or type a command into the shell'

/** A readiness the queue gave up on may come back: the console printed, then kept printing or stayed silent. */
const WAIT_AGAIN = new Set(['readiness_timeout', 'readiness_changed'])

export interface ConsoleOpenDeps<S extends { sessionId: string }> {
  readProject(projectId: string): Promise<{ repo_path: string | null }>
  /** CO-236: whether an unresolved launch may still be writing in the project's folder. */
  folderHeld(projectId: string): boolean
  /** The operator's home folder: where an agent starts when no repository is attached. */
  home(): string
  /** The terminals (`PtyManager`), narrowed to what a launch uses. */
  ptys: {
    open(projectId: string, cwd: string, optionId: string, taskId: string | null, permissionMode: string | null,
      agent?: null, requestedSessionId?: undefined, preset?: undefined, route?: LaunchRoute): Promise<S>
    get(sessionId: string): S | null
    claimAttach(sessionId: string): boolean
    releaseAttach(sessionId: string): void
    deliverWhenReady(sessionId: string, instruction: string, options?: import('./deliveryQueue.ts').DeliveryWriteOptions): Promise<DeliveryWriteResult | unknown>
    /** The console's output so far (raw), and how many characters it has written in all; absent in older tests. */
    scrollbackOf?(sessionId: string): { text: string; written?: number } | null
    /** Type into the console (the one extra Enter). */
    write?(sessionId: string, data: string): void
  }
  /** The fallback order's walk for an ad-hoc terminal (`runnerFallback.ts#walk`). */
  walk(projectId: string, permissionMode: string | null, spawnFailed: ReadonlySet<string>, skipSessions: ReadonlySet<string>): Promise<Walk>
  /** ADR-0125 §4: nothing started, so the walk may move on (a spawn that threw, a runner not available). */
  unavailable(error: unknown): boolean
  record(op: 'runner.fallback-exhausted' | 'runner.fallback-attached', detail: Record<string, unknown>): void
  /** A first instruction that was not delivered: logged, never thrown at the person who opened the console. */
  failed(op: string, error: unknown): void
  /** The power blocker follows the running consoles. */
  syncPower(): void
  /** What became of a first instruction: one line of the operations log, never thrown. */
  delivered?(detail: { session_id: string; runner: string | null } & FirstInstructionOutcome): void
  /** Waits; the tests pass their own. */
  sleep?(ms: number): Promise<void>
  /** 2026-11-20: whether the runner's own transcript holds a turn from the person yet (Claude Code's
   *  `<home>/projects/<folder>/<session>.jsonl`): true, false, or null when it cannot be read. Only a false that is read,
   *  with no paste waiting on the screen, types the task once more; an unknown never does. */
  turnTaken?(sessionId: string): Promise<boolean | null>
}

export function createConsoleOpen<S extends { sessionId: string; optionId?: string }>(deps: ConsoleOpenDeps<S>) {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((res) => { const t = setTimeout(res, ms); t.unref?.() }))
  const outcomes = new Map<string, Promise<FirstInstructionOutcome>>()

  const asResult = (r: unknown): DeliveryWriteResult =>
    r && typeof r === 'object' && 'state' in r ? r as DeliveryWriteResult : { state: 'written' }

  /** The first instruction, followed to its end: delivered, resubmitted, written_unconfirmed or not delivered, and the
   *  log says which. */
  async function deliverFirst(session: S, instruction: string): Promise<FirstInstructionOutcome> {
    const id = session.sessionId
    let attempts = 1
    // Measured before the write: the paste's echo arrives in the output after it, whenever the queue writes.
    const lengthNow = (): number => deps.ptys.scrollbackOf?.(id)?.text.length ?? 0
    let before = lengthNow()
    let r = asResult(await deps.ptys.deliverWhenReady(id, instruction, { quietOnly: true }))
    // One more wait for readiness: never a blind write (the queue's rule), only a second window for fresh output.
    if (r.state === 'failed_before_write' && r.reason && WAIT_AGAIN.has(r.reason) && deps.ptys.get(id)) {
      attempts = 2
      before = lengthNow()
      r = asResult(await deps.ptys.deliverWhenReady(id, instruction, { quietOnly: true }))
    }
    if (r.state !== 'written') return { state: 'not_delivered', reason: r.reason ?? r.state, attempts }
    // Claude Code reads a long paste as «[Pasted text #1 …]», and the Enter written with it can be lost: the
    // instruction then waits in the box while the console looks idle. One more Enter sends it; it is pressed only
    // while no turn has started, so it cannot answer a question the agent asks.
    const runner = deps.ptys.get(id)?.optionId ?? session.optionId ?? null
    if (runner !== 'claude-code' || !deps.ptys.scrollbackOf || !deps.ptys.write) return { state: 'delivered', attempts }
    // What the console printed since the write (the scrollback is bounded: once it was cut, its newest part).
    const printedSince = (): string => {
      const now = deps.ptys.scrollbackOf?.(id)?.text ?? ''
      // Raw PTY output: styling escapes can split a hint (0.3.27 review, ER-7), so they are taken out before matching.
      // A cursor-forward move draws blank cells: it becomes as many spaces (ER-18), then every other sequence goes.
      return (now.length >= before ? now.slice(before) : now.slice(-8000))
        .replace(/\x1b\[(\d*)C/g, (_m, n: string) => ' '.repeat(Math.min(Number(n || 1), 200)))
        .replace(/\x1b\[[0-9;:<=>?]*[ -\/]*[@-~]/g, '')
    }
    await sleep(FIRST_INSTRUCTION_CHECK_MS)
    let since = printedSince()
    if (PASTE_WAITING.test(since) && !TURN_STARTED.test(since.slice(since.search(PASTE_WAITING)))) {
      try { deps.ptys.write(id, '\r') } catch { return { state: 'not_delivered', reason: 'enter_failed', attempts } }
      // The Enter is not the turn (ER-20): a second look for the working line before it is said resubmitted.
      await sleep(FIRST_INSTRUCTION_CHECK_MS)
      return TURN_STARTED.test(printedSince()) ? { state: 'resubmitted', attempts } : { state: 'written_unconfirmed', reason: 'no_turn_after_enter', attempts }
    }
    if (TURN_STARTED.test(since)) return { state: 'delivered', attempts }
    // 0.3.27 review, PL-2: written is not taken. A second look for the working line; none means the CEO is told to read
    // the screen, never that the session is working (an Enter here could accept a trust or update screen).
    await sleep(FIRST_INSTRUCTION_CHECK_MS)
    since = printedSince()
    if (TURN_STARTED.test(since)) return { state: 'delivered', attempts }
    // 2026-11-20 (0daa75f1, e150fe59): a paste written before Claude Code drew its box is dropped without a trace on the
    // screen. Its transcript says it: no turn from the person. Then, and only then, the task is typed once more.
    const taken = deps.turnTaken ? await deps.turnTaken(id).catch(() => null) : null
    if (taken === false && !PASTE_WAITING.test(since) && deps.ptys.get(id)) {
      before = lengthNow()
      const again = asResult(await deps.ptys.deliverWhenReady(id, instruction, { quietOnly: true }))
      if (again.state !== 'written') return { state: 'written_unconfirmed', reason: `retype_${again.reason ?? again.state}`, attempts: attempts + 1 }
      await sleep(FIRST_INSTRUCTION_CHECK_MS)
      const now = await (deps.turnTaken?.(id) ?? Promise.resolve(null)).catch(() => null)
      return now === true || TURN_STARTED.test(printedSince())
        ? { state: 'resubmitted', reason: 'retyped', attempts: attempts + 1 }
        : { state: 'written_unconfirmed', reason: 'no_turn_after_retype', attempts: attempts + 1 }
    }
    if (taken === true) return { state: 'delivered', reason: 'turn_in_transcript', attempts }
    return { state: 'written_unconfirmed', reason: 'no_turn_started', attempts }
  }

  const open = async (projectId: string, optionId: string, firstInstruction?: string, permissionMode?: string | null): Promise<S> => {
    const project = await deps.readProject(projectId)
    // CO-236: no second coding agent in a folder an unresolved launch may still be writing in (a plain shell is no agent).
    if (optionId !== 'shell' && deps.folderHeld(projectId)) throw new Error(FOLDER_HELD_SAYS)
    // ONE RULE, and the surface reads the same one (UXA-C04): with no repository attached the agent starts in the
    // operator's own home folder, with write tools, and the launcher says so.
    const place = launchPlace(project.repo_path)
    const cwd = place.place === 'repository' ? place.path : deps.home()
    const mode = permissionMode ?? null
    // CO-229: the held session this launch attached to is claimed until its first instruction is delivered.
    let claimed: string | null = null
    const session = optionId === FALLBACK_OPTION
      ? await openWithFallback({
          walk: (failed, skip) => deps.walk(projectId, mode, failed, skip),
          open: (runner, route) => deps.ptys.open(projectId, cwd, runner, null, mode, null, undefined, undefined, route),
          get: (sessionId) => deps.ptys.get(sessionId),
          claim: (sessionId) => { const ok = deps.ptys.claimAttach(sessionId); if (ok) claimed = sessionId; return ok },
          unavailable: deps.unavailable,
          record: deps.record
        })
      : await deps.ptys.open(projectId, cwd, optionId, null, mode)
    deps.syncPower()
    const release = (): void => { if (claimed) deps.ptys.releaseAttach(claimed) }
    if (firstInstruction?.trim() && TAKES_NO_TASK.has(optionId)) {
      release()
      try { deps.delivered?.({ session_id: session.sessionId, runner: optionId, state: 'not_delivered', reason: 'shell_takes_no_task', attempts: 0 }) } catch { /* the log says its own failures */ }
      outcomes.set(session.sessionId, Promise.resolve({ state: 'not_delivered', reason: 'shell_takes_no_task', attempts: 0 }))
    } else if (firstInstruction?.trim()) {
      // The same delivery as the task path, and it must be: two ways of handing an agent its first instruction is two
      // behaviours to keep matched (M103). The claim ends when the instruction is written or refused.
      const outcome = deliverFirst(session, firstInstruction.trim())
        .catch((e): FirstInstructionOutcome => { deps.failed('terminal.first-instruction', e); return { state: 'not_delivered', reason: 'threw', attempts: 1 } })
        .then((o) => {
          release()
          try { deps.delivered?.({ session_id: session.sessionId, runner: deps.ptys.get(session.sessionId)?.optionId ?? session.optionId ?? null, ...o }) } catch { /* the log says its own failures */ }
          return o
        })
      outcomes.set(session.sessionId, outcome)
      void outcome.finally(() => { setTimeout(() => outcomes.delete(session.sessionId), 10 * 60_000).unref?.() })
    } else release()
    return session
  }
  /** What became of the first instruction of a console this opened, while it is kept (ten minutes after it settled). */
  const firstInstruction = (sessionId: string): Promise<FirstInstructionOutcome> | null => outcomes.get(sessionId) ?? null
  return Object.assign(open, { firstInstruction })
}
// #endregion console-open
