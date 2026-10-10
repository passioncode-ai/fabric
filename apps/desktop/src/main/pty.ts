// PtyManager — hosted terminals (ADR-0008 §3 / ADR-0031). Sessions live in the
// main process and survive renderer reloads AND window closes; a reattaching
// view replays the scrollback buffer. Lifecycle is journalled:
// terminal.opened@1 / terminal.closed@1.

import { spawn as ptySpawn, type IPty } from 'node-pty'
import type { TranscriptStore } from './transcripts'
import type { TerminalTermination } from '../shared/stop.ts'
import { randomUUID } from 'node:crypto'
import { checkAuthorityTarget } from '../shared/authorityIngress.ts'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Journal } from '@fabric/journal'
import type { LaunchOption, SessionState, TerminalSession } from '../shared/types'
import { AGENTS, mayLaunch, type SurfaceAdapter } from '../shared/agents.ts'
import { sessionEnvironment } from './sessionEnv.ts'
import { DeliveryQueue, type DeliveryQueueTiming, type DeliveryWriteOptions, type DeliveryWriteResult } from './deliveryQueue.ts'
import { LaunchRefusedBeforeSpawn, PtyLaunchFailure } from './launchFailure.ts'
import { ops } from './opsSink.ts'
import { createBoundedScrollback, type BoundedScrollback } from './scrollback.ts'
import { createProcessBoundary, type OwnedProcess } from './processBoundary.ts'
import { defaultShell, processTreeStopInvocation, whichInvocation } from './platform.ts'

/** How a fallback walk chose the runner a session runs (ADR-0125): the basis is the installation's
 *  order, never a contract route revision (DEC-0029); `passed_over` is every entry above the choice. */
export interface LaunchRoute {
  basis: 'host-order'
  requested: 'fallback-order'
  selected_index: number
  session: 'spawned'
  /** The contract's probe results (runner-route-event.schema.json `probes`), every entry above the choice. */
  probes: { index: number; runner: string; result: string; detail?: string }[]
}

const IDLE_AFTER_MS = 60_000 // no output for a minute → idle (honest tier-0 status)

/** How much of a session's output travels with EVERY listing.
 *
 *  FA-08. `list()` used to carry the whole capped buffer — up to 400 000
 *  characters per session, structure-cloned across the IPC boundary on every
 *  poll, for two readers: a tile that shows the last four thousand characters,
 *  and a terminal view that needs the whole thing exactly ONCE, when it mounts.
 *  The listing now carries the tile's worth and the mount asks for the rest. */
const EXCERPT_CHARS = 8_192

interface LiveSession {
  sessionId: string
  projectId: string
  permissionMode: string | null
  delivery: DeliveryQueue
  cwd: string
  program: string
  optionId: string
  /** The runner underneath (`optionId` is a created agent's id when it runs one). ADR-0125 attaches by runner. */
  runnerKind: string
  pty: IPty
  scrollback: BoundedScrollback
  /** Characters this session has emitted since it opened, counted before any
   *  capping. A reattaching view uses it to tell what it already holds from
   *  what arrived while it was asking — see `scrollbackOf`. */
  written: number
  running: boolean
  startedAt: number
  lastActivityAt: number
  exitCode: number | null
  exitSignal: number | null
  inputHalted: boolean
  process: OwnedProcess | null
  closedRecorded: boolean
  exitFinalized: boolean
  termination?: TerminalTermination
  closedPending?: Promise<boolean>
}

/**
 * The runner cannot serve this launch and nothing was started (ADR-0125 §4: "candidate unavailable"):
 * not installed, or connected through a surface that is down. A fallback walk moves on; every other
 * caller sees the same message it always did.
 */
export class RunnerUnavailable extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RunnerUnavailable'
  }
}

/** The launch's own authority changed before the spawn: the request is invalid, never retried elsewhere,
 *  and nothing started (`LaunchRefusedBeforeSpawn`, as the managed launch classifies it). */
export class LaunchAuthorityChanged extends LaunchRefusedBeforeSpawn {
  constructor(sessionId: string) {
    super(sessionId, 'launch_authority_changed')
    this.message = 'launch authority changed'
    this.name = 'LaunchAuthorityChanged'
  }
}

/** A spawn failure the operator can act on: it names what was run and where. */
export class SpawnFailure extends Error {
  readonly program: string
  readonly cwd: string
  readonly reason: string

  constructor(program: string, cwd: string, reason: string) {
    super(`${program} could not start in ${cwd}: ${reason}`)
    this.name = 'SpawnFailure'
    this.program = program
    this.cwd = cwd
    this.reason = reason
  }
}

/**
 * What a launch option needs handed to it so the agent can talk back to Fabric.
 * This is the per-session bundle: a config file naming the agent surface and a
 * credential scoped to this session alone. `agent-composition.md` calls this the
 * compiled bundle; today it holds one thing, and the shape is what matters —
 * skills and prompt sections land in the same directory later.
 */
export interface SessionBundle {
  /** Directory materialised for this session, outside the operator's repository. */
  dir: string
  /** Extra arguments the program is launched with. */
  args: string[]
  /** Extra environment (`config-content-env`): the session config, credential included. */
  env?: Record<string, string>
  /** `acp-session`: the program actually started (Fabric's ACP shell) and its arguments, in place
   *  of the agent's binary; the agent runs inside it. */
  command?: { program: string; args: string[] }
}

export interface BundleCompiler {
  /** Returns the arguments that connect this session to the agent surface, or
   *  null when the surface is unavailable — a session still starts, it just
   *  cannot report. */
  compile(
    sessionId: string,
    projectId: string,
    taskId: string | null,
    /** Which agent, and how it is told about the surface. The arguments depend
     *  on both, and before M17 they did not — every connecting agent received
     *  Claude Code's flags whether or not it understood them. */
    optionId: string,
    adapter: SurfaceAdapter,
    /** A created agent's brief and the servers it asked for (M125). */
    agent?: { instructions: string; servers: string[] } | null,
    /** The chosen mode's fragment of a per-session config (`config-content-env`). */
    modeConfig?: Readonly<Record<string, unknown>> | null
  ): Promise<SessionBundle | null>
  /**
   * Undo a compile. Called when the session that bundle was for never came into
   * existence, and again when it ends: a bundle carries a live credential, and a
   * credential nothing will ever revoke is the worst kind — it looks like it
   * belongs to something.
   */
  discard(sessionId: string): void
}

export interface PtyEvents {
  /** `written` is the session's running character count AFTER this chunk, so a
   *  view that asked for the scrollback can tell what it already holds. */
  onData(sessionId: string, data: string, written: number): void
  /** A pending or rejected finalizer retains the Session for recovery. */
  onExit(sessionId: string, exitCode: number): void | Promise<void>
}

function binaryExists(bin: string): boolean {
  try {
    // execFile without a shell: no argument concatenation, no injection surface.
    const how = whichInvocation(process.platform, bin)
    execFileSync(how.file, how.args, { encoding: 'utf8', timeout: 5000, windowsHide: true })
    return true
  } catch (e) {
      ops.failed('pty.signal', e)
    return false
  }
}

/** The launch menu. In slice 3 this is generated from admitted provider
 *  bindings; today it is the two things a terminal can hold. */
/**
 * The launchable agents, from the registry plus what this machine actually has.
 *
 * The descriptors are static (`shared/agents.ts`); AVAILABILITY is measured
 * here, because whether `claude` is on the PATH is a fact about the machine and
 * not about the agent. Adding a third agent is one descriptor and no edit to
 * this function.
 */
export function launchOptions(): LaunchOption[] {
  return AGENTS.map((agent) => ({
    id: agent.id,
    label: agent.label,
    program: agent.program,
    description: agent.description,
    available: agent.program === null || binaryExists(agent.program),
    connectsToSurface: agent.connectsToSurface,
    permissionModes: agent.permissionModes.map((mode) => ({
      id: mode.id,
      labelKey: mode.labelKey,
      // Blocked modes are SHOWN, not hidden: a choice that is absent teaches
      // nothing, and one that is refused with a reason is a decision the
      // operator can read and argue with.
      blockedKey: mode.blockedKey ?? null,
      warnKey: mode.warnKey ?? null
    })),
    defaultMode: agent.defaultMode
  }))
}

export class PtyManager {
  private sessions = new Map<string, LiveSession>()
  private opening = new Set<string>()
  private processBoundary = createProcessBoundary()

  private journal: Journal
  private estateId: string
  private events: PtyEvents
  private bundles?: BundleCompiler
  private spawn: typeof ptySpawn
  private transcripts?: TranscriptStore
  private deliveryTiming: DeliveryQueueTiming
  /** Who a terminal belongs to (FA-07). Handed in from the one port that may
   *  produce a person actor, rather than written out here — twice — as it was. */
  private actor: () => { kind: 'person'; id: string }

  // Assigned in the body, not declared as parameter properties: Node's
  // type-stripping loader rejects those, and this class is imported directly by
  // apps/desktop/test/session-bundle.test.mjs. Same trap the agent surface hit.
  //
  // `spawn` exists only so the spawn-FAILURE branch can be watched. Nothing in
  // the app passes it, and the seam is here because the alternative was to prove
  // that branch by argument: a missing binary is caught earlier by the launch
  // option's availability check, and a missing cwd does not throw at all — it
  // produces a session that exits 1 a moment later (measured). Neither reaches
  // the catch, and the catch is where a credential is handed back.
  constructor(
    journal: Journal,
    estateId: string,
    events: PtyEvents,
    bundles?: BundleCompiler,
    spawn: typeof ptySpawn = ptySpawn,
    transcripts?: TranscriptStore,
    /**
     * Who a terminal belongs to (FA-07). It was written out here as
     * `{ kind: 'person', id: 'operator' }`, TWICE — the third and fourth
     * definitions of one identity in this product, with nothing forbidding a
     * fifth. It is handed in now, from the one port that may produce it.
     */
    actor: () => { kind: 'person'; id: string } = () => {
      throw new Error('a terminal cannot be journalled before a subject is established')
    },
    deliveryTiming: DeliveryQueueTiming = {}
  ) {
    this.journal = journal
    this.estateId = estateId
    this.events = events
    this.bundles = bundles
    this.spawn = spawn
    this.transcripts = transcripts
    this.actor = actor
    this.deliveryTiming = deliveryTiming
  }

  /** The record of what a session did, or null. Reading it ENDS the capture. */
  captureTranscript(sessionId: string, optionId: string, startedAt: string, exitCode: number | null) {
    return (
      this.transcripts?.close(sessionId, {
        optionId,
        startedAt,
        endedAt: new Date().toISOString(),
        exitCode
      }) ?? null
    )
  }

  finalizeTranscript(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (!session || session.running || !this.transcripts) return { state: 'unavailable' as const, reason: 'missing-capture' as const }
    return this.transcripts.finalize(sessionId, { optionId: session.optionId,
      startedAt: new Date(session.startedAt).toISOString(), endedAt: new Date(session.lastActivityAt).toISOString(), exitCode: session.exitCode })
  }

  setTermination(receipt: TerminalTermination): void {
    const session = this.sessions.get(receipt.sessionId)
    if (session) session.termination = receipt
  }

  /** Resolve only after the actual PTY write, or an explicit refusal/unknown.
   * Output followed by quiet is a heuristic, never evidence of agent acceptance. */
  deliverWhenReady(sessionId: string, instruction: string, options: DeliveryWriteOptions = {}): Promise<DeliveryWriteResult> {
    const session = this.sessions.get(sessionId)
    if (!session) return Promise.resolve({ state: 'failed_before_write', reason: 'unknown_session' })
    return session.delivery.enqueue(instruction, options)
  }

  /** Remove a session's spool once its record is durable (IMP-12). */
  settleTranscript(sessionId: string): void {
    this.transcripts?.settle(sessionId)
  }

  recoverTranscriptFinalizations(page: { after: string | null; limit: number } = { after: null, limit: 8 }) {
    // Current generations, even exited ones awaiting Stop/receipt, belong to
    // runtime finalization. Background recovery must not consume their spool.
    return this.transcripts?.recoverFinalizations({ ...page, exclude: new Set([...this.sessions.keys(), ...this.opening]) })
      ?? { state: 'listed' as const, items: [] }
  }

  /** Spools a previous run left behind — a crash, or an append that failed. */
  recoverTranscripts(): ReturnType<NonNullable<PtyManager['transcripts']>['recover']> {
    return this.transcripts?.recover() ?? []
  }

  async open(
    projectId: string,
    cwd: string,
    optionId: string,
    taskId: string | null = null,
    permissionMode: string | null = null,
    /**
     * A created agent (M125), already resolved. `optionId` stays what the
     * OPERATOR chose and is what gets journalled — "which agent ran this" is a
     * question about the agent, not about the program underneath it — while the
     * program, its flags and its permission modes come from the RUNNER named
     * here. That separation is the whole of the runner/agent distinction made
     * operable.
     */
    agent: { runnerId: string; instructions: string; servers: string[] } | null = null,
    requestedSessionId?: string,
    beforeSpawn?: () => Promise<boolean>,
    /** The fallback walk that chose this runner (ADR-0125), journalled additively with the opening. */
    route: LaunchRoute | null = null
  ): Promise<TerminalSession> {
    const sessionId = requestedSessionId ?? randomUUID()
    if (this.sessions.has(sessionId) || this.opening.has(sessionId)) throw new Error('session identity already used')
    this.opening.add(sessionId)
    try {
    const runnerId = agent?.runnerId ?? optionId
    for (const ref of [cwd, optionId, runnerId])
      if (typeof ref !== 'string' || !ref.trim() || !checkAuthorityTarget(ref).ok)
        throw new Error('Launch reference was refused before preparation.')
    const option = launchOptions().find((o) => o.id === runnerId)
    if (!option) throw new Error(`unknown launch option: ${runnerId}`)
    if (!option.available) throw new RunnerUnavailable(`${option.label} is not available on this machine`)
    // The mode is checked HERE, where the session is actually created, and not
    // only in the picker that offered it. A blocked mode reaching this line is
    // either a stale renderer or a caller that skipped the picker entirely, and
    // both must be refused the same way.
    const descriptor = AGENTS.find((a) => a.id === runnerId)
    const verdict = mayLaunch(runnerId, permissionMode)
    if (!verdict.ok) throw new Error(verdict.reason)
    // The mode the runner RECEIVES: a runner without modes receives none, whatever was asked for
    // (ADR-0125 §6 — the journal recorded "ask" for Codex, which has no gate, the A6-006 class).
    const mode = descriptor && descriptor.permissionModes.length > 0 ? (permissionMode ?? descriptor.defaultMode) : null
    const program = option.program ?? defaultShell(process.platform, process.env)
    if (!checkAuthorityTarget(program).ok)
      throw new Error('Launch program was refused before preparation.')

    // Only an agent gets the surface; a plain shell has nothing to say to it.
    // Awaited: the bundle now compiles a context pack, which reads the project's
    // memory. The session must not start before the pack it is told about exists.
    const bundle = option.connectsToSurface
      ? ((await this.bundles?.compile(
          sessionId,
          projectId,
          taskId,
          runnerId,
          descriptor?.surfaceAdapter ?? 'unimplemented',
          agent,
          verdict.config
        )) ?? null)
      : null
    // Audit 2026-10-05 A6-006: for these adapters the session's permissions travel IN the bundle (Kilo's
    // Ask is a config fragment, and Kilo's own default allows everything; a Hermes session is the ACP
    // shell itself). With no bundle — the agent surface is not running — the agent would start with
    // its own defaults while the journal recorded the mode the person chose. Refused, and said why.
    const adapter = descriptor?.surfaceAdapter
    if (option.connectsToSurface && !bundle && (adapter === 'config-content-env' || adapter === 'acp-session'))
      throw new RunnerUnavailable(
        `${option.label} was not started: Fabric's agent surface is not running, and this agent's permissions ` +
        `and connection are given with it. Start the session again once the surface is up (Settings → Agent access).`
      )
    // Asked before the spawn and outside its catch: a changed authority is a refused request, not a
    // spawn that failed — a fallback walk must never retry it on another runner (ADR-0125 §4).
    // A check that THROWS (the launch receipt could not be read, the identity guard failed) takes the
    // credential back too: it was minted with the bundle, and nothing after this line will hear of the
    // session (0.3.3 verification ER-1 — 0.3.2 discarded it, inside the spawn's catch).
    const discardBundle = (): void => {
      if (!bundle) return
      try { this.bundles?.discard(sessionId) }
      catch { ops.failed('pty.bundle-cleanup', new Error('session credential cleanup failed'), { sessionId }) }
    }
    if (beforeSpawn) {
      let allowed: boolean
      try { allowed = await beforeSpawn() } catch (e) { discardBundle(); throw e }
      if (!allowed) { discardBundle(); throw new LaunchAuthorityChanged(sessionId) }
    }
    let pty: IPty
    try {
      pty = this.spawn(bundle?.command?.program ?? program, bundle?.command ? bundle.command.args : [...(bundle?.args ?? []), ...verdict.args], {
        name: 'xterm-256color',
        cols: 120,
        rows: 32,
        cwd,
        // IMP-07: the operator's environment minus Fabric's own database keys.
        // The surface is meant to be the only door, and it was one variable wide.
        // The operator's environment, minus Fabric's own keys (IMP-07), plus
        // whatever the agent itself needs — `goose` takes its mode from
        // GOOSE_MODE rather than from a flag, and a descriptor that could not
        // say so is what made "a third agent is one row" false.
        env: { ...sessionEnvironment(process.env), ...(descriptor?.env ?? {}), ...(bundle?.env ?? {}) }
      })
    } catch (e) {
      // The bundle was written and its credential minted before spawn was even
      // attempted. Nothing downstream will ever hear about this session, so this
      // is the only place that can take them back.
      discardBundle()
      throw new SpawnFailure(program, cwd, e instanceof Error ? e.message : String(e))
    }
    const now = Date.now()
    const session: LiveSession = {
      sessionId,
      projectId,
      cwd,
      program,
      optionId,
      runnerKind: runnerId,
      permissionMode: mode,
      delivery: new DeliveryQueue((text) => {
        pty.write(text)
        session.lastActivityAt = Date.now()
      }, () => session.running && !session.inputHalted, this.deliveryTiming),
      pty,
      scrollback: createBoundedScrollback(),
      written: 0,
      running: true,
      startedAt: now,
      lastActivityAt: now,
      exitCode: null,
      exitSignal: null,
      inputHalted: false,
      process: null,
      closedRecorded: false,
      exitFinalized: false
    }
    this.sessions.set(sessionId, session)
    try {
      // Subscribe before storage can throw. A failed setup still owns a process
      // and must remain observable until an actual exit arrives.
      pty.onData((data) => {
        this.transcripts?.write(sessionId, data)
        session.delivery.noteOutput()
        session.scrollback.push(data)
        session.written += data.length
        session.lastActivityAt = Date.now()
        this.events.onData(sessionId, data, session.written)
      })
      pty.onExit(async ({ exitCode, signal }) => {
        session.running = false
        session.inputHalted = true
        session.delivery.close('session_exited')
        session.exitCode = exitCode
        session.exitSignal = signal ?? null
        session.lastActivityAt = Date.now()
        // Notify local exit immediately, so credential revocation is not held
        // behind a slow journal. Stop independently awaits ensureClosedReceipt;
        // neither port may await this callback's completion.
        let consumer: Promise<void>
        try { consumer = Promise.resolve(this.events.onExit(sessionId, exitCode)) }
        catch (error) { /* The common finalizer catch below reports this after the close receipt attempt. */ consumer = Promise.reject(error) }
        try {
          await Promise.all([this.ensureClosedReceipt(sessionId), consumer])
          session.exitFinalized = true
        }
        catch { ops.failed('pty.exit-observer', new Error('session exit observer failed'), { sessionId }) }
        this.closing.get(sessionId)?.()
        this.closing.delete(sessionId)
      })

      this.transcripts?.open(sessionId, {
        projectId,
        optionId,
        startedAt: new Date(now).toISOString(),
        taskId
      })
      // Open capture before the first asynchronous observation: native output
      // can arrive while ps is running and must already have somewhere to go.
      // Failure to read a process identity is a visible lack of termination
      // evidence, not proof that spawn failed. Keep the owned PTY observable.
      try { session.process = await this.processBoundary.capture(pty.pid) } catch { session.process = null /* observeProcess exposes process_identity_unavailable; spawn still exists. */ }

      await this.journal.append({
        estateId: this.estateId,
        type: 'terminal.opened@1',
        actor: this.actor(),
        projectId,
        payload: {
          session_id: sessionId,
          cwd,
          program,
          option_id: optionId,
          surface: bundle !== null,
          // Additive to the @1 payload: a reader that predates this field sees
          // it absent, which is what "we did not record it" should look like.
          permission_mode: mode,
          // Additive (ADR-0125): present only when the fallback order chose the runner.
          ...(route ? { route } : {}),
          process_identity: session.process ? { pid: session.process.pid, group: session.process.group, start: session.process.start } : null
        }
      })
    } catch {
      // Close mediated access immediately, but retain native liveness until
      // the exit callback observes it. kill() returning is not that evidence.
      session.delivery.close('launch_failed')
      session.inputHalted = true
      try { if (bundle) this.bundles?.discard(sessionId) }
      catch { ops.failed('pty.bundle-cleanup', new Error('session credential cleanup failed'), { sessionId }) }
      try { if (session.running) pty.kill('SIGTERM') }
      catch { ops.failed('pty.launch-stop', new Error('session termination could not be requested'), { sessionId }) }
      throw new PtyLaunchFailure(sessionId)
    }

    return this.toPublic(session)
    } finally { this.opening.delete(sessionId) }
  }

  /**
   * A session a fallback walk may attach to (ADR-0125, contract DEC-0029): this runner, this project,
   * running, idle, accepting input and not held by anything in `exclude` (a task's session).
   */
  attachable(projectId: string, runnerKind: string, mode: string | null, exclude: ReadonlySet<string>): string | null {
    for (const s of [...this.sessions.values()].sort((a, b) => b.lastActivityAt - a.lastActivityAt)) {
      if (s.projectId !== projectId || s.runnerKind !== runnerKind || exclude.has(s.sessionId)) continue
      // The runner itself, not a created agent with its own brief and servers; and the mode this launch
      // would apply — a launch asking for a gate never lands in a session opened in bypass (DEC-0029:
      // an attached session runs under the derived execution context).
      if (s.optionId !== s.runnerKind || s.permissionMode !== mode) continue
      if (!s.running || s.inputHalted || !s.delivery.open || this.opening.has(s.sessionId) || this.stateOf(s) !== 'idle') continue
      return s.sessionId
    }
    return null
  }

  list(projectId?: string): TerminalSession[] {
    return [...this.sessions.values()]
      .filter((s) => !projectId || s.projectId === projectId)
      .sort((a, b) => a.startedAt - b.startedAt)
      .map((s) => this.toPublic(s))
  }

  get(sessionId: string): TerminalSession | null {
    const s = this.sessions.get(sessionId)
    return s ? this.toPublic(s) : null
  }

  /**
   * The whole retained buffer, for a view that is attaching to this session.
   *
   * Asked for ONCE per mount, which is why the listing no longer carries it.
   * `written` is the character count the buffer ends at, and it is what closes
   * a hole this replay has always had: a view used to replay a snapshot taken
   * by an earlier poll and only THEN subscribe, so every byte in between was
   * lost — silently, and worse the busier the session. A subscriber that starts
   * first and holds what arrives can now tell which of those bytes this answer
   * already contains, instead of guessing between losing them and doubling them.
   */
  scrollbackOf(sessionId: string): { text: string; written: number } | null {
    const s = this.sessions.get(sessionId)
    return s ? { text: s.scrollback.text(), written: s.written } : null
  }

  write(sessionId: string, data: string): void {
    const s = this.sessions.get(sessionId)
    if (!s || !s.running || s.inputHalted) return
    s.delivery.noteExternalWrite()
    s.lastActivityAt = Date.now()
    try {
      s.pty.write(data)
    } catch (error) {
      // Direct input can fail after a prefix was transmitted, just like queued
      // delivery. No automated instruction may follow that unknown outcome.
      s.delivery.close('prior_write_unknown')
      throw error
    }
  }

  resize(sessionId: string, cols: number, rows: number): void {
    // An ended session keeps its record (and its tile) but not its terminal: node-pty's resize on an
    // exited PTY throws `ioctl(2) failed, EBADF` (audit 2026-10-05 A2-001, probed). Opening or resizing
    // the window of an ended session is ordinary, so it is a no-op, not an error.
    const s = this.sessions.get(sessionId)
    if (!s || !s.running || !(cols > 0 && rows > 0)) return
    s.pty.resize(cols, rows)
  }

  /**
   * End a running session. The record SURVIVES: the tile stays, showing how it
   * ended, until the operator dismisses it. Killing and forgetting in one action
   * is how an exit code becomes unobservable.
   */
  async end(sessionId: string): Promise<void> {
    const s = this.sessions.get(sessionId)
    if (!s || !s.running) return
    this.haltInput(sessionId)
    await this.signalProcess(sessionId, 'SIGTERM')
  }

  haltInput(sessionId: string, reason = 'stop_requested'): void {
    const s = this.sessions.get(sessionId)
    if (!s) return
    s.inputHalted = true
    s.delivery.close(reason)
  }

  /** Returns only host-observed process facts. Provider daemons need their own
   * evidence; an empty POSIX group never claims provider quiescence. */
  async observeProcess(sessionId: string) {
    const s = this.sessions.get(sessionId)
    if (!s) return null
    const observation = s.process ? await this.processBoundary.observe(s.process, !s.running) : null
    return { rootExited: !s.running, processTreeQuiescent: observation?.state === 'quiescent',
      processIdentity: s.process ? { pid: s.process.pid, group: s.process.group, start: s.process.start } : null,
      reasonCode: observation?.reasonCode ?? 'process_identity_unavailable',
      exitCode: s.exitCode, exitSignal: s.exitSignal }
  }

  async signalProcess(sessionId: string, signal: 'SIGTERM' | 'SIGKILL', stillAllowed: () => boolean = () => true): Promise<void> {
    const s = this.sessions.get(sessionId)
    if (!s) return
    if (s.process) { await this.processBoundary.signal(s.process, signal, stillAllowed); return }
    // Windows has no process groups (PL-07): the session's tree is stopped from its root, and only while that root's
    // exit has not been observed, so the pid is still the session's own (REQ-11).
    if (process.platform === 'win32' && s.running && stillAllowed()) {
      try {
        const how = processTreeStopInvocation(s.pty.pid, signal)
        execFileSync(how.file, how.args, { timeout: 5000, windowsHide: true, stdio: 'ignore' })
        return
      } catch (e) { ops.failed('pty.tree-stop', e) /* Falls back to the PTY's own kill below. */ }
    }
    // We can still request that the owned PTY stop. Without its captured group
    // identity, observeProcess deliberately cannot prove whole-tree quiescence.
    if (s.running && stillAllowed()) s.pty.kill(signal)
  }

  async ensureClosedReceipt(sessionId: string): Promise<boolean> {
    const s = this.sessions.get(sessionId)
    if (!s || s.running) return false
    if (s.closedRecorded) return true
    if (s.closedPending) return s.closedPending
    s.closedPending = (async () => {
      try {
        await this.journal.append({ estateId: this.estateId, type: 'terminal.closed@1', actor: this.actor(),
          projectId: s.projectId, payload: { session_id: sessionId, exit_code: s.exitCode, exit_signal: s.exitSignal, option_id: s.optionId } })
        s.closedRecorded = true
        return true
      } catch {
        ops.failed('pty.journal-terminal-closed-failed', new Error('Terminal exit receipt remains unavailable'), { sessionId })
        return false
      } finally { s.closedPending = undefined }
    })()
    return s.closedPending
  }

  /** Remove an already-ended session from the board. */
  dismiss(sessionId: string): void {
    const s = this.sessions.get(sessionId)
    if (s && !s.running && s.closedRecorded && s.exitFinalized && (!s.termination || s.termination.state === 'stopped')) this.sessions.delete(sessionId)
  }

  /**
   * A03: quitting must not lose the closing events. Kills every live session and
   * resolves once each one's terminal.closed@1 has been appended.
   */
  async closeAll(): Promise<void> {
    const live = [...this.sessions.values()].filter((s) => s.running)
    if (live.length === 0) return
    await Promise.all(
      live.map(
        (s) =>
          new Promise<void>((resolve) => {
            this.closing.set(s.sessionId, resolve)
            this.haltInput(s.sessionId, 'shutdown_requested')
            void this.signalProcess(s.sessionId, 'SIGTERM').catch(() =>
              ops.failed('pty.signal', new Error('Shutdown termination request failed'), { sessionId: s.sessionId }))
            setTimeout(resolve, 3000) // never hang the quit on a stuck process
          })
      )
    )
  }

  private closing = new Map<string, () => void>()

  private stateOf(s: LiveSession): SessionState {
    if (!s.running) return 'ended'
    return Date.now() - s.lastActivityAt > IDLE_AFTER_MS ? 'idle' : 'running'
  }

  private toPublic(s: LiveSession): TerminalSession {
    return {
      sessionId: s.sessionId,
      projectId: s.projectId,
      cwd: s.cwd,
      program: s.program,
      optionId: s.optionId,
      permissionMode: s.permissionMode,
      excerpt: s.scrollback.text().slice(-EXCERPT_CHARS),
      written: s.written,
      running: s.running,
      state: this.stateOf(s),
      startedAt: new Date(s.startedAt).toISOString(),
      lastActivityAt: new Date(s.lastActivityAt).toISOString(),
      tail: s.scrollback.tailLine(),
      exitCode: s.exitCode,
      ...(s.termination ? { termination: s.termination } : {})
    }
  }
}
