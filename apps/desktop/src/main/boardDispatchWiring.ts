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
import type { CommsMessage, CommsRespondersReply } from '../shared/commsRead.ts'
import type { SweepComms } from './abandonedSweepRun.ts'
import { createBoardDispatch, isDispatchRecord, type DispatchDeps, type DispatchRecord, type OpenRequest, type ToOperatorWhy } from './boardDispatchRun.ts'
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
    ...(attemptLive.has(m.id) ? { attemptLive: attemptLive.get(m.id) } : {})
  }))
  return { requests, states }
}

/** Switchboard's refusal codes, the only words of its stderr that are kept (the 0.3.16 review, iteration 2, DA-5: a
 *  failure's own text carries the command line and the project's folder, and never reaches the log). */
const REFUSAL_CODES = /\b(no_agent|not_in_group|ceiling_reached|spend_unknown|agent_not_installed)\b/
const run = (file: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> => new Promise((resolve, reject) => {
  execFile(file, args, { env, timeout: CLI_DEADLINE_MS, maxBuffer: 4 * 1024 * 1024 }, (e, out, err) => {
    if (!e) return resolve(String(out))
    const code = String(err).match(REFUSAL_CODES)?.[1]
    reject(new Error(code ? `refused: ${code}` : e.killed ? 'no answer within the deadline' : `exited ${String((e as { code?: unknown }).code ?? 'with an error')}`))
  })
})

export function wireBoardDispatch(o: {
  estateId: string
  comms: SweepComms & { responders(estateId: string): Promise<CommsRespondersReply> }
  repos: (projectId: string) => Promise<Array<{ path: string; is_primary: boolean | null }>>
  sessionLive: (projectId: string) => boolean
  switchOn: () => boolean
  quitting: () => boolean
  file: string
  env: NodeJS.ProcessEnv
  log: DispatchDeps['log']
}): { onPass(): Promise<void>; close(): Promise<void>; toOperator(): Map<string, ToOperatorWhy> } {
  let probePath: Promise<string> | null = null
  const pathFor = (): Promise<string> => (probePath ??= widenProbePath(o.env.PATH ?? '', o.env))
  const bin = async (name: string): Promise<string | null> => findOnPath(name, await pathFor())
  const envWith = async (): Promise<NodeJS.ProcessEnv> => ({ ...o.env, PATH: await pathFor() })
  const observatory = createObservatoryClient(async () => findObservatoryServer(await bin('project-observatory')))
  let lastStates = new Map<string, string>()
  // The responder slots, read once per pass: an unread board is never "nobody answers".
  let slots: Promise<CommsRespondersReply> | null = null

  const deps: DispatchDeps = {
    now: () => Date.now(),
    switchOn: o.switchOn,
    async readRequests() {
      const r = await readOpenRequests(o.comms, o.estateId, Date.now())
      lastStates = r.states
      slots = null
      return r.requests
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
        const out = JSON.parse(await run(sb, ['--json', 'dispatch', '--dir', a.dir, '--workflow', a.workflow, '--handoff', a.handoff,
          '--request', a.request, '--dispatch-id', a.dispatchId, '--reason', 'request', '--permissions', 'all',
          '--timeout-minutes', String(a.timeoutMinutes)], await envWith())) as { data?: { launch_id?: string; state?: string; reason?: string } }
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
        const out = JSON.parse(await run(sb, ['--json', 'sessions', 'show', launchId], await envWith())) as { data?: { launch?: { state?: string } } }
        const state = out.data?.launch?.state
        return state === 'ended' ? 'ended' : state === 'starting' || state === 'running' ? 'running' : 'unknown'
      } catch {
        // Switchboard could not say: the run stays running and is asked again on the next pass.
        return 'unknown'
      }
    },
    async requestState(requestId) { return lastStates.get(requestId) ?? null },
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
    toOperator: () => dispatch.toOperator()
  }
}

/**
 * The provider a hand-over is offered to: the agent `switchboard dispatch` will start. Switchboard's SB-294 (board
 * thread `327c7290`, 2026-11-07) names it as `data.dispatch_agent`, Claude Code when no default is set; a Switchboard
 * without the field keeps the old rule, its default agent only (CO-409, the on-demand spec §3.5).
 */
export function dispatchProvider(data: { default?: string | null; dispatch_agent?: string | null } | undefined): 'claude' | 'codex' | null {
  const agent = data && 'dispatch_agent' in data ? data.dispatch_agent ?? null : data?.default ?? null
  return agent === 'claude-code' ? 'claude' : agent === 'codex' ? 'codex' : null
}
// #endregion board-dispatch-wiring
