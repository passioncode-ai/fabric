// #region board-dispatch-wiring — docs: docs/evidence/specs/2026-11-04-on-demand-sessions.md#35-the-start
/**
 * The dispatcher's real doors (CO-409 wave 1): the board through the operator's read door, the responders through
 * `board_status`, the project's folder from `project_repos`, Switchboard's `dispatch` and `sessions show` through its
 * CLI on the session PATH, Observatory through its stdio server, and a small file of what was started. Each call has a
 * deadline; a door that fails throws, and the dispatcher logs it and tries again on a later pass.
 */
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, writeSync } from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import type { CommsFactsReply, CommsInboxReply, CommsMessage, CommsRespondersReply, CommsTimelineReply } from '../shared/commsRead.ts'
import type { SweepComms } from './abandonedSweepRun.ts'
import { mandateOfRequest } from './boardMandate.ts'
import { INBOX_CAPABILITY, type DispatchAgent } from '../shared/boardDispatch.ts'
import { createBoardDispatch, isDispatchRecord, noteOf, type DispatchDeps, type InboxGiven, type DispatchRecord, type OpenRequest, type RemoteState, type ToOperatorWhy } from './boardDispatchRun.ts'
import { createObservatoryClient, findObservatoryServer } from './observatoryMemory.ts'
import { findOnPath, widenProbePath } from './executorDetect.ts'

const WINDOW_MS = 7 * 24 * 3600_000
const CLI_DEADLINE_MS = 60_000


/** Every request of the board's last week, with its thread, submission time and whether its attempt is alive. */
export async function readOpenRequests(comms: SweepComms, estateId: string, now: number): Promise<{ requests: OpenRequest[]; states: Map<string, string> }> {
  const threads: string[] = []
  let before: unknown = null
  for (let page = 0; page < 3; page++) {
    const r = await comms.threadPage(estateId, { kind: 'request', activeSince: new Date(now - WINDOW_MS).toISOString() }, before, 100)
    if (!r.ok) throw new Error('the board\'s threads could not be read')
    threads.push(...r.threads.map((t) => t.id))
    if (!r.more || !r.before) break
    before = r.before
  }
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
  return { requests, states }
}

// #region board-dispatch-inbox — docs: docs/evidence/specs/2026-11-04-on-demand-sessions.md#38-every-addressee-woken-and-watched-co-559
/**
 * CO-559 (§3.8): each Project's unread board messages of the last week as one inbox item, the newest message standing
 * for them all, its deadline that message's time plus the board's week. A read that fails throws, so an unread board is
 * never "nothing waits".
 */
export async function readInboxItems(comms: { inbox(estateId: string, since: string): Promise<CommsInboxReply> }, estateId: string, now: number): Promise<OpenRequest[]> {
  const r = await comms.inbox(estateId, new Date(now - WINDOW_MS).toISOString())
  if (!r.ok) throw new Error(`the board's inboxes could not be read: ${r.error.message}`)
  return r.projects.map((p): OpenRequest => ({
    id: p.newest.id, thread: p.newest.thread, state: 'queued', target: p.project, capability: INBOX_CAPABILITY,
    submittedAt: p.newest.at, deadline: new Date(Date.parse(p.newest.at) + WINDOW_MS).toISOString(),
    inbox: { unread: p.unread, oldestAt: p.oldestAt }
  }))
}
/**
 * CO-559 (§3.8): an inbox run's message as its project reads it now. `answered` once the project has nothing left
 * unread in a read that worked (a read mark or an answer in the thread, the inbox read's own rule), else from the
 * message's read marks, read once per pass; null while the inbox could not be read this pass.
 */
export function createInboxState(facts: (messageIds: string[]) => Promise<CommsFactsReply>): { reset(items: OpenRequest[] | null): void; state(messageId: string, projectId: string): Promise<string | null> } {
  let read = false
  let projects = new Set<string>()
  let marks = new Map<string, Promise<string[] | null>>()
  return {
    reset(items) {
      read = items !== null
      projects = new Set((items ?? []).map((i) => i.target))
      marks = new Map()
    },
    async state(messageId, projectId) {
      if (!read) return null
      if (!projects.has(projectId)) return 'answered'
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
const run = (file: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> => new Promise((resolve, reject) => {
  execFile(file, args, { env, timeout: CLI_DEADLINE_MS, maxBuffer: 4 * 1024 * 1024 }, (e, out, err) => {
    if (!e) return resolve(String(out))
    const code = String(err).match(REFUSAL_CODES)?.[1]
    reject(new Error(code ? `refused: ${code}` : e.killed ? 'no answer within the deadline' : `exited ${String((e as { code?: unknown }).code ?? 'with an error')}`))
  })
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
  return code?.kind === 'exited' && typeof code.exit_code === 'number' && code.exit_code !== 0 ? 'crashed' : 'ended'
}

// #region board-dispatch-remote-wiring — docs: docs/evidence/specs/2026-11-04-on-demand-sessions.md#37-a-run-on-another-machine-co-551-stage-a
/** `switchboard --json dispatch …` for one start; `--target <machine>` when the run goes to another machine (CO-551). */
export function dispatchArgs(a: { dir: string; workflow: string; handoff: string; request: string; dispatchId: string; timeoutMinutes: number; target?: string }): string[] {
  return ['--json', 'dispatch', '--dir', a.dir, '--workflow', a.workflow, '--handoff', a.handoff, '--request', a.request, '--dispatch-id', a.dispatchId,
    '--reason', 'request', '--permissions', 'all', '--timeout-minutes', String(a.timeoutMinutes), ...(a.target ? ['--target', a.target] : [])]
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
  remoteTarget?: () => string | null
  /** CO-551: the operator's board door for a Project, to post a run's answer as that Project. */
  board?: (projectId: string) => RelayBoard
  quitting: () => boolean
  file: string
  env: NodeJS.ProcessEnv
  log: DispatchDeps['log']
}): { onPass(): Promise<void>; close(): Promise<void>; toOperator(): Map<string, ToOperatorWhy>; inboxGiven(): InboxGiven[] } {
  let probePath: Promise<string> | null = null
  const pathFor = (): Promise<string> => (probePath ??= widenProbePath(o.env.PATH ?? '', o.env))
  const bin = async (name: string): Promise<string | null> => findOnPath(name, await pathFor())
  const envWith = async (): Promise<NodeJS.ProcessEnv> => ({ ...o.env, PATH: await pathFor() })
  const observatory = createObservatoryClient(async () => findObservatoryServer(await bin('project-observatory')))
  let lastStates = new Map<string, string>()
  /** CO-559: the inbox runs' messages, judged against this pass's inbox read. */
  const inboxState = createInboxState((ids) => o.comms.facts(o.estateId, ids))
  const follower = createRequestFollower(o.comms.timeline ? (id) => o.comms.timeline!(o.estateId, id) : undefined)
  // The responder slots, read once per pass: an unread board is never "nobody answers".
  let slots: Promise<CommsRespondersReply> | null = null

  const deps: DispatchDeps = {
    now: () => Date.now(),
    switchOn: o.switchOn,
    async readRequests() {
      const now = Date.now()
      const r = await readOpenRequests(o.comms, o.estateId, now)
      // CO-559 (§3.8): the inboxes after the requests. A failed inbox read is logged and leaves the requests and the
      // watch of running runs to go on (review: it ended the whole pass); its inbox runs are judged on a later pass.
      let inbox: OpenRequest[] | null = null
      if (o.comms.inbox) {
        try {
          inbox = await readInboxItems({ inbox: o.comms.inbox.bind(o.comms) }, o.estateId, now)
        } catch (e) {
          // Recorded through the dispatcher's own log, which writes to the ops log (`o.log`).
          o.log('board.dispatch.inbox', 'failed', { note: noteOf(e) })
        }
      }
      inboxState.reset(inbox)
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
    async folderOf(projectId) {
      const rows = await o.repos(projectId)
      const ordered = [...rows].sort((a, b) => Number(b.is_primary === true) - Number(a.is_primary === true))
      return ordered.map((x) => x.path).find((p) => typeof p === 'string' && path.isAbsolute(p) && existsSync(p)) ?? null
    },
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
        const out = JSON.parse(await run(sb, dispatchArgs(a), await envWith())) as { data?: { launch_id?: string; state?: string; reason?: string } }
        const d = out.data ?? {}
        if (d.state === 'refused' || !d.launch_id) return { refused: d.reason ?? 'refused' }
        return { launchId: d.launch_id }
      } catch (e) {
        // A refusal is the dispatcher's to record (board.dispatch.decided names its check).
        const code = e instanceof Error ? e.message.match(REFUSAL_CODES)?.[1] : undefined
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
        const out = JSON.parse(await run(sb, ['--json', 'sessions', 'show', launchId], await envWith())) as { data?: { launch?: { state?: string; ended?: unknown } } }
        return runStateOf(out.data?.launch)
      } catch {
        // Switchboard could not say: the run stays running and is asked again on the next pass.
        return 'unknown'
      }
    },
    remoteTarget: () => o.remoteTarget?.() ?? null,
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
    quitting: o.quitting
  }
  const dispatch = createBoardDispatch(deps)
  return {
    onPass: () => dispatch.onPass(),
    close: () => observatory.close(),
    toOperator: () => dispatch.toOperator(),
    inboxGiven: () => dispatch.inboxGiven()
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
