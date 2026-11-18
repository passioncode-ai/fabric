// #region board-main — docs: docs/evidence/plans/2026-11-17-board-apart-waves.md#3-the-waves
/**
 * The board's entry (ADR-0195 W2c.1a): the hub, run by Electron's binary as Node (`ELECTRON_RUN_AS_NODE=1`) apart from
 * the window, built from the bundle entry `board-main` (`electron.vite.config.ts`). It composes the same hub the window
 * composes (`board.ts#startBoardHub`) against the stack the window started, with what is the window's replaced by Node's:
 *
 * - its own database client, from `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the environment the window gives the
 *   child (the window resolves them in `env.ts`, which imports Electron and is never reached from here); the values are
 *   never printed or written;
 * - its own operations log under `<user data>/board/logs`, and the local stores under `--user-data <dir>`, the window's
 *   data folder, so the two read the same settings and the same disconnected agents;
 * - a quit of its own: SIGTERM, SIGINT and SIGHUP run every stop once, then exit 0; a second signal or the deadline ends
 *   the process (`createBoardQuit`);
 * - no window: a consent request is said in the operations log and waits on the board, decided in the window or by an
 *   agent relaying the operator's words (`headlessPresenter`); a product's sign-in link opens with macOS `open`
 *   (`openWithSystem`); no terminals (unknown until W2c.2 gives the window's, never an empty list); no History acts.
 *
 * The cycle (the routine tick, the sweep, the dispatcher, the people-ask bridge) is not started here: it applies the
 * person's decisions through the window's doors, which move to the board in W2c.2 (W2c.1b).
 */
import { spawn } from 'node:child_process'
import { realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createJournal } from '@fabric/journal'
import type { AccessService } from './accessService.ts'
import type { AccessStore } from './accessStore.ts'
import { activeEstateUnreadable, readActiveEstate } from './activeEstate.ts'
import type { AgentRegistry } from './agentRegistry.ts'
import type { AgentSurface } from './agentSurface.ts'
import { startBoardHub, type BoardHub } from './board.ts'
import { createBoardState } from './boardState.ts'
import { ConsentPresenter } from './consentPresenter.ts'
import { createAssignDeps } from './crossProjectAssign.ts'
import { fetchWithDeadline } from './dbDeadline.ts'
import { createDesktopJournal } from './desktopIngress.ts'
import { windowHubPorts } from './hubPorts.ts'
import { createIdentity } from './identity.ts'
import { createKeptOut } from './keptOut.ts'
import { localStore, setLocalStoreDir } from './localStore.ts'
import { createOps } from './ops.ts'
import { ops, useOps } from './opsSink.ts'
import { Policy } from './policy.ts'
import { FABRIC_INBOX, type ProductConnector } from './productConnect.ts'
import { createProjectReads } from './projectReads.ts'
import { QUIT_DEADLINE_EXIT_CODE, QUIT_DEADLINE_MS, listenForQuitSignals, type QuitSignal } from './quit.ts'
import { createScopedStore } from './scopedStore.ts'
import { readSettings, readSettingsState } from './settings.ts'
import { ScanCandidates } from './startChoices.ts'
import { writeWorkspace } from './workspace.ts'
import { validateKeptOutFile, type KeptOutFile } from '../shared/keptOut.ts'
import { translator } from '../renderer/src/i18n/translate.ts'

/** The exit code when the quit had to be ended: by a second signal or at the deadline (`quit.ts`'s, 3). */
export const BOARD_FORCED_EXIT_CODE = QUIT_DEADLINE_EXIT_CODE
/** The exit code of a start refused before anything ran: a missing folder or database. */
export const BOARD_USAGE_EXIT_CODE = 2
/** The exit code of a start that failed after it began (the estate, the identity, the hub's composition). */
export const BOARD_START_FAILED_EXIT_CODE = 1

/** Where the board's own operations log lives: beside the window's, never in the same file (two writers rotate it). */
export function boardLogDir(userData: string): string {
  return path.join(userData, 'board', 'logs')
}

// #region board-main-quit — docs: docs/evidence/plans/2026-11-17-board-apart-waves.md#3-the-waves
export interface BoardQuit {
  /** True from the first quit request on. */
  readonly quitting: boolean
  /** Registers a stop; it runs once when quitting begins, or at once when it has. */
  onQuit(stop: () => void): void
  /** Begins the quit (once): every stop, then the shutdown, then exit 0. A second call while draining by a signal forces
   *  the exit; any other second call returns the drain already running. */
  quit(reason: QuitSignal | 'stop'): Promise<void>
  /** 0.3.23 review, iteration 1, ER-7: runs every stop and the shutdown, as the quit does, and exits nothing: a start that
   *  failed after its hub was up withdraws `hub.json` here, and its caller exits with the failed start's code. A shutdown
   *  that has not settled by the quit's deadline is said as `board.quit-deadline` and left (iteration 2, ER-8). */
  release(): Promise<void>
}

/**
 * The board's quit, the Node counterpart of `quit.ts#createQuitCoordinator` (which holds Electron's `app`): the stops run
 * once, synchronously, in the order given, a broken one said and passed; then `shutdown` (the surface's stop) is awaited;
 * then `exit(0)`. The deadline is armed before the stops run and is unref'd, so it never keeps a finished process alive.
 */
export function createBoardQuit(o: {
  signals?: { on(signal: QuitSignal, fn: () => void): unknown }
  exit: (code: number) => void
  shutdown?: () => Promise<unknown> | unknown
  deadlineMs?: number
}): BoardQuit {
  const deadlineMs = o.deadlineMs ?? QUIT_DEADLINE_MS
  const stops: Array<() => void> = []
  let quitting = false
  let exited = false
  let drain: Promise<void> | null = null
  const exitOnce = (code: number): void => {
    if (exited) return
    exited = true
    o.exit(code)
  }
  const runStop = (stop: () => void): void => {
    try { stop() } catch (e) {
      // One broken stop must not keep the others running or the quit from ending.
      ops.failed('board.quit-stop', e, { note: 'a stop failed; the others ran and the quit continues' })
    }
  }
  const quit = (reason: QuitSignal | 'stop'): Promise<void> => {
    if (drain) {
      if (reason !== 'stop') {
        ops.record({ op: 'board.quit-forced', outcome: 'failed', level: 'warn', detail: { signal: reason, note: 'a second signal while draining ended the board at once' }, ctx: { correlationId: ops.correlate() } })
        exitOnce(BOARD_FORCED_EXIT_CODE)
      }
      return drain
    }
    quitting = true
    ops.record({ op: 'board.quit', outcome: 'ok', detail: { reason }, ctx: { correlationId: ops.correlate() } })
    const timer = setTimeout(() => {
      ops.failed('board.quit-deadline', new Error('quit_deadline'), { note: 'the drain stalled; the board was ended at the deadline', deadline_ms: deadlineMs })
      exitOnce(BOARD_FORCED_EXIT_CODE)
    }, deadlineMs)
    timer.unref?.()
    for (const stop of stops.splice(0)) runStop(stop)
    drain = Promise.resolve()
      .then(() => o.shutdown?.())
      .catch((e: unknown) => { ops.failed('board.quit-shutdown', e, { note: 'the surface did not stop cleanly; the board ends anyway' }) })
      .then(() => { clearTimeout(timer); exitOnce(0) })
    return drain
  }
  if (o.signals) listenForQuitSignals(o.signals, (signal) => { void quit(signal) })
  const release = async (): Promise<void> => {
    if (drain) return drain
    quitting = true
    for (const stop of stops.splice(0)) runStop(stop)
    // 0.3.23 review, iteration 2, ER-8: the shutdown races the quit's own deadline, so a surface that never stops cannot
    // keep the failed start's catch from its rethrow (main then exits BOARD_START_FAILED_EXIT_CODE). It exits nothing.
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        ops.failed('board.quit-deadline', new Error('quit_deadline'), { note: 'the surface did not stop after a failed start; the start fails anyway', deadline_ms: deadlineMs })
        resolve()
      }, deadlineMs)
      timer.unref?.()
    })
    const shutdown = Promise.resolve()
      .then(() => o.shutdown?.())
      .catch((e: unknown) => { ops.failed('board.quit-shutdown', e, { note: 'the surface did not stop cleanly after a failed start' }) })
    try { await Promise.race([shutdown, deadline]) } finally { clearTimeout(timer) }
  }
  return {
    get quitting() { return quitting },
    onQuit(stop) {
      if (quitting) runStop(stop)
      else stops.push(stop)
    },
    quit,
    release
  }
}
// #endregion board-main-quit

// #region board-main-presenter — docs: docs/adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md#decision
/**
 * The consent presenter without a window. ADR-0160 §4: an agent's ask is a question on Главная and is never pushed at the
 * person, so the board needs no prompt. A request presented here is queued as the window's presenter queues it (the
 * `hub.consent.notified` line, `shown: false`) and said once more as `board.consent.pending`; it waits on the board and
 * is decided in the window's Agent access or by an agent relaying the operator's words (`fabric_access_decide`).
 */
export function headlessPresenter(parts: {
  access: () => Pick<AccessService, 'decide'> | null
  accessStore: Pick<AccessStore, 'request' | 'liveConnection'>
  connector: Pick<ProductConnector, 'begin'>
  operator: { kind: 'person'; id: string }
}): ConsentPresenter {
  return new ConsentPresenter({
    window: () => null,
    // Never reached: with no window there is no parent, and the presenter shows no box without one.
    showMessageBox: async () => { throw new Error('the board has no window to show a prompt in') },
    notify: () => {
      ops.record({ op: 'board.consent.pending', outcome: 'unknown', level: 'warn',
        detail: { note: 'the board has no window: the request waits on the board, decided in the window or by a relayed decision' },
        ctx: { correlationId: ops.correlate() } })
      return false
    },
    openWindow: () => {},
    decide: async (requestId, decision) => {
      const access = parts.access()
      return access ? access.decide(requestId, decision, parts.operator) : { ok: false, reason: 'the hub is not ready' }
    },
    connect: async (product) => (product === FABRIC_INBOX.product ? parts.connector.begin(FABRIC_INBOX) : { ok: false, problem: { code: 'no-flow' }, reason: `${product} has no connect flow` }),
    say: () => translator(readSettings().locale),
    stillPending: async (requestId) => {
      const r = await parts.accessStore.request(requestId)
      return !!r && r.status === 'pending' && Date.parse(r.expires_at) > Date.now()
    },
    connected: async (product) => (await parts.accessStore.liveConnection(product)) !== null
  })
}
// #endregion board-main-presenter

// #region board-main-links — docs: docs/evidence/specs/2026-11-04-on-demand-sessions.md#313-the-hubs-boundary-wave-w1
/**
 * A product's sign-in link, opened in the person's browser without Electron's `shell`: macOS `open` with the link as
 * its one argument, no shell. Only an http(s) link is opened, so nothing an agent names can open an app or a file.
 * Elsewhere nothing opens yet: it is said in the operations log and the connect flow goes on as on a machine with no
 * browser (the person opens the link from the window).
 */
export function openWithSystem(url: string, o: {
  platform?: NodeJS.Platform
  spawn?: (command: string, args: string[], options: { stdio: 'ignore'; shell: false }) => { once(event: 'error' | 'exit', fn: (v: unknown) => void): unknown }
} = {}): Promise<void> {
  if (!/^https?:\/\/[^\s]+$/i.test(url)) return Promise.reject(new Error('the board opens only an http(s) link'))
  const platform = o.platform ?? process.platform
  if (platform !== 'darwin') {
    ops.record({ op: 'board.open-link', outcome: 'unknown', level: 'warn', detail: { platform, note: 'the board opens links only on macOS; the window opens this one' }, ctx: { correlationId: ops.correlate() } })
    return Promise.resolve()
  }
  const run = o.spawn ?? ((command, args, options) => spawn(command, args, options))
  return new Promise((resolve, reject) => {
    const child = run('open', [url], { stdio: 'ignore', shell: false })
    child.once('error', (e) => reject(e as Error))
    child.once('exit', (code) => (code === 0 ? resolve() : reject(new Error(`open exited ${String(code)}`))))
  })
}
// #endregion board-main-links

export interface BoardProcessOptions {
  /** The window's data folder (`app.getPath('userData')`): the local stores, the estate choice and the board's log. */
  userData: string
  /** The database client, or a factory of it; a test gives a stand-in. */
  db: SupabaseClient | (() => SupabaseClient)
  /** Where the quit signals come from; `process` by default. */
  signals?: { on(signal: QuitSignal, fn: () => void): unknown }
  /** How the process ends; `process.exit` by default. */
  exit?: (code: number) => void
  /** A product's link opener; `openWithSystem` by default. */
  openUrl?: (url: string) => Promise<void>
  /** The quit's deadline; `quit.ts`'s 10 s by default. */
  deadlineMs?: number
  /** The caller's own step once the hub is up (the cycle, W2c.1b). A throw from it fails the start, and the hub is
   *  withdrawn first (0.3.23 review, iteration 1, ER-7). */
  ready?: (board: BoardProcess) => Promise<void> | void
}

export interface BoardProcess {
  hub: BoardHub
  surface: AgentSurface
  registry: AgentRegistry
  quit: BoardQuit
  estateId: string
  operator: { kind: 'person'; id: string }
  /** The quit as a signal runs it, then the injected `exit` (a test's recorder, or the process's). */
  stop(): Promise<void>
}

/**
 * Starts the board's hub in this process. Throws when the start cannot go on (an unreadable estate choice, an identity
 * that cannot be established, a hub that did not compose); a hub whose port is refused is not a throw: it is `hub.down`,
 * as in the window.
 */
export async function startBoardProcess(opts: BoardProcessOptions): Promise<BoardProcess> {
  const userData = opts.userData
  setLocalStoreDir(() => userData)
  useOps(createOps({ dir: boardLogDir(userData) }))
  let surface: AgentSurface | null = null
  const quit = createBoardQuit({ signals: opts.signals ?? process, exit: opts.exit ?? ((code) => process.exit(code)), shutdown: () => surface?.stop(), deadlineMs: opts.deadlineMs })
  // Which estate: the window's recorded choice, or the default. An unreadable choice stops here with its reason.
  const active = readActiveEstate(userData)
  if (active.status === 'unreadable') throw activeEstateUnreadable(active.problem)
  const estateId = active.estateId
  const db = typeof opts.db === 'function' ? opts.db() : opts.db
  // WHO IS ACTING, established before the hub opens; the board never acts as an unidentified writer (FA-07).
  const identity = createIdentity({ db, estateId })
  const established = await identity.establish()
  if (!established.ok) throw new Error(`identity could not be established: ${established.says}`)
  const operator = identity.actor()
  // Every person-actored append is checked against the membership as it stands at the write (the window's seam).
  const journal = identity.guarded(createDesktopJournal(createJournal(db)))
  const store = createScopedStore(db, { kind: 'estate', estateId })
  const policy = new Policy({ db, journal })
  const state = createBoardState()
  const keptOut = createKeptOut(localStore<KeptOutFile>('kept-out-agents.json', {}, validateKeptOutFile))
  const reads = createProjectReads({ store: () => store })
  let saidFileRoots = false
  let registry: AgentRegistry | null = null
  let hub: BoardHub | null = null
  const openUrl = opts.openUrl ?? ((url: string) => openWithSystem(url))
  // 0.3.23 review, iteration 1, ER-7: from here on the hub may be up (`hub.json`, the door token, the registry watch);
  // a start that fails after it withdraws them before the throw, so no `hub.json` is left naming a dead process.
  try {
    await startBoardHub({
      quit, db, store, journal, policy, estateId, operator, state,
      // The window's port implementation, given the board's own parts: no terminals (unknown, not none), the sweep's handle
      // (empty until the cycle runs here, W2c.1b), the settings file the window writes, and Node's link opener.
      ports: (reg) => windowHubPorts({
        ptys: () => undefined, sweep: state.sweep.get, readSettings: readSettingsState, registry: reg,
        desktop: { openExternal: openUrl, applicationInfoForProtocol: async () => ({ name: '', path: '' }) }
      }),
      presenter: ({ accessStore, connector, access }) => headlessPresenter({ access, accessStore, connector, operator }),
      standby: null,
      releaseStandby: () => {},
      keptOut,
      // No window lists repositories for the board: an agent's folder is admitted by its own rules alone.
      scanCandidates: new ScanCandidates(),
      // History's acts are the window's: an act is said in the board's log (board.ts#noteAct).
      acts: () => null,
      assignDeps: () => createAssignDeps({ store, journal, estateId, operator,
        board: (projectId) => {
          if (!surface) throw new Error('the board door is not open yet')
          return surface.operatorBoard(projectId, operator.id)
        } }),
      projects: {
        read: (id) => reads.read(id),
        listRepos: (projectId) => reads.listRepos(projectId),
        readImported: () => reads.readImported(),
        listRemovals: () => reads.listRemovals(),
        // The file roots bound the window's file API; the board serves none, so there is nothing to refresh here.
        refreshFileRoots: async () => {
          if (saidFileRoots) return
          saidFileRoots = true
          ops.record({ op: 'board.file-roots', outcome: 'ok', detail: { note: 'the board holds no file roots; the window refreshes its own' }, ctx: { correlationId: ops.correlate() } })
        },
        mirror: () => {
          const root = readSettings().workspace.path
          if (!root) return
          void writeWorkspace(root, store).catch((e) => ops.failed('board.workspace-mirror', e, { note: 'the workspace mirror could not be written' }))
        },
        enrollProject: (id) => reads.enroll(id),
        reposWithRemotes: (projectId) => reads.reposWithRemotes(projectId),
        leaseRefs: (projectId) => reads.leaseRefs(projectId)
      },
      onRegistry: (r) => { registry = r },
      onOnboardingFiler: () => {},
      onAdmission: () => {},
      onSurface: (s) => { surface = s },
      onHub: (h) => { hub = h }
    })
    if (!hub || !surface || !registry) throw new Error('the board hub did not compose')
    const composed = { hub: hub as BoardHub, surface: surface as AgentSurface, registry: registry as AgentRegistry }
    ops.record({ op: 'board.started', outcome: 'ok', level: composed.hub.down ? 'warn' : 'info',
      detail: { pid: process.pid, origin: composed.surface.origin || null, down: composed.hub.downCode ?? null }, ctx: { correlationId: ops.correlate(), estateId } })
    const board: BoardProcess = { ...composed, quit, estateId, operator, stop: () => quit.quit('stop') }
    await opts.ready?.(board)
    return board
  } catch (e) {
    await quit.release()
    throw e
  }
}

/** The command line: `--user-data <absolute folder>`. */
export function parseBoardArgs(argv: readonly string[]): { userData: string } | { error: string } {
  const at = argv.indexOf('--user-data')
  const value = at >= 0 ? argv[at + 1] : undefined
  if (!value || value.startsWith('--')) return { error: 'board-main: --user-data <the window\'s data folder> is required' }
  if (!path.isAbsolute(value)) return { error: 'board-main: --user-data must be an absolute path' }
  return { userData: value }
}

/**
 * The process: the folder from the command line, the database from the environment the window gives the child
 * (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; only their names are ever said). A refused start exits 2, a failed one 1.
 */
export async function main(argv: readonly string[] = process.argv, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const say = (line: string): void => { process.stderr.write(line + '\n') }
  const args = parseBoardArgs(argv.slice(2))
  if ('error' in args) { say(args.error); process.exit(BOARD_USAGE_EXIT_CODE) }
  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((name) => !env[name])
  if (missing.length) {
    say(`board-main: the database is named by the environment the window gives the board; missing: ${missing.join(', ')}`)
    process.exit(BOARD_USAGE_EXIT_CODE)
  }
  const url = env.SUPABASE_URL as string
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY as string
  process.on('unhandledRejection', (reason) => ops.failed('process.unhandled-rejection', reason))
  process.on('uncaughtException', (error) => ops.failed('process.uncaught-exception', error))
  try {
    await startBoardProcess({
      userData: args.userData,
      db: () => createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        // Every request ends by a deadline, as in the window (audit A7-010).
        global: { fetch: fetchWithDeadline() }
      })
    })
  } catch (e) {
    ops.failed('board.start', e)
    say(`board-main: the board could not start: ${(e as Error).message}`)
    process.exit(BOARD_START_FAILED_EXIT_CODE)
  }
}

/** True only when this file is the process's entry under Electron as Node, never when a module imports it. */
function runsAsEntry(): boolean {
  if (!process.env.ELECTRON_RUN_AS_NODE || !process.argv[1]) return false
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    // An entry path that cannot be resolved is not this file.
    return false
  }
}

if (runsAsEntry()) {
  // Not inherited by what the board starts (git, `open`): none of them is Electron.
  delete process.env.ELECTRON_RUN_AS_NODE
  void main()
}
// #endregion board-main
