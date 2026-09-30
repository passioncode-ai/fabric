// Native composition for one Stop finalizer per local session. A lookup failure
// is never reinterpreted as an unmanaged shell, and PTY exit alone is not proof
// that an agent provider (daemon, remote turn or background work) has stopped.
import { createHash } from 'node:crypto'
import { createManagedStop, type ManagedStopDeps, type StopOutcome, type StopReason, type StopTarget } from './managedStop.ts'

export type { TerminalStopResult as NativeStopResult, TerminalTermination as NativeStopState } from '../shared/stop.ts'
import type { TerminalStopResult as NativeStopResult, TerminalTermination as NativeStopState } from '../shared/stop.ts'
export interface NativeStopSession { sessionId: string; optionId: string; startedAt: string | number }
export interface NativeProcessObservation {
  rootExited: boolean
  processTreeQuiescent: boolean
  processIdentity: { pid: number; group: number; start: string } | null
  exitCode: number | null
  exitSignal: number | null
  /** A port that owns its own process reference (the owned backend, B3-2) supplies it; the PTY
   * port leaves it out and the runtime derives one from `processIdentity`. */
  processIdentityRef?: string
}
export interface NativeStopDeps {
  db: ManagedStopDeps['db']
  estateId: string
  actor: ManagedStopDeps['actor']
  guard(): Promise<boolean>
  authority: ManagedStopDeps['authority']
  /** null means a successful read proved there is no Run. Errors must throw. */
  lookup(sessionId: string): Promise<StopTarget | null>
  localTask(sessionId: string): string | null
  ptys: {
    get(sessionId: string): NativeStopSession | null
    list(): NativeStopSession[]
    haltInput(sessionId: string): void
    signalProcess(sessionId: string, signal: 'SIGTERM' | 'SIGKILL', stillAllowed: () => boolean): Promise<void>
    observeProcess(sessionId: string): Promise<NativeProcessObservation | null>
    ensureClosedReceipt(sessionId: string): Promise<boolean>
  }
  revoke(sessionId: string): Promise<{ revoked: boolean; evidenceRef?: string }>
  finalizeTranscript(sessionId: string): Promise<{ committed: boolean; evidenceRef?: string }>
  /** Omit until a provider adapter can supply a verified quiescence receipt. */
  provider?: {
    observe(sessionId: string): Promise<{ quiescent: boolean; evidenceRef?: string }>
    /** Only managed Runs currently have the canonical durable command here. */
    requestStop?(sessionId: string, command: { commandId: string; reason: StopReason }, stillAllowed: () => boolean): Promise<void>
  }
  hostInstanceId: string
  bootId: string
  onState?(state: NativeStopState): void
  timeoutMs?: number
  samples?: number
  sampleIntervalMs?: number
  escalateAfterSample?: number
}
interface Attempt {
  sessionId: string
  expires: Promise<void>
  expire(): void
  expired: boolean
  deadline: number
  snapshot?: NativeStopSession
  target?: StopTarget
  managed?: boolean
}

/** null is absence of knowledge, not exit zero or a known failure. */
export function nativeExitOutcome(observed: NativeProcessObservation | null): StopOutcome | undefined {
  if (!observed || observed.rootExited !== true) return undefined
  if (observed.exitSignal != null && (!Number.isSafeInteger(observed.exitSignal) || observed.exitSignal < 0)) return undefined
  if (Number.isSafeInteger(observed.exitSignal) && observed.exitSignal! > 0) return 'failed_known'
  if (Number.isSafeInteger(observed.exitCode) && observed.exitCode! >= 0)
    return observed.exitCode === 0 ? 'completed' : 'failed_known'
  return undefined
}

export function createNativeStopRuntime(deps: NativeStopDeps) {
  const pending = new Map<string, Promise<NativeStopResult>>()
  const finishing = new Set<string>()
  const attempts = new Map<string, Attempt>()
  const number = (value: number | undefined, fallback: number, min: number, max: number) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value))) : fallback
  const timeout = number(deps.timeoutMs, 8_000, 1, 60_000)
  const key = (target: StopTarget) => `${target.runId}/${target.sessionId}/${target.taskId}`
  const notify = (state: NativeStopState) => { try { deps.onState?.(state) } catch { /* UI cannot alter Stop authority. */ } }
  const local = (a: Attempt): boolean => {
    if (performance.now() >= a.deadline) a.expire()
    if (a.expired || !a.snapshot) return false
    try {
      const current = deps.ptys.get(a.sessionId)
      return current?.sessionId === a.sessionId && current.startedAt === a.snapshot.startedAt &&
        current.optionId === a.snapshot.optionId && deps.localTask(a.sessionId) === (a.target?.taskId ?? null)
    } catch { /* An unreadable local identity refuses ownership; never infer a match. */ return false }
  }
  const check = (a: Attempt) => { if (a.expired) throw Error('stop_deadline'); if (!local(a)) throw Error('stop_identity_changed') }
  const bounded = async <T>(a: Attempt, operation: () => Promise<T>, requireLocal = true): Promise<T> => {
    if (performance.now() >= a.deadline) a.expire()
    if (a.expired) throw Error('stop_deadline')
    if (requireLocal) check(a)
    const value = await Promise.race([operation(), a.expires.then(() => { throw Error('stop_deadline') })])
    if (performance.now() >= a.deadline) a.expire()
    if (a.expired) throw Error('stop_deadline')
    if (requireLocal) check(a)
    return value
  }
  const attemptFor = (target: StopTarget): Attempt => {
    const a = attempts.get(key(target))
    if (!a) throw Error('stop_attempt_unavailable')
    check(a)
    return a
  }
  const pause = (a: Attempt, ms: number) => bounded(a, () => new Promise<void>(resolve => setTimeout(resolve, ms)))
  // Construct this once so lost RPC replies preserve the canonical command id.
  const managed = createManagedStop({
    db: { rpc: (name: string, args: Record<string, unknown>) => {
      const a = [...attempts.values()].find(candidate => candidate.target?.runId === args.p_run_id && candidate.sessionId === args.p_session_id)
      if (!a) return Promise.reject(Error('stop_attempt_unavailable'))
      return bounded(a, async () => await deps.db.rpc(name, args))
    } },
    estateId: deps.estateId, actor: deps.actor,
    // Preflight bounds authority before the coordinator is entered. The native
    // caller's explicit membership revision is still checked atomically by SQL.
    guard: async () => true,
    authority: deps.authority,
    owns: target => { const a = attempts.get(key(target)); return !!a && local(a) },
    halt: target => { const a = attemptFor(target); check(a); deps.ptys.haltInput(target.sessionId) },
    revoke: target => { const a = attemptFor(target); return bounded(a, () => deps.revoke(target.sessionId)) },
    requestProviderStop: deps.provider?.requestStop ? async (target, command, coordinatorAllowed) => {
      const a = attemptFor(target)
      await bounded(a, () => deps.provider!.requestStop!(target.sessionId, command, () => local(a) && coordinatorAllowed()))
    } : undefined,
    signal: async (target: StopTarget, signal: 'SIGTERM' | 'SIGKILL', coordinatorAllowed?: () => boolean) => {
      const a = attemptFor(target)
      await bounded(a, () => deps.ptys.signalProcess(target.sessionId, signal, () => local(a) && (coordinatorAllowed?.() ?? true)))
    },
    observe: async target => {
      const a = attemptFor(target)
      const observed = await bounded(a, () => deps.ptys.observeProcess(target.sessionId))
      const rootExited = observed?.rootExited === true
      // Do not wait for PTY onExit's complete callback: that callback can itself
      // be joining this Stop. Only the independent terminal.closed receipt is awaited.
      const closed = rootExited && await bounded(a, () => deps.ptys.ensureClosedReceipt(target.sessionId))
      const provider = deps.provider ? await bounded(a, () => deps.provider!.observe(target.sessionId)) : null
      const identity = observed?.processIdentity
      const supplied = typeof observed?.processIdentityRef === 'string' && /^process:[a-f0-9]{64}$/.test(observed.processIdentityRef) ? observed.processIdentityRef : undefined
      const processIdentityRef = supplied ?? (identity && Number.isSafeInteger(identity.pid) && identity.pid > 1 &&
        Number.isSafeInteger(identity.group) && identity.group > 1 && typeof identity.start === 'string' && identity.start
        ? `process:${createHash('sha256').update(JSON.stringify([deps.hostInstanceId, deps.bootId, target.sessionId, identity])).digest('hex')}` : undefined)
      return { rootExited: rootExited && closed, processTreeQuiescent: observed?.processTreeQuiescent === true,
        providerQuiescent: provider?.quiescent === true && !!provider.evidenceRef,
        hostInstanceId: deps.hostInstanceId, bootId: deps.bootId, processIdentityRef,
        providerObservationRef: provider?.evidenceRef, outcome: nativeExitOutcome(observed) }
    },
    commitTranscript: async target => {
      const a = attemptFor(target)
      if (!await bounded(a, () => deps.ptys.ensureClosedReceipt(target.sessionId))) return { committed: false }
      return bounded(a, () => deps.finalizeTranscript(target.sessionId))
    },
    wait: async ms => { await new Promise<void>(resolve => setTimeout(resolve, ms)) },
    samples: deps.samples, sampleIntervalMs: deps.sampleIntervalMs, escalateAfterSample: deps.escalateAfterSample,
    timeoutMs: timeout
  })

  async function unmanaged(a: Attempt, reason: StopReason, force: boolean): Promise<NativeStopResult> {
    const result = (state: NativeStopResult['state'], reasonCode: string): NativeStopResult =>
      ({ sessionId: a.sessionId, managed: false, state, reasonCode })
    const shell = a.snapshot?.optionId === 'shell'
    deps.ptys.haltInput(a.sessionId)
    let revoked = false
    try { const r = await bounded(a, () => deps.revoke(a.sessionId)); revoked = r.revoked === true && !!r.evidenceRef } catch { /* still request exit */ }
    try { await bounded(a, () => deps.ptys.signalProcess(a.sessionId, 'SIGTERM', () => local(a))) } catch { /* observe */ }
    const samples = number(deps.samples, 16, 1, 100)
    const escalation = number(deps.escalateAfterSample, Math.min(samples - 1, 8), 0, samples - 1)
    for (let i = 0; i < samples; i++) {
      check(a)
      const observed = await bounded(a, () => deps.ptys.observeProcess(a.sessionId))
      if (observed?.rootExited && observed.processTreeQuiescent) {
        if (!await bounded(a, () => deps.ptys.ensureClosedReceipt(a.sessionId))) return result('outcome_unknown', 'exit_receipt_unavailable')
        const transcript = await bounded(a, () => deps.finalizeTranscript(a.sessionId))
        if (reason === 'natural_exit' && !nativeExitOutcome(observed)) return result('outcome_unknown', 'exit_outcome_unavailable')
        // Free agent terminals remain stoppable, but physical exit does not
        // prove their daemon/remote work ended. No task/run receipt is minted.
        const provider = !shell && deps.provider ? await bounded(a, () => deps.provider!.observe(a.sessionId)) : null
        if (!shell && !(provider?.quiescent === true && provider.evidenceRef))
          return result('outcome_unknown', 'provider_termination_unproved')
        return revoked && transcript.committed && !!transcript.evidenceRef
          ? result('stopped', shell ? 'unmanaged_shell_observed' : 'unmanaged_agent_observed') : result('outcome_unknown', 'finalization_unproved')
      }
      if (force && i === escalation)
        try { await bounded(a, () => deps.ptys.signalProcess(a.sessionId, 'SIGKILL', () => local(a))) } catch { /* observe */ }
      if (i + 1 < samples) await pause(a, number(deps.sampleIntervalMs, 100, 0, 1_000))
    }
    return result('outcome_unknown', 'termination_unproved')
  }

  function stop(sessionId: string, reason: StopReason = 'operator_stop', options: { force?: boolean } = {}): Promise<NativeStopResult> {
    const prior = pending.get(sessionId)
    if (prior) return prior
    if (finishing.has(sessionId)) return Promise.resolve({ sessionId, state: 'outcome_unknown', reasonCode: 'stop_finalizing' })
    let expire!: () => void
    const a: Attempt = { sessionId, expires: new Promise<void>(resolve => { expire = resolve }), expired: false, deadline: performance.now() + timeout,
      expire: () => { a.expired = true; expire() } }
    const unknown = (reasonCode: string): NativeStopResult => ({ sessionId, ...a.target, ...(a.managed === undefined ? {} : { managed: a.managed }), state: 'outcome_unknown', reasonCode })
    const timer = setTimeout(a.expire, timeout)
    const execute = async (): Promise<NativeStopResult> => {
      try {
        const snapshot = deps.ptys.get(sessionId)
        if (!snapshot || snapshot.sessionId !== sessionId || !(typeof snapshot.startedAt === 'string' ? snapshot.startedAt.length > 0 : Number.isFinite(snapshot.startedAt)))
          return { sessionId, state: 'refused', reasonCode: 'not_local_session' }
        a.snapshot = { ...snapshot }
        // Freeze local input immediately on Stop; even an unreadable Run must
        // not let queued/manual writes continue while its authority is checked.
        deps.ptys.haltInput(sessionId)
        // No process signal until both the trusted lookup and exact local
        // session/task association agree. An unreadable lookup is never null.
        const target = await bounded(a, () => deps.lookup(sessionId), false)
        if (target) {
          a.managed = true
          if (typeof target.runId !== 'string' || !target.runId || typeof target.taskId !== 'string' || !target.taskId || target.sessionId !== sessionId || deps.localTask(sessionId) !== target.taskId)
            return { sessionId, state: 'refused', reasonCode: 'target_mismatch', managed: true }
          a.target = { ...target }
        } else if (deps.localTask(sessionId)) return unknown('run_lookup_missing')
        else a.managed = false
        if (!local(a)) return { sessionId, state: 'refused', reasonCode: 'local_ownership_changed' }
        if ((reason === 'operator_stop' || options.force === true) && !await bounded(a, () => deps.guard()))
          return { sessionId, ...a.target, state: 'refused', reasonCode: 'authority_changed', managed: !!a.target }
        check(a)
        if (!a.target) return await unmanaged(a, reason, options.force === true)
        attempts.set(key(a.target), a)
        return { ...await managed(a.target, reason, options), managed: true }
      } catch { /* The typed unknown receipt is the observable failure; dependency text may contain secrets. */ return unknown(a.expired ? 'stop_deadline' : 'stop_read_unavailable') }
    }
    finishing.add(sessionId)
    const execution = Promise.resolve().then(execute).finally(() => finishing.delete(sessionId))
    const promise = Promise.race([execution, a.expires.then(() => unknown('stop_deadline'))])
      .then(result => { notify(result); return result })
      .finally(() => {
        clearTimeout(timer); a.expire()
        if (a.target && attempts.get(key(a.target)) === a) attempts.delete(key(a.target))
        if (pending.get(sessionId) === promise) pending.delete(sessionId)
      })
    pending.set(sessionId, promise)
    // Synchronous state emission blocks dismissal before lookup's first await.
    notify({ sessionId, state: 'requested', reasonCode: 'stop_requested' })
    return promise
  }
  return { stop,
    /** Safe in a callback whose completion might be awaited by a process port. */
    onExit(sessionId: string): void { void stop(sessionId, 'natural_exit') },
    async shutdown(): Promise<NativeStopResult[]> { return Promise.all(deps.ptys.list().map(s => stop(s.sessionId, 'app_shutdown'))) }
  }
}
