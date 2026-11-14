// #region board-dispatch-wiring — docs: docs/evidence/specs/2026-11-04-on-demand-sessions.md#35-the-start
/**
 * The dispatcher's real doors (CO-409 wave 1): the board through the operator's read door, the responders through
 * `board_status`, the project's folder from `project_repos`, Switchboard's `dispatch` and `sessions show` through its
 * CLI on the session PATH, Observatory through its stdio server, and a small file of what was started. Each call has a
 * deadline; a door that fails throws, and the dispatcher logs it and tries again on a later pass.
 */
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, writeSync } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { hostname, networkInterfaces } from 'node:os'
import type { CommsFactsReply, CommsInboxReply, CommsMessage, CommsRespondersReply, CommsTimelineReply } from '../shared/commsRead.ts'
import type { SweepComms } from './abandonedSweepRun.ts'
import { mandateOfRequest } from './boardMandate.ts'
import { readRequestThreadIds } from './boardThreadIds.ts'
import { INBOX_CAPABILITY, isSelfTarget, remoteOwnerOf, targetForOwner, type DispatchAgent } from '../shared/boardDispatch.ts'
import { createBoardDispatch, isDispatchRecord, noteOf, type DispatchDeps, type InboxGiven, type DispatchRecord, type OpenRequest, type RemoteState, type ToOperatorWhy } from './boardDispatchRun.ts'
import { createObservatoryClient, findObservatoryServer } from './observatoryMemory.ts'
import { findOnPath, widenProbePath } from './executorDetect.ts'
import { originOf } from './agentSyncLeases.ts'
import type { BoardRun } from './agentWork.ts'

const WINDOW_MS = 7 * 24 * 3600_000
const CLI_DEADLINE_MS = 60_000


/** Every request of the board's last week, with its thread, submission time and whether its attempt is alive. */
export async function readOpenRequests(comms: SweepComms, estateId: string, now: number): Promise<{ requests: OpenRequest[]; states: Map<string, string>; capped: boolean }> {
  // CO-572: the threads with an open request first, so the board's growth past one read never hides a waiting request.
  const { ids: threads, capped } = await readRequestThreadIds(comms, estateId, new Date(now - WINDOW_MS).toISOString())
  const messages: CommsMessage[] = []
  for (const thread of threads) {
    let after = 0
    for (let page = 0; page < 5; page++) {
      const r = await comms.list(estateId, thread, after, 100)
      if (!r.ok) throw new Error('the board\'s messages could not be read')
      messages.push(...r.messages)
      if (!r.more) break
      after = r.lastSeq
    }
  }
  const asked = messages.filter((m) => m.kind === 'request' && m.request)
  const states = new Map(asked.map((m) => [m.id, m.request!.state]))
  const attemptLive = new Map<string, boolean>()
  for (let i = 0; i < asked.length; i += 100) {
    const f = await comms.facts(estateId, asked.slice(i, i + 100).map((m) => m.id))
    if (!f.ok) throw new Error('the board\'s request facts could not be read')
    for (const [id, r] of Object.entries(f.requests)) attemptLive.set(id, r.attemptLive === true)
  }
  const requests = asked.filter((m) => m.request && m.request.deadline).map((m): OpenRequest => ({
    id: m.id, thread: m.thread, state: m.request!.state as OpenRequest['state'], target: m.request!.target,
    capability: m.request!.capability, submittedAt: m.at, deadline: m.request!.deadline as string,
    ...(attemptLive.has(m.id) ? { attemptLive: attemptLive.get(m.id) } : {}),
    ...((mandate) => (mandate ? { mandate } : {}))(mandateOfRequest(m, now))
  }))
  return { requests, states, capped }
}

// #region board-dispatch-inbox — docs: docs/evidence/specs/2026-11-04-on-demand-sessions.md#38-every-addressee-woken-and-watched-co-559
/**
 * CO-559 (§3.8): each Project's unread board messages of the last week as one inbox item, the newest message standing
 * for them all, its deadline that message's time plus the board's week. A read that fails throws, so an unread board is
 * never "nothing waits".
 */
export async function readInboxItems(comms: { inbox(estateId: string, since: string): Promise<CommsInboxReply> }, estateId: string, now: number): Promise<{ items: OpenRequest[]; more: boolean }> {
  const r = await comms.inbox(estateId, new Date(now - WINDOW_MS).toISOString())
  if (!r.ok) throw new Error(`the board's inboxes could not be read: ${r.error.message}`)
  return { more: r.more, items: r.projects.map((p): OpenRequest => ({
    id: p.newest.id, thread: p.newest.thread, state: 'queued', target: p.project, capability: INBOX_CAPABILITY,
    submittedAt: p.newest.at, deadline: new Date(Date.parse(p.newest.at) + WINDOW_MS).toISOString(),
    inbox: { unread: p.unread, oldestAt: p.oldestAt }
  })) }
}
/**
 * CO-559 (§3.8): an inbox run's message as its project reads it now. `answered` once the project has nothing left
 * unread in a read that worked (a read mark or an answer in the thread, the inbox read's own rule), else from the
 * message's read marks, read once per pass; null while the inbox could not be read this pass.
 */
export function createInboxState(facts: (messageIds: string[]) => Promise<CommsFactsReply>): { reset(items: OpenRequest[] | null, more?: boolean): void; state(messageId: string, projectId: string): Promise<string | null> } {
  let read = false
  let cut = false
  let projects = new Set<string>()
  let marks = new Map<string, Promise<string[] | null>>()
  return {
    reset(items, more = false) {
      read = items !== null
      cut = more
      projects = new Set((items ?? []).map((i) => i.target))
      marks = new Map()
    },
    async state(messageId, projectId) {
      if (!read) return null
      // 0.3.19 review PL-10: a read cut at its bound leaves projects out; one left out is never taken as answered, and
      // its message is judged by its own read marks (iteration 2, DA-7).
      if (!projects.has(projectId) && !cut) return 'answered'
      let by = marks.get(messageId)
      if (!by) {
        by = facts([messageId]).then((f) => (f.ok ? f.messages[messageId]?.readBy ?? [] : null), () => null)
        marks.set(messageId, by)
      }
      const who = await by
      return who === null ? null : who.includes(projectId) ? 'answered' : 'queued'
    }
  }
}
// #endregion board-dispatch-inbox

/** Switchboard's refusal codes, the only words of its stderr that are kept (the 0.3.16 review, iteration 2, DA-5: a
 *  failure's own text carries the command line and the project's folder, and never reaches the log). */
const REFUSAL_CODES = /\b(no_agent|not_in_group|ceiling_reached|spend_unknown|agent_not_installed|not_on_target|target_busy|target_unreachable)\b/
/** Most of a CLI's output kept (4 Mi characters, as execFile's `maxBuffer` was). */
const OUT_MAX = 4 * 1024 * 1024
/**
 * One Switchboard call. 2026-11-12 (H4): it runs in a process group of its own, and the deadline ends the whole group,
 * so an ssh Switchboard started for a run on another machine does not outlive it (a link that hangs used to leave one
 * ssh per attempt, every pass). Output past OUT_MAX ends the call as a failure, never a buffer that grows.
 */
export const run = (file: string, args: string[], env: NodeJS.ProcessEnv, deadlineMs = CLI_DEADLINE_MS): Promise<string> => new Promise((resolve, reject) => {
  const child = spawn(file, args, { env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  let out = '', err = '', over = false, killed = false, done = false
  const end = (sig: NodeJS.Signals): void => {
    try { if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, sig); else child.kill(sig) } catch { /* already gone */ }
  }
  const timer = setTimeout(() => { killed = true; end('SIGTERM'); setTimeout(() => end('SIGKILL'), 2_000).unref() }, deadlineMs)
  timer.unref()
  // 0.3.20 review, iteration 3, ER-22 and ER-25: decoded as one UTF-8 stream (a character split between two chunks stays
  // whole), and nothing more is kept once the output is past OUT_MAX.
  const take = (into: 'out' | 'err') => (b: string): void => {
    if (over) return
    if (into === 'out') out += b; else err += b.slice(0, 64 * 1024 - err.length)
    if (out.length > OUT_MAX) { over = true; out = ''; end('SIGTERM') }
  }
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', take('out'))
  child.stderr.on('data', take('err'))
  const finish = (e: Error | null, code: number | null): void => {
    if (done) return
    done = true
    clearTimeout(timer)
    if (!e && code === 0 && !over) return resolve(out)
    // CO-573 (2026-11-13): a program that could not be started at all (not on the PATH, not executable) says so by its
    // system code, never by its text; that is the one cause a dispatcher saw for 2.5 hours without being told it.
    if (e) return reject(new Error(`could not be started: ${(e as NodeJS.ErrnoException).code ?? 'error'}`))
    const refusal = err.match(REFUSAL_CODES)?.[1]
    reject(new Error(refusal ? `refused: ${refusal}` : killed ? 'no answer within the deadline' : over ? 'the answer was larger than the call takes' : `exited ${code ?? 'with an error'}`))
  }
  child.on('error', (e) => finish(e, null))
  child.on('close', (code) => finish(null, code))
})

/**
 * §3.6: the dispatcher follows a request it watches even when the request is outside the pass's read, through the
 * request's own journal transitions (the operator's door onto `com.get`'s facts), read once per pass. A page that holds
 * only the oldest transitions, or one that cannot be read, says nothing, and the run is judged as before (CO-409, DO-5).
 */
export function createRequestFollower(timeline?: (requestId: string) => Promise<CommsTimelineReply>): { reset(): void; state(requestId: string): Promise<string | null> } {
  let followed = new Map<string, Promise<string | null>>()
  return {
    reset: () => { followed = new Map() },
    state(requestId) {
      const known = followed.get(requestId)
      if (known) return known
      const read = (async (): Promise<string | null> => {
        if (!timeline) return null
        const t = await timeline(requestId)
        if (!t.ok || t.more || t.steps.length === 0) return null
        return t.steps[t.steps.length - 1].to
      })().catch(() => {
        // A read that throws says nothing about the request; the dispatcher's own margin decides (ER-3, CO-512).
        return null
      })
      followed.set(requestId, read)
      return read
    }
  }
}

/**
 * A dispatched run's state from Switchboard's launch record (its CONTRACTS, SB-247): `ended` is `{kind: exited | stopped
 * | timed_out, exit_code?, at}`, and an `exited` run with a failure exit code is `crashed`, so the workflow is taken back
 * as `crash` rather than `restart` (the on-demand spec §3.4).
 */
export function runStateOf(launch: { state?: string; ended?: unknown } | undefined): 'running' | 'ended' | 'crashed' | 'unknown' {
  const state = launch?.state
  if (state === 'starting' || state === 'running') return 'running'
  if (state !== 'ended') return 'unknown'
  const end = launch?.ended
  const code = end && typeof end === 'object' ? (end as { kind?: unknown; exit_code?: unknown }) : null
  // CO-573 (5): an exit with no code is one nobody reaped (a Switchboard restart lost the child, five in a day on
  // 2026-11-12): it is not known to be clean, so the next run takes the workflow back as `crash`, as for a failure code.
  return code?.kind === 'exited' && (typeof code.exit_code !== 'number' || code.exit_code !== 0) ? 'crashed' : 'ended'
}

/** The coding agent's own session id of a launch `sessions show` reports starting or running (2026-11-11): the home
 *  matches it to the Fabric session the run enrolled as (`main/agentWork.ts`). Anything else is null. */
export function launchSessionOf(launch: { state?: unknown; provider_session_id?: unknown } | undefined): string | null {
  if (launch?.state !== 'starting' && launch?.state !== 'running') return null
  return typeof launch.provider_session_id === 'string' && launch.provider_session_id ? launch.provider_session_id : null
}

/** The dispatcher's runs on this machine that Switchboard last reported running, each with the session it runs in
 *  (`seen`, by launch id) and when it was seen: the home's work signal for a run that ends no turn while it works. */
export function boardRunsOf(records: ReadonlyArray<Pick<DispatchRecord, 'requestId' | 'launchId' | 'state' | 'startedAt' | 'launchedAt' | 'inbox' | 'target'>>,
  seen: ReadonlyMap<string, { runtimeSessionId: string; at: number }>): BoardRun[] {
  const out: BoardRun[] = []
  for (const r of records) {
    const s = r.state === 'running' && r.launchId && !r.target ? seen.get(r.launchId) : undefined
    if (!s) continue
    out.push({ runtimeSessionId: s.runtimeSessionId, requestId: r.requestId, inbox: !!r.inbox, since: new Date(r.launchedAt ?? r.startedAt).toISOString(), seenAt: new Date(s.at).toISOString() })
  }
  return out
}

/** A project's folder on this computer: its primary repository first, the first that exists. */
export async function primaryFolder(repos: (projectId: string) => Promise<Array<{ path: string; is_primary: boolean | null }>>, projectId: string): Promise<string | null> {
  const rows = await repos(projectId)
  const ordered = [...rows].sort((a, b) => Number(b.is_primary === true) - Number(a.is_primary === true))
  return ordered.map((x) => x.path).find((p) => typeof p === 'string' && path.isAbsolute(p) && existsSync(p)) ?? null
}

/**
 * The machine a project's request run goes to (2026-11-11, the Mac Studio's spaces): the owner of its primary folder's
 * `origin` in `targets`, else `fallback`. With no owner map the folder is not read at all; a folder whose remote cannot
 * be read (no git, no origin, past the 3 s of `agentSyncLeases.ts#originOf`, which ignores an inherited `GIT_DIR`)
 * takes the fallback.
 */
export async function remoteTargetFor(folder: string | null, targets: Record<string, string>, fallback: string | null,
  git: (dir: string) => Promise<string | null> = originOf): Promise<string | null> {
  if (!folder || Object.keys(targets).length === 0) return fallback
  const url = (await git(folder).catch(() => null)) ?? ''
  return targetForOwner(remoteOwnerOf(url), targets, fallback)
}

/** At most this much of a thread goes into a remote run's packet: Observatory refuses a checkpoint's `notes` past 4000
 *  characters (0.3.20 review ER-9, DA-10: a longer one never opened, here or there). */
export const THREAD_TEXT_MAX = 3900
/** The request's own text is cut here, so the newest messages of its thread still fit beside it. */
export const REQUEST_TEXT_MAX = 3000
/** How many pages of 100 the thread is read through for its newest messages (the request may be past the first). */
const THREAD_TEXT_PAGES = 10

/**
 * A request and its thread as plain text for a run on another machine (2026-11-11: the first live run on the Mac Studio
 * had no board and only the request's id). Read through the operator's read door, up to `THREAD_TEXT_PAGES` pages
 * oldest first; the request comes first, cut to `REQUEST_TEXT_MAX`, then the thread's other messages newest first while
 * they fit in `THREAD_TEXT_MAX`. Projects are named in the reference form, which Observatory keeps (it removes a bare
 * UUID from text). Null when the thread cannot be read.
 */
export async function requestThreadText(comms: Pick<SweepComms, 'list'>, estateId: string, req: { id: string; thread: string }): Promise<string | null> {
  const messages: CommsMessage[] = []
  let after = 0
  let more = false
  for (let page = 0; page < THREAD_TEXT_PAGES; page++) {
    const r = await comms.list(estateId, req.thread, after, 100)
    if (!r.ok) return null
    messages.push(...r.messages)
    more = r.more
    if (!r.more) break
    after = r.lastSeq
  }
  const text = (m: CommsMessage) => m.redacted || !m.body ? '(its text was removed)' : m.body.text
  const head = (m: CommsMessage) => `[${m.at}] ${m.kind}${m.id === req.id ? ' (the request)' : ''} from fabric-project:${m.sender.project}:`
  const request = messages.find((m) => m.id === req.id)
  let out = 'The request, then the other messages of its thread, newest first.\n\n'
  if (request) {
    const body = text(request)
    out += `${head(request)}\n${body.length > REQUEST_TEXT_MAX ? `${body.slice(0, REQUEST_TEXT_MAX)}\n(cut: the request is longer)` : body}`
  } else out += `(the request board-request:${req.id} was not among the ${messages.length} messages read)`
  const others = messages.filter((m) => m.id !== req.id).reverse()
  let left = 0
  for (const m of others) {
    const next = `${out}\n\n${head(m)}\n${text(m)}`
    if (next.length > THREAD_TEXT_MAX - 80) { left = others.length - others.indexOf(m); break }
    out = next
  }
  if (left || more) out += `\n\n(${left ? `${left} older message${left === 1 ? '' : 's'} left out` : ''}${left && more ? '; ' : ''}${more ? 'the thread is longer than was read' : ''})`
  return out.length > THREAD_TEXT_MAX ? out.slice(0, THREAD_TEXT_MAX) : out
}

// #region board-dispatch-remote-wiring — docs: docs/evidence/specs/2026-11-04-on-demand-sessions.md#37-a-run-on-another-machine-co-551-stage-a
/** `switchboard --json dispatch …` for one start; `--target <machine>` when the run goes to another machine (CO-551);
 *  `--reason inbox` for an inbox run when the installed Switchboard takes it (`takesInbox`, CO-559), else `request`. */
export function dispatchArgs(a: { dir: string; workflow: string; handoff: string; request: string; dispatchId: string; timeoutMinutes: number; target?: string; reason?: 'request' | 'inbox' }, takesInbox = false): string[] {
  const reason = a.reason === 'inbox' && takesInbox && !a.target ? 'inbox' : 'request'
  return ['--json', 'dispatch', '--dir', a.dir, '--workflow', a.workflow, '--handoff', a.handoff, '--request', a.request, '--dispatch-id', a.dispatchId,
    '--reason', reason, '--permissions', 'all', '--timeout-minutes', String(a.timeoutMinutes), ...(a.target ? ['--target', a.target] : [])]
}

/** The first Switchboard whose `dispatch` takes `--reason inbox` and its inbox exit contract (SB-338). */
export const INBOX_REASON_SINCE = [0, 7, 56] as const
/** Whether `switchboard --version`'s answer ("switchboard 0.7.56") names a version that takes `--reason inbox`. An
 *  answer that names no version is no: an older Switchboard would refuse the argument and start nothing. */
export function takesInboxReason(versionText: string): boolean {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(versionText)
  if (!m) return false
  const v = [Number(m[1]), Number(m[2]), Number(m[3])]
  for (let i = 0; i < 3; i++) if (v[i] !== INBOX_REASON_SINCE[i]) return v[i] > INBOX_REASON_SINCE[i]
  return true
}

const REMOTE_STATES: ReadonlySet<string> = new Set(['running', 'exited', 'stopped', 'timed_out', 'lost', 'unknown'])
/** `switchboard --json dispatch status --launch-id <id>` read field by field (0.7.40: `{launch_id, target, state,
 *  exit_code, result, worktree}`). A state this build does not know, or no data, is `unknown`, which ends nothing. */
export function remoteStateOf(out: unknown): RemoteState {
  const d = out && typeof out === 'object' ? (out as { data?: unknown }).data : undefined
  const x = d && typeof d === 'object' ? d as { state?: unknown; exit_code?: unknown; result?: unknown } : {}
  if (typeof x.state !== 'string' || !REMOTE_STATES.has(x.state)) return { state: 'unknown', exitCode: null, result: null }
  return { state: x.state as RemoteState['state'], exitCode: typeof x.exit_code === 'number' ? x.exit_code : null, result: typeof x.result === 'string' ? x.result : null }
}

/** The operator's board door for one Project (`AgentSurface#operatorBoard`), the two calls a relay needs. */
export interface RelayBoard { epoch(): Promise<number | null>; reply(input: unknown): Promise<Record<string, unknown>> }

/** CO-551: the run's answer as the target project's reply to the request (DEC-0098: a reply from the request's target
 *  answers it), under an idempotency key, so a retry answers the message already stored. Refusals as codes only. */
export async function relayReply(board: RelayBoard, requestId: string, text: string, key: string): Promise<{ posted: true } | { refused: string }> {
  try {
    const epoch = await board.epoch()
    if (epoch === null) return { refused: 'no-epoch' }
    const said = await board.reply({ idempotency: { epoch, key }, replyTo: requestId, body: { format: 'text/markdown', text } })
    const e = said.error as { code?: unknown } | undefined
    return e ? { refused: typeof e.code === 'string' ? e.code : 'refused' } : { posted: true }
  } catch {
    // The board door threw: the dispatcher counts it as a refusal and asks again with the same key on the next pass.
    return { refused: 'failed' }
  }
}
// #endregion board-dispatch-remote-wiring

export function wireBoardDispatch(o: {
  estateId: string
  comms: SweepComms & { responders(estateId: string): Promise<CommsRespondersReply>; timeline?(estateId: string, requestId: unknown): Promise<CommsTimelineReply>; inbox?(estateId: string, since: string): Promise<CommsInboxReply> }
  repos: (projectId: string) => Promise<Array<{ path: string; is_primary: boolean | null }>>
  sessionLive: (projectId: string) => boolean
  switchOn: () => boolean
  /** CO-551: the machine Settings names for runs (`dispatchTarget`), or null. */
  remoteTarget?: (projectId: string) => string | null | Promise<string | null>
  /** CO-551: the operator's board door for a Project, to post a run's answer as that Project. */
  board?: (projectId: string) => RelayBoard
  quitting: () => boolean
  file: string
  env: NodeJS.ProcessEnv
  log: DispatchDeps['log']
  /** 2026-11-12 (C2): how long this machine slept since a time (ms); absent, none. */
  suspendedSince?: (from: number) => number
}): { onPass(): Promise<void>; close(): Promise<void>; toOperator(): Map<string, ToOperatorWhy>; inboxGiven(): InboxGiven[]; boardRuns(): BoardRun[] } {
  let probePath: Promise<string> | null = null
  const pathFor = (): Promise<string> => (probePath ??= widenProbePath(o.env.PATH ?? '', o.env))
  const bin = async (name: string): Promise<string | null> => findOnPath(name, await pathFor())
  const envWith = async (): Promise<NodeJS.ProcessEnv> => ({ ...o.env, PATH: await pathFor() })
  const observatory = createObservatoryClient(async () => findObservatoryServer(await bin('project-observatory')))
  let lastStates = new Map<string, string>()
  /** CO-559: the inbox runs' messages, judged against this pass's inbox read. */
  const inboxState = createInboxState((ids) => o.comms.facts(o.estateId, ids))
  const follower = createRequestFollower(o.comms.timeline ? (id) => o.comms.timeline!(o.estateId, id) : undefined)
  /** Switchboard's `--version`, kept an hour; one that cannot be read is asked again on the next start. */
  let version: { text: string; at: number } | null = null
  const versionOf = async (sb: string): Promise<string> => {
    if (version && Date.now() - version.at < 3600_000) return version.text
    const text = await run(sb, ['--version'], await envWith(), 10_000).catch(() => '')
    if (text) version = { text, at: Date.now() }
    return text
  }
  /** This machine's names and addresses (its Tailscale address too), against which a target is compared. */
  const ownNames = (): string[] => [hostname(), ...Object.values(networkInterfaces()).flat().map((a) => a?.address ?? '').filter(Boolean)]
  /** Whether an ssh host names this machine, by `ssh -G` (read locally, no connection), kept per host for the process. */
  const selfKnown = new Map<string, Promise<boolean>>()
  const selfTarget = (t: string): Promise<boolean> => {
    let known = selfKnown.get(t)
    if (!known) {
      known = run('ssh', ['-G', t], o.env, 5_000)
        .then((out) => isSelfTarget(t, out.match(/^hostname\s+(\S+)$/m)?.[1] ?? null, ownNames()), () => isSelfTarget(t, null, ownNames()))
      if (selfKnown.size < 64) selfKnown.set(t, known)
    }
    return known
  }
  /** Each running launch's coding-agent session id, as `sessions show` last said it (2026-11-11, `boardRunsOf`). */
  const seen = new Map<string, { runtimeSessionId: string; at: number }>()
  // The responder slots, read once per pass: an unread board is never "nobody answers".
  let slots: Promise<CommsRespondersReply> | null = null
  /** The last cause a start failed with, logged once per change (CO-573). */
  let lastLaunchFailure: string | null = null
  /** Whether the last pass's thread read stopped at its bound (CO-572). */
  let threadsCapped = false

  const deps: DispatchDeps = {
    now: () => Date.now(),
    switchOn: o.switchOn,
    async readRequests() {
      const now = Date.now()
      const r = await readOpenRequests(o.comms, o.estateId, now)
      // Said once per change, never every 30 s: a capped read leaves the oldest threads unread (CO-572).
      if (r.capped !== threadsCapped) { threadsCapped = r.capped; o.log('board.dispatch.threads', r.capped ? 'failed' : 'ok', { capped: r.capped, note: r.capped ? 'more threads with an open request than one pass reads; a waiting request may be left out' : 'every thread with an open request read' }) }
      // CO-559 (§3.8): the inboxes after the requests. A failed inbox read is logged and leaves the requests and the
      // watch of running runs to go on (review: it ended the whole pass); its inbox runs are judged on a later pass.
      let inbox: OpenRequest[] | null = null
      let more = false
      if (o.comms.inbox) {
        try {
          ;({ items: inbox, more } = await readInboxItems({ inbox: o.comms.inbox.bind(o.comms) }, o.estateId, now))
        } catch (e) {
          // Recorded through the dispatcher's own log, which writes to the ops log (`o.log`).
          o.log('board.dispatch.inbox', 'failed', { note: noteOf(e) })
        }
      }
      inboxState.reset(inbox, more)
      lastStates = r.states
      for (const i of inbox ?? []) lastStates.set(i.id, 'queued')
      follower.reset()
      slots = null
      return [...r.requests, ...(inbox ?? [])]
    },
    async responderLive(projectId, capability) {
      const r = await (slots ??= o.comms.responders(o.estateId))
      if (!r.ok) throw new Error(`the board's responders could not be read: ${r.error.message}`)
      const now = Date.now()
      return r.responders.some((x) => x.project === projectId && x.capability === capability && x.state === 'active' && x.held !== true
        && (!x.leaseExpiresAt || Date.parse(x.leaseExpiresAt) > now))
    },
    sessionLive: o.sessionLive,
    folderOf: (projectId) => primaryFolder(o.repos, projectId),
    async defaultProvider() {
      const sb = await bin('switchboard')
      if (!sb) return null
      const out = JSON.parse(await run(sb, ['--json', 'agents', 'status'], await envWith())) as { data?: { default?: string | null; dispatch_agent?: string | null } }
      return dispatchProvider(out.data)
    },
    observatory: (name, args) => observatory.call(name, args),
    async launch(a) {
      const sb = await bin('switchboard')
      if (!sb) return { refused: 'switchboard_absent' }
      try {
        // CO-559: the version is read for an inbox run only; a version that cannot be read keeps `request`. 2026-11-12 (H3):
        // read once an hour, not before every inbox start.
        const takesInbox = a.reason === 'inbox' ? takesInboxReason(await versionOf(sb)) : false
        const out = JSON.parse(await run(sb, dispatchArgs(a, takesInbox), await envWith())) as { data?: { launch_id?: string; state?: string; reason?: string } }
        const d = out.data ?? {}
        if (d.state === 'refused' || !d.launch_id) return { refused: d.reason ?? 'refused' }
        lastLaunchFailure = null
        return { launchId: d.launch_id }
      } catch (e) {
        // A refusal is the dispatcher's to record (board.dispatch.decided names its check).
        const code = e instanceof Error ? e.message.match(REFUSAL_CODES)?.[1] : undefined
        // CO-573 (2026-11-13): a start Switchboard did not answer was logged only as `unknown`, so 2.5 hours of failed
        // starts after a restart left no cause. The cause is logged once each time it changes, never every pass.
        if (!code) {
          const note = noteOf(e)
          if (note !== lastLaunchFailure) { lastLaunchFailure = note; o.log('board.dispatch.launch', 'failed', { note }) }
        }
        return { refused: code ?? 'failed' }
      }
    },
    async stop(launchId) {
      const sb = await bin('switchboard')
      if (!sb) return 'failed'
      try {
        const out = JSON.parse(await run(sb, ['--json', 'dispatch', 'stop', '--launch-id', launchId], await envWith())) as { data?: { state?: string; result?: string } }
        const said = out.data?.state ?? out.data?.result
        return said === 'stopped' ? 'stopped' : said === 'already_ended' ? 'already-ended' : 'failed'
      } catch {
        // Switchboard did not answer: the dispatcher asks again on its next pass and says so in the operations log.
        return 'failed'
      }
    },
    async runState(launchId) {
      const sb = await bin('switchboard')
      if (!sb) return 'unknown'
      try {
        const out = JSON.parse(await run(sb, ['--json', 'sessions', 'show', launchId], await envWith())) as { data?: { launch?: { state?: string; ended?: unknown; provider_session_id?: unknown } } }
        // 2026-11-11: the session the run works in, for the home's «В работе» (`boardRunsOf`).
        const session = launchSessionOf(out.data?.launch)
        if (session) seen.set(launchId, { runtimeSessionId: session, at: Date.now() })
        else seen.delete(launchId)
        return runStateOf(out.data?.launch)
      } catch {
        // Switchboard could not say: the run stays running and is asked again on the next pass.
        return 'unknown'
      }
    },
    // 2026-11-12: a target that is this machine runs here, as a run here (settings copied from another machine).
    remoteTarget: async (projectId) => {
      const t = await (o.remoteTarget?.(projectId) ?? null)
      if (!t) return null
      if (await selfTarget(t)) { o.log('board.dispatch.self-target', 'ok', { note: 'the named machine is this one; the run starts here' }); return null }
      return t
    },
    requestThread: (req) => requestThreadText(o.comms, o.estateId, req),
    async remoteState(launchId) {
      const sb = await bin('switchboard')
      if (!sb) return { state: 'unknown', exitCode: null, result: null }
      try {
        return remoteStateOf(JSON.parse(await run(sb, ['--json', 'dispatch', 'status', '--launch-id', launchId], await envWith())))
      } catch {
        // Switchboard could not say: `unknown`, which ends nothing; asked again on the next pass (CO-551, `e6f33c33`).
        return { state: 'unknown', exitCode: null, result: null }
      }
    },
    relay: async (projectId, requestId, text, key) => (o.board ? relayReply(o.board(projectId), requestId, text, key) : { refused: 'no-door' }),
    async requestState(requestId) { return lastStates.get(requestId) ?? follower.state(requestId) },
    // CO-559 (§3.8): an inbox run's message as its project reads it now (`createInboxState`).
    inboxState: (messageId, projectId) => inboxState.state(messageId, projectId),
    load() {
      let text: string
      try { text = readFileSync(o.file, 'utf8') } catch {
        // No file yet (first run): nothing was started that this process can watch.
        return []
      }
      try {
        const parsed: unknown = JSON.parse(text)
        if (Array.isArray(parsed)) {
          // ER-8: record by record; each one in another shape is left out and counted, never half-read.
          const kept = parsed.filter(isDispatchRecord)
          if (kept.length < parsed.length) o.log('board.dispatch.records-unread', 'failed', { note: 'records in board-dispatches.json that are not records were left out', left_out: parsed.length - kept.length })
          return kept
        }
      } catch {
        // A torn file is said below and read as empty (the 0.3.16 review, iteration 2, DA-4).
      }
      o.log('board.dispatch.records-unread', 'failed', { note: 'board-dispatches.json is not a list of records; it is read as empty and rewritten at the next save' })
      return []
    },
    save(records) {
      // Written whole, synced, then renamed over the old file: a crash leaves the old or the new, never a torn one.
      const tmp = `${o.file}.tmp`
      const fd = openSync(tmp, 'w', 0o600)
      try { writeSync(fd, JSON.stringify(records)); fsyncSync(fd) } finally { closeSync(fd) }
      renameSync(tmp, o.file)
    },
    log: o.log,
    quitting: o.quitting,
    ...(o.suspendedSince ? { suspendedSince: o.suspendedSince } : {})
  }
  const dispatch = createBoardDispatch(deps)
  /** A launch no longer running forgets its session (2026-11-12: after every pass, not only when the home asks). */
  const forget = (): void => {
    const running = new Set(dispatch.records().filter((r) => r.state === 'running' && r.launchId).map((r) => r.launchId as string))
    for (const id of [...seen.keys()]) if (!running.has(id)) seen.delete(id)
  }
  return {
    onPass: async () => { try { await dispatch.onPass() } finally { forget() } },
    close: () => observatory.close(),
    toOperator: () => dispatch.toOperator(),
    inboxGiven: () => dispatch.inboxGiven(),
    boardRuns: () => {
      forget()
      return boardRunsOf(dispatch.records(), seen)
    }
  }
}

/**
 * The provider a hand-over is offered to: the agent `switchboard dispatch` will start. Switchboard's SB-294 (board
 * thread `327c7290`, 2026-11-07) names it as `data.dispatch_agent`, Claude Code when no default is set; a Switchboard
 * without the field keeps the old rule, its default agent only (CO-409, the on-demand spec §3.5). CO-556: the agent
 * id itself, because Switchboard's dispatch prompt has the session accept as `executor.provider` = that id, and
 * Observatory refuses an accept whose provider is not the offer's (observed on 0.3.18 rc.2, 2026-11-10).
 */
export function dispatchProvider(data: { default?: string | null; dispatch_agent?: string | null } | undefined): DispatchAgent | null {
  const agent = data && 'dispatch_agent' in data ? data.dispatch_agent ?? null : data?.default ?? null
  return agent === 'claude-code' || agent === 'codex' ? agent : null
}
// #endregion board-dispatch-wiring
