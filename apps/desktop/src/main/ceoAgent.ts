// #region ceo-agent — docs: docs/adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md#decision
/**
 * The CEO agent (ADR-0197, board task a125cc0e): one console Fabric keeps on this computer, in a folder of its own
 * (`<userData>/ceo`, with its brief as CLAUDE.md and AGENTS.md and an `inbox/` for attachments), in a project of its own
 * so it runs like every other console (its bundle, its surface, its journal). It starts on first use and keeps
 * running; «Перезапустить» stops it and starts it again. The person's «Остановить» holds it stopped: nothing starts it
 * (no fallback, no opening of its window) until «Запустить», «Перезапустить» or a message (ADR-0197 amendment 2).
 *
 * THE FALLBACK IS FABRIC'S (the operator, 2026-11-18: mandatory). The console walks the CEO's own order (Claude Code,
 * then Hermes on OpenRouter; only these two can be CEO runners, `shared/ceoAgent.ts#CEO_RUNNERS_KNOWN`, settings
 * `ceoRunners`): a runner that is not installed, is signed out or could not be spawned is passed over (ADR-0125's walk).
 * A runner that, in its start window (its first 20 seconds) or in the 10 seconds after a line Fabric typed into it
 * (`REPLY_WINDOW_MS`), shows a usage limit or a sign-in screen, or that ends in its start window, is set
 * aside for an hour and the next one is started, the person's messages typed into the lost console typed again, each
 * at most once. When every runner is set aside the CEO stops as failed and walks none of them again until the set-aside
 * time passes or the person retries or restarts it (0.3.24 review, ER-1). Which runner answers is in the status the
 * popup's head shows.
 */
import { randomUUID } from 'node:crypto'
import { lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { TerminalSession } from '../shared/types.ts'
import type { Walk } from '../shared/runnerRoute.ts'
import { CEO_QUEUE_MAX, CEO_QUEUE_RETRY_MS, ceoBoardNudge, ceoBrief, ceoLine, inboxName, type CeoAttachment, type CeoBoardRequest, type CeoProblem, type CeoSendReason, type QueuedLine, type CeoState, type CeoStatus } from '../shared/ceoAgent.ts'
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
  /** A line the queue typed into the console, so a voice ask that waited learns when it was written (run five, DO-46). */
  typed?(line: string, outcome: 'written' | 'unknown'): void
  /** Wait; the tests pass none and wait nothing. */
  sleep?(ms: number): Promise<void>
  /** The person's stop; `force` kills a console the plain stop left running (ER-10). */
  stop(sessionId: string, force?: boolean): Promise<unknown>
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
/** How long after Fabric types a line the runner's answer is read for a limit or sign-in screen (0.3.24 review
 *  iteration 2, DO-15, ER-16): Claude Code answers a turn it cannot run at once, while a CEO quoting a session at its
 *  limit does so only after a tool call. */
export const REPLY_WINDOW_MS = 10_000
/** How long an attachment is kept in `<userData>/ceo/inbox` (DA-5): older ones are removed at the next start. */
export const INBOX_KEEP_MS = 30 * 24 * 60 * 60_000
/** The person's lines kept for a fallback to type again (ER-13). */
const KEPT_LINES = 10

/** One line the person sent: the console it was typed into, and whether a fallback typed it again (at most once). */
interface SentLine { line: string; sessionId: string | null; retyped: boolean; files?: boolean; at?: number }

/** The CEO's project (DA-7): the known one while it lives, the one that holds the folder, else a new one under a fresh
 *  id. An archived known project is never reused: its id would bring the archived row back. */
export async function ceoProjectFor(d: {
  read(id: string): Promise<{ status?: string } | null>
  heldBy(folder: string): Promise<string | null>
  create(id: string): Promise<string>
  newId(): string
}, folder: string, knownId: string | null): Promise<string> {
  if (knownId) {
    const row = await d.read(knownId)
    if (row && row.status !== 'archived') return knownId
  }
  const held = await d.heldBy(folder)
  if (held) return held
  return d.create(d.newId())
}

/** An error as the operations log keeps it (DA-8): its class and code, never a message that may carry a path. */
function errorClass(e: unknown): Record<string, string> {
  const code = (e as { code?: unknown } | null)?.code
  return { error_class: e instanceof Error ? e.constructor.name : typeof e, ...(typeof code === 'string' ? { code } : {}) }
}

export function createCeoAgent(deps: CeoAgentDeps) {
  const now = deps.now ?? Date.now
  let projectId: string | null = null
  let sessionId: string | null = null
  let runner: string | null = null
  let models: string[] = []
  let startedAt = 0
  let passedOver: CeoStatus['passedOver'] = []
  let problem: CeoProblem | null = null
  let state: CeoState = 'idle'
  let starting: Promise<CeoStatus> | null = null
  /** A stop of the previous console under way: a start waits for it (ER-10). */
  let stopping: Promise<void> | null = null
  /** The person stopped the CEO (the owner, 2026-11-19): its console's end is not an early end, and nothing starts it
   *  again (no fallback, no popup opening) until the person starts it, restarts it or writes to it. */
  let held = false
  /** The person's stop under way, from any door (ER-7, ER-8, 0.3.25): a message or a restart waits for it to end, so the
   *  stop's exit is read as the person's and the stop never undoes what the person asked after it. */
  let personStop: { done: Promise<void>; end: () => void } | null = null
  const beginPersonStop = (): void => {
    if (personStop) return
    let end!: () => void
    const done = new Promise<void>((r) => { end = r })
    personStop = { done, end: () => { personStop = null; end() } }
  }
  /** A hold another door set (the console's window, History), its console, and how many such stops are in flight
   *  (ER-10, ER-11, 0.3.25): only the last of them settles the hold, and the popup's own stop is never released by them. */
  let doorHold = false
  let stopDoorId: string | null = null
  let doors = 0
  const waitPersonStop = async (): Promise<void> => { while (personStop) await personStop.done }
  const setAside = new Map<string, { until: number; why: string }>()
  /** The person's recent lines, newest last (ER-13). */
  const sent: SentLine[] = []
  /** Ids handed to a launch not yet answered: its surface may be asked for before `open` returns. */
  const opening = new Set<string>()
  const inbox = path.join(deps.root, 'inbox')
  const metaFile = path.join(deps.root, 'ceo.json')
  // #region ceo-queue — docs: docs/ux/scenarios.md#scn-189-a-message-to-the-ceo-is-never-lost
  /** The person's messages the console has not taken yet, oldest first, kept on disk so a restart of Fabric keeps them
   *  (the owner, 2026-11-20, 21:37: «не отправляется сообщение из поп-апа … Я руками вставил»). */
  const queueFile = path.join(deps.root, 'pending.json')
  // The queue's bound (0.3.27 review, run four, DA-32, ER-42; run seven, DA-46): 50 of the person's lines, plus up to 10
  // a lost console owed; a send past it is refused and said, never dropped; a file holding more at a start is kept
  // aside whole, then cut.
  /** A queue file Fabric could not use is moved aside, never overwritten without a trace (run four ER-41); the moved files
   *  are kept 30 days and at most three, since each holds the owner's words (run five, DA-38). */
  const keepAside = (why: string, detail: Record<string, unknown>): void => {
    let kept: string | null = null
    const name = `pending.json.corrupt-${Date.now()}`
    try { renameSync(queueFile, path.join(deps.root, name)); kept = name } catch (e2) { /* said in the record below as kept_aside: false */ void e2 }
    deps.record('ceo.agent.queue-read-failed', { why, kept_aside: kept !== null, ...detail })
    pruneAside(kept)
  }
  /** The kept-aside queue files past 30 days or past the newest three are removed: at every start of Fabric and whenever
   *  one is kept aside (run six, DA-42). Only plain files of that exact name, newest by the time in the name; each removal
   *  on its own, so one that fails leaves the rest pruned (DA-45). */
  function pruneAside(justKept: string | null = null): void {
    let names: string[]
    try { names = readdirSync(deps.root) } catch (e) {
      // No folder yet is nothing kept aside; any other failure is recorded, since these files hold the owner's words
      // (run seven, ER-64).
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') deps.record('ceo.agent.queue-aside-prune-failed', errorClass(e))
      return
    }
    const plain = (f: string): boolean => { try { return lstatSync(path.join(deps.root, f)).isFile() } catch (e) { /* gone meanwhile: not counted */ void e; return false } }
    // Plain files only count toward the three; a name more than a day in the future is old, not newest; the file just
    // kept aside is never the one removed (run seven, DA-47).
    const aside = names.filter((f) => /^pending\.json\.corrupt-\d+$/.test(f) && plain(f))
      .map((f) => ({ f, at: Number(f.slice('pending.json.corrupt-'.length)) }))
      .map((x) => ({ ...x, at: x.at > now() + 86_400_000 ? 0 : x.at }))
      .sort((a, b) => (b.f === justKept ? 1 : 0) - (a.f === justKept ? 1 : 0) || b.at - a.at)
    aside.forEach(({ f, at }, i) => {
      if (f === justKept) return
      if (i < 3 && now() - at <= INBOX_KEEP_MS) return
      try { unlinkSync(path.join(deps.root, f)) } catch (e) { /* recorded through deps.record, the host's ops.record */ deps.record('ceo.agent.queue-aside-prune-failed', errorClass(e)) }
    })
  }
  let rewriteAfterLoad = false
  let queued: QueuedLine[] = (() => {
    let text: string
    try { text = readFileSync(queueFile, 'utf8') } catch (e) { /* no file is an empty queue; any other failure is recorded below */
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') deps.record('ceo.agent.queue-read-failed', errorClass(e))
      return []
    }
    let raw: unknown
    try { raw = JSON.parse(text) } catch (e) { /* kept aside and recorded by keepAside */
      keepAside('not-json', errorClass(e))
      return []
    }
    // A file of the wrong shape (an older or newer format) is kept aside like one that does not parse (run five, DA-39).
    if (!Array.isArray(raw)) { keepAside('not-a-list', {}); return [] }
    const all = raw.filter((x): x is QueuedLine => !!x && typeof (x as { line?: unknown }).line === 'string' && typeof (x as { at?: unknown }).at === 'number')
    // The good entries are written back at once, so a quit before the next send keeps them (run six, DA-43).
    if (all.length < raw.length) { keepAside('invalid-entries', { invalid: raw.length - all.length }); rewriteAfterLoad = true }
    // The bound on disk is the person's 50 plus up to the lines a lost console owed (run seven, DA-46): a file past it is
    // kept aside whole before it is cut, so no line is dropped without its copy.
    const bound = CEO_QUEUE_MAX + KEPT_LINES
    if (all.length > bound) { keepAside('over-bound', { kept: bound, dropped: all.length - bound }); rewriteAfterLoad = true }
    return all.slice(0, bound)
  })()
  pruneAside()
  /** The person's own waiting lines; lines a lost console owed ride on top, at most `KEPT_LINES` (run seven, DA-46). */
  const personLines = (): number => queued.filter((q) => !q.retype).length
  const saveQueue = (): void => {
    try {
      mkdirSync(deps.root, { recursive: true, mode: 0o700 })
      writeFileSync(`${queueFile}.tmp`, JSON.stringify(queued), { mode: 0o600 })
      renameSync(`${queueFile}.tmp`, queueFile)
    } catch (e) { /* the queue still holds in memory; recorded through deps.record, the host's ops.record */ deps.record('ceo.agent.queue-save-failed', errorClass(e)) }
  }
  if (rewriteAfterLoad) saveQueue()
  /** The drain under way: a second caller waits for it instead of returning early (0.3.27 review, run five). */
  let draining: Promise<void> | null = null
  let drainTimer: ReturnType<typeof setTimeout> | null = null
  // Tries that found the console not taking input, in a row: each doubles the wait, up to five minutes, so a console that
  // stays closed is not written to and logged every 10 s all day (0.3.27 review, run four, ER-40).
  let drainMisses = 0
  /** Lines the queue typed with an unknown outcome, so the send that waited on them says so (UX-50). */
  const endedUnknown = new WeakSet<QueuedLine>()
  /** A send waits for its own line to leave the queue, not for every line after it (run six, ER-57). */
  const leftQueue = new Map<QueuedLine, () => void>()
  const drainLater = (): void => {
    if (drainTimer || queued.length === 0) return
    drainTimer = setTimeout(() => { drainTimer = null; void drain() }, Math.min(CEO_QUEUE_RETRY_MS * 2 ** drainMisses, 5 * 60_000))
    ;(drainTimer as { unref?: () => void }).unref?.()
  }
  /** Types the waiting messages into the running console, oldest first; one that is not taken waits for the next try. */
  function drain(): Promise<void> {
    if (draining) return draining
    if (queued.length === 0) return Promise.resolve()
    // The marker is cleared by the promise it marks, never inside the call that sets it: a pass that ends before its first
    // await would otherwise clear it before it is set, and the queue would stop for good (run six, ER-53).
    const run: Promise<void> = drainOnce().finally(() => { if (draining === run) draining = null; drainLater() })
    draining = run
    return run
  }
  async function drainOnce(): Promise<void> {
    try {
      while (queued.length > 0) {
        const live = sessionId ? deps.get(sessionId) : null
        if (!live?.running || state !== 'running') break
        const head = queued[0]!
        const typed = await typeInto(live.sessionId, head.line, 'ceo.agent.delivered')
        if (typed === 'failed') {
          // The console was set aside while the line waited for it (a sign-in screen, a limit): the next one, already
          // running, takes it now, not after the retry wait.
          if (sessionId && sessionId !== live.sessionId && state === 'running') continue
          drainMisses = Math.min(drainMisses + 1, 5)
          break
        }
        drainMisses = 0
        // By identity: a fallback may have put owed lines ahead of it meanwhile (run seven, DO-58, ER-61).
        const at = queued.indexOf(head)
        if (at >= 0) queued.splice(at, 1)
        // A line written into a console a fallback lost while the write waited is owed to it: it goes back behind the
        // other owed lines, once (run seven, DO-58).
        if (typed === 'written' && !head.retype && sessionId !== live.sessionId) {
          const after = queued.findIndex((q) => !q.retype)
          queued.splice(after < 0 ? queued.length : after, 0, { ...head, retype: true })
          saveQueue()
          deps.record('ceo.agent.requeued', { lines: 1, written_to_lost: true })
          continue
        }
        saveQueue()
        leftQueue.get(head)?.(); leftQueue.delete(head)
        // What the queue typed is owed to that console: a limit or sign-in screen in its answer retypes it on the next
        // runner, once (run five, ER-47). An unknown write is not owed: it may have gone in (ER-40).
        if (typed === 'written') {
          try { deps.typed?.(head.line, 'written') } catch (e) { /* recorded through deps.record, the host's ops.record */ deps.record('ceo.agent.typed-hook-failed', errorClass(e)) }
          // A line already typed again after a fallback is not owed a third time.
          sent.push({ line: head.line, sessionId: live.sessionId, retyped: head.retype === true, at: head.at, ...(head.files ? { files: true } : {}) })
          if (sent.length > KEPT_LINES) sent.splice(0, sent.length - KEPT_LINES)
        }
        // ER-40: a write whose outcome is unknown may have gone in; it is never typed again, only said.
        if (typed === 'unknown') { endedUnknown.add(head); try { deps.typed?.(head.line, 'unknown') } catch (e) { /* recorded through deps.record */ deps.record('ceo.agent.typed-hook-failed', errorClass(e)) } deps.record('ceo.agent.queue-unknown', { session_id: live.sessionId, left: queued.length }); changed(); continue }
        // UX-43: a line naming files gets the same settled Enter the direct path gives it.
        if (head.files) await enterAfterFiles(live.sessionId)
        deps.record('ceo.agent.queue-delivered', { session_id: live.sessionId, waited_s: Math.round((now() - head.at) / 1000), left: queued.length, ...(head.retype ? { retype: true } : {}) })
        changed()
      }
    } finally {
      // The marker and the next try are the caller's (`drain`), once this pass has settled (ER-53).
    }
  }
  // #endregion ceo-queue

  const status = (): CeoStatus => {
    const live = sessionId ? deps.get(sessionId) : null
    const s: CeoState = held && !live?.running ? 'stopped' : state === 'running' && live && !live.running ? 'ended' : state
    const t = now()
    return {
      state: s, sessionId, runner, models, passedOver, folder: deps.root, problem, ...(queued.length ? { queued: queued.length } : {}),
      setAside: [...setAside.entries()].filter(([, v]) => v.until > t).map(([r, v]) => ({ runner: r, until: v.until, why: v.why }))
    }
  }
  const changed = (): void => { try { deps.onChange(status()) } catch (e) { /* recorded in the operations log through deps.record, the host's ops.record */ deps.record('ceo.agent.change-broadcast', errorClass(e)) } }

  /** Attachments older than `INBOX_KEEP_MS` are removed (DA-5, ER-13); a file that cannot be read or removed stays. */
  function pruneInbox(): void {
    let removed = 0
    let kept = 0
    const cutoff = now() - INBOX_KEEP_MS
    let names: string[] = []
    try { names = readdirSync(inbox) } catch (e) { /* recorded through deps.record, the host's ops.record */ deps.record('ceo.agent.inbox-prune-failed', errorClass(e)); return }
    for (const name of names) {
      const file = path.join(inbox, name)
      try {
        const st = statSync(file)
        if (st.isFile() && st.mtimeMs < cutoff) { unlinkSync(file); removed++ }
      } catch (e) { /* recorded below as kept: the next start tries again */ kept++; deps.record('ceo.agent.inbox-prune-failed', errorClass(e)) }
    }
    if (removed || kept) deps.record('ceo.agent.inbox-pruned', { removed, kept })
  }

  /** The folder and its brief, written at every start so the brief follows the language and this build. */
  function prepareFolder(): void {
    mkdirSync(inbox, { recursive: true, mode: 0o700 })
    pruneInbox()
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

  function fail(code: CeoProblem, detail: Record<string, unknown>): void {
    state = 'failed'
    problem = code
    deps.record('ceo.agent.start-failed', { problem: code, ...detail })
  }

  async function start(): Promise<CeoStatus> {
    state = 'starting'
    problem = null
    changed()
    let walked: Walk | null = null
    try {
      prepareFolder()
      try {
        projectId ??= await deps.ensureProject(deps.root, knownProject())
      } catch (e) { /* recorded through fail(), the host's ops.record */
        fail('project', errorClass(e))
        return finish()
      }
      writeFileSync(metaFile, JSON.stringify({ projectId }, null, 2), { encoding: 'utf8', mode: 0o600 })
      const t = now()
      const order = deps.runners().filter((r) => (setAside.get(r)?.until ?? 0) <= t)
      // ER-1: every runner set aside. None is walked again until its time passes or the person retries.
      if (order.length === 0) {
        passedOver = []
        fail('all-set-aside', { set_aside: [...setAside.entries()].map(([r, v]) => `${r}:${v.why}`).join(',') })
        return finish()
      }
      const session = await openWithFallback<TerminalSession>({
        walk: async (failed, skip) => (walked = await deps.walk(projectId!, order, failed, skip)),
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
      // ER-1 (0.3.25): the person stopped the CEO while this console was opening: it is stopped, never installed.
      if (held) {
        const done = stopConsole(session.sessionId)
        stopping = done
        try { await done } finally { if (stopping === done) stopping = null }
        // ER-9 (0.3.25): a console the stop could not end stays the CEO's, so the stop says still-running.
        if (!deps.get(session.sessionId)?.running) { state = 'idle'; return finish() }
      }
      sessionId = session.sessionId
      heard = ''
      quiet = false
      runner = session.optionId
      models = deps.models()
      startedAt = now()
      const w = walked as Walk | null
      passedOver = w && w.state === 'selected' ? w.passedOver.map((p) => ({ runner: p.runner, result: p.result })) : []
      state = 'running'
      // A console that starts types what waited at once, not after the queue's grown retry wait (0.3.27 review, run five,
      // UX-51).
      drainMisses = 0
      // A long retry wait already armed is dropped: the new console is tried now (run six, ER-59).
      if (drainTimer) { clearTimeout(drainTimer); drainTimer = null }
      if (queued.length) void drain()
      deps.record('ceo.agent.started', { session_id: sessionId, runner, passed_over: passedOver.map((p) => `${p.runner}:${p.result}`).join(',') })
    } catch (e) { /* recorded through fail(), the host's ops.record */
      const w = walked as Walk | null
      if (w && w.state === 'exhausted') {
        passedOver = w.passedOver.map((p) => ({ runner: p.runner, result: p.result }))
        fail('none-could-start', { passed_over: passedOver.map((p) => `${p.runner}:${p.result}`).join(',') })
      } else fail('start-failed', errorClass(e))
    } finally {
      opening.clear()
    }
    return finish()
  }
  function finish(): CeoStatus { changed(); return status() }

  /** The console, started when there is none running. Concurrent callers share one start. */
  async function ensure(): Promise<CeoStatus> {
    if (stopping) await stopping
    if (held) return status()
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
      if (bytes.length === 0) throw Object.assign(new Error('empty'), { ceo: 'empty-file' as CeoSendReason, file: f.name })
      if (bytes.length > 25 * 1024 * 1024) throw Object.assign(new Error('too big'), { ceo: 'too-big' as CeoSendReason, file: f.name })
      const file = path.join(inbox, inboxName(f.name, t, i + 1))
      writeFileSync(file, bytes, { mode: 0o600 })
      return file
    })
  }

  /** ER-2: a line Fabric types that itself reads as a limit or a sign-in screen closes the console's start window, so
   *  its echo is never taken for the runner's own screen. */
  function typing(id: string, line: string): void {
    if (id !== sessionId) return
    if (LIMIT_SAID.test(line) || SIGNED_OUT_SAID.test(line)) { quiet = true; replyUntil = 0; return }
    // The runner's answer to this line is read for a limit or a sign-in screen: a limit reached mid-work shows here.
    heard = ''
    replyUntil = now() + REPLY_WINDOW_MS
  }

  /** Type a line into a console; the raw reason stays in the operations log. `unknown`: the write may have gone in, so it
   *  is never typed again (0.3.27 review, run four, ER-40); `failed`: nothing was written. */
  async function typeInto(id: string, line: string, op: string): Promise<'written' | 'unknown' | 'failed'> {
    typing(id, line)
    const r = await deps.deliver(id, line)
    deps.record(op, { session_id: id, state: r.state, ...(r.reason ? { reason: r.reason } : {}), chars: line.length })
    return r.state === 'written' ? 'written' : r.state === 'outcome_unknown' ? 'unknown' : 'failed'
  }

  /** Measured 2026-11-18 on Claude Code: a pasted image path becomes «[Image #1]» while the paste is read, and the Enter
   *  after it is lost, so the message waits in the box. One more Enter once it has settled sends it; on an empty prompt
   *  Claude Code ignores it. */
  async function enterAfterFiles(id: string): Promise<void> {
    if (runner !== 'claude-code' || !deps.write) return
    await (deps.sleep ?? ((ms: number) => new Promise<void>((res) => setTimeout(res, ms))))(1500)
    try { deps.write(id, '\r') } catch (e) { /* recorded through deps.record, the host's ops.record */ deps.record('ceo.agent.enter-failed', errorClass(e)) }
  }

  /** Puts a line behind the waiting ones (oldest first); false when the queue is full. */
  function enqueue(line: string, files: boolean, reason: CeoSendReason): QueuedLine | null {
    if (personLines() >= CEO_QUEUE_MAX) { deps.record('ceo.agent.queue-full', { waiting: queued.length, chars: line.length }); return null }
    const item: QueuedLine = { line, at: now(), ...(files ? { files: true } : {}) }
    queued.push(item)
    saveQueue()
    return item
  }

  /** A message from the person: typed into the console, its attachments named by path. */
  async function send(text: string, attachments: readonly CeoAttachment[] = []): Promise<{ ok: boolean; reason?: CeoSendReason; name?: string; status: CeoStatus; queued?: boolean }> {
    // A full queue refuses before any file is saved, so a refused message leaves nothing in the inbox (run five, DA-40).
    if (personLines() >= CEO_QUEUE_MAX) { deps.record('ceo.agent.queue-full', { waiting: queued.length }); return { ok: false, reason: 'queue-full', status: status() } }
    let paths: string[]
    try { paths = saveAttachments(attachments) } catch (e) {
      const x = e as { ceo?: CeoSendReason; file?: string }
      if (!x.ceo) deps.record('ceo.agent.attach-failed', errorClass(e))
      return { ok: false, reason: x.ceo ?? 'not-saved', ...(x.file ? { name: x.file } : {}), status: status() }
    }
    const line = ceoLine(text, paths, deps.locale())
    if (line === null) return { ok: false, reason: 'nothing-to-send', status: status() }
    // 0.3.27 review, runs four and five: every message goes through the one queue, so messages are typed in the order
    // they were sent whatever overlaps (DA-31, ER-48, DA-41), a line has one owner (ER-38, ER-47: the queue records what
    // it typed as owed to that console, which a fallback retypes), and a send is never typed beside a file message's
    // settled Enter (ER-51). It is kept on disk before it is typed: never lost, after a restart of Fabric too.
    const item = enqueue(line, paths.length > 0, 'not-delivered')
    if (!item) return { ok: false, reason: 'queue-full', status: status() }
    // Writing to a stopped or ended CEO is the person asking it back, once its stop has ended (ER-2, 0.3.25; run five,
    // UX-49, ER-46): the stop's exit is read as the person's, never as an early end that sets the runner aside. A fallback
    // under way is waited for, so the line goes to the console it brings.
    await waitPersonStop()
    if (stopping) await stopping.catch(() => undefined /* recorded by stopConsole */)
    held = false
    if (pendingFallback) await pendingFallback
    await ensure()
    const left = new Promise<void>((resolve) => leftQueue.set(item, resolve))
    await Promise.race([left, drain()])
    // A fallback the line itself caused (its console showed a limit while it waited) is waited for, and the queue types
    // it on the next runner before the send answers (run six, UX-57).
    if (queued.includes(item) && pendingFallback) { await pendingFallback; await Promise.race([left, drain()]) }
    if (!queued.includes(item)) leftQueue.delete(item)
    if (!queued.includes(item)) {
      // A line the queue typed with an unknown outcome is said so, never as sent (run four ER-40; run five UX-50).
      return endedUnknown.has(item) ? { ok: false, reason: 'delivery-unknown', status: status() } : { ok: true, status: status() }
    }
    drainLater()
    changed()
    // UX-52: a console still starting is said as busy, not as not running.
    const reason: CeoSendReason = state === 'running' || state === 'starting' ? 'not-delivered' : 'not-running'
    // `queued` in the operations log keeps its meaning: the console did not take the line at once (run six, DA-44).
    deps.record('ceo.agent.queued', { reason, waiting: queued.length, chars: line.length })
    return { ok: true, queued: true, reason, status: status() }
  }

  /** ER-10: the person's stop, then, when the console still runs, a forced one; the outcome is recorded. */
  async function stopConsole(id: string): Promise<void> {
    let outcome = 'stopped'
    try { await deps.stop(id) } catch (e) { /* recorded below with the outcome */ deps.record('ceo.agent.stop-failed', { session_id: id, ...errorClass(e) }) }
    if (deps.get(id)?.running) {
      outcome = 'forced'
      try { await deps.stop(id, true) } catch (e) { /* recorded below with the outcome */ deps.record('ceo.agent.stop-failed', { session_id: id, force: true, ...errorClass(e) }) }
      if (deps.get(id)?.running) outcome = 'still-running'
    }
    deps.record('ceo.agent.stopped', { session_id: id, outcome })
  }

  /** Stop the console and start another. A person's restart (or retry) also brings back every runner set aside (UX-4). */
  async function restart(why = 'restart'): Promise<CeoStatus> {
    if (why === 'person') { await waitPersonStop(); setAside.clear(); held = false }
    if (held) return status()
    const id = sessionId
    // ER-3: the console is no longer the CEO's before its stop is awaited, so its exit is never read as an early end.
    sessionId = null
    runner = null
    state = 'starting'
    problem = null
    changed()
    if (id && deps.get(id)?.running) {
      const done = stopConsole(id)
      stopping = done
      try { await done } finally { if (stopping === done) stopping = null }
    }
    deps.record('ceo.agent.restart', { from_session: id, why })
    state = 'idle'
    return ensure()
  }

  /** The person's stop (the owner, 2026-11-19: «пытался остановить эту консоль, но не смог»): the console is stopped as
   *  any console is, its end is read as the person's, and the CEO stays stopped until the person starts it. A stop that
   *  leaves the console running answers `still-running`, and the CEO is not held. */
  async function stop(): Promise<{ ok: boolean; reason?: 'still-running'; status: CeoStatus }> {
    await waitPersonStop()
    beginPersonStop()
    try { return await stopNow() } finally { personStop?.end() }
  }
  async function stopNow(): Promise<{ ok: boolean; reason?: 'still-running'; status: CeoStatus }> {
    held = true
    // Lines a lost console owed were said as sent; the person's stop means they are not typed again later, after a
    // restart or the next day (run seven, UX-62). The person's own waiting lines stay.
    if (queued.some((q) => q.retype)) {
      const n = queued.filter((q) => q.retype).length
      queued = queued.filter((q) => !q.retype)
      saveQueue()
      deps.record('ceo.agent.requeued-dropped', { lines: n })
    }
    doorHold = false
    // ER-3 (0.3.25): a fallback waiting to run after this one is dropped.
    deferred = null
    changed()
    // ER-1 (0.3.25): a start in flight sees the hold and stops what it opened; the stop answers once it has.
    if (starting) await starting.catch(() => undefined /* a failed start opened nothing to stop */)
    if (pendingFallback) await pendingFallback.catch(() => undefined /* a failed fallback opened nothing to stop */)
    const id = sessionId
    if (id && deps.get(id)?.running) {
      const done = stopConsole(id)
      stopping = done
      try { await done } finally { if (stopping === done) stopping = null }
    }
    if (id && deps.get(id)?.running) {
      held = false
      changed()
      return { ok: false, reason: 'still-running', status: status() }
    }
    state = 'idle'
    deps.record('ceo.agent.held', { session_id: id })
    changed()
    return { ok: true, status: status() }
  }

  /** Another door (the console's own window, History's act) is stopping a console for the person: when it is the CEO's,
   *  the CEO is held as by `stop`, so its end starts nothing. */
  function personStopping(id: string): void {
    if (id === '' || (id !== sessionId && !opening.has(id))) return
    doors++
    if (held) return
    held = true
    doorHold = true
    stopDoorId = id
    deferred = null
    beginPersonStop()
    deps.record('ceo.agent.held', { session_id: id, door: 'console' })
  }

  /** ER-6 (0.3.25): the other door's stop has returned; a console it left running is not held. */
  function personStopEnded(id: string): void {
    if (id === '' || (id !== sessionId && id !== stopDoorId)) return
    if (doors > 0) doors--
    if (doors > 0 || !doorHold) return
    const stillRunning = held && !!deps.get(id)?.running
    doorHold = false
    stopDoorId = null
    personStop?.end()
    if (!stillRunning) return
    held = false
    deps.record('ceo.agent.hold-released', { session_id: id, why: 'still-running' })
    changed()
  }

  /** Set a runner aside and start the next one; the person's lines typed into the lost console are typed again, each
   *  at most once (ER-1, ER-13). */
  async function fallBack(why: string): Promise<void> {
    if (!runner || held) return
    const lost = sessionId
    setAside.set(runner, { until: now() + SET_ASIDE_MS, why })
    deps.record('ceo.agent.fallback', { runner, why })
    const owed = sent.filter((e) => e.sessionId === lost && !e.retyped)
    for (const e of owed) e.retyped = true
    // The lines the lost console owed go back to the head of the queue, oldest first, ahead of newer ones, so the next
    // runner gets them in the order they were sent; marked as retypes, they are typed at most once more (run six, DO-53).
    if (owed.length) {
      queued.unshift(...owed.map((e) => ({ line: e.line, at: e.at ?? now(), retype: true, ...(e.files ? { files: true } : {}) } as QueuedLine)))
      saveQueue()
      deps.record('ceo.agent.requeued', { lines: owed.length })
    }
    await restart(why)
  }

  let fallingBack = false
  /** A fallback under way, so a message sent meanwhile waits for it instead of reporting the console it lost. */
  let pendingFallback: Promise<void> | null = null
  /** A start screen or an early end of the NEXT console seen while a fallback still types into it: run after it. */
  let deferred: string | null = null
  const startFallback = (why: string): void => {
    if (held) return
    if (fallingBack) { deferred ??= why; return }
    fallingBack = true
    pendingFallback = fallBack(why).finally(() => {
      fallingBack = false
      pendingFallback = null
      const next = deferred
      deferred = null
      if (next && sessionId && !held) startFallback(next)
    })
  }
  /** The console's recent output as words: a TUI places its words with cursor moves (`\x1b[9G`), not spaces, and a
   *  sentence may arrive in two chunks (measured 2026-11-18 on Claude Code 2.1.299's sign-in screen). */
  let heard = ''
  /** The start window closed early: Fabric typed a line that itself reads as a limit or sign-in screen (ER-2). */
  let quiet = false
  /** Until when the runner's answer to the line Fabric typed last is read (REPLY_WINDOW_MS). */
  let replyUntil = 0
  /** The console's output, as the terminal manager hands it on. ER-2 / UX-1: only the runner's own start screens set
   *  it aside: a limit or a sign-in screen in its first `EARLY_END_MS` or in the `REPLY_WINDOW_MS` after a typed line. Other output (the CEO quoting a session at its
   *  limit, a tool's result) and the echo of text Fabric typed never do. */
  function onOutput(id: string, data: string): void {
    if (id !== sessionId || held) return
    const inStart = !quiet && now() - startedAt < EARLY_END_MS
    if (!inStart && now() >= replyUntil) { heard = ''; return }
    // eslint-disable-next-line no-control-regex
    heard = (heard + data.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, ' ').replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '').replace(/\s+/g, ' ')).slice(-4000)
    if (LIMIT_SAID.test(heard)) { heard = ''; replyUntil = 0; startFallback('limit') }
    else if (SIGNED_OUT_SAID.test(heard)) { heard = ''; replyUntil = 0; startFallback('not-connected') }
  }

  function onExit(id: string): void {
    // ER-10 (0.3.25): the console a door stopped while it was opening has ended: so has that stop.
    if (held && id === stopDoorId && id !== sessionId) { if (personStop && !stopping) personStop.end(); return }
    if (id !== sessionId) return
    // The console's end is the end of the person's stop, whichever door asked for it.
    if (held) { state = 'idle'; if (personStop && !stopping) personStop.end(); changed(); return }

    if (now() - startedAt < EARLY_END_MS) {
      startFallback('ended-at-start')
      return
    }
    state = 'ended'
    changed()
  }

  /** PM chain (task ff3fe9c3): board requests for the CEO that it was not told about are typed into its running console,
   *  each once it was written (ER-8: a failed delivery is tried again at the next tick); a console that is not running is
   *  not started for them (the next start's brief reads the board). */
  const told = new Set<string>()
  let nudging = false
  async function nudgeBoard(requests: readonly CeoBoardRequest[], names: Readonly<Record<string, string>> = {}): Promise<boolean> {
    const live = sessionId ? deps.get(sessionId) : null
    if (!live?.running || !projectId || nudging) return false
    const nudge = ceoBoardNudge(requests, projectId, told, names)
    if (!nudge) return false
    nudging = true
    try {
      typing(live.sessionId, nudge.line)
      const r = await deps.deliver(live.sessionId, nudge.line)
      deps.record('ceo.agent.board-nudge', { session_id: live.sessionId, requests: nudge.ids.length, state: r.state })
      if (r.state !== 'written') return false
      for (const id of nudge.ids) told.add(id)
      return true
    } finally {
      nudging = false
    }
  }

  // What waited when Fabric last quit is typed once the console runs.
  if (queued.length) drainLater()

  return {
    status, ensure, send, restart, stop, personStopping, personStopEnded, onOutput, onExit, nudgeBoard, drain,
    isCeo: (id: string): boolean => id !== '' && (id === sessionId || opening.has(id)),
    sessionId: (): string | null => sessionId,
    projectId: (): string | null => projectId
  }
}

export type CeoAgent = ReturnType<typeof createCeoAgent>
// #endregion ceo-agent
