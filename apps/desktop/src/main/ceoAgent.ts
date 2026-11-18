// #region ceo-agent — docs: docs/adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md#decision
/**
 * The CEO agent (ADR-0197, board task a125cc0e): one console Fabric keeps on this computer, in a folder of its own
 * (`<userData>/ceo`, with its brief as CLAUDE.md and AGENTS.md and an `inbox/` for attachments), in a project of its own
 * so it runs like every other console (its bundle, its surface, its journal). It starts on first use and keeps
 * running; «Перезапустить CEO» stops it and starts it again.
 *
 * THE FALLBACK IS FABRIC'S (the operator, 2026-11-18: mandatory). The console walks the CEO's own order (Claude Code,
 * then Hermes on OpenRouter, then the rest; `shared/ceoAgent.ts#CEO_RUNNERS_DEFAULT`, settings `ceoRunners`): a runner
 * that is not installed, is signed out or could not be spawned is passed over (ADR-0125's walk). A runner that started
 * and then reports a usage limit, or ends within its first 20 seconds, is set aside for an hour and the next one is
 * started, the person's last message typed again. Which runner answers is in the status the popup's head shows.
 */
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { TerminalSession } from '../shared/types.ts'
import type { Walk } from '../shared/runnerRoute.ts'
import { ceoBoardNudge, ceoBrief, ceoLine, inboxName, type CeoAttachment, type CeoBoardRequest, type CeoState, type CeoStatus } from '../shared/ceoAgent.ts'
export type { CeoAttachment, CeoState, CeoStatus }
import { openWithFallback } from './runnerFallback.ts'
import type { LaunchRoute } from './pty.ts'
import type { DeliveryWriteResult } from './deliveryQueue.ts'

export interface CeoAgentDeps {
  /** `<userData>/ceo`. */
  root: string
  locale(): string
  /** The CEO's project, created when it is not there (a project is what a console runs in). */
  ensureProject(folder: string, knownId: string | null): Promise<string>
  /** The order to walk, already cleaned (`ceoRunnersOf`). */
  runners(): string[]
  /** The CEO's models, best first, none below the floor (`ceoModelsOf`); the host gives each runner its share. */
  models(): string[]
  /** ADR-0125's walk over `order`, measuring this machine. */
  walk(projectId: string, order: string[], failed: ReadonlySet<string>, skip: ReadonlySet<string>): Promise<Walk>
  /** `sessionId` is chosen here, so the console's surface knows it is the CEO's from its first call. */
  open(projectId: string, cwd: string, runner: string, route: LaunchRoute, sessionId: string): Promise<TerminalSession>
  get(sessionId: string): TerminalSession | null
  deliver(sessionId: string, text: string): Promise<DeliveryWriteResult>
  /** Raw input to the console (the Enter a pasted image path swallowed); the tests may leave it out. */
  write?(sessionId: string, data: string): void
  /** Wait; the tests pass none and wait nothing. */
  sleep?(ms: number): Promise<void>
  stop(sessionId: string): Promise<unknown>
  /** ADR-0125 §4: nothing started, the walk may move on. */
  unavailable(error: unknown): boolean
  record(op: string, detail: Record<string, unknown>): void
  onChange(status: CeoStatus): void
  now?: () => number
}

/** What a runner prints when its plan's limit stops it (Claude Code's own words, measured on 2.1.x). */
export const LIMIT_SAID = /(usage limit reached|hit your (?:usage )?limit|limit reached\s*[·∙•]\s*resets|credit balance is too low|exceeded your (?:current )?quota)/i
/** What a runner prints when it is not signed in and asks for it (Claude Code's onboarding, measured 2026-11-18 on
 *  2.1.299 with an empty config: its auth probe may not answer in time under load, so the walk lets it start). A first
 *  run opens on the theme picker before the login menu: nobody is there to pick, so it reads the same. */
export const SIGNED_OUT_SAID = /(Select login method|Please run \/login|Invalid API key|not logged in|Choose the text style that looks best)/i
/** A console that ends this soon after its start did not start: the next runner is tried. */
export const EARLY_END_MS = 20_000
/** How long a runner that hit its limit or did not start is left out of the walk. */
export const SET_ASIDE_MS = 60 * 60_000

export function createCeoAgent(deps: CeoAgentDeps) {
  const now = deps.now ?? Date.now
  let projectId: string | null = null
  let sessionId: string | null = null
  let runner: string | null = null
  let models: string[] = []
  let startedAt = 0
  let passedOver: CeoStatus['passedOver'] = []
  let problem: string | null = null
  let state: CeoState = 'idle'
  let starting: Promise<CeoStatus> | null = null
  let lastLine: string | null = null
  const setAside = new Map<string, { until: number; why: string }>()
  /** Ids handed to a launch not yet answered: its surface may be asked for before `open` returns. */
  const opening = new Set<string>()
  const inbox = path.join(deps.root, 'inbox')
  const metaFile = path.join(deps.root, 'ceo.json')

  const status = (): CeoStatus => {
    const live = sessionId ? deps.get(sessionId) : null
    const s: CeoState = state === 'running' && live && !live.running ? 'ended' : state
    const t = now()
    return {
      state: s, sessionId, runner, models, passedOver, folder: deps.root, problem,
      setAside: [...setAside.entries()].filter(([, v]) => v.until > t).map(([r, v]) => ({ runner: r, until: v.until, why: v.why }))
    }
  }
  const changed = (): void => { try { deps.onChange(status()) } catch (e) { /* recorded in the operations log through deps.record, the host's ops.record */ deps.record('ceo.agent.change-broadcast', { error: e instanceof Error ? e.message : String(e) }) } }

  /** The folder and its brief, written at every start so the brief follows the language and this build. */
  function prepareFolder(): void {
    mkdirSync(inbox, { recursive: true, mode: 0o700 })
    const brief = ceoBrief({ locale: deps.locale() })
    for (const name of ['CLAUDE.md', 'AGENTS.md']) writeFileSync(path.join(deps.root, name), brief, { encoding: 'utf8', mode: 0o600 })
  }

  function knownProject(): string | null {
    try {
      const j = JSON.parse(readFileSync(metaFile, 'utf8')) as { projectId?: unknown }
      return typeof j.projectId === 'string' && /^[0-9a-f-]{36}$/.test(j.projectId) ? j.projectId : null
    } catch {
      // No file yet, or one somebody broke: a new project id is chosen and written.
      return null
    }
  }

  async function start(): Promise<CeoStatus> {
    state = 'starting'
    problem = null
    changed()
    try {
      prepareFolder()
      projectId ??= await deps.ensureProject(deps.root, knownProject())
      writeFileSync(metaFile, JSON.stringify({ projectId }, null, 2), { encoding: 'utf8', mode: 0o600 })
      const t = now()
      const order = deps.runners().filter((r) => (setAside.get(r)?.until ?? 0) <= t)
      // Every runner set aside: the whole order is walked again rather than none (a limit may have reset).
      const walkOrder = order.length ? order : deps.runners()
      let walked: Walk | null = null
      const session = await openWithFallback<TerminalSession>({
        walk: async (failed, skip) => (walked = await deps.walk(projectId!, walkOrder, failed, skip)),
        open: (r, route) => {
          const id = randomUUID()
          opening.add(id)
          return deps.open(projectId!, deps.root, r, route, id)
        },
        get: deps.get,
        // The CEO never attaches to a held session: it is its own console.
        claim: () => false,
        unavailable: deps.unavailable,
        record: (op, detail) => deps.record(`ceo.${op}`, detail)
      })
      sessionId = session.sessionId
      heard = ''
      runner = session.optionId
      models = deps.models()
      startedAt = now()
      const w = walked as Walk | null
      passedOver = w && w.state === 'selected' ? w.passedOver.map((p) => ({ runner: p.runner, result: p.result })) : []
      state = 'running'
      deps.record('ceo.agent.started', { session_id: sessionId, runner, passed_over: passedOver.map((p) => `${p.runner}:${p.result}`).join(',') })
    } catch (e) { /* recorded in the operations log through deps.record, the host's ops.record */
      state = 'failed'
      problem = e instanceof Error ? e.message : String(e)
      deps.record('ceo.agent.start-failed', { error: problem.slice(0, 300) })
    } finally {
      opening.clear()
    }
    changed()
    return status()
  }

  /** The console, started when there is none running. Concurrent callers share one start. */
  async function ensure(): Promise<CeoStatus> {
    const live = sessionId ? deps.get(sessionId) : null
    if (live?.running) return status()
    if (starting) return starting
    starting = start().finally(() => { starting = null })
    return starting
  }

  /** Save the attachments in the inbox; their absolute paths, in order. A file that cannot be written is refused whole. */
  function saveAttachments(files: readonly CeoAttachment[]): string[] {
    mkdirSync(inbox, { recursive: true, mode: 0o700 })
    const t = now()
    return files.slice(0, 10).map((f, i) => {
      const bytes = Buffer.from(String(f.data ?? ''), 'base64')
      if (bytes.length === 0) throw new Error(`«${f.name}» is empty`)
      if (bytes.length > 25 * 1024 * 1024) throw new Error(`«${f.name}» is over 25 MB`)
      const file = path.join(inbox, inboxName(f.name, t, i + 1))
      writeFileSync(file, bytes, { mode: 0o600 })
      return file
    })
  }

  async function deliverLine(line: string): Promise<{ ok: boolean; reason?: string }> {
    const s = await ensure()
    if (s.state !== 'running' || !s.sessionId) return { ok: false, reason: s.problem ?? 'the CEO console is not running' }
    const r = await deps.deliver(s.sessionId, line)
    deps.record('ceo.agent.delivered', { session_id: s.sessionId, state: r.state, ...(r.reason ? { reason: r.reason } : {}), chars: line.length })
    return r.state === 'written' ? { ok: true } : { ok: false, reason: r.reason ?? r.state }
  }

  /** A message from the person: typed into the console, its attachments named by path. */
  async function send(text: string, attachments: readonly CeoAttachment[] = []): Promise<{ ok: boolean; reason?: string; status: CeoStatus }> {
    let paths: string[]
    try { paths = saveAttachments(attachments) } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : String(e), status: status() }
    }
    const line = ceoLine(text, paths, deps.locale())
    if (line === null) return { ok: false, reason: 'nothing to send', status: status() }
    lastLine = line
    const seq = fallbacks
    let r = await deliverLine(line)
    // The console was set aside while the message waited (a sign-in screen, a limit): the fallback types it again.
    if (!r.ok && (pendingFallback || fallbacks !== seq)) { await pendingFallback; r = retyped ? { ok: true } : r }
    // Measured 2026-11-18 on Claude Code: a pasted image path becomes «[Image #1]» while the paste is read, and the
    // Enter after it is lost, so the message waits in the box. One more Enter once it has settled sends it; on an empty
    // prompt Claude Code ignores it.
    if (r.ok && paths.length && runner === 'claude-code' && sessionId && deps.write) {
      await (deps.sleep ?? ((ms: number) => new Promise<void>((res) => setTimeout(res, ms))))(1500)
      try { deps.write(sessionId, '\r') } catch (e) { /* recorded through deps.record, the host's ops.record */ deps.record('ceo.agent.enter-failed', { error: e instanceof Error ? e.message : String(e) }) }
    }
    return { ...r, status: status() }
  }

  async function restart(why = 'restart'): Promise<CeoStatus> {
    const id = sessionId
    if (id && deps.get(id)?.running) {
      try { await deps.stop(id) } catch (e) { /* recorded in the operations log through deps.record, the host's ops.record */ deps.record('ceo.agent.stop-failed', { session_id: id, error: e instanceof Error ? e.message : String(e) }) }
    }
    deps.record('ceo.agent.restart', { from_session: id, why })
    sessionId = null
    runner = null
    state = 'idle'
    return ensure()
  }

  /** Whether the last fallback typed the person's last message into the next runner. */
  let retyped = false
  /** Set a runner aside and start the next one, the person's last message typed again. */
  async function fallBack(why: string): Promise<void> {
    if (!runner) return
    setAside.set(runner, { until: now() + SET_ASIDE_MS, why })
    deps.record('ceo.agent.fallback', { runner, why })
    await restart(why)
    retyped = lastLine && state === 'running' ? (await deliverLine(lastLine)).ok : false
  }

  let fallingBack = false
  /** A fallback under way, so a message sent meanwhile waits for it instead of reporting the console it lost. */
  let pendingFallback: Promise<void> | null = null
  /** How many fallbacks have started: a send compares it before and after its delivery. */
  let fallbacks = 0
  const startFallback = (why: string): void => {
    fallbacks++
    fallingBack = true
    pendingFallback = fallBack(why).finally(() => { fallingBack = false; pendingFallback = null })
  }
  /** The console's recent output as words: a TUI places its words with cursor moves (`\x1b[9G`), not spaces, and a
   *  sentence may arrive in two chunks (measured 2026-11-18 on Claude Code 2.1.299's sign-in screen). */
  let heard = ''
  /** The console's output, as the terminal manager hands it on: a limit or a sign-in screen sets the runner aside. */
  function onOutput(id: string, data: string): void {
    if (id !== sessionId || fallingBack) return
    // eslint-disable-next-line no-control-regex
    heard = (heard + data.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, ' ').replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '').replace(/\s+/g, ' ')).slice(-4000)
    if (LIMIT_SAID.test(heard)) { heard = ''; startFallback('limit') }
    else if (SIGNED_OUT_SAID.test(heard)) { heard = ''; startFallback('not-connected') }
  }

  function onExit(id: string): void {
    if (id !== sessionId) return
    if (now() - startedAt < EARLY_END_MS && !fallingBack) {
      startFallback('ended-at-start')
      return
    }
    state = 'ended'
    changed()
  }

  /** PM chain (task ff3fe9c3): board requests for the CEO that it was not told about are typed into its running console,
   *  each once; a console that is not running is not started for them (the next start's brief reads the board). */
  const told = new Set<string>()
  async function nudgeBoard(requests: readonly CeoBoardRequest[], names: Readonly<Record<string, string>> = {}): Promise<boolean> {
    const live = sessionId ? deps.get(sessionId) : null
    if (!live?.running || !projectId) return false
    const nudge = ceoBoardNudge(requests, projectId, told, names)
    if (!nudge) return false
    for (const id of nudge.ids) told.add(id)
    const r = await deps.deliver(live.sessionId, nudge.line)
    deps.record('ceo.agent.board-nudge', { session_id: live.sessionId, requests: nudge.ids.length, state: r.state })
    return r.state === 'written'
  }

  return {
    status, ensure, send, restart, onOutput, onExit, nudgeBoard,
    isCeo: (id: string): boolean => id !== '' && (id === sessionId || opening.has(id)),
    sessionId: (): string | null => sessionId,
    projectId: (): string | null => projectId
  }
}

export type CeoAgent = ReturnType<typeof createCeoAgent>
// #endregion ceo-agent
