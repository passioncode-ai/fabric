// #region board-dispatch-wiring — docs: docs/evidence/specs/2026-11-04-on-demand-sessions.md#35-the-start
/**
 * The dispatcher's real doors (CO-409 wave 1): the board through the operator's read door, the responders through
 * `board_status`, the project's folder from `project_repos`, Switchboard's `dispatch` and `sessions show` through its
 * CLI on the session PATH, Observatory through its stdio server, and a small file of what was started. Each call has a
 * deadline; a door that fails throws, and the dispatcher logs it and tries again on a later pass.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import type { CommsMessage, CommsRespondersReply } from '../shared/commsRead.ts'
import type { SweepComms } from './abandonedSweepRun.ts'
import { createBoardDispatch, type DispatchDeps, type DispatchRecord, type OpenRequest } from './boardDispatchRun.ts'
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

const run = (file: string, args: string[], env: NodeJS.ProcessEnv): Promise<string> => new Promise((resolve, reject) => {
  execFile(file, args, { env, timeout: CLI_DEADLINE_MS, maxBuffer: 4 * 1024 * 1024 }, (e, out, err) => {
    if (e) reject(new Error(String(err || e.message).slice(0, 300)))
    else resolve(String(out))
  })
})

export function wireBoardDispatch(o: {
  estateId: string
  comms: SweepComms & { responders(estateId: string): Promise<CommsRespondersReply> }
  repos: (projectId: string) => Promise<Array<{ path: string; is_primary: boolean | null }>>
  sessionLive: (projectId: string) => boolean
  switchOn: () => boolean
  file: string
  env: NodeJS.ProcessEnv
  log: DispatchDeps['log']
}): { onPass(): Promise<void>; close(): Promise<void> } {
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
      const out = JSON.parse(await run(sb, ['--json', 'agents', 'status'], await envWith())) as { data?: { default?: string | null } }
      const agent = out.data?.default ?? null
      return agent === 'claude-code' ? 'claude' : agent === 'codex' ? 'codex' : null
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
        const code = e instanceof Error ? e.message.match(/no_agent|not_in_group|ceiling_reached|spend_unknown|agent_not_installed/)?.[0] : undefined
        return { refused: code ?? 'failed' }
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
      try { return JSON.parse(readFileSync(o.file, 'utf8')) as DispatchRecord[] } catch {
        // No file yet (first run) or a torn one: nothing was started that this process can watch.
        return []
      }
    },
    save(records) {
      const tmp = `${o.file}.tmp`
      writeFileSync(tmp, JSON.stringify(records), { mode: 0o600 })
      renameSync(tmp, o.file)
    },
    log: o.log
  }
  const dispatch = createBoardDispatch(deps)
  return {
    onPass: () => dispatch.onPass(),
    close: () => observatory.close()
  }
}
// #endregion board-dispatch-wiring
