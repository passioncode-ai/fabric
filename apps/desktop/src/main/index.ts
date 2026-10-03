// The v1 control plane (ADR-0031 §2): the only Supabase client, the journal
// writer, the PTY host and the IPC surface — all here, never in the renderer.

import { BrowserWindow, Notification, app, clipboard, dialog, ipcMain, net, powerMonitor, shell } from 'electron'
import { CONFIGURED, saveProjectSettings } from './commands/projectSettingsCommand.ts'
import { landed, type SaveSettingsInput } from '../shared/projectSettings.ts'
import path from 'node:path'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createJournal, type Journal } from '@fabric/journal'
import { createDesktopJournal, cleanOriginalText, prepareTaskText, prepareIdeaText, prepareRetrievalText } from './desktopIngress.ts'
import { commitBoardCommand, commitPreparedAnswer, commitPreparedImport, commitReleaseCommand } from './commandIngressAdapters.ts'
import { createHash, randomUUID } from 'node:crypto'
import { fixPath, resolveSupabaseEnv, startStack } from './env'
import { applyAppIcon, windowIcon } from './appIcon'
import { Policy } from './policy'
import { launchOptions, PtyManager } from './pty'
import { classifyFailure } from '../shared/failure.ts'
import { createManagedLaunch, type LaunchInput } from './managedLaunch.ts'
import { createNativeStopRuntime } from './nativeStopRuntime.ts'
import { createTranscriptRecovery } from './transcriptRecovery.ts'
import { createTranscriptReceipt } from './transcriptReceipt.ts'
import { createStopHostIdentity } from './stopHostIdentity.ts'
import { AgentSurface } from './agentSurface'
import { FileRoots, listDirectory, readFile, resolveForOpen, writeFile } from './files'
import { createBundleCompiler } from './sessionBundle'
import { createTranscriptStore } from './transcripts'
import { compileContextPack, contextDemandFor, type LaunchTrigger } from './contextPack'
import { refreshFileRootsFrom } from './fileRootsRefresh.ts'
import { readSettings, writeSettings } from './settings'
import { createPowerKeeper, type PowerKeeper } from './power'
import { createRepoStateReader } from './repoState'
import { createCodeStatsReader } from './codeStats'
import { createQuotaReader } from './quota'
import { readGateway } from './gateway'
import { classifyStartupFailure, startupDialog } from '../shared/startupFailure'
import { readBuildManifestCandidates, withSchemaReadiness } from './schemaReadiness.ts'
import { linkOutcome, linkRefusal } from '../shared/taskLinks.ts'
import { splashProgress } from '../shared/splashProgress'
import { checkWorkspace, importWorkspace, initRepository, writeWorkspace } from './workspace'
import {
  IPC,
  type AppSettings,
  type CreateProjectInput,
  type DiagnosticsView,
  type AnswerReceipt,
  type PinResult,
  type SettingsWrite,
  type MemoryBackend,
  type MemoryBackendOption,
  type MemoryFact,
  type ProjectRow,
  type AgentClaim,
  type ProjectStats,
  type Quota,
  type RepoRow,
  type RepoState,
  type SessionTranscript,
  type TaskRow,
  type UpdateProjectInput,
  type BriefSection,
  type FeedEvent,
  type GoalRow,
  type EstateSummary,
  type Harness,
  type MemoryMiss,
  type MemoryOverview,
  type MoveResult,
  type TaskDetail,
  type TaskLinkRow,
  type TaskNote,
  type WriteResult,
  type CreatedAgent,
  type RoutineRow,
  type CeoChatReply,
  type CeoChatStatus,
  type FabricApi
} from '../shared/types'
import { createCeoConversationHost } from './ceoConversationHost.ts'
import { createCeoChatBinding } from './ceoChatBinding.ts'
import { DEFAULT_ESTATE, activeEstateUnreadable, readActiveEstate, recordActiveEstate } from './activeEstate.ts'
import { createBackups } from './backup.ts'
import { createPrivateHistory, type PrivateHistory } from './privateHistory.ts'

/**
 * What a contract method resolves to (M109).
 *
 * The renderer's API is the one declaration of every channel's answer, and until
 * this existed nothing connected a handler to it: `tsc` type-checked the preload
 * calls and compared them with nothing. A handler annotated with
 * `Returns<FabricApi['ns']['fn']>` is checked against the promise the renderer
 * was given, and the type comes from that declaration rather than from a second
 * list that could drift from it.
 *
 * **Applied to the handlers M109 names, not to all of them.** The rest are a
 * mechanical sweep this change does not make, and the row says so rather than
 * reading as closed.
 */
type Returns<T> = T extends (...args: never[]) => Promise<infer R> ? R : never
import { hasSiblings, originDocument, sameDocument } from '../shared/origin.ts'
import { researchBrief } from '../shared/idea.ts'
import { agentNameRefusal, agentNameTakenAtWrite, nameTaken, readSpec, resolveServers } from '../shared/agentSpec.ts'
import { dueRoutines } from '../shared/routine.ts'
import { automationStates } from '../shared/automations.ts'
import { createRoutineTick } from './routineTick'
import { createChainAdvance } from './chainAdvance'
import { createScopedStore, type ScopedStore } from './scopedStore'
import {
  buildLine,
  compatibilityOf,
  type ManifestRead
} from '../shared/buildManifest.ts'
import { createOps } from './ops'
import { boardEntries, cutBoard, scopeBoard, type BoardCut, type BoardQuestion } from '../shared/board'
import { deferredEntries, resolvedEntries, type DeferredEntry, type ResolvedEntry } from '../shared/boardResolved.ts'
import { releaseEntries, type ReleaseEntry } from '../shared/releases.ts'
import { envelope, type Omission, type ReadEnvelope, type SourceReceipt } from '../shared/readEnvelope'
import { coverageOfList } from '../shared/planProgress'

/** How many finished tasks one list carries. Named so the cap and the sentence
 *  that declares it cannot drift apart. */
const CLOSED_TASK_CAP = 20

/** How many decisions one read carries. Named for the same reason as the
 *  task cap: the number and the sentence that declares it must not drift. */
const DECISION_CAP = 200

/** How much routine history one automations read carries, per window. */
const AUTOMATION_WINDOW = 200
import { type AnswerOption } from '../shared/answerCommit'
import { projectWeight, type ProjectSignals } from '../shared/projectWeight'
import { ops, useOps } from './opsSink'
import { decideProposal } from './commands/proposalCommands.ts'
import { withDeliveryHeader } from '../shared/deliveryState.ts'
import { continuationText, routeContinuation, type ContinuationState } from '../shared/continuation.ts'
import { createRuntimeObserver, DEFAULT_THRESHOLDS } from './runtimeObserver.ts'
import { deriveLiveness } from '../shared/liveness.ts'
import { declaredCapabilities, isAvailable } from '../shared/capabilityReport.ts'
import { AGENTS } from '../shared/agents.ts'
import type { RunStatusView } from '../shared/runStatus.ts'
import { advancesWatermark, worstOf, type WindowState } from '../shared/cyclePort.ts'
import type { OpsLevel } from '../shared/opsLog'

/**
 * Every IPC call, timed and recorded, with a correlation id (M81).
 *
 * ONE WRAPPER RATHER THAN SEVENTY-SIX EDITS. A rule applied by hand at every
 * call site is a rule that holds until somebody is busy — and `check-ops.mjs`
 * refuses a bare `ipcMain.handle` so the next handler inherits this instead of
 * having to remember it.
 *
 * The error is RE-THROWN: the renderer still gets its rejection, and the log is
 * a witness rather than a replacement for the failure.
 */
function handle(
  channel: string,
  fn: (event: Electron.IpcMainInvokeEvent, ...args: never[]) => unknown
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    const done = ops.begin(`ipc.${channel}`, { correlationId: ops.correlate() })
    try {
      const result = await fn(event, ...(args as never[]))
      done('ok')
      return result
    } catch (e) {
      done('failed', { error: e })
      throw e
    }
  })
}
import { installMenu } from './menu'
import { decideNotification, rememberTold, type ShowOutcome } from '../shared/notify.ts'
import { createUnattendedAdmission } from '../shared/unattendedAdmission.ts'
import { createAdmitExisting } from './admitExisting.ts'
import { createRunLifecycle, type RunLifecycle } from './runLifecycle.ts'
import { createIdentity, LOCAL_OPERATOR_PERSON, type Identity } from './identity.ts'

/** One shape for a created agent, so the two handlers cannot disagree. */
/** A launch option is either a runner id (`claude-code`) or a created agent's
 *  uuid. The column is a uuid, so asking it about a runner id is an error and
 *  not an empty answer. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const toCreatedAgent = (r: Record<string, unknown>): CreatedAgent => ({
  id: r.id as string,
  project_id: r.project_id as string,
  name: r.role as string,
  runner_id: r.provider_ref as string,
  instructions: (r.instructions as string | null) ?? '',
  mcp_servers: (r.mcp_servers as string[] | null) ?? [],
  permission_mode: (r.permission_mode as string | null) ?? null,
  created_by: (r.created_by as string | null) ?? null,
  created_at: r.created_at as string
})
import { mayMove, type TaskState } from '../shared/ladder.ts'
import {
  attentionKey,
  attentionOf,
  obligationReceipts,
  type AttentionItem,
  type AttentionSources
} from '../shared/attention.ts'
import {
  DEFAULT_CATEGORY,
  INSIGHT_CATEGORIES,
  normaliseAbout,
  recurrence as recurrenceOf,
  type InsightCategory,
  type OccurrenceGrouping
} from '../shared/memoryContract.ts'
import {
  checkCursor,
  evidenceOf,
  normaliseQuery,
  pageOf,
  recurrenceUnknown,
  type Recurrence,
  type RetroItem,
  type RetroPage,
  type RetroQuery
} from '../shared/retroView.ts'
import { parseRef } from '../shared/entityRef.ts'
import type { StoreCount } from '../shared/memoryOverview.ts'
import { digestFor } from './digestRead.ts'
import { SEARCH_CAP, coverageOfStore, type SearchGroup } from '../shared/search.ts'
import { lineagesOf, orphansOf, type DecisionFact, type Lineage } from '../shared/decisions.ts'
import { SURFACE_TOOLS } from '../shared/surfaceTools.ts'
import { harnessFor } from './harnessRead.ts'
import { memoryOverviewFor } from './memoryOverviewRead.ts'
import { searchFor } from './searchRead.ts'
import { tenureFrom } from '../shared/tenure.ts'
import { markFor, setMark } from './digestMark.ts'
import { favourites, moveProject, projectOrder, replaceFavourite, toggleFavourite } from './favourites.ts'
import { persona, savePersona } from './persona.ts'
import { asFolderRefusal, inspectFolder, scanFolder } from './projectDiscovery.ts'
import { detectExecutors } from './executorDetect.ts'
import { keepScan, lastScan } from './startPaths.ts'
import { createProjectFolder } from './projectFolder.ts'
import { ParentChoices, ScanCandidates, admitRepoPaths, indexImported, realOrResolved, refuseHeldByOther, walkPickFor } from './startChoices.ts'
import { sessionEnvironment } from './sessionEnv.ts'
import { projectNameProblem, type CandidateView, type FolderFacts, type ScanView } from '../shared/startPaths.ts'
import { livenessFor } from './livenessRead.ts'
import { classifyObservationGap, type HostWindow } from '../shared/harnessBreak.ts'
import { createDrafts } from './onboardingDrafts.ts'
import { localStore } from './localStore.ts'
import { validateDraftFile } from '../shared/onboardingDraft.ts'
import type { DraftFile } from '../shared/onboardingDraft.ts'
import type { PersistedTabs } from '../shared/tabs.ts'
import { createContinuationDelivery, type ContinuationResult } from './continuationDelivery.ts'
import { createPastContext } from './pastContext.ts'
import { launchPlace } from '../shared/launchPlace.ts'

/**
 * The Estate this process works in: the operator's recorded choice (A1-6b), read once at the
 * start of bootstrap and fixed for the life of the process. A restored Estate is opened by
 * recording it and restarting, never by rebinding a running process.
 */
let ACTIVE_ESTATE: string = DEFAULT_ESTATE
/**
 * The operator's journal actor, ESTABLISHED at bootstrap rather than written out
 * here (FA-07).
 *
 * It was a literal, and the same object appeared twice more in `pty.ts` — three
 * definitions of one identity, with nothing forbidding a fourth. It now comes
 * from the identity port, which resolves a `persons` row and its membership; the
 * handle it carries is unchanged, so no event already written reads differently.
 */
let OPERATOR_ACTOR: { kind: 'person'; id: string }

let db: SupabaseClient
/** The same client, narrowed to this estate (S02.a). `db` stays for bootstrap —
 *  the estate row has to be read before a scope over it exists — and everything
 *  downstream is handed this instead, so a query cannot be written without a
 *  predicate by writing it the short way. */
let store: ScopedStore
let journal: Journal
/** AX-01 — the run lifecycle, reachable from the module-level exit handler.
 *  A session exit is where a run ends, and that handler lives outside the
 *  bootstrap closure because it is registered on the pty host. */
let runs: RunLifecycle
/** Established at bootstrap; the only producer of a person actor. */
let identity: Identity
let policy: Policy
let ptys: PtyManager
let stopRuntime: ReturnType<typeof createNativeStopRuntime>
let surface: AgentSurface
let mainWindow: BrowserWindow | null = null
/** sessionId → taskId, so a session's exit can close the task that opened it. */
const taskBySession = new Map<string, string>()
/** sessionId → detached window showing that session. */
const sessionWindows = new Map<string, BrowserWindow>()
/** absolute path → detached editor window. */
const fileWindows = new Map<string, BrowserWindow>()

function allWindows(): BrowserWindow[] {
  return [mainWindow, ...sessionWindows.values(), ...fileWindows.values()].filter(
    (w): w is BrowserWindow => !!w && !w.isDestroyed()
  )
}

function broadcast(channel: string, ...args: unknown[]): void {
  for (const w of allWindows()) w.webContents.send(channel, ...args)
}

/**
 * M63 — the chrome every window shares.
 *
 * None of the three windows set these, so macOS drew its own light title bar and
 * Electron painted white until the renderer's first frame: every window this
 * product opens looked like a different application for a moment, and the main
 * window — which draws its own tab strip — looked like it had two of them.
 *
 * `backgroundColor` is what is painted BEFORE any CSS exists, so it cannot come
 * from a token; it is the one place the dark ground is a literal, and it is
 * written here once rather than in three places.
 */
const WINDOW_CHROME = {
  titleBarStyle: 'hiddenInset' as const,
  trafficLightPosition: { x: 14, y: 14 },
  backgroundColor: '#0a0a0a'
}

// The IDE opens with one click: if the local stack is down, start it ourselves
// instead of sending the operator to a terminal.
// The two literals below mirror --bg and --ink of the style pack by hand: this
// window is painted before any stylesheet exists, which is why the palette gate
// scopes itself to the renderer. They are the only hand-copied colours in the
// app, and moving the pack means updating this line.
function splashWindow(text: string): BrowserWindow {
  // M63 said "all three windows" and there are FOUR. This one was missed, and it
  // is the FIRST window a person ever sees on a cold start — so the white flash
  // the fix existed to remove was still there, on the only frame that makes a
  // first impression. `titleBarStyle` does not apply to a frameless window;
  // `backgroundColor` very much does.
  const w = new BrowserWindow({
    width: 380,
    height: 120,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    backgroundColor: WINDOW_CHROME.backgroundColor
  })
  void w.loadURL(
    'data:text/html,' +
      encodeURIComponent(
        `<body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#0c0e10;color:#e6e9ec;font:14px -apple-system,sans-serif"><p>${text}</p></body>`
      )
  )
  return w
}

async function resolveEnvStartingStackIfNeeded(): ReturnType<typeof resolveSupabaseEnv> {
  try {
    return await resolveSupabaseEnv()
  } catch {
    // M101 — the whole of this used to run on the main thread, which IS
    // Electron's browser-process message loop. Measured with the page reporting
    // its own clock: against a six-second block the splash's script ran 59ms
    // AFTER the block ended, so its text was not late, it was never displayed.
    // A four-minute start showed a person a bare rectangle.
    const splash = process.env.SMOKE ? null : splashWindow(splashProgress({ elapsedMs: 0, lastLine: null }))
    const startedAt = Date.now()
    let lastLine: string | null = null
    // The window is only worth updating once it can render — before
    // `did-finish-load` there is no document to write into.
    let painted = false
    splash?.webContents.once('did-finish-load', () => {
      painted = true
    })
    const tick = setInterval(() => {
      if (!painted || !splash || splash.isDestroyed()) return
      const text = splashProgress({ elapsedMs: Date.now() - startedAt, lastLine })
      // `executeJavaScript` rather than a reload: a reload would restart the
      // very paint this exists to deliver.
      void splash.webContents
        .executeJavaScript(`document.querySelector('p').textContent = ${JSON.stringify(text)}`)
        .catch(() => {
          /* the window went away mid-update; the finally below is the authority */
        })
    }, 500)
    try {
      await startStack((line) => {
        lastLine = line
      })
      return await resolveSupabaseEnv()
    } finally {
      clearInterval(tick)
      splash?.destroy()
    }
  }
}

/** M100 — see the assignment inside bootstrap for what this observes. */
let pastRetryPoint = false
/** The database connection main already holds, kept for the CEO conversation host (C2). */
let ceoConnection: { url: string; serviceKey: string } | null = null
/** The CEO chat binding; null until identity is established, and if its host cannot be built. */
let ceoChat: ReturnType<typeof createCeoChatBinding> | null = null
/** Closed until private recovery is available (first-slice plan C5). */
const CEO_CHAT_CLOSED: CeoChatStatus = { active: false, reason: 'private_recovery_unavailable' }
/** C5: the chat opens only while private export and restore exist for the held operator — the
 * service is built after identity is established, and without it the gate stays closed. */
const ceoChatActivation = (): CeoChatStatus => privateHistory ? { active: true, reason: null } : CEO_CHAT_CLOSED
/** Private history and restore (A1-6); null until identity is established. */
let privateHistory: PrivateHistory | null = null
/** Archive folders main chose in its own dialog, by the token the renderer holds instead of a path. */
const historyTokens = new Map<string, string>()

async function bootstrap(): Promise<{ estateId: string; estateName: string }> {
  // FIRST, before anything that can fail. A monitor initialised after the thing
  // it is supposed to explain is a monitor that misses the startup.
  useOps(createOps({ dir: path.join(app.getPath('userData'), 'logs') }))
  await fixPath()
  // Which Estate: the recorded choice, or the default. An unreadable choice stops here with its
  // reason; Fabric never opens another Estate in its place.
  const active = readActiveEstate(app.getPath('userData'))
  if (active.status === 'unreadable') throw activeEstateUnreadable(active.problem)
  ACTIVE_ESTATE = active.estateId
  const env = await resolveEnvStartingStackIfNeeded()
  ceoConnection = { url: env.url, serviceKey: env.serviceKey }
  db = createClient(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
  return withSchemaReadiness({
    packaged: app.isPackaged,
    manifest: installedBuild(),
    readSchema: (signal) => db.rpc('schema_version').abortSignal(signal)
  }, bootstrapReady)
}

/** Reached only after this startup attempt has verified the database schema. */
async function bootstrapReady(): Promise<{ estateId: string; estateName: string }> {
  journal = createDesktopJournal(createJournal(db))
  store = createScopedStore(db, { kind: 'estate', estateId: ACTIVE_ESTATE })
  policy = new Policy({ db, journal })

  const { data: estate, error } = await store.select('estates', '*').eq('id', ACTIVE_ESTATE).maybeSingle()
  if (error) throw new Error(`estates read failed: ${error.message}`)

  // WHO IS ACTING, established once and never invented (FA-07). Everything a
  // person writes goes through the guarded journal below, so a membership
  // revoked while the app is open stops the NEXT write rather than the next
  // restart. The estate has to exist first, because a membership is a fact
  // about one — the bootstrap append above is the one system-actored write that
  // legitimately precedes identity.
  identity = createIdentity({ db, estateId: ACTIVE_ESTATE })
  if (!estate) {
    await journal.append({
      estateId: ACTIVE_ESTATE,
      type: 'estate.created@1',
      actor: { kind: 'system', id: 'desktop-bootstrap' },
      // WITH AN OWNER (FA-07). An estate created without one cannot resolve a
      // subject, so a fresh install would refuse to start — measured, before
      // this line existed. The owner travels in the event rather than being
      // assumed by the projector, so the record says who founded it.
      payload: { name: 'org #1', owner_person_id: LOCAL_OPERATOR_PERSON }
    })

  }

  // M100 — the point after which retrying in place is NOT safe. Observed as we
  // cross it, never inferred from whatever error arrives: a second attempt
  // would open a second listener and register every IPC handler twice, and a
  // failure we cannot place is a failure we must not offer to repeat.
  pastRetryPoint = true
  surface = new AgentSurface({ db, journal, ptys: () => ptys, policy, estateId: ACTIVE_ESTATE })
  try {
    await surface.start()
  } catch (e) {
    // A session must still start when the surface cannot: the agent simply has
    // nothing to report through, and the launch says so rather than failing.
    ops.failed('index.agent-surface-failed-to-start', e, { note: 'agent surface failed to start:' })
  }

  // Every repository attached to any project in this estate. Rebuilt from the
  // projection rather than remembered, so a detach actually closes the door.
  await refreshFileRoots()

  const bundles = createBundleCompiler({
    root: app.getPath('userData'),
    surface: {
      get endpoint() {
        return surface.endpoint
      },
      mint: (projectId, sessionId, taskId) => surface.mint(projectId, sessionId, taskId),
      revokeSession: (sessionId) => surface.revokeSession(sessionId)
    },
    // M127 — what this project may reach besides Fabric, and what the machine's
    // gateway offers. Both are read at compile time rather than cached: a
    // gateway that started since the app did is a gateway a session can use.
    declaredServers: async (projectId) => {
      const { data } = await store
        .select('projects', 'mcp_servers').eq('id', projectId).maybeSingle()
      return ((data?.mcp_servers as string[] | null) ?? []).map((name) => ({
        name,
        source: 'gateway' as const
      }))
    },
    gateway: () => readGateway(),
    // M49 — compile the pack, journal the lockfile, hand back the text. The
    // lockfile is written BEFORE the session starts, so "what did this agent
    // know" is answerable even if the session dies in its first second.
    context: async (sessionId, projectId, taskId) => {
      const task = taskId
        ? await store
            .select('project_tasks', 'instruction,brief_what,brief_why,brief_expected')
            .eq('id', taskId)
            .maybeSingle()
        : null
      const pack = await compileContextPack({
        store,
        projectId,
        // An unattended start (chain, routine) requires its context sources; a missing one refuses it.
        // The trigger is the one the launch admitted this session with (`launchTriggerBySession`, set
        // by the managed launch around `ptys.open`); a terminal opened without a launch has none.
        mandatory: contextDemandFor(launchTriggerBySession.get(sessionId)),
        taskInstruction: (task?.data?.instruction as string | undefined) ?? null,
        // The brief travels too. Found by auditing the layer against itself:
        // step 5 gave a task a brief and nothing carried it to the agent, so a
        // session opened for a task read only the line that was typed at the
        // start — which is the least of what is known about it by then.
        taskBrief: task?.data
          ? {
              what: (task.data.brief_what as string | null) ?? null,
              why: (task.data.brief_why as string | null) ?? null,
              expected: (task.data.brief_expected as string | null) ?? null
            }
          : null
      })
      await journal.append({
        estateId: ACTIVE_ESTATE,
        type: 'context.compiled@1',
        // `system`: Fabric selected this, nobody claimed it.
        actor: { kind: 'system', id: 'context-pack' },
        projectId,
        payload: {
          session_id: sessionId,
          task_id: taskId,
          sha256: pack.sha256,
          chars: pack.chars,
          fact_ids: pack.factIds,
          fact_seqs: pack.factSeqs,
          transcript_ids: pack.transcriptIds,
          omitted_facts: pack.omittedFacts,
          omitted_transcripts: pack.omittedTranscripts
        }
      })
      return pack.markdown
    }
  })

  // A new process has no evidence that sessions on other hosts have exited.

  power = createPowerKeeper()
  power.setPolicy(readSettings().keepAwake)

  const transcripts = createTranscriptStore({ root: app.getPath('userData') })

  ptys = new PtyManager(journal, ACTIVE_ESTATE, {
    onData: (sessionId, data, written) => broadcast(IPC.terminalData, sessionId, data, written),
    onExit: async (sessionId, exitCode) => {
      const requestedByFabric = !!ptys.get(sessionId)?.termination || quitting
      broadcast(IPC.terminalExit, sessionId, exitCode)
      syncPower()
      // Observed local exit revokes Fabric credentials even if Run lookup is
      // unavailable. Repeated revocation in the finalizer is idempotent.
      try { bundles.discard(sessionId) } catch {
        ops.failed('session.exit-revoke', new Error('Local credential revocation remains unproved'), { sessionId })
      }
      // This joins the same finalizer as operator Stop, launch failure and quit.
      // Its observations await terminal.closed, never this callback itself.
      await stopRuntime.stop(sessionId, 'natural_exit')
      void recordSessionExit(sessionId, exitCode, requestedByFabric)
    }
  }, bundles, undefined, transcripts, () => OPERATOR_ACTOR)
  // ESTABLISHED, and the actor everything downstream uses comes from here. A
  // failure is fatal on purpose: a product that carries on with an unidentified
  // writer is one whose journal cannot say who did anything.
  const established = await identity.establish()
  if (!established.ok)
    throw new Error(`identity could not be established: ${established.says}`)
  OPERATOR_ACTOR = identity.actor()
  // C2: the CEO conversation host exists only once the operator is established, and behind a
  // gate that opens only while private recovery is available (C5); closed, no chat call reaches
  // the database, while drafts still save on this Mac. A host that cannot be built leaves the chat
  // unavailable and the rest of the app running.
  try {
    if (!ceoConnection) throw new Error('database connection is not resolved')
    ceoChat = createCeoChatBinding({
      service: createCeoConversationHost({ rootDir: app.getPath('userData'), estateId: ACTIVE_ESTATE, identity,
        connection: { url: ceoConnection.url, serviceKey: ceoConnection.serviceKey, allowLoopbackHttp: true },
        online: () => net.isOnline() }),
      activation: ceoChatActivation
    })
  } catch (e) {
    ceoChat = null
    ops.failed('ceo.chat.host', e as Error, { note: 'CEO chat unavailable: its host could not be built' })
  }
  // A1-6: the operator is main's held identity in the active Estate; the ordinary archive is taken
  // by the real backup writer, and the commands are migration 66's.
  privateHistory = createPrivateHistory({
    rootDir: app.getPath('userData'),
    identity: { held: () => { const h = identity.held(); return h ? { estateId: ACTIVE_ESTATE, personId: h.personId, revision: h.revision, actor: identity.actor() } : null } },
    take: (estateId, dir) => createBackups(db).take(estateId, dir),
    rpc: async (name, args) => { const { data, error } = await db.rpc(name, args); return { data, error } }
  })
  // Every person-actored append is checked against the membership as it stands
  // at the moment of the write. One seam rather than a check in a hundred
  // handlers, which is a hundred places to forget one.
  journal = identity.guarded(journal)
  const host = createStopHostIdentity(app.getPath('userData'))
  const finalizeTranscript = createTranscriptReceipt({ estateId: ACTIVE_ESTATE, journal,
    get: id => ptys.get(id), task: id => taskBySession.get(id) ?? null,
    finalize: id => ptys.finalizeTranscript(id), settle: id => ptys.settleTranscript(id) })
  stopRuntime = createNativeStopRuntime({ db, estateId: ACTIVE_ESTATE, actor: OPERATOR_ACTOR,
    guard: async () => (await identity.guard()).ok, authority: () => identity.held(),
    hostInstanceId: host.hostInstanceId, bootId: host.bootId, ptys,
    localTask: id => taskBySession.get(id) ?? null,
    lookup: async sessionId => {
      const { data, error } = await store.select('task_runs', 'task_run_id,task_id,session_id')
        .eq('session_id', sessionId).maybeSingle()
      if (error) throw new Error('Stop ownership could not be read')
      return data ? { taskId: data.task_id as string, runId: data.task_run_id as string,
        sessionId: data.session_id as string } : null
    },
    revoke: async sessionId => {
      bundles.discard(sessionId)
      return { revoked: true, evidenceRef: `surface-revoked:${host.bootId}:${sessionId}` }
    },
    finalizeTranscript,
    // No provider has a verified daemon/background boundary yet. The runtime
    // defaults agent quiescence to unknown, even when its root PTY has exited.
    onState: state => { ptys.setTermination(state); syncPower() }
  })

  startTranscriptRecovery()

  return { estateId: ACTIVE_ESTATE, estateName: estate?.name ?? 'org #1' }
}

/** Preserve a runtime diagnostic without ending a Run or accepting work. The
 * complete Stop receipt is owned by nativeStopRuntime/SQL, never this taxonomy. */
async function recordSessionExit(sessionId: string, exitCode: number | null, requestedByFabric: boolean): Promise<void> {
  const taskId = taskBySession.get(sessionId)
  if (!taskId || requestedByFabric) return
  try {
    const { data, error } = await store.select('project_tasks', 'project_id,status').eq('id', taskId).maybeSingle()
    if (error || !data) throw new Error('Task exit context unavailable')
    // A reported result/review outranks a generic process-exit diagnosis.
    if (['review', 'finished', 'cancelled', 'done'].includes(data.status as string)) return
    const failure = classifyFailure({ exitCode })
    if (!failure) return
    await journal.append({ estateId: ACTIVE_ESTATE, type: 'session.ended@1',
      actor: { kind: 'system', id: 'session-exit' }, projectId: data.project_id as string,
      payload: { id: taskId, session_id: sessionId, exit_code: exitCode,
        kind: failure.kind, origin: failure.origin, certainty: failure.certainty,
        retryability: failure.retryability, recovery: failure.recovery,
        abnormal: failure.abnormal, says: failure.says } })
  } catch {
    ops.failed('session.exit-diagnostic', new Error('Exit diagnostic remains unavailable'), { sessionId })
  }
}

/** Bounded background pages; retained receipts retry without blocking startup.
 * Restarting bootstrap cancels this scheduler, not an already submitted DB write. */
let recoveryGeneration = 0
let recoveryTimer: ReturnType<typeof setTimeout> | null = null
function startTranscriptRecovery(): void {
  const generation = ++recoveryGeneration
  if (recoveryTimer) clearTimeout(recoveryTimer)
  const recover = createTranscriptRecovery({ estateId: ACTIVE_ESTATE, db,
    recover: page => ptys.recoverTranscriptFinalizations(page),
    settle: sessionId => { if (generation === recoveryGeneration) ptys.settleTranscript(sessionId) },
    report: (sessionId, reason) => ops.failed('startup.transcript-recovery', new Error(reason),
      sessionId ? { sessionId } : undefined) })
  const tick = async (): Promise<void> => {
    if (generation !== recoveryGeneration) return
    let delay = 60_000
    try { const result = await recover(); if (result.remaining > 0) delay = 50 }
    catch { ops.failed('startup.transcript-recovery', new Error('capture_recovery_pending')) }
    if (generation === recoveryGeneration) {
      recoveryTimer = setTimeout(() => void tick(), delay)
      recoveryTimer.unref()
    }
  }
  void tick()
}
app.on('will-quit', () => { recoveryGeneration++; if (recoveryTimer) clearTimeout(recoveryTimer) })

function toTranscript(row: Record<string, unknown>): SessionTranscript {
  return {
    sessionId: row.session_id as string,
    optionId: (row.option_id as string | null) ?? null,
    annotation: (row.annotation as string) ?? '',
    excerpt: (row.excerpt as string) ?? '',
    body: row.body as string | undefined,
    bytes: Number(row.bytes ?? 0),
    lines: Number(row.lines ?? 0),
    truncated: Boolean(row.truncated),
    startedAt: (row.started_at as string | null) ?? null,
    endedAt: (row.ended_at as string | null) ?? null,
    capturedAt: (row.captured_at as string | null) ?? null,
    endingProvenance: row.ending_provenance === 'observed' ? 'observed' : row.ending_provenance === 'unknown' ? 'unknown' : 'legacy',
    exitCode: (row.exit_code as number | null) ?? null
  }
}

/** M56 — git state, cached and watched; never read from a render (CO-098). */
const repoStates = createRepoStateReader()
/**
 * M57, reopened by M113 — what the code is doing, as opposed to what our own
 * storage holds. Its own reader with its own longer TTL: it is heavier than the
 * repository state and it answers a question about weeks rather than about the
 * last keystroke.
 */
const codeStats = createCodeStatsReader()
/** The window every project statistic is counted over. Carried WITH the
 *  numbers, because "12 commits" is not a fact without it. */
const STATS_WINDOW_DAYS = 7
/** M83 — the account's quota, cached with its age. */
const quota = createQuotaReader()

/** M73 — holds the machine awake while agents work, per the operator's policy. */
let power: PowerKeeper | null = null

/**
 * The keeper is told the count, never incremented and decremented: a counter
 * that drifts holds a laptop awake forever and nothing in the interface would
 * ever say so. The count is READ from the session manager, which observes it.
 */
function syncPower(): void {
  power?.setActiveSessions(ptys?.list().filter((s) => s.running).length ?? 0)
}

/** SEC-REQ-016: what the filesystem API may reach at all. */
const fileRoots = new FileRoots()

/** Which window is asking. A dialog grant belongs to it and dies with it — the
 *  sender id is stable for the window's lifetime, which is exactly the lifetime
 *  the grant should have (S02.roots). */
const scopeOf = (event: Electron.IpcMainInvokeEvent): string => `win:${event.sender.id}`

/** Called for every window as it closes, so a folder it was allowed to reach
 *  does not outlive it. */
/** A start-path parent chosen in a window, and that window's running scan (ADR-0100) — both end with it. */
const parentChoices = new ParentChoices()
/** How each session being opened by a managed launch was admitted, for the length of `ptys.open` — the
 *  context pack's demand is decided by it (`contextPack.ts#contextDemandFor`). */
const launchTriggerBySession = new Map<string, LaunchTrigger>()
const startScans = new Map<string, AbortController>()
/** The repositories main listed for each window's scan and kept scan: what `projects.create` and
 *  `repos.attach` may admit besides the window's own roots (iteration 2, errors finding 2). */
const scanCandidates = new ScanCandidates()
/** A window's repository paths, admitted against what THAT window can reach, or the whole call refused. */
const admitForWindow = (event: Electron.IpcMainInvokeEvent, paths: unknown): string[] =>
  admitRepoPaths(paths, scopeOf(event), { granted: (p, scope) => fileRoots.resolve(p, scope), candidates: scanCandidates })

export function revokeWindowRoots(webContentsId: number): void {
  const scope = `win:${webContentsId}`
  fileRoots.revoke(scope)
  parentChoices.revoke(scope)
  scanCandidates.revoke(scope)
  startScans.get(scope)?.abort()
  startScans.delete(scope)
}

async function refreshFileRoots(): Promise<void> {
  // Every page, or the roots stay as they were (release review iteration 2, data finding 3): one capped
  // request reset the roots to the first 1000 repositories (`fileRootsRefresh.ts`).
  const refreshed = await refreshFileRootsFrom(store, (paths) => fileRoots.reset(paths), (failed) =>
    ops.failed('index.could-not-refresh-file-roots', failed, { note: 'could not refresh file roots; the current roots are kept:' }))
  if (refreshed.state === 'kept') return
  const paths = refreshed.paths
  // The same set bounds the filesystem API and is watched for git changes: one
  // list of what the operator opened, two consumers (M56, SEC-REQ-016).
  // M107 — on its OWN channel. This broadcast used to go out on
  // `projects:repo-states`, the channel `ipcMain.handle` answers on, and no
  // renderer listened to it anywhere: the watch fired, the cache was dropped,
  // and nobody was told to read. M56 shipped saying "the watch makes it feel
  // immediate"; until this line had a listener on the other end, it did not.
  repoStates.watchAll(paths, (repoPath) => broadcast(IPC.projectsRepoChanged, repoPath))
}

async function readProject(id: string): Promise<ProjectRow> {
  const { data, error } = await store.select('projects', '*').eq('id', id).single()
  if (error) throw new Error(`project read failed: ${error.message}`)
  return data as ProjectRow
}

async function listRepos(projectId: string): Promise<RepoRow[]> {
  const { data, error } = await store
    .select('project_repos', '*')
    .eq('project_id', projectId)
    .order('attached_at', { ascending: true })
  if (error) throw new Error(`repositories read failed: ${error.message}`)
  return (data ?? []) as RepoRow[]
}

/** Which projects hold each folder, by real path, every page read (`startChoices.ts#indexImported`). */
async function readImportedIndex(): Promise<Map<string, { id: string; name: string }[]>> {
  const [repos, projects] = await Promise.all([
    store.selectAll('project_repos', 'path,project_id', { orderBy: ['project_id', 'path'] }),
    store.selectAll('projects', 'id,name', { orderBy: ['id'] })
  ])
  if (repos.failed || projects.failed) throw new Error(`projects read failed: ${repos.failed ?? projects.failed}`)
  return indexImported(repos.rows, projects.rows)
}

/**
 * A window's repository paths for `projectId`, admitted (`admitForWindow`) and none held by another
 * project (REQ-04, `refuseHeldByOther`) — or the whole call refused before anything is journalled.
 */
async function admitReposFor(event: Electron.IpcMainInvokeEvent, projectId: string, paths: unknown): Promise<string[]> {
  const admitted = admitForWindow(event, paths)
  if (admitted.length) refuseHeldByOther(admitted, projectId, await readImportedIndex())
  return admitted
}

async function attachRepos(projectId: string, paths: string[]): Promise<void> {
  const existing = new Set((await listRepos(projectId)).map((r) => r.path))
  for (const raw of paths) {
    const p = raw.trim()
    if (!p || existing.has(p)) continue
    existing.add(p)
    await journal.append({
      estateId: ACTIVE_ESTATE,
      type: 'project.repo.attached@1',
      actor: OPERATOR_ACTOR,
      projectId,
      payload: { id: randomUUID(), path: p, label: p.split('/').filter(Boolean).pop() ?? p }
    })
  }
}

/**
 * The build's own account of itself, READ ONCE from the artifact (S07).
 *
 * Never `git rev-parse` at runtime. A packaged app has no repository under it,
 * so that answers about whatever directory it was launched from — with total
 * confidence, about somebody else's work — and a dev checkout moves under the
 * question. The file travels with the build or there is no answer, and "no
 * answer" is itself worth saying: before this, nothing in the running
 * application identified the build at all.
 *
 * Cached because it cannot change while the process lives, and a re-read per
 * window would be a chance for two windows to disagree.
 */
let manifestRead: ManifestRead | null = null
function installedBuild(): ManifestRead {
  if (manifestRead) return manifestRead
  // A packaged process reads only its own staged resource. Development may
  // locate a generated resource at either app layout; a present invalid file
  // refuses startup instead of borrowing another candidate’s identity.
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, 'build-manifest.json')]
    : [
        path.join(app.getAppPath(), 'resources', 'build-manifest.json'),
        path.join(app.getAppPath(), '..', '..', 'resources', 'build-manifest.json')
      ]
  manifestRead = readBuildManifestCandidates(candidates)
  return manifestRead
}

function registerIpc(meta: { estateId: string; estateName: string }): void {
  // When THIS process started watching, and the intervals the machine was
  // suspended for. Both belong to the observer's honesty rather than to the
  // agents: a stall reported from an interval nobody watched is a guess
  // wearing the clothes of a measurement (M179).
  //
  // HOISTED ABOVE THE HANDLERS (AX-02) and read through `hostWindow()` by BOTH
  // consumers. It used to sit beside the observer's construction, below every
  // handler, so `runs.status` could not reach it — and that is exactly why the
  // widget passed no gap at all and turned a sleeping laptop into an agent's
  // fault. One window, two readers.
  const watchingSince = Date.now()
  const suspendedIntervals: { from: number; to: number }[] = []
  let suspendedAt: number | null = null
  powerMonitor.on('suspend', () => {
    suspendedAt = Date.now()
  })
  powerMonitor.on('resume', () => {
    if (suspendedAt !== null) suspendedIntervals.push({ from: suspendedAt, to: Date.now() })
    suspendedAt = null
    // Bounded: the window only needs the recent past, and an unbounded list on
    // a laptop that sleeps nightly grows for as long as the app runs.
    if (suspendedIntervals.length > 50) suspendedIntervals.splice(0, suspendedIntervals.length - 50)
  })

  /** The host window both the observer and `runs.status` judge against. */
  const hostWindow = (): HostWindow => ({ watchingSince, suspended: suspendedIntervals, sourceHealthy: true })

  handle(IPC.metaInfo, async (e): Promise<Returns<FabricApi['meta']['info']>> => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const sessionId = [...sessionWindows.entries()].find(([, w]) => w === win)?.[0] ?? null
    const filePath = [...fileWindows.entries()].find(([, w]) => w === win)?.[0] ?? null
    const read = installedBuild()
    // The ESTATE's schema version, not this build's. Counting the local
    // migrations directory would answer with the artifact's own number, and
    // the whole question is whether the two agree — so that answer would make
    // them agree by construction. Null when the read fails: not version zero,
    // and not an out-of-date build.
    const version = await db.rpc('schema_version')
    const applied = version.error ? null : ((version.data as number | null) ?? null)
    return {
      ...meta,
      sessionId,
      filePath,
      build: read.ok ? read.manifest : null,
      buildLine: buildLine(read),
      compatibility: compatibilityOf({
        manifest: read.ok ? read.manifest : null,
        runtimeSchema: applied
      })
    }
  })

  // M118 — the workspace, and the mirror ADR-0002 asked for.
  //
  // `mirrorNow` is called after every DECLARED change and never after an
  // observed one. It is deliberately fire-and-forget with its failure LOGGED
  // rather than thrown: a mirror that cannot be written must not stop the
  // operator changing a project setting, and a failure that is silent is how
  // the estate and its history part company without anyone noticing.
  const mirrorNow = (): void => {
    const root = readSettings().workspace.path
    if (!root) return
    void writeWorkspace(root, store).catch((e) =>
      ops.failed('index.the-workspace-mirror-could-not-be-writte', e, { note: 'the workspace mirror could not be written:' })
    )
  }

  handle(IPC.projectsCreate, async (event, input: CreateProjectInput): Promise<Returns<FabricApi['projects']['create']>> => {
    // #region project-name-rule — docs: docs/adr/0100-first-run-and-start-paths.md#boundary
    // A name read from a folder on disk is checked here, not trusted (iteration 3): a code, never English.
    const nameProblem = projectNameProblem(input?.name)
    if (nameProblem) throw new Error(`project-name-refused:${nameProblem}`)
    // #endregion project-name-rule
    const name = (input.name as string).trim()
    const id = input.id
    if (!id) throw new Error('a project needs an id chosen by the caller')

    // A repeat of the SAME create finishes it rather than making a sibling. The
    // repository attach still runs: an attempt that journalled the project and
    // then failed attaching would otherwise be "already exists, nothing to do",
    // and the operator would be left with a project missing the repositories
    // they chose — a partial creation that looks complete.
    // #region repo-path-admission — docs: docs/adr/0100-first-run-and-start-paths.md#boundary
    // Every repository path the renderer names is checked here, not trusted: an absolute path to an
    // existing folder that THIS window can reach (its picker, a folder it made, the estate's repositories)
    // or that main listed for this window's scan, and held by no OTHER project (REQ-04) — or the create is
    // refused before anything is journalled (iteration 1: any string; iteration 2: any existing folder,
    // then exposed to every window; iteration 3: a repository another project held).
    const repoPaths = await admitReposFor(event, id, input.repoPaths)
    // #endregion repo-path-admission
    // A failed read is not "no such project" (iteration 1: it appended a second create that cleared the
    // project's folder).
    const { data: already, error: alreadyError } = await store.select('projects', 'id').eq('id', id).maybeSingle()
    if (alreadyError) throw new Error(`project read failed: ${alreadyError.message}`)
    if (already) {
      if (repoPaths.length) await attachRepos(id, repoPaths)
      await refreshFileRoots()
      return readProject(id)
    }

    await journal.append({
      estateId: ACTIVE_ESTATE,
      type: 'project.created@1',
      actor: OPERATOR_ACTOR,
      projectId: id,
      payload: {
        id,
        name,
        purpose: input.purpose?.trim() || null,
        repo_path: null, // derived from the repositories attached below
        memory_backend: input.memoryBackend ?? 'local',
        default_agent: input.defaultAgent ?? 'claude-code'
      }
    })
    if (repoPaths.length) await attachRepos(id, repoPaths)
    // The new project's folders join the estate's roots and the git watch now, not at the next restart.
    await refreshFileRoots()
    mirrorNow()
    return readProject(id)
  })

  handle(
    IPC.projectsUpdateSettings,
    async (_e, input: {
      id: string
      memoryBackend?: MemoryBackend
      defaultAgent?: string
      mcpServers?: string[]
    }): Promise<Returns<FabricApi['projects']['updateSettings']>> => {
      const payload: Record<string, unknown> = { id: input.id }
      if (input.memoryBackend) payload.memory_backend = input.memoryBackend
      if (input.defaultAgent) payload.default_agent = input.defaultAgent
      // Present-or-absent, not truthy: an EMPTY list is a decision ("this
      // project reaches nothing but Fabric") and `if (input.mcpServers)` would
      // silently drop it, leaving the old list in place.
      if (input.mcpServers !== undefined) payload.mcp_servers = input.mcpServers
      await journal.append({
        estateId: ACTIVE_ESTATE,
        type: 'project.settings.updated@1',
        actor: OPERATOR_ACTOR,
        projectId: input.id,
        payload
      })
      mirrorNow()
      return readProject(input.id)
    }
  )

  /**
   * One append for the settings panel, against the revision it was typed at
   * (UX28-11).
   *
   * The compare-and-set is in `saveProjectSettings` — before the append,
   * because a journal cannot refuse a fact it has already recorded. The handler
   * only supplies the two primitives: the scoped store, and an append that
   * takes the payload the command decided on.
   */
  handle(
    IPC.projectsSaveSettings,
    async (_e, input: SaveSettingsInput): Promise<Returns<FabricApi['projects']['saveSettings']>> => {
      const result = await saveProjectSettings(
        {
          store,
          append: (payload, projectId) =>
            journal.append({
              estateId: ACTIVE_ESTATE,
              type: CONFIGURED,
              actor: OPERATOR_ACTOR,
              projectId,
              payload
            })
        },
        input
      )
      // The gateway grant list can change what a session may reach, so the
      // mirror is refreshed on a landed save exactly as `updateSettings` does —
      // and NOT on a refusal or a conflict, where nothing was recorded.
      if (landed(result)) mirrorNow()
      return result
    }
  )

  handle(IPC.projectsStats, async (_e, projectId: string): Promise<Returns<FabricApi['projects']['stats']>> => {
    // One statement, one snapshot (migration 9). Assembling this from several
    // reads produced a row whose numbers were each true and whose combination
    // never existed at any instant.
    const [{ data, error }, repos] = await Promise.all([
      db.rpc('project_stats', { p_project_id: projectId }).maybeSingle(),
      listRepos(projectId)
    ])
    if (error) throw new Error(`project stats failed: ${error.message}`)
    const primaryRepo = repos[0] ?? null
    const row = (data ?? {}) as Record<string, unknown>
    return {
      // Sessions are observed in this process, not in the database — the one
      // number here that is a measurement rather than a count.
      agentsRunning: ptys.list(projectId).filter((s) => s.running).length,
      repos: Number(row.repos ?? 0),
      memoryFacts: Number(row.memory_facts ?? 0),
      memorySuperseded: Number(row.memory_superseded ?? 0),
      transcripts: Number(row.transcripts ?? 0),
      transcriptChars: Number(row.transcript_chars ?? 0),
      retrievals: Number(row.retrievals ?? 0),
      retrievalMisses: Number(row.retrieval_misses ?? 0),
      events: Number(row.events ?? 0),
      lastActivityAt: (row.last_activity_at as string | null) ?? null,
      // M57 — the project's own numbers, read from the PRIMARY repository. Null
      // when nothing is attached: a project with nothing to measure must not
      // read as a project where nothing happened.
      code: primaryRepo ? await codeStats.read(primaryRepo.path, STATS_WINDOW_DAYS) : null
    }
  })

  handle(IPC.projectsRepoStates, async (_e, projectId: string): Promise<Returns<FabricApi['projects']['repoStates']>> => {
    const repos = await listRepos(projectId)
    return Promise.all(repos.map((r) => repoStates.read(r.path)))
  })

  handle(IPC.quotaRead, (): Promise<Returns<FabricApi['quota']['read']>> => quota.read())

  handle(IPC.transcriptsList, async (_e, projectId: string): Promise<Returns<FabricApi['transcripts']['list']>> => {
    const { data, error } = await store
      .select('session_transcripts', 'session_id,option_id,annotation,excerpt,bytes,lines,truncated,started_at,ended_at,exit_code,captured_at,ending_provenance')
      .eq('project_id', projectId)
      .order('seq', { ascending: false })
      .limit(30)
    if (error) throw new Error(`transcripts read failed: ${error.message}`)
    return (data ?? []).map(toTranscript)
  })

  handle(IPC.transcriptsGet, async (_e, sessionId: string): Promise<Returns<FabricApi['transcripts']['get']>> => {
    const { data, error } = await store
      .select('session_transcripts', 'session_id,option_id,annotation,excerpt,body,bytes,lines,truncated,started_at,ended_at,exit_code,captured_at,ending_provenance')
      .eq('session_id', sessionId)
      .maybeSingle()
    if (error) throw new Error(`transcript read failed: ${error.message}`)
    return data ? toTranscript(data) : null
  })

  // AX-04 — the durable answer to "what did this session run from". The packet
  // store has held these bytes since PF-05.02 and NOTHING read them back:
  // `readPart` had zero consumers in the repository, so the record existed and
  // no path in the product asked for it, which from the operator's side is the
  // same as having lost it.
  const pastContext = createPastContext({ root: app.getPath('userData') })
  handle(IPC.contextPast, async (_e, sessionId: string): Promise<Returns<FabricApi['transcripts']['context']>> =>
    pastContext.read(sessionId)
  )

  /**
   * Start a task and open its session. EXTRACTED from the IPC handler because
   * M134's research door needs the same act: two implementations of "start a
   * task" are two implementations free to disagree about what gets journalled.
   */
  const startTask = async (input: {
    projectId: string
    instruction: string
    optionId: string
    preset?: string
    presetEdited?: boolean
    permissionMode?: string | null
    // A dispatch that ADVANCES an existing task rather than minting a new one
    // (PF-07.01). A chain advance passes the backlog follower's own id, so the
    // trigger reuses that identity instead of spawning a duplicate and leaving
    // the follower in backlog to be advanced again next tick.
    followerId?: string
    // run/node/revision/attempt idempotency key. Recorded on the started event
    // so a repeated advance is one attempt, not two.
    idempotencyKey?: string
    launchAdmission?: LaunchInput['admission']
  }): Promise<{ task: TaskRow; session: { sessionId: string } }> => {
      const { instruction, title } = prepareTaskText(input.instruction)
      const id = input.followerId ?? randomUUID()
      // Record requested work in backlog. Only receiver ACK moves it to running.
      if (!input.followerId) await journal.append({
        estateId: ACTIVE_ESTATE, type: 'task.created@1', actor: OPERATOR_ACTOR,
        projectId: input.projectId,
        payload: { id, title, instruction,
          option_id: input.optionId, preset: input.preset ?? null,
          preset_edited: input.presetEdited ?? false,
          idempotency_key: input.idempotencyKey ?? null }
      })
      const launched = await launchManaged({ taskId: id,
        trigger: input.followerId ? 'chain' : input.preset === 'routine' ? 'routine' : 'operator',
        admission: input.launchAdmission, instruction: input.followerId ? instruction : undefined,
        permissionMode: input.permissionMode })
      if (!launched.started) throw new Error(launched.says)
      const { data, error } = await store.select('project_tasks', '*').eq('id', id).single()
      if (error) throw new Error('The session started, but the task could not be read back. Refresh the board.')
      return { task: data as TaskRow, session: { sessionId: launched.sessionId } }
  }

  /**
   * What the NEXT agent would be told, without starting one (M191).
   *
   * Measured before this: the only way to see a context pack was to launch a
   * session, because `compileContextPack` had exactly one caller and it was
   * the launch — which appends `context.compiled@1` and spawns a process. The
   * memory screen even carries the comment "context packs are compiled per
   * session and have no screen".
   *
   * IT APPENDS NOTHING AND SPAWNS NOTHING. That is the whole invariant, and it
   * is what makes this a preview rather than a launch whose result is thrown
   * away.
   *
   * It calls the SAME compile the launch does, deliberately. A preview that
   * re-implemented the selection would drift from the thing it previews, and
   * an operator would tune a budget against rules the launch does not use.
   */
  handle(
    IPC.memoryPreview,
    async (
      _e,
      projectId: string,
      budget?: number
    ): Promise<Returns<FabricApi['memory']['preview']>> => {
      const pack = await compileContextPack({ store, projectId, budget })
      return {
        markdown: pack.markdown,
        sha256: pack.sha256,
        compilerRevision: pack.compilerRevision,
        budget: pack.budget,
        chars: pack.chars,
        includedFacts: pack.factIds.length,
        includedTranscripts: pack.transcriptIds.length,
        omittedFacts: pack.omittedFacts,
        omittedTranscripts: pack.omittedTranscripts,
        read: pack.read
      }
    }
  )

  /**
   * What is happening right now, composed from what the estate already records
   * (M189).
   *
   * Measured before this: the agent tile showed `session.state` — `running |
   * idle | ended` from one subtraction against a sixty-second timer, which is
   * exactly the signal M178 replaced. A thinking agent, one blocked on an
   * unanswered question and one whose process is wedged all read `idle`, while
   * the estate had recorded which of the three it was since M179.
   *
   * NOTHING NEW IS DERIVED HERE. The liveness comes from `deriveLiveness` with
   * the observer's own thresholds, the run from M188's table, the claim from
   * M178's heartbeat. A second derivation would drift from the one the observer
   * records, and the operator would be reading a different answer from the one
   * in the journal.
   */
  handle(
    IPC.runsStatus,
    async (_e, sessionId: string): Promise<Returns<FabricApi['runs']['status']>> => {
      const live = ptys.list().find((s) => s.sessionId === sessionId) ?? null
      const at = new Date().toISOString()
      const now = Date.now()

      // ONE OBSERVATION, shared with the watcher (AX-02).
      //
      // This handler used to assemble `deriveLiveness`'s input itself and
      // decide for itself what it did not know: no observation gap,
      // `orientedAt: null` on every call, and the wait target selected and then
      // dropped. Measured against one fresh, oriented, beating session, the
      // watcher said `working | available` and this said `stalled | available`
      // — a healthy agent reported broken, at complete coverage, for a record
      // that existed and that this reader never asked for.
      //
      // `livenessFor` makes the reads and `livenessInputFrom` assembles them,
      // so the two consumers cannot disagree about a session again. The gap is
      // classified HERE too, from the same host window the observer uses: host
      // sleep is the observer's silence and must not become this agent's fault.
      const snapshot = await livenessFor(store, {
        sessionId,
        session: live
          ? {
              processEnded: !live.running,
              lastOutputAt: Date.parse(live.lastActivityAt),
              startedAt: Date.parse(live.startedAt)
            }
          : null,
        beatsSupported: isAvailable(
          declaredCapabilities({
            runnerId: live?.optionId ?? 'claude-code',
            adapter: AGENTS.find((a) => a.id === live?.optionId)?.surfaceAdapter ?? 'none',
            connectsToSurface: AGENTS.find((a) => a.id === live?.optionId)?.connectsToSurface ?? false,
            now
          }),
          'heartbeat'
        ),
        host: hostWindow(),
        thresholds: DEFAULT_THRESHOLDS,
        now
      })
      const sources = snapshot.sources
      const reading = deriveLiveness(snapshot.input)
      const run = snapshot.run ?? undefined
      const beat = snapshot.input.heartbeat
      const blockers = snapshot.blockers
      const taskTitle = snapshot.taskTitle

      const view: RunStatusView = {
        taskId: run?.task_id ?? null,
        taskTitle,
        runRef: run?.task_run_id ?? null,
        ordinal: run?.run_ordinal ?? null,
        runState: (run?.state as RunStatusView['runState']) ?? null,
        runOutcome: (run?.outcome as RunStatusView['runOutcome']) ?? null,
        claim: {
          phase: beat?.phase ?? null,
          reportedAt: beat ? new Date(beat.receivedAt).toISOString() : null,
          // THE WAIT TARGET REACHES THE SURFACE. It was selected from
          // `session_heartbeats` and dropped before the derivation; now it
          // travels with the claim, so a waiting agent can say what it waits
          // on rather than merely looking quiet.
          waitingOn: beat?.waitingOn ? { kind: beat.waitingOn.kind, id: beat.waitingOn.id } : null
        },
        observation: {
          liveness: reading.state,
          reason: reading.reason,
          coverage: reading.coverage,
          processRunning: Boolean(live?.running),
          lastOutputAt: live?.lastActivityAt ?? null,
          /** What this reading was computed from, and what nobody read. */
          evidence: reading.evidence,
          unread: snapshot.unread
        },
        // EXPLICIT UNKNOWN, never a zero. `blockers` was
        // `(read.data ?? []).length`, so a refused query reported a task with
        // no blockers at all — the sixth time this cycle a refusal has arrived
        // as a confident measurement.
        blockers: blockers.known ? blockers.count : null,
        // No plan steps exist yet (M188 named PlanRevision and StepClaim as not
        // built), so this is zero — and `progressLine` says "no plan declared"
        // rather than rendering 0 of 0, which a bar draws as complete.
        steps: { done: 0, declared: 0, skipped: 0, failed: 0 }
      }
      return envelope({ data: view, sources, asOf: at })
    }
  )

  handle(IPC.tasksStart, async (_e, input: Parameters<FabricApi['tasks']['start']>[0]): Promise<Returns<FabricApi['tasks']['start']>> =>
    startTask({ projectId: input.projectId, instruction: input.instruction, optionId: input.optionId,
      preset: input.preset, presetEdited: input.presetEdited, permissionMode: input.permissionMode })
  )

  /**
   * Start a task that ALREADY EXISTS (S04).
   *
   * Measured before this: nothing could. Every launch path called `startTask`,
   * which appends a fresh `task.started@1` — so a task sitting on the board at
   * `backlog` could never be run, and the blocking set S06 computes was
   * consulted nowhere, because a brand-new task has no blockers by
   * construction. Two unanswered questions on a task stopped nothing.
   *
   * Admission is a separate act from creation, and it happens in ONE
   * transaction under a lock on the task: nonterminal, not already running,
   * every blocker answered, and holding the only launch lease. The refusal
   * carries a reason code a surface can act on, and it is RETURNED rather than
   * thrown (M106).
   */
  handle(
    IPC.tasksStartExisting,
    async (_e, taskId: string): Promise<Returns<FabricApi['tasks']['startExisting']>> => {
      const result = await launchManaged({ taskId, trigger: 'operator' })
      if (!result.started) return { admitted: false, reasonCode: result.reasonCode,
        says: result.says, retryable: false, admissionRecorded: result.admissionRecorded,
        taskRunId: result.runId, sessionId: result.sessionId }
      return { admitted: true, taskId, sessionId: result.sessionId,
        deliveryId: result.deliveryId, deliveryState: result.deliveryState, says: result.says }
    }
  )

  /**
   * The board's query, and its SHAPE is the point (M146).
   *
   * A flat `limit(30)` ordered by time is right for a recent-tasks list and
   * wrong for a board: once thirty tasks exist, an old backlog item silently
   * stops being rendered — a task that vanished, which is exactly what the
   * board exists to prevent. So the two halves are read differently, because
   * they mean different things: OPEN WORK IS UNBOUNDED, since every piece of it
   * is someone's obligation, and outcomes are capped, since a done column is a
   * tail rather than a workload.
   */
  handle(IPC.tasksList, async (_e, projectId: string): Promise<Returns<FabricApi['tasks']['list']>> => {
    // M190 — THE CAP IS DECLARED. This returned a flat array of open plus the
    // twenty most recent closed and said nothing about the cut, so a consumer
    // counting the array counted a truncated set as the whole: a project with
    // two hundred finished tasks handed the renderer twenty and no indication
    // that it had. ADR-0042's rule for these screens is that nodes are not
    // silently removed, and a count from a capped read is exactly that removal
    // done by arithmetic.
    const [open, closed, closedCount] = await Promise.all([
      store
        .select('project_tasks', '*')
        .eq('project_id', projectId)
        .in('status', ['backlog', 'running', 'review'])
        .order('started_at', { ascending: false }),
      store
        .select('project_tasks', '*')
        .eq('project_id', projectId)
        .in('status', ['done', 'cancelled'])
        .order('finished_at', { ascending: false, nullsFirst: false })
        .limit(CLOSED_TASK_CAP),
      // Counted, not guessed. Without this the honest answer would be "there
      // may be more", which is true and useless — an operator cannot tell
      // "twenty of twenty-one" from "twenty of two hundred".
      store
        .select('project_tasks', 'id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .in('status', ['done', 'cancelled'])
    ])
    if (open.error) throw new Error(`tasks read failed: ${open.error.message}`)
    if (closed.error) throw new Error(`tasks read failed: ${closed.error.message}`)
    const rows = [...(open.data ?? []), ...(closed.data ?? [])] as TaskRow[]
    return {
      tasks: rows,
      closed: coverageOfList({
        returned: (closed.data ?? []).length,
        // A failed count is `null`, which reads as "nobody counted" rather
        // than as "nothing was cut" (S14).
        available: closedCount.error ? null : (closedCount.count ?? null),
        cap: CLOSED_TASK_CAP
      })
    }
  })

  /**
   * The operator's half of the ladder (M146 step 4).
   *
   * The SAME `mayMove` the agent surface uses, asked with `person` instead of
   * `agent` — which is the whole point of the table living in `shared/`. Two
   * copies of a permission rule is how a rule stops being one, and the copy
   * that drifts is always the one nobody is looking at.
   *
   * A refusal comes back as a VALUE. Throwing would make the renderer's error
   * boundary decide what the operator sees, and what they must see here is the
   * ladder's own sentence about why the move is not available.
   */
  handle(IPC.tasksMove, async (_e, taskId: string, to: TaskState): Promise<Returns<FabricApi['tasks']['move']>> => {
    const { data: task } = await store
      .select('project_tasks', 'id,project_id,status')
      .eq('id', taskId)
      .maybeSingle()
    if (!task) return { ok: false, reason: 'that task no longer exists' }
    const verdict = mayMove('person', task.status as TaskState, to)
    if (!verdict.ok) return verdict
    await journal.append({
      estateId: ACTIVE_ESTATE,
      type: 'task.moved@1',
      actor: OPERATOR_ACTOR,
      projectId: task.project_id as string,
      payload: { task_id: taskId, from: task.status, to }
    })
    return { ok: true }
  })

  handle(
    IPC.tasksClose,
    async (
      _e,
      taskId: string,
      outcome: 'done' | 'cancelled',
      reason?: string
    ): Promise<Returns<FabricApi['tasks']['close']>> => {
      // A cancellation with no reason is a task that vanished, and the decision
      // behind it vanishes with it. The check is here rather than only in the
      // dialog because a dialog is a suggestion and this is the rule.
      if (outcome === 'cancelled' && (reason ?? '').trim().length === 0)
        return { ok: false, reason: 'cancelling needs a reason — say what changed' }
      const { data: task } = await store
        .select('project_tasks', 'id,project_id,status')
        .eq('id', taskId)
        .maybeSingle()
      if (!task) return { ok: false, reason: 'that task no longer exists' }
      const verdict = mayMove('person', task.status as TaskState, outcome)
      if (!verdict.ok) return verdict
      await journal.append({
        estateId: ACTIVE_ESTATE,
        type: 'task.closed@1',
        actor: OPERATOR_ACTOR,
        projectId: task.project_id as string,
        payload: { task_id: taskId, outcome, reason: reason ?? null }
      })
      return { ok: true }
    }
  )

  /**
   * One task, whole (M146 step 5).
   *
   * Five reads in one call because five calls would be five moments in time,
   * and a page that shows a task's state beside receipts fetched a second later
   * is a page that can contradict itself on screen.
   *
   * The events are the task's RECEIPTS. They are found by matching the task id
   * inside the payload rather than by a foreign key, because the journal has no
   * schema per event type by design (ADR-0014) — the id is written under
   * different keys by different events, and that is the price of a spine that
   * accepts new vocabulary without a migration.
   */
  // M134 — the operator's own door onto the board.
  //
  // Before this, `task.created@1` had exactly ONE writer, the agent surface, and
  // the operator's only way to put anything on the board was to start a session.
  // The backlog was a place a person could not write to, which makes it a queue
  // rather than somewhere to think.
  // M127 — what the operator may choose from. The key never crosses: the
  // renderer has no use for it, and a secret that travels a bridge it does not
  // need is a secret in a devtools console.
  handle(
    IPC.proposalDecide,
    async (_e, id: string, decision: 'accepted' | 'declined'): Promise<Returns<FabricApi['proposals']['decide']>> => {
      // M168 — ONE checker, and this handler is no longer where the rules live.
      // It used to read the row, check `decided_at is null` itself, and append
      // two events in sequence. The agent surface checked something else
      // entirely, and neither shared a line. `check-checker.mjs` refuses a
      // proposal event appended anywhere but the command module.
      //
      // A refusal is RETURNED, not thrown. M106: a thrown error reaches the
      // renderer as "Error invoking remote method", and a checker experienced
      // that way is a broken button rather than an answer.
      return decideProposal({
        store,
        journal,
        db,
        estateId: ACTIVE_ESTATE,
        actor: OPERATOR_ACTOR,
        proposalId: id,
        decision
      })
    }
  )

  // M65 — one read, not three. Three reads are three moments, and the operator
  // would be comparing a running list from one second against a history from
  // another.
  handle(IPC.automationsRead, async (_e, projectId: string): Promise<Returns<FabricApi['automations']['read']>> => {
    const [running, routines, ran, paused] = await Promise.all([
      store
        .select('project_tasks', 'id,title,instruction,started_at')
        .eq('project_id', projectId)
        .eq('status', 'running')
        .order('started_at', { ascending: false }),
      store.select('routines', '*').eq('project_id', projectId).order('created_at'),
      store
        .select('journal', 'occurred_at,payload')
        .eq('project_id', projectId)
        .eq('type', 'routine.ran@1')
        .order('seq', { ascending: false })
        .limit(AUTOMATION_WINDOW),
      store
        .select('journal', 'occurred_at,payload')
        .eq('project_id', projectId)
        .eq('type', 'routine.paused@1')
        .order('seq', { ascending: false })
        .limit(AUTOMATION_WINDOW)
    ])

    // M186 — A REFUSED READ IS NOT AN EMPTY HISTORY. Both windows destructured
    // `data` past `error`, so a query that failed rendered as "this routine has
    // never run" — the exact defect S14 exists to prevent, still standing here.
    // The receipts say which sources answered; a caller reading `unread` knows
    // the difference between silence and a hole.
    const unread = [
      ['runs', ran],
      ['pauses', paused]
    ]
      .filter(([, r]) => (r as { error: unknown }).error)
      .map(([name]) => name as string)

    const runs = [
      ...(ran.data ?? []).map((e) => ({
        routineId: (e.payload as { id: string }).id,
        at: e.occurred_at as string,
        outcome: 'ran' as const,
        taskId: ((e.payload as { task_id?: string }).task_id ?? null) as string | null,
        reason: null
      })),
      ...(paused.data ?? []).map((e) => ({
        routineId: (e.payload as { id: string }).id,
        at: e.occurred_at as string,
        outcome: 'paused' as const,
        taskId: null,
        reason: ((e.payload as { reason?: string }).reason ?? null) as string | null
      }))
    ]

    // Which routine started a running task, so "running now" can say whether a
    // person or a schedule began it.
    const byTask = new Map<string, string>()
    for (const e of ran.data ?? []) {
      const p = e.payload as { id: string; task_id?: string }
      if (p.task_id) byTask.set(p.task_id, p.id)
    }

    return {
      running: (running.data ?? []).map((t) => ({
        taskId: t.id as string,
        title: (t.title as string | null) ?? (t.instruction as string),
        startedAt: t.started_at as string,
        routineId: byTask.get(t.id as string) ?? null
      })),
      routines: (routines.data ?? []) as RoutineRow[],
      states: automationStates(runs),
      /** Which of the history windows could not be read (M186). A screen
       *  showing "never run" over a refused query is stating an absence it did
       *  not observe. */
      unread,
      /** And both windows are capped. A history that stops at 200 and says
       *  nothing is a claim about completeness (M190's rule, third site). */
      historyCoverage: coverageOfList({
        returned: (ran.data ?? []).length + (paused.data ?? []).length,
        available: null,
        cap: AUTOMATION_WINDOW * 2
      })
    }
  })

  handle(IPC.routinesList, async (_e, projectId: string): Promise<Returns<FabricApi['routines']['list']>> => {
    const { data, error } = await store
      .select('routines', '*').eq('project_id', projectId).order('created_at')
    if (error) throw new Error(`routines read failed: ${error.message}`)
    return (data ?? []) as RoutineRow[]
  })

  handle(
    IPC.routinesDefine,
    async (
      _e,
      input: {
        projectId: string
        instruction: string
        optionId: string
        everyMinutes: number
        kind?: 'fixed' | 'backlog'
      }
    ): Promise<Returns<FabricApi['routines']['define']>> => {
      const instruction = input.instruction?.trim()
      // A backlog routine composes its own instruction, so the field is a NOTE
      // about what it is for rather than what gets run. It is still required:
      // an unlabelled routine in a list of three is one nobody can tell apart.
      if (!instruction) throw new Error('a routine needs an instruction')
      // The floor is the schema's, repeated here so the refusal is a sentence
      // rather than a constraint violation.
      if (!(input.everyMinutes >= 5))
        throw new Error(
          'a routine runs at most every five minutes — below that it is always due, which is a loop wearing a schedule'
        )
      const id = randomUUID()
      await journal.append({
        estateId: ACTIVE_ESTATE,
        type: 'routine.defined@1',
        actor: OPERATOR_ACTOR,
        projectId: input.projectId,
        payload: {
          id,
          project_id: input.projectId,
          instruction,
          option_id: input.optionId,
          every_minutes: input.everyMinutes,
          kind: input.kind ?? 'fixed'
        }
      })
      const { data, error } = await store.select('routines', '*').eq('id', id).single()
      if (error) throw new Error(`routine read-back failed: ${error.message}`)
      return data as RoutineRow
    }
  )

  handle(IPC.routinesSetEnabled, async (_e, id: string, enabled: boolean): Promise<Returns<FabricApi['routines']['setEnabled']>> => {
    const { data } = await store.select('routines', 'project_id').eq('id', id).single()
    await journal.append({
      estateId: ACTIVE_ESTATE,
      type: 'routine.updated@1',
      actor: OPERATOR_ACTOR,
      projectId: data?.project_id as string,
      payload: { id, enabled }
    })
  })

  // M125 — an agent created from a prompt.
  //
  // The authority check happens HERE, at creation, and again at launch. Here it
  // is the operator's answer to "can this project even do that"; at launch it is
  // the answer to "does it still". A grant removed after an agent was created
  // must not leave a live agent quietly reaching what the project no longer
  // allows, so neither check stands in for the other.
  handle(
    IPC.agentsCreate,
    async (
      _e,
      input: {
        projectId: string
        name: string
        instructions: string
        runnerId: string
        servers?: string[]
        permissionMode?: string | null
      }
    ): Promise<Returns<FabricApi['agents']['create']>> => {
      const verdict = readSpec(input)
      if (!verdict.ok) throw new Error(verdict.reason)

      const { data: project, error: perr } = await store
        .select('projects', 'mcp_servers').eq('id', input.projectId).single()
      if (perr) throw new Error(`project read failed: ${perr.message}`)
      const resolved = resolveServers(
        verdict.spec.servers,
        (project.mcp_servers as string[] | null) ?? []
      )
      if (!resolved.ok) throw new Error(resolved.reason)
      // One agent per name in a project (`nameTaken`, the rule the form shows before the click).
      const { data: named, error: nerr } = await store
        .select('agent_bindings', 'role').eq('project_id', input.projectId).not('instructions', 'is', null)
      if (nerr) throw new Error(`agents read failed: ${nerr.message}`)
      if (nameTaken(verdict.spec.name, (named ?? []).map((r) => ({ name: (r.role as string | null) ?? '' }))))
        throw new Error(agentNameRefusal(verdict.spec.name))

      const id = randomUUID()
      // #region one-agent-per-name — docs: docs/ux/scenarios.md#scn-130-start-a-new-agent-inside-a-project
      // The read above is the quick answer; the RULE is at the write boundary. Two creates of one name
      // could both pass that read, so `append_event` checks the name again under the estate's lock
      // (migration 72) and refuses the second; both answer with one code, `agentNameRefusal` (agent-name-refused:taken).
      try {
        await journal.append({
          estateId: ACTIVE_ESTATE,
          type: 'agent.registered@1',
          actor: OPERATOR_ACTOR,
          projectId: input.projectId,
          payload: {
            id,
            project_id: input.projectId,
            name: verdict.spec.name,
            runner_id: verdict.spec.runnerId,
            instructions: verdict.spec.instructions,
            mcp_servers: resolved.servers,
            permission_mode: input.permissionMode ?? null
          }
        })
      } catch (e) {
        if (agentNameTakenAtWrite(e)) throw new Error(agentNameRefusal(verdict.spec.name))
        throw e
      }
      // #endregion one-agent-per-name
      const { data, error } = await store
        .select('agent_bindings', '*').eq('id', id).single()
      if (error) throw new Error(`agent read-back failed: ${error.message}`)
      mirrorNow()
      return toCreatedAgent(data)
    }
  )

  handle(IPC.agentsList, async (_e, projectId: string): Promise<Returns<FabricApi['agents']['list']>> => {
    const { data, error } = await store
      .select('agent_bindings', '*')
      .eq('project_id', projectId)
      .not('instructions', 'is', null)
      .order('created_at', { ascending: false })
    if (error) throw new Error(`agents read failed: ${error.message}`)
    return (data ?? []).map(toCreatedAgent)
  })

  // M111 — the working set. Read once at start, written on every change.
  handle(IPC.tabsRead, async (): Promise<Returns<FabricApi['tabs']['read']>> => readSettings().tabs)
  handle(IPC.tabsWrite, async (_e, state: PersistedTabs): Promise<Returns<FabricApi['tabs']['write']>> => {
    writeSettings({ tabs: state })
  })

  handle(IPC.workspaceState, async (): Promise<Returns<FabricApi['workspace']['state']>> => readSettings().workspace)

  handle(IPC.workspaceDecline, async (): Promise<Returns<FabricApi['workspace']['decline']>> => {
    writeSettings({ workspace: { path: null, git: 'declined' } })
  })

  handle(IPC.workspaceChoose, async (): Promise<Returns<FabricApi['workspace']['choose']>> => {
    const picked = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      message: 'Where should Fabric keep the workspace?'
    })
    if (picked.canceled || picked.filePaths.length === 0) return { outcome: 'cancelled' }
    const root = picked.filePaths[0]
    // The files first, then the repository: a repository initialised over an
    // empty folder is a repository whose first commit would be empty, and the
    // operator's first look should show them their estate.
    await writeWorkspace(root, store)
    const repo = await initRepository(root)
    // The QUESTION is answered either way — they chose a folder, and the mirror
    // is written into it. Whether it carries version history is a different
    // fact, and it used to be returned and dropped (UXA-C03).
    writeSettings({ workspace: { path: root, git: 'yes' } })
    return repo.ok
      ? { outcome: 'ready', path: root }
      : {
          outcome: 'unversioned',
          path: root,
          reason: repo.reason ?? 'the reason was not recorded'
        }
  })

  // M13/M94/M132 — the tick that starts unattended work. It lives in
  // `routineTick.ts` because it is the one path that launches an agent with
  // nobody watching, and nothing had ever executed it: `index.ts` cannot be
  // imported (M110), so every check stopped at the pure parts. Extracted, it
  // takes its dependencies as arguments and a probe can drive it.
  const TICK_MS = 60_000
  // ONE DOOR for everything that starts without somebody watching (FA-03). The
  // routine tick and the chain advance spend the same account, so each holding
  // its own gate would let both authorise a start against one observation of
  // the remainder — which is the defect a gate exists to close, arriving by
  // having two of them.
  const unattended = createUnattendedAdmission()
  const admitExisting = createAdmitExisting(db)
  // AX-01 — the half of `task_runs` that did not exist. The table had five
  // states, an outcome vocabulary and a trigger refusing to reopen an ended run,
  // and nothing in this process had ever appended a `run.ended@1`.
  runs = createRunLifecycle({
    db,
    estateId: ACTIVE_ESTATE,
    actor: OPERATOR_ACTOR,
    onFailure: (op, says) => ops.failed(op, new Error(says))
  })
  // Runs this process cannot see a session for are COUNTED, never ended: absence on this host is not
  // proof of exit (managed stop owns endings). The count makes an orphaned run visible in the ops log.
  void runs.reconcile(ptys.list().map((s) => s.sessionId)).then((r) => {
    if (r.unobserved !== null) ops.record({ op: 'run.reconcile', outcome: 'ok', detail: { unobserved: r.unobserved }, ctx: { correlationId: ops.correlate() } })
  }, (e) => ops.failed('run.reconcile', e))
  const tick = createRoutineTick({
    store,
    journal,
    quota: () => quota.read(),
    admission: unattended,
    startTask,
    estateId: ACTIVE_ESTATE
  })
  // Local absence is not proof of exit, especially on another host. Keep
  // unresolved generations owned until the recovery path has process evidence.

  // Chains share this interval rather than adding one: two timers on the same
  // estate is two chances to start the same follower twice, and the guard that
  // stops it would have to know about both.
  const advanceChains = createChainAdvance({
    store,
    journal,
    quota: () => quota.read(),
    admission: unattended,
    // The SAME door the operator's Run uses. A chain step is that decision made
    // by a timer instead of by a person, and giving it its own mechanism is how
    // it ended up with one the database rejects.
    admitExisting: (taskId, sessionId) =>
      admitExisting({ estateId: ACTIVE_ESTATE, taskId, actor: { kind: 'system', id: 'chain' }, sessionId, trigger: 'chain' }),
    // AX-01 — the chain's runs end too. It admits through the same command as
    // the operator, so it inherits the same obligation: a run it opened and
    // never closed is an estate claiming work is in flight.
    startTask,
    estateId: ACTIVE_ESTATE
  })

  // S15 — the observer M179 built had no caller. It was written, tested against
  // a real store, and never once run against a live session: the exact shape
  // M179 itself was about, repeated in the same run. The cycle is what calls it.
  const observer = createRuntimeObserver({
    store,
    journal,
    estateId: ACTIVE_ESTATE,
    sessions: () =>
      ptys.list().map((s) => ({
        sessionId: s.sessionId,
        projectId: s.projectId,
        optionId: s.optionId,
        processEnded: !s.running,
        lastOutputAt: Date.parse(s.lastActivityAt),
        startedAt: Date.parse(s.startedAt)
      })),
    // The host window this pass is judging against. `watchingSince` is when
    // THIS process started watching, so work from before a restart is not
    // attributed to an observer that was not there.
    host: hostWindow
  })

  /**
   * One pass, and it leaves a receipt whether or not it did anything.
   *
   * The empty receipt is the point (ADR-0037). A row only when work happened
   * would leave the same hole the tick had: the silence of a healthy idle
   * estate and the silence of a closed laptop look identical.
   */
  const runCycle = async (): Promise<void> => {
    const started = Date.now()
    // COMPOSED, never defaulted (AX-08). This began at `completed` and could
    // only leave it by throwing — so the `partial` the tick already knew about
    // could not reach the receipt, and a refused routines read produced a row
    // saying the pass had completed. A window recorded complete is one the
    // watermark may step over.
    const states: WindowState[] = []
    let observed = 0
    let says = ''
    try {
      const pass = await tick()
      states.push(pass.state)
      says = pass.says
      // The chain pass reports too: a pass that could not read its links is not a completed window.
      const chains = await advanceChains()
      states.push(chains.state)
      if (chains.state !== 'completed' && chains.state !== 'skipped_no_delta') says = says ? `${says}; ${chains.says}` : chains.says
      observed = (await observer.sample()).length
    } catch (e) {
      states.push('failed_known')
      says = says || `the pass failed: ${String(e)}`
      ops.failed('cycle.run', e)
    }
    const state = worstOf(states)
    try {
      await journal.append({
        estateId: ACTIVE_ESTATE,
        type: 'cycle.ran@1',
        actor: { kind: 'system', id: 'cycle' },
        payload: {
          state,
          ms: Date.now() - started,
          sessions_observed: observed,
          says,
          // The invariant, RECORDED rather than merely available. Until AX-08
          // `advancesWatermark` was read by nothing but its own unit test, so
          // the rule it encodes — "advancing past work nobody can account for
          // is how work disappears" — applied nowhere. A reader of this row can
          // now tell a window it may step over from one it may not, without
          // re-deriving the vocabulary.
          advances: advancesWatermark(state)
        }
      })
    } catch (e) {
      // A cycle that ran and could not say so is worse than one that did not
      // run: the next reader sees a gap and concludes the app was closed.
      ops.failed('cycle.receipt', e, { note: 'the pass ran but left no receipt; a reader will see a gap' })
    }
  }

  const ticker = setInterval(() => {
    void runCycle()
  }, TICK_MS)
  app.on('will-quit', () => clearInterval(ticker))

  handle(IPC.workspaceImport, async (): Promise<Returns<FabricApi['workspace']['adopt']>> => {
    const picked = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      message: 'Which folder holds the workspace?'
    })
    // CANCELLED IS NOT REFUSED. This used to answer `ok: false` with the reason
    // "nothing was chosen", so a closed dialog and an estate that genuinely
    // cannot adopt were one shape — and a surface telling them apart would have
    // had to match on the message (UXA-C03).
    if (picked.canceled || picked.filePaths.length === 0) return { outcome: 'cancelled' }
    const root = picked.filePaths[0]
    // S12 — ONE transaction. The old callback appended event by event, so a
    // fault on the last row left the estate holding everything before it, in an
    // append-only journal with no way back.
    const result = await importWorkspace(root, store, async (input) => {
      const committed = await commitPreparedImport({
        rpc: (name, args) => db.rpc(name, args), estateId: ACTIVE_ESTATE, actor: OPERATOR_ACTOR
      }, input)
      return committed.state === 'committed' ? { ok: true } : { ok: false, reason: committed.reason }
    })
    // The setting is written only on success. A failed import that still pointed
    // Fabric at the folder would leave the next mirror write OVERWRITING the
    // files it just refused to read — the operator's estate destroyed by the
    // recovery path.
    if (!result.ok)
      return { outcome: 'refused', reason: result.reason ?? 'the reason was not recorded' }
    writeSettings({ workspace: { path: root, git: 'yes' } })
    // WHAT CAME IN, carried to the surface. The counts were computed by the
    // import and thrown away by the only caller, so an adoption that brought in
    // nothing looked exactly like one that brought in forty projects.
    return { outcome: 'adopted', projects: result.projects, agents: result.agents }
  })

  handle(IPC.workspaceCheck, async (): Promise<Returns<FabricApi['workspace']['check']>> =>
    checkWorkspace(readSettings().workspace.path, store)
  )

  handle(IPC.gatewayOffer, async (): Promise<Returns<FabricApi['gateway']['offer']>> => {
    const facts = readGateway()
    return { reachable: facts.origin !== null, servers: Object.keys(facts.routes).sort() }
  })

  handle(IPC.tasksFileIdea, async (_e, projectId: string, text: string): Promise<Returns<FabricApi['tasks']['fileIdea']>> => {
    const verdict = prepareIdeaText(text)
    if (!verdict.ok) throw new Error(verdict.reason)
    const id = randomUUID()
    await journal.append({
      estateId: ACTIVE_ESTATE,
      type: 'task.created@1',
      actor: OPERATOR_ACTOR,
      projectId,
      payload: {
        id,
        title: verdict.idea.title,
        instruction: verdict.idea.title,
        task_type: 'idea',
        // The rule survives rather than being waived: a card names what it came
        // out of, and for an idea that is the person who had it.
        origin: { kind: 'person', ref: OPERATOR_ACTOR.id }
      }
    })
    if (verdict.idea.note)
      await journal.append({
        estateId: ACTIVE_ESTATE,
        type: 'task.note.added@1',
        actor: OPERATOR_ACTOR,
        projectId,
        // `note_id` is the note's primary key in the projection, not an
        // optional label: without it the insert fails on a null key and takes
        // the whole append with it, so the idea would be filed and its note
        // silently lost. Read the projector's clause before writing an event.
        payload: { task_id: id, note_id: randomUUID(), body_md: verdict.idea.note }
      })
    const { data, error } = await store.select('project_tasks', '*').eq('id', id).single()
    if (error) throw new Error(`idea read-back failed: ${error.message}`)
    return data as TaskRow
  })

  // M134 — researching an idea SPAWNS work from it and leaves it alone.
  handle(
    IPC.tasksResearch,
    async (_e, taskId: string, optionId: string): Promise<Returns<FabricApi['tasks']['research']>> => {
      const { data: idea, error } = await store
        .select('project_tasks', 'id,project_id,title,instruction')
        .eq('id', taskId)
        .single()
      if (error) throw new Error(`idea read failed: ${error.message}`)

      const notes = await store
        .select('task_notes', 'body_md').eq('task_id', taskId).order('created_at').limit(1)
      const brief = researchBrief({
        title: (idea.title as string | null) ?? (idea.instruction as string),
        note: (notes.data?.[0]?.body_md as string | undefined) ?? null
      })

      const started = await startTask({
        projectId: idea.project_id as string,
        instruction: brief,
        optionId,
        preset: 'research'
      })
      // The link is what makes the report findable from the idea, and the idea
      // findable from the work. `spawned` is already in the vocabulary.
      //
      // THROUGH THE COMMAND (FA-04), not by appending here. This was the third
      // writer of `task.linked@1`, and like the other two it carried none of the
      // rules the tool applied — so the same edge was governed differently
      // depending on which door recorded it.
      const { data: link, error: linkError } = await db.rpc('link_tasks', {
        p_estate_id: ACTIVE_ESTATE,
        p_task_id: started.task.id,
        p_rel: 'spawned',
        p_target_id: taskId,
        p_actor: OPERATOR_ACTOR,
        p_project_id: idea.project_id as string
      })
      // The research task exists either way; what must not happen is reporting
      // a link that was not made. The operation log is where a failure that the
      // caller cannot act on goes — silence here would leave the report
      // unfindable from the idea with nothing saying why.
      const verdict = linkOutcome(link, linkError)
      if (!verdict.linked)
        ops.failed('task.link', new Error(linkRefusal(verdict) || 'the link was not recorded'), {
          task_id: started.task.id,
          target_id: taskId
        })
      return { task: started.task }
    }
  )

  handle(IPC.tasksDetail, async (_e, taskId: string): Promise<Returns<FabricApi['tasks']['detail']>> => {
    const { data: task, error } = await store
      .select('project_tasks', '*')
      .eq('id', taskId)
      .single()
    if (error) throw new Error(`task read failed: ${error.message}`)
    const [notes, links, lease, events] = await Promise.all([
      store.select('task_notes', '*').eq('task_id', taskId).order('created_at'),
      store.select('task_links', '*').eq('task_id', taskId),
      store.select('leases', 'owner_session,expires_at,write_scopes').eq('work_id', taskId).maybeSingle(),
      store
        .select('journal', '*')
        .eq('project_id', (task as TaskRow).project_id)
        .or(`payload->>id.eq.${taskId},payload->>task_id.eq.${taskId},payload->>work.eq.${taskId}`)
        .order('seq')
    ])
    // M124, the direction nothing could walk. Narrowed in the database by a
    // PREFIX and made exact here: `like 'a.md%'` also catches `a.md.bak`, and
    // the location is stripped so two tasks from different lines of one
    // document are siblings rather than strangers.
    const t = task as TaskRow
    const doc = t.origin_ref ? originDocument(t.origin_ref) : null
    const siblingRows =
      doc && t.origin_kind && hasSiblings(t.origin_kind)
        ? ((
            await store
              .select('project_tasks', 'id,title,instruction,status,origin_ref')
              .eq('project_id', t.project_id)
              .eq('origin_kind', t.origin_kind)
              .like('origin_ref', `${doc}%`)
              .neq('id', taskId)
              .limit(AUTOMATION_WINDOW)
          ).data ?? []).filter((r) => sameDocument(String(r.origin_ref ?? ''), doc))
        : []

    const targets = (links.data ?? []).map((l) => l.target_id as string)
    const titleRead = await store.selectIn('project_tasks', 'id,title,instruction', 'id', targets)
    if (titleRead.failed) ops.failed('tasks.detail-titles-unreadable', new Error(titleRead.failed))
    const titles = titleRead.rows
    return {
      task: task as TaskRow,
      notes: (notes.data ?? []) as TaskNote[],
      links: (links.data ?? []).map((l) => {
        const found = titles.find((x) => x.id === l.target_id)
        return {
          task_id: l.task_id as string,
          rel: l.rel as TaskLinkRow['rel'],
          target_kind: l.target_kind as TaskLinkRow['target_kind'],
          target_id: l.target_id as string,
          target_title: (found?.title as string | null) ?? (found?.instruction as string | null) ?? null
        }
      }),
      lease: lease.data
        ? {
            owner_session: lease.data.owner_session as string,
            expires_at: lease.data.expires_at as string,
            write_scopes: (lease.data.write_scopes as string[]) ?? []
          }
        : null,
      events: (events.data ?? []) as FeedEvent[],
      siblings: {
        total: siblingRows.length,
        shown: siblingRows.slice(0, 20).map((r) => ({
          id: r.id as string,
          title: (r.title as string | null) ?? (r.instruction as string),
          status: r.status as TaskState
        }))
      }
    }
  })

  handle(IPC.tasksNote, async (_e, taskId: string, body: string): Promise<Returns<FabricApi['tasks']['note']>> => {
    const text = body?.trim()
    if (!text) throw new Error('a note needs something in it')
    const { data: task } = await store
      .select('project_tasks', 'project_id')
      .eq('id', taskId)
      .single()
    await journal.append({
      estateId: ACTIVE_ESTATE,
      type: 'task.note.added@1',
      actor: OPERATOR_ACTOR,
      projectId: task?.project_id as string,
      payload: { task_id: taskId, note_id: randomUUID(), body_md: text }
    })
  })

  /**
   * A note leaves the task and becomes a fact (§1 of operating-surfaces.md).
   *
   * TWO EVENTS, and the order matters: the fact is recorded first, then the
   * note is marked with where it went. Reversed, a crash between them would
   * leave a note pointing at a fact that does not exist — a dangling claim,
   * which is worse than an unpromoted note.
   *
   * The note is NOT copied and NOT deleted. Its body stays where it was
   * written, and the fact carries the knowledge forward; the link is how the
   * task can still say "that is where this went".
   */
  handle(IPC.tasksPromote, async (_e, noteId: string): Promise<Returns<FabricApi['tasks']['promote']>> => {
    const { data: note, error } = await store
      .select('task_notes', 'id,task_id,project_id,body_md,promoted_fact_id')
      .eq('id', noteId)
      .single()
    if (error) throw new Error(`note read failed: ${error.message}`)
    if (note.promoted_fact_id)
      throw new Error('that note has already been promoted; it is in memory once')
    const factId = randomUUID()
    await journal.append({
      estateId: ACTIVE_ESTATE,
      type: 'memory.project.recorded@1',
      actor: OPERATOR_ACTOR,
      projectId: note.project_id as string,
      payload: {
        id: factId,
        claim: note.body_md as string,
        // The provenance IS the task: a fact promoted out of a note can always
        // say which piece of work taught it.
        source_ref: `task:${note.task_id}`,
        kind: 'finding',
        supersedes: null
      }
    })
    await journal.append({
      estateId: ACTIVE_ESTATE,
      type: 'task.note.promoted@1',
      actor: OPERATOR_ACTOR,
      projectId: note.project_id as string,
      payload: { task_id: note.task_id, note_id: noteId, fact_id: factId }
    })
    const { data: fact, error: readBack } = await store
      .select('memory_facts', '*')
      .eq('id', factId)
      .single()
    if (readBack) throw new Error(`fact read-back failed: ${readBack.message}`)
    return fact as MemoryFact
  })

  handle(
    IPC.tasksBrief,
    async (_e, taskId: string, section: BriefSection, body: string): Promise<Returns<FabricApi['tasks']['brief']>> => {
      const { data: task } = await store
        .select('project_tasks', 'project_id')
        .eq('id', taskId)
        .single()
      await journal.append({
        estateId: ACTIVE_ESTATE,
        type: 'task.brief.edited@1',
        actor: OPERATOR_ACTOR,
        projectId: task?.project_id as string,
        payload: { task_id: taskId, section, body_md: body }
      })
    }
  )

  /**
   * What needs the operator, across every project (M146 step 8).
   *
   * Four reads and one pure function. The reads are here because they are
   * queries; the ORDER and the shape are in `shared/attention.ts` under test,
   * because "a refusal outranks a review" is a judgement and judgements belong
   * where they can be argued with rather than buried in a SQL ORDER BY.
   *
   * Refusals are found in the journal rather than in a table: `policy.decided@1`
   * with a refusing verdict is the only record of an action that did not happen,
   * and an action that did not happen has no row anywhere else by construction.
   */
  /** Everything waiting on the operator. EXTRACTED so the notifier and the
   *  screen read the same thing: two similar queries are two answers that can
   *  differ, and the operator would be told about something the panel does not
   *  show. */
  /** How many refusals the derived queue looks back over. Named, because the
   *  window is a claim about completeness and an unnamed number cannot be one. */
  const REFUSAL_WINDOW = 50

  /**
   * The queue AND what could not be read to build it.
   *
   * The Board's envelope used to carry `{ name: 'obligations', status: 'ok' }`
   * as a literal, beside three receipts that were measured — so six reads could
   * fail underneath and the one source that had not been checked was the one
   * asserting it was fine. An envelope whose whole purpose is honest receipts
   * cannot contain a hardcoded one.
   */
  const readAttentionWithSources = async (
    stamp: string
  ): Promise<{
    items: AttentionItem[]
    /**
     * ONE receipt per source, ok or error (UXA-C02).
     *
     * It used to be a list of FAILURES, and a list of failures cannot make a
     * partial envelope: `envelope()` derives availability by comparing what
     * answered against what was consulted, so handing it only the refusals says
     * nothing answered — and it would hide the four sources that did. The
     * sources that worked are part of the measurement.
     */
    sources: SourceReceipt[]
    omitted: Omission[]
  }> => {
    const [reviews, expired, refusals, projects, proposals] = await Promise.all([
      store
        .select('project_tasks', 'id,project_id,title,instruction,started_at')
        .eq('estate_id', ACTIVE_ESTATE)
        .eq('status', 'review'),
      store
        .select('leases', 'work_id,project_id,owner_session,expires_at')
        .eq('estate_id', ACTIVE_ESTATE)
        .lte('expires_at', new Date().toISOString()),
      store
        .select('journal', 'seq,project_id,payload,occurred_at')
        .eq('estate_id', ACTIVE_ESTATE)
        .eq('type', 'policy.decided@1')
        .order('seq', { ascending: false })
        .limit(REFUSAL_WINDOW),
      store.select('projects', 'id,name').eq('estate_id', ACTIVE_ESTATE),
      store
        .select('proposals', 'id,project_id,title,depth,bound,created_at')
        .eq('estate_id', ACTIVE_ESTATE)
        .is('decided_at', null)
        .order('created_at')
    ])
    const names = Object.fromEntries(
      (projects.data ?? []).map((row) => [row.id as string, row.name as string])
    )
    // This read already answers the question navigation needs. A lease's
    // `work_id` is a task id only when a task carries it; it was asked here for
    // a TITLE and the answer thrown away, so `AttentionPanel` went on treating
    // every lease as a task and opening a page for one that does not exist.
    const taskRead = await store.selectIn(
      'project_tasks',
      'id,title,instruction',
      'id',
      (expired.data ?? []).map((l) => l.work_id as string)
    )
    if (taskRead.failed) ops.failed('leases.titles-unreadable', new Error(taskRead.failed))
    const titles = Object.fromEntries(
      taskRead.rows.map((row) => [
        row.id as string,
        (row.title as string | null) ?? (row.instruction as string)
      ])
    )
    const isTask = new Set(taskRead.rows.map((row) => row.id as string))
    const sources = obligationReceipts(
      [
        { source: 'reviews', error: reviews.error },
        { source: 'leases', error: expired.error },
        { source: 'refusals', error: refusals.error },
        { source: 'projects', error: projects.error },
        { source: 'proposals', error: proposals.error },
        // The chunked read reports differently — its failure is a sentence
        // rather than an error object — and it is folded in here rather than
        // left out, because a source missing from these receipts reads as one
        // that answered.
        { source: 'lease-titles', error: taskRead.failed ? { message: taskRead.failed } : null }
      ],
      stamp
    )

    const items = attentionOf({
      proposals: (proposals.data ?? []) as AttentionSources['proposals'],
      reviews: (reviews.data ?? []) as AttentionSources['reviews'],
      expired: (expired.data ?? []).map((l) => ({
        work_id: l.work_id as string,
        project_id: l.project_id as string,
        owner_session: l.owner_session as string,
        expires_at: l.expires_at as string,
        title: titles[l.work_id as string] ?? null,
        // A refused read leaves this false for every lease, which makes each of
        // them unnavigable rather than wrongly navigable. Failing towards "I
        // cannot open this" is the safe direction.
        is_task: isTask.has(l.work_id as string)
      })),
      refusals: (refusals.data ?? [])
        .filter((row) => (row.payload as { verdict?: string }).verdict === 'refuse')
        .map((row) => {
          const payload = row.payload as {
            floor_class?: string
            target?: string
            reason?: string
            asked_because?: string | null
          }
          return {
            seq: row.seq as number,
            project_id: (row.project_id as string | null) ?? null,
            floor_class: payload.floor_class ?? 'unknown',
            target: payload.target ?? 'unknown',
            reason: payload.reason ?? '',
            asked_because: payload.asked_because ?? null,
            occurred_at: row.occurred_at as string
          }
        }),
      names
    })

    return {
      items,
      sources,
      // The refusal window is the only capped read here, and it is the one that
      // can hide an obligation: fifty policy decisions back, a refusal older
      // than that is simply not in the queue and nothing said so. An OMISSION,
      // not an error — the read succeeded and does not contain everything.
      omitted:
        (refusals.data ?? []).length >= REFUSAL_WINDOW
          ? [
              {
                count: null,
                reason: `refusals older than the last ${REFUSAL_WINDOW} policy decisions were not read`
              }
            ]
          : []
    }
  }

  /**
   * The queue, WITH the receipts that say what it is (UXA-C02).
   *
   * This channel used to be `handle(IPC.attentionList, readAttention)` — a
   * wrapper whose own comment said callers had "nowhere to put the receipts",
   * while `board.query`, reading the same function five hundred lines below,
   * had exactly the place. So a refused `journal` select produced a queue with
   * no refusals in it, resolved successfully, and both surfaces rendered it as
   * the estate's state.
   *
   * Passed by name, it was also the ONE handler of eighty-eight that
   * `check-ipc-contract.mjs` could not see: its pattern required a parameter
   * list after the channel. The gate now enumerates every call and this one
   * carries its annotation like the rest.
   */
  handle(
    IPC.attentionList,
    async (): Promise<Returns<FabricApi['attention']['list']>> => {
      const stamp = new Date().toISOString()
      const read = await readAttentionWithSources(stamp)
      return envelope<AttentionItem[]>({
        data: read.items,
        sources: read.sources,
        omitted: read.omitted,
        asOf: stamp,
        freshness: 'fresh'
      })
    }
  )

  /**
   * The operator answers (M152.commit). One server transaction — S06's
   * `answer_question` — resolves the question, records the answer as a decision
   * the project remembers, and recomputes every blocking set it touched.
   *
   * TWO THINGS THIS DOES NOT SAY. Answered is not delivered: nobody is woken
   * here, and the receipt names what became eligible rather than what was
   * started. And answered is not done: the task keeps its rung.
   */
  handle(
    IPC.questionAnswer,
    async (
      _e,
      input: {
        commandId: string
        questionId: string
        projectId: string
        expectedRevision: number
        answer?: string
        chosenOption?: string
        options: AnswerOption[]
      }
    ): Promise<Returns<FabricApi['questions']['answer']>> => {
      const result = await commitPreparedAnswer({
        rpc: (name, args) => db.rpc(name, args), estateId: ACTIVE_ESTATE, actor: OPERATOR_ACTOR,
        continueAnswer: deliverContinuation
      }, input)
      if (result.state !== 'committed') return { committed: false, reason: result.reason }
      const r = result.receipt
      return {
        committed: true,
        repeated: r.repeated,
        decisionId: r.decision_id,
        commitSeq: r.answered_seq === undefined ? null : String(r.answered_seq),
        unblocked: r.unblocked ?? [],
        stillBlocked: r.still_blocked ?? [],
        continuations: result.continuations.map(item => item.state === 'returned' ? item.value : {
          taskId: item.taskId, state: 'outcome_unknown' as const,
          says: 'The answer is recorded. Delivery could not be confirmed; inspect the session before retrying.'
        })
      }
    }
  )

  /**
   * Route one answer to the run that was waiting for it.
   *
   * Reuses M103's delivery machinery rather than growing a second one: the ack,
   * the digest and the `written_unconfirmed` middle state are the same
   * questions here, and a parallel implementation would drift from the one that
   * gets exercised.
   */
  const continuations = createContinuationDelivery({
    store,
    db,
    guard: async () => (await identity.guard()).ok,
    authority: () => identity.held(),
    ptys,
    estateId: ACTIVE_ESTATE,
    actor: OPERATOR_ACTOR,
    withDeliveryHeader
  })
  const launchManaged = createManagedLaunch({
    db, estateId: ACTIVE_ESTATE, actor: OPERATOR_ACTOR,
    authority: () => identity.held(),
    admit: (taskId, sessionId, trigger) => {
      const held = identity.held()
      return admitExisting({ estateId: ACTIVE_ESTATE, taskId, actor: OPERATOR_ACTOR,
        sessionId, trigger, personId: held?.personId, revision: held?.revision })
    },
    prepare: async (receipt, input) => {
      const project = await readProject(receipt.project_id!)
      if (!project.repo_path) throw new Error('Choose an available project folder before starting an agent.')
      const optionId = receipt.option_id || 'claude-code'
      let agent: { runnerId: string; instructions: string; servers: string[] } | null = null
      if (UUID.test(optionId)) {
        const { data, error } = await store.select('agent_bindings', 'provider_ref,instructions,mcp_servers')
          .eq('id', optionId).maybeSingle()
        if (error || !data) throw new Error('The selected agent could not be read. Refresh its configuration.')
        agent = { runnerId: data.provider_ref as string, instructions: (data.instructions as string) ?? '',
          servers: (data.mcp_servers as string[] | null) ?? [] }
      }
      return async (sessionId, validateLaunch) => {
        // #region context-demand — docs: docs/evidence/backlog.md#work-s14
        // The context pack is compiled inside `ptys.open`; it asks this map how the session was admitted
        // instead of reading the journal back (release review iteration 2, memory finding 7).
        launchTriggerBySession.set(sessionId, input.trigger)
        try {
          const session = await ptys.open(receipt.project_id!, project.repo_path!, optionId,
            input.taskId, input.permissionMode ?? null, agent, sessionId,
            async () => (await identity.guard()).ok && await validateLaunch())
          syncPower()
          return session
        } finally {
          launchTriggerBySession.delete(sessionId)
        }
        // #endregion context-demand
      }
    },
    track: (sessionId, taskId) => { taskBySession.set(sessionId, taskId) },
    untrack: (sessionId, taskId) => { if (taskBySession.get(sessionId) === taskId) taskBySession.delete(sessionId) },
    get: sessionId => ptys.get(sessionId),
    stop: async sessionId => { await stopRuntime.stop(sessionId, 'launch_failure') },
    dispatch: (...args) => continuations.dispatch(...args)
  })
  const deliverContinuation = (
    taskId: string,
    decisionId: string,
    answer: string
  ): Promise<ContinuationResult> => continuations.deliver(taskId, decisionId, answer)


  /**
   * The Board: one ranked list of authored questions and derived obligations
   * (M151, ADR-0035). It is a QUERY — computed here at read time — because a
   * board stored as a table is a second copy of the truth, and the copy that
   * drifts is the one the operator is looking at.
   *
   * It returns a ReadEnvelope, and that is the invariant rather than the style:
   * one source failing must not produce a quiet board. `attention.list` still
   * answers with a bare array for its existing callers, and that read has the
   * same defect S14 fixed elsewhere — noted on M151's row rather than changed
   * underneath a consumer in this iteration.
   */
  const readBoard = async (
    projectId: string | null,
    limit: number
  ): Promise<ReadEnvelope<BoardCut>> => {
    const now = new Date()
    const stamp = now.toISOString()
    const [obligations, questionRead, blockRead, projectRead, deferralRead] = await Promise.all([
      readAttentionWithSources(stamp),
      store
        .select('questions', 'id,project_id,text,kind,asked_at,status,revision,options')
        .eq('estate_id', ACTIVE_ESTATE)
        .eq('status', 'open'),
      store.select('question_blocks', 'question_id').eq('estate_id', ACTIVE_ESTATE),
      store.select('projects', 'id,name,priority_tier').eq('estate_id', ACTIVE_ESTATE),
      // SCR-41 L3b: set aside for next time is not waiting on you now. Its own receipt, so a
      // failed read of the deferrals is said rather than silently showing them as current.
      store.select('question_deferrals', 'question_id').eq('estate_id', ACTIVE_ESTATE)
    ])
    const setAside = new Set((deferralRead.data ?? []).map((d) => d.question_id as string))

    const blocksOf = new Map<string, number>()
    for (const b of blockRead.data ?? [])
      blocksOf.set(b.question_id as string, (blocksOf.get(b.question_id as string) ?? 0) + 1)
    const projects = new Map(
      (projectRead.data ?? []).map((r) => [r.id as string, r as { name: string; priority_tier: string | null }])
    )

    const questions: BoardQuestion[] = (questionRead.data ?? []).filter((q) => !setAside.has(q.id as string)).map((q) => ({
      id: q.id as string,
      projectId: (q.project_id as string | null) ?? null,
      projectName: projects.get(q.project_id as string)?.name ?? null,
      text: q.text as string,
      kind: (q.kind as BoardQuestion['kind']) ?? 'decision',
      askedAt: q.asked_at as string,
      blocks: blocksOf.get(q.id as string) ?? 0,
      revision: (q.revision as number | null) ?? 1,
      options: (q.options as BoardQuestion['options'] | null) ?? [],
      // Goals are M?-scoped; claiming a question serves an active goal without
      // reading one would be an invented component in a ranked list.
      servesActiveGoal: false
    }))

    const all = boardEntries({
      questions,
      attention: obligations.items,
      // The TIER only. Pressure is computed from a project's own blocked tasks
      // and open questions, and feeding the board's own inputs back into the
      // weight that ranks it would let one loud project outrank a paying one by
      // being loud. The tier is the operator's claim and it is enough here.
      projectWeightOf: (id) =>
        projectWeight({
          tier: (projects.get(id ?? '')?.priority_tier as ProjectSignals['tier']) ?? 'normal',
          blockedTasks: 0,
          daysSinceOldestOpenQuestion: 0,
          goalDueWithinWeek: false,
          ranInLast24h: false
        }).weight,
      now
    })
    const scoped = projectId ? scopeBoard(all, projectId) : all

    const receipt = (name: string, r: { error: { message?: string } | null }): SourceReceipt =>
      r.error ? { name, status: 'error', asOf: null, errorCode: r.error.message ?? 'unknown' } : { name, status: 'ok', asOf: stamp }

    return envelope<BoardCut>({
      data: cutBoard(scoped, limit),
      sources: [
        // MEASURED. This was the literal `{ status: 'ok' }` — six reads under
        // it, none of them checked, in the one receipt that claimed to be fine.
        // Then it was a list of FAILURES, which could not say that five of six
        // answered: the derivation compares what answered against what was
        // consulted, and a source it never hears about is a source that did not
        // answer. The obligation read now names all six either way (UXA-C02).
        ...obligations.sources,
        receipt('questions', questionRead),
        receipt('blocks', blockRead),
        receipt('projects', projectRead),
        receipt('deferrals', deferralRead)
      ],
      // A cut refusal window is an OMISSION, not an error and not an ok: the
      // read succeeded and does not contain everything, which is what `omitted`
      // is for — and it makes the envelope `partial`, so `whole()` refuses to
      // hand this out as a total. Derived where the cap is, so the board and
      // the panel cannot disagree about whether the window was cut.
      omitted: obligations.omitted,
      asOf: stamp,
      freshness: 'fresh'
    })
  }

  handle(IPC.boardQuery, (_e, q?: { projectId?: string | null; limit?: number }): Promise<Returns<FabricApi['board']['query']>> =>
    readBoard(q?.projectId ?? null, q?.limit ?? 5)
  )

  /** SCR-41 «Разобрано»: answered questions, newest first, bounded. Two reads, each with its
   *  own receipt, so a failed project read leaves the rows unnamed rather than the list empty. */
  const readResolved = async (projectId: string | null, limit: number): Promise<ReadEnvelope<ResolvedEntry[]>> => {
    const stamp = new Date().toISOString()
    const bounded = Math.max(1, Math.min(200, Math.floor(Number.isFinite(limit) ? limit : 50)))
    let questions = store
      .select('questions', 'id,project_id,text,kind,asked_at,answered_at,answer,chosen_option,answered_by_kind,options')
      .eq('estate_id', ACTIVE_ESTATE)
      .eq('status', 'answered')
    if (projectId) questions = questions.eq('project_id', projectId)
    const [questionRead, projectRead] = await Promise.all([
      questions.order('answered_at', { ascending: false }).limit(bounded),
      store.select('projects', 'id,name').eq('estate_id', ACTIVE_ESTATE)
    ])
    const names = new Map((projectRead.data ?? []).map((r) => [r.id as string, r.name as string]))
    const receipt = (name: string, r: { error: { message?: string } | null }): SourceReceipt =>
      r.error ? { name, status: 'error', asOf: null, errorCode: r.error.message ?? 'unknown' } : { name, status: 'ok', asOf: stamp }
    return envelope<ResolvedEntry[]>({
      data: resolvedEntries((questionRead.data ?? []) as Record<string, unknown>[], names),
      sources: [receipt('questions', questionRead), receipt('projects', projectRead)],
      asOf: stamp,
      freshness: 'fresh'
    })
  }
  handle(IPC.boardResolved, (_e, q?: { projectId?: string | null; limit?: number }): Promise<Returns<FabricApi['board']['resolved']>> =>
    readResolved(q?.projectId ?? null, q?.limit ?? 50)
  )

  /** SCR-41 «На следующий раз»: the deferrals and the open questions they belong to. */
  const readDeferred = async (projectId: string | null, limit: number): Promise<ReadEnvelope<DeferredEntry[]>> => {
    const stamp = new Date().toISOString()
    const bounded = Math.max(1, Math.min(200, Math.floor(Number.isFinite(limit) ? limit : 50)))
    let deferrals = store.select('question_deferrals', 'question_id,reason,deferred_at').eq('estate_id', ACTIVE_ESTATE)
    if (projectId) deferrals = deferrals.eq('project_id', projectId)
    const deferralRead = await deferrals.order('deferred_at', { ascending: false }).limit(bounded)
    const ids = (deferralRead.data ?? []).map((d) => d.question_id as string)
    const [questionRead, projectRead] = await Promise.all([
      store.selectIn('questions', 'id,project_id,text,kind,asked_at,status', 'id', ids),
      store.select('projects', 'id,name').eq('estate_id', ACTIVE_ESTATE)
    ])
    const names = new Map((projectRead.data ?? []).map((r) => [r.id as string, r.name as string]))
    const receipt = (name: string, r: { error: { message?: string } | null }): SourceReceipt =>
      r.error ? { name, status: 'error', asOf: null, errorCode: r.error.message ?? 'unknown' } : { name, status: 'ok', asOf: stamp }
    return envelope<DeferredEntry[]>({
      data: deferredEntries((deferralRead.data ?? []) as Record<string, unknown>[], questionRead.rows, names),
      sources: [
        receipt('deferrals', deferralRead),
        // `selectIn` reports its own failure as `failed`, not as `error`.
        questionRead.failed ? { name: 'questions', status: 'error', asOf: null, errorCode: questionRead.failed } : { name: 'questions', status: 'ok', asOf: stamp },
        receipt('projects', projectRead)
      ],
      asOf: stamp,
      freshness: 'fresh'
    })
  }
  handle(IPC.boardDeferred, (_e, q?: { projectId?: string | null; limit?: number }): Promise<Returns<FabricApi['board']['deferred']>> =>
    readDeferred(q?.projectId ?? null, q?.limit ?? 50)
  )
  // The Board's three commands, each through the prepared adapter as the established operator.
  const boardDeps = () => ({ rpc: (name: string, args: Record<string, unknown>) => db.rpc(name, args), estateId: ACTIVE_ESTATE, actor: OPERATOR_ACTOR })
  handle(IPC.boardDefer, (_e, input: unknown): Promise<Returns<FabricApi['board']['defer']>> => commitBoardCommand(boardDeps(), 'defer', input))
  handle(IPC.boardReopen, (_e, input: unknown): Promise<Returns<FabricApi['board']['reopen']>> => commitBoardCommand(boardDeps(), 'reopen', input))
  handle(IPC.boardAddTopic, (_e, input: unknown): Promise<Returns<FabricApi['board']['addTopic']>> => commitBoardCommand(boardDeps(), 'topic', input))

  /** Releases with their basis (ADR-0084): the releases, then the tasks and decisions they name,
   *  each read with its own receipt — an unread task leaves its reference without text, never
   *  the release without its basis. */
  const readReleases = async (projectId: string | null, limit: number): Promise<ReadEnvelope<ReleaseEntry[]>> => {
    const stamp = new Date().toISOString()
    const bounded = Math.max(1, Math.min(200, Math.floor(Number.isFinite(limit) ? limit : 100)))
    let releases = store
      .select('releases', 'id,project_id,name,environment,summary,task_ids,decision_ids,rolls_back,recorded_at,recorded_seq,verified_outcome,verification_receipt,verified_at')
      .eq('estate_id', ACTIVE_ESTATE)
    if (projectId) releases = releases.eq('project_id', projectId)
    const [releaseRead, projectRead] = await Promise.all([
      releases.order('recorded_seq', { ascending: false }).limit(bounded),
      store.select('projects', 'id,name').eq('estate_id', ACTIVE_ESTATE)
    ])
    const rows = (releaseRead.data ?? []) as Record<string, unknown>[]
    const named = (key: string) => [...new Set(rows.flatMap((r) => (Array.isArray(r[key]) ? (r[key] as string[]) : [])))]
    const [taskRead, decisionRead] = await Promise.all([
      store.selectIn('project_tasks', 'id,title,instruction', 'id', named('task_ids')),
      store.selectIn('memory_facts', 'id,claim', 'id', named('decision_ids'))
    ])
    const names = new Map((projectRead.data ?? []).map((r) => [r.id as string, r.name as string]))
    const titles = new Map(taskRead.rows.map((r) => [r.id as string, ((r.title as string | null) || (r.instruction as string)) ?? '']))
    const claims = new Map(decisionRead.rows.map((r) => [r.id as string, r.claim as string]))
    const receipt = (name: string, r: { error: { message?: string } | null }): SourceReceipt =>
      r.error ? { name, status: 'error', asOf: null, errorCode: r.error.message ?? 'unknown' } : { name, status: 'ok', asOf: stamp }
    // `selectIn` reports its own failure as `failed`, not as `error`.
    const listed = (name: string, r: { failed: string | null }): SourceReceipt =>
      r.failed ? { name, status: 'error', asOf: null, errorCode: r.failed } : { name, status: 'ok', asOf: stamp }
    return envelope<ReleaseEntry[]>({
      data: releaseEntries(rows, names, titles, claims),
      sources: [receipt('releases', releaseRead), receipt('projects', projectRead), listed('tasks', taskRead), listed('decisions', decisionRead)],
      asOf: stamp,
      freshness: 'fresh'
    })
  }
  handle(IPC.releasesList, (_e, q?: { projectId?: string | null; limit?: number }): Promise<Returns<FabricApi['releases']['list']>> =>
    readReleases(q?.projectId ?? null, q?.limit ?? 100)
  )
  handle(IPC.releasesRecord, (_e, input: unknown): Promise<Returns<FabricApi['releases']['record']>> => commitReleaseCommand(boardDeps(), 'record', input))
  handle(IPC.releasesVerify, (_e, input: unknown): Promise<Returns<FabricApi['releases']['verify']>> => commitReleaseCommand(boardDeps(), 'verify', input))


  // M8 — the first of the four transports, and the one that needs no provider,
  // no key and no configuration.
  //
  // WHY IT CANNOT BE NAIVE. The attention queue is DERIVED and recomputes on
  // every read, so a refusal told about on each pass would ring every minute
  // until it was granted — and a product that does that gets its notifications
  // switched off, after which it can never tell the operator anything again.
  // `notify.ts` holds each item to one telling and collapses a burst into one.
  const told = new Set<string>()
  const NOTIFY_MS = 60_000
  const notifier = setInterval(() => {
    void (async () => {
      try {
        if (!Notification.isSupported()) return
        const focused = mainWindow?.isFocused() ?? false
        // The ITEMS only, and a partial read is safe HERE in a way it is not
        // on a screen: a source that refused means fewer tellings this pass,
        // never a wrong one, and the next pass tells about what it missed. A
        // surface saying "nothing is waiting" is a claim; a notifier saying
        // nothing is silence, which is what it does most passes anyway.
        const items = (await readAttentionWithSources(new Date().toISOString())).items
        const d = decideNotification(
          // The OBLIGATION's key, not its subject's: a task in review whose
          // lease has also expired is two things waiting, and one key for both
          // would tell the operator about only the first of them, ever.
          items.map((i) => ({ id: attentionKey(i), title: i.title, projectName: i.projectName })),
          told,
          focused
        )
        // Forgetting what has left keeps the set from growing for the life of
        // the process, AND means a thing that comes back is told about again —
        // which is right: it is waiting again.
        const live = new Set(items.map((i) => attentionKey(i)))
        for (const id of told) if (!live.has(id)) told.delete(id)
        if (!d.notify) return
        // SHOW FIRST, REMEMBER AFTER (AX-16). This marked every id told BEFORE
        // showing, inside a try whose catch reports to `ops.failed` — so a show
        // that threw left them marked told and the operator was NEVER told,
        // for the life of the process. Telling twice costs a glance; never
        // telling costs the thing it was about.
        let outcome: ShowOutcome
        try {
          const n = new Notification({ title: d.title, body: d.body })
          n.on('click', () => {
            mainWindow?.show()
            mainWindow?.focus()
          })
          n.show()
          outcome = { shown: true }
        } catch (e) {
          // NOT unknown: the throw happened here, so we observed that nothing
          // was shown. `unknown` is for an outcome nobody saw at all.
          outcome = { shown: false, why: String(e) }
          ops.failed('notify.show', e, { note: 'nothing was shown, so the next pass tells again' })
        }
        const remembered = rememberTold(d, outcome)
        for (const id of remembered.told) told.add(id)
      } catch (e) {
        ops.failed('index.the-notifier-could-not-read-what-is-wait', e, { note: 'the notifier could not read what is waiting:' })
      }
    })()
  }, NOTIFY_MS)
  app.on('will-quit', () => clearInterval(notifier))

  /**
   * The four stores, counted (M135).
   *
   * Every count carries whether it could be READ. A store that failed shows its
   * problem rather than a zero — the same rule IMP-04 put on the agent surface,
   * applied to a surface a person looks at, where a confident zero is if
   * anything more convincing.
   */
  /**
   * What happened while the operator was away (M133).
   *
   * Four reads and a pure composer. Everything the digest says is a row that
   * exists, carrying the id that opens it — the alternative would be a summary
   * written by a model, which would be a claim about the project rather than a
   * reading of it, and there is no model here anyway.
   */
  /**
   * One field, three stores, across every project (M141).
   *
   * Estate-wide because the question is usually "where did I see this", and a
   * search that first asks which project defeats itself. Each hit names its
   * project instead.
   *
   * TWO STORES RANK AND ONE MATCHES. `memory_facts` and `session_transcripts`
   * carry a tsvector with a GIN index; `project_tasks` has neither, so it is
   * searched by substring and SAYS so. Merging the three into one list would
   * imply an ordering across incomparable scorers.
   */
  /**
   * The operator's half of M140: they read what was asked and authorise it.
   *
   * ONE ACT, ONE TARGET, AND IT EXPIRES. Not a setting, not a role — a grant
   * names the class and the thing, is spent once, and dies in an hour if
   * nobody uses it. The agent is never told it exists; it asks again and the
   * surface finds it.
   */
  handle(
    IPC.attentionGrant,
    async (_e, input: { projectId: string | null; floorClass: string; target: string }): Promise<Returns<FabricApi['attention']['grant']>> => {
      await policy.issueGrant({
        estateId: ACTIVE_ESTATE,
        projectId: input.projectId,
        floorClass: input.floorClass as 'money' | 'deletion' | 'publication',
        target: input.target,
        actor: OPERATOR_ACTOR,
        // An hour. Long enough for an agent to notice and act, short enough
        // that an authorisation nobody used stops being one.
        ttlMs: 60 * 60 * 1000
      })
    }
  )

  /**
   * The onboarding drafts, and how the read went (AX-05).
   *
   * A failed read is NOT an empty set of drafts: one would restore no tabs and
   * look exactly like an operator who had none, which is the shape S14 exists
   * to refuse. The problem travels with the answer so the shell can say the
   * drafts could not be read rather than quietly pretending there were none.
   */
  // The real store, built here because this is the only file that may know
  // where `userData` is (see `onboardingDrafts.ts` for why it is injected).
  const drafts = createDrafts(localStore<DraftFile>('onboarding-drafts.json', {}, validateDraftFile))

  // Private history and restore (SCR-65, SCR-48). No path and no identity cross IPC.
  const historyUnavailable = { ok: false as const, state: 'refused' as const, reason_code: 'unavailable' }
  handle(IPC.historyList, (): Returns<FabricApi['history']['list']> => privateHistory?.exports().map(e => ({ name: e.name })) ?? [])
  handle(IPC.historyExport, async (): Promise<Returns<FabricApi['history']['export']>> => {
    if (!privateHistory) return historyUnavailable
    const r = await privateHistory.exportHistory()
    return r.ok ? { ok: true, archive_id: r.archive_id, name: path.basename(r.dir), conversations: r.conversations, messages: r.messages } : r
  })
  handle(IPC.historyChoose, async (): Promise<Returns<FabricApi['history']['choose']>> => {
    if (!privateHistory) return historyUnavailable
    const picked = await dialog.showOpenDialog({ properties: ['openDirectory'], message: 'Choose a Fabric archive folder' })
    if (picked.canceled || picked.filePaths.length === 0) return null
    const dir = picked.filePaths[0], seen = privateHistory.inspect(dir)
    if (!seen.ok) return seen
    const token = randomUUID(); historyTokens.set(token, dir)
    const me = identity.held()?.personId
    return { ok: true, token, taken_at: seen.taken_at, events: seen.events,
      companion: seen.companion && { conversations: seen.companion.conversations, messages: seen.companion.messages, mine: seen.companion.owner === me } }
  })
  handle(IPC.historyRestore, async (_e, token: unknown, name: unknown): Promise<Returns<FabricApi['history']['restore']>> => {
    const dir = typeof token === 'string' ? historyTokens.get(token) : undefined
    if (!privateHistory || !dir) return { ok: false, state: 'refused', reason_code: 'not_found' }
    return await privateHistory.restore(dir, typeof name === 'string' ? name : '') as Returns<FabricApi['history']['restore']>
  })
  handle(IPC.historyCheck, async (_e, operationId: unknown): Promise<Returns<FabricApi['history']['check']>> => {
    if (!privateHistory || typeof operationId !== 'string') return historyUnavailable
    return await privateHistory.check(operationId) as Returns<FabricApi['history']['check']>
  })
  handle(IPC.historyOpen, (_e, estateId: unknown): Returns<FabricApi['history']['open']> => {
    // Only an Estate this machine restored for this Person, never any id the renderer names.
    if (!privateHistory || typeof estateId !== 'string' || !privateHistory.restored().includes(estateId)) return { ok: false, reason: 'not_restored_here' }
    const recorded = recordActiveEstate(app.getPath('userData'), estateId)
    if (!recorded.ok) return { ok: false, reason: recorded.reason }
    setImmediate(() => { app.relaunch(); app.exit(0) })
    return { ok: true, reason: null }
  })

  // The CEO conversation (SCR-64). Arguments are the renderer's and are checked by the binding;
  // identity never comes from here.
  handle(IPC.ceoStatus, (): Returns<FabricApi['ceo']['status']> => ceoChat?.status() ?? CEO_CHAT_CLOSED)
  handle(IPC.ceoCall, async (_e, method: unknown, args: unknown): Promise<Returns<FabricApi['ceo']['call']>> =>
    ceoChat ? (await ceoChat.call(method, args)) as CeoChatReply : { ok: false, state: 'refused', reason_code: 'unavailable' })
  handle(IPC.ceoSelect, (_e, conversationId: unknown): Returns<FabricApi['ceo']['select']> => {
    if (!ceoChat) return { ok: false }
    try { ceoChat.select(conversationId as string | null); return { ok: true } }
    catch { /* Not silence: an id that is not a conversation id is refused as {ok:false}; nothing was selected. */ return { ok: false } }
  })
  handle(IPC.draftsRead, (): Returns<FabricApi['drafts']['read']> => {
    const read = drafts.read()
    return read
  })

  handle(IPC.draftsSave, (_e, next: DraftFile): Returns<FabricApi['drafts']['save']> => {
    const written = drafts.save(next)
    // The three answers `localStore` gives, not two. A conflict means another
    // window wrote between the read and the write, and calling that "saved"
    // would be the confident-answer defect on the write side.
    return written.status === 'committed'
      ? { saved: true, reason: null }
      : {
          saved: false,
          reason:
            written.status === 'conflict'
              ? 'another window changed the drafts while this one was typing'
              : written.reason
        }
  })

  handle(IPC.favouritesList, (): Returns<FabricApi['favourites']['list']> => favourites())
  handle(IPC.favouritesToggle, (_e, projectId: string): Returns<FabricApi['favourites']['toggle']> =>
    toggleFavourite(projectId)
  )
  handle(
    IPC.favouritesReplace,
    (_e, release: string, add: string): Returns<FabricApi['favourites']['replace']> =>
      replaceFavourite(release, add)
  )
  handle(IPC.favouritesOrder, (): Returns<FabricApi['favourites']['order']> => projectOrder())
  // #region start-paths-ipc — docs: docs/adr/0100-first-run-and-start-paths.md#boundary
  // The first run and the start paths (ADR-0100). Every folder here goes through the window's
  // granted roots (S02.roots): the picker grants, `fileRoots.resolve` refuses anything else.
  // Which projects already hold a folder. Every page is read (iteration 1: past PostgREST's 1000-row cap
  // an imported folder looked new), and paths are compared by their REAL path on both sides, so a folder
  // attached through a symlink or with a trailing slash is still recognised.
  const importedIndex = readImportedIndex
  const withImported = async <T extends FolderFacts>(rows: T[]): Promise<(T & { importedBy: { id: string; name: string }[] })[]> => {
    const index = await importedIndex()
    return rows.map((r) => ({ ...r, importedBy: index.get(realOrResolved(r.path)) ?? [] }))
  }
  const scans = startScans
  handle(IPC.startChooseFolder, async (event, purpose: 'project' | 'scan' | 'parent', defaultPath?: string): Promise<Returns<FabricApi['start']['chooseFolder']>> => {
    const message =
      purpose === 'scan' ? 'Choose the folder that holds your projects'
        : purpose === 'parent' ? 'Choose where the new project folder goes'
          : 'Choose a project folder'
    // The walk harness answers the picker in an unpackaged run only (`walkPickFor`).
    const walkPick = walkPickFor(purpose, process.env, app.isPackaged)
    const result = walkPick
      ? { canceled: false, filePaths: [walkPick] }
      : await (() => {
          // Modal to the asking window, so a second click cannot open a second picker behind the first.
          const owner = BrowserWindow.fromWebContents(event.sender)
          const options = { properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'>, message, ...(typeof defaultPath === 'string' ? { defaultPath } : {}) }
          return owner ? dialog.showOpenDialog(owner, options) : dialog.showOpenDialog(options)
        })()
    if (result.canceled || !result.filePaths[0]) return null
    const scope = scopeOf(event)
    if (purpose === 'parent') {
      // A parent is recorded, not granted; one that vanished since the picker is not offered at all.
      if (parentChoices.record(scope, result.filePaths[0]) === null) return null
    } else fileRoots.allow(result.filePaths[0], scope)
    return result.filePaths[0]
  })
  // A folder outside this window's folders is refused by code (`folder-refused:outside: <path>`), like
  // every other inspect and scan refusal (`projectDiscovery.ts#FolderRefused`, iteration 3).
  const windowFolder = (event: Electron.IpcMainInvokeEvent, folder: string): string => {
    try {
      return fileRoots.resolve(folder, scopeOf(event))
    } catch (e) {
      throw asFolderRefusal(e, String(folder))
    }
  }
  handle(IPC.startInspect, async (event, folder: string): Promise<Returns<FabricApi['start']['inspect']>> => {
    const facts = await inspectFolder(windowFolder(event, folder))
    return (await withImported([facts]))[0]
  })
  handle(IPC.startScan, async (event, root: string): Promise<Returns<FabricApi['start']['scan']>> => {
    const scope = scopeOf(event)
    const resolved = windowFolder(event, root)
    scans.get(scope)?.abort()
    const ctl = new AbortController()
    scans.set(scope, ctl)
    try {
      const result = await scanFolder(resolved, { signal: ctl.signal })
      // What main found is what this window may add without the picker; a stopped scan lists nothing.
      // Held as the walk wrote them, tied to the root they were found under (`ScanCandidates#record`).
      if (!result.cancelled) scanCandidates.record(scope, 'scan', result.root, result.candidates.map((c) => c.path))
      const kept = keepScan(result)
      const view: ScanView = { ...result, scannedAt: kept?.scannedAt ?? new Date().toISOString(), candidates: (await withImported(result.candidates)) as CandidateView[] }
      ops.record({ op: 'start.scan', outcome: 'ok', detail: { visited: result.visited, candidates: result.candidates.length, unreadable: result.unreadable, deep: result.deep, symlinks: result.symlinks, truncated: result.truncated, cancelled: result.cancelled }, ctx: { correlationId: ops.correlate() } })
      return view
    } finally {
      if (scans.get(scope) === ctl) scans.delete(scope)
    }
  })
  handle(IPC.startCancelScan, async (event): Promise<Returns<FabricApi['start']['cancelScan']>> => {
    scans.get(scopeOf(event))?.abort()
  })
  handle(IPC.startLastScan, async (event): Promise<Returns<FabricApi['start']['lastScan']>> => {
    const kept = lastScan()
    if (!kept) return null
    // The kept list is re-marked against today's projects and shown — it is NOT a grant (iteration 1:
    // re-granting its root gave any window a folder it never chose). Scanning it again goes through
    // the picker. Its CANDIDATES — repositories main itself found under a folder the operator picked —
    // are what this window may add from it (ADR-0100 §3), through `projects.create`'s admission; the
    // root and everything else under it stay unreachable.
    scanCandidates.record(scopeOf(event), 'kept', kept.root, kept.candidates.map((c) => c.path))
    return { ...kept, candidates: (await withImported(kept.candidates)) as CandidateView[] }
  })
  handle(IPC.startCreateFolder, async (event, input): Promise<Returns<FabricApi['start']['createFolder']>> => {
    const scope = scopeOf(event)
    const result = await createProjectFolder(input, (p) => parentChoices.resolve(scope, p, (q) => fileRoots.resolve(q, scope)))
    if (result.ok) fileRoots.allow(result.path, scope)
    else ops.record({ op: 'start.create-folder', outcome: 'failed', level: 'warn', detail: { refused: result.reason }, ctx: { correlationId: ops.correlate() } })
    return result
  })
  handle(IPC.startExecutors, async (): Promise<Returns<FabricApi['start']['executors']>> =>
    detectExecutors(
      AGENTS.filter((a) => (a.id === 'claude-code' || a.id === 'codex') && a.program).map((a) => ({ id: a.id, label: a.label, program: a.program as string, connected: a.connectsToSurface })),
      { env: sessionEnvironment(process.env) }
    )
  )
  // #endregion start-paths-ipc
  handle(IPC.personaRead, (): Returns<FabricApi['persona']['read']> => persona())
  handle(IPC.personaSave, (_e, next: unknown): Returns<FabricApi['persona']['save']> => savePersona(next))
  handle(
    IPC.favouritesMove,
    (_e, projectId: string, dir: 'up' | 'down', rest: string[]): Returns<FabricApi['favourites']['move']> =>
      moveProject(projectId, dir, rest)
  )

  handle(IPC.searchRun, async (_e, query: string): Promise<Returns<FabricApi['search']['run']>> => {
    // A thin dispatcher. Five queries and their five groups lived here inline,
    // and the one property that matters — that the searched set and the
    // DECLARED set are the same — was spread across forty lines nobody could
    // check. `searchRead.ts` holds it, and the probe drives it.
    return searchFor(store, query)
  })

  handle(IPC.digestRead, async (_e, projectId: string): Promise<Returns<FabricApi['digest']['read']>> => {
    // A thin dispatcher, like the projector: the decision — which boundary a
    // reading may acknowledge — lives in `digestRead.ts` where it can be
    // driven without an Electron process.
    return digestFor(store, ACTIVE_ESTATE, projectId, markFor(projectId))
  })

  handle(
    IPC.digestSeen,
    async (_e, projectId: string, boundary: number): Promise<Returns<FabricApi['digest']['seen']>> => {
      // THE CALLER SAYS WHERE (UX28-03), and it is the boundary its reading was
      // taken at. This used to read the journal's head here instead — which is
      // "wherever the estate has got to by now", a different question from
      // "what did the operator see". The renderer holds a boundary only for a
      // payload that reached the screen, so a failed read has nothing to pass
      // and a refresh cannot reach past what it displayed.
      //
      // Still the HEAD of that reading rather than its highest line: an event
      // of a kind the digest does not show moves the boundary too, so unread
      // kinds cannot accumulate. `setMark` refuses to go backwards, so a stale
      // renderer cannot make seen things reappear.
      if (!Number.isFinite(boundary))
        throw new Error(`a digest boundary must be a number, and this one is ${String(boundary)}`)
      setMark(projectId, boundary)
    }
  )

  /**
   * What this project has decided (M144).
   *
   * Superseded decisions are read too, and deliberately: a lineage needs what
   * was replaced, and the bi-temporal store keeps it rather than deleting it
   * (M48). Filtering them out at the query would make every chain one link
   * long and the history invisible — which is the thing the store exists to
   * prevent.
   */
  /**
   * What a session in this project is given (M145).
   *
   * ONE SERVER, and that is the fact worth putting on a screen: sessions are
   * launched with `--strict-mcp-config`, so whatever else this machine has
   * configured is invisible from inside. An operator auditing what an agent
   * could reach otherwise has to reason about their own global config.
   */
  /**
   * What has been done here (M131).
   *
   * Every number is a count of ROWS, and a store that could not be read reports
   * null rather than zero — the rule the memory screen established, because a
   * confident zero in front of a person is more convincing than one in front of
   * an agent.
   *
   * The portrait and the name are absent on purpose and the surface says so:
   * one needs an image nobody has generated, the other is a decision about this
   * product's own character. A screen inventing either would be asserting
   * something nobody chose.
   */
  handle(IPC.estateSummary, async (): Promise<Returns<FabricApi['estate']['summary']>> => {
    const head = { count: 'exact' as const, head: true }
    const count = async (
      run: PromiseLike<{ count: number | null; error: unknown }>
    ): Promise<number | null> => {
      const r = await run
      return r.error ? null : (r.count ?? 0)
    }
    const [first, projects, sessions, tasksClosed, facts, decisions, grants, events] =
      await Promise.all([
        store.select('journal', 'occurred_at').eq('estate_id', ACTIVE_ESTATE).order('seq').limit(1).maybeSingle(),
        count(store.select('projects', 'id', head).eq('estate_id', ACTIVE_ESTATE)),
        count(store.select('session_transcripts', 'session_id', head).eq('estate_id', ACTIVE_ESTATE)),
        count(store.select('project_tasks', 'id', head).eq('estate_id', ACTIVE_ESTATE).in('status', ['done', 'cancelled'])),
        count(store.select('memory_facts', 'id', head).eq('estate_id', ACTIVE_ESTATE).is('valid_to', null)),
        count(store.select('memory_facts', 'id', head).eq('estate_id', ACTIVE_ESTATE).eq('kind', 'decision')),
        count(store.select('grants', 'id', head).eq('estate_id', ACTIVE_ESTATE)),
        count(store.select('journal', 'seq', head).eq('estate_id', ACTIVE_ESTATE))
      ])
    return {
      tenure: tenureFrom((first.data?.occurred_at as string | undefined) ?? null, new Date()),
      projects,
      sessions,
      tasksClosed,
      facts,
      decisions,
      grantsIssued: grants,
      events
    }
  })

  handle(
    IPC.diagnosticsRead,
    (_e, query?: { level?: OpsLevel; limit?: number }): Returns<FabricApi['diagnostics']['read']> => ({
      // Newest last, and capped: the viewer asks for a page, not for the file.
      records: ops.read({ level: query?.level, limit: query?.limit ?? 200 }),
      file: ops.file()
    })
  )

  handle(IPC.harnessRead, async (_e, projectId: string): Promise<Returns<FabricApi['harness']['read']>> => {
    // A thin dispatcher. The decisions — which figures are estate-wide, and
    // what a refused count means — live in `harnessRead.ts`, where they can be
    // driven without an Electron process. This handler used to take
    // `projectId` and never use it (UX28-05).
    return harnessFor({
      store,
      estateId: ACTIVE_ESTATE,
      projectId,
      now: new Date().toISOString(),
      providers: launchOptions,
      endpoint: surface.endpoint ?? null,
      tools: SURFACE_TOOLS
    })
  })

  handle(IPC.decisionsList, async (_e, projectId: string): Promise<Returns<FabricApi['decisions']['list']>> => {
    // M173 — THE CAP IS DECLARED, the same rule M190 applied to the task list.
    // A capped read feeds `lineagesOf`, and a lineage built from a truncated
    // batch has holes it cannot see: a fact naming a predecessor outside the
    // window reads as a decision made once.
    const [read, total] = await Promise.all([
      store
        .select('memory_facts', 'id,claim,source_ref,actor_kind,recorded_at,superseded_by')
        .eq('project_id', projectId)
        .eq('kind', 'decision')
        .order('recorded_at', { ascending: false })
        .limit(DECISION_CAP),
      store
        .select('memory_facts', 'id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('kind', 'decision')
    ])
    if (read.error) throw new Error(`the decisions could not be read: ${read.error.message}`)
    return {
      lineages: lineagesOf((read.data ?? []) as DecisionFact[]),
      // HISTORIES THIS READ CANNOT SHOW (AX-06). A fact whose current version
      // fell outside the cap forms no lineage, so it disappears from the panel
      // rather than appearing shortened — computed from the SAME batch, so the
      // two cannot disagree about which rows arrived.
      orphans: orphansOf((read.data ?? []) as DecisionFact[]),
      coverage: coverageOfList({
        returned: (read.data ?? []).length,
        available: total.error ? null : (total.count ?? null),
        cap: DECISION_CAP
      })
    }
  })

  /**
   * The review path a finding has never had (M154).
   *
   * `kind: 'finding' | 'trap'` has been written since M149 and by note
   * promotion since M52, and nothing has ever read it: the memory list renders
   * every fact identically. This is the reader — and it is three reads, not
   * one, because a lesson, how often it happened, and whether its source is
   * still reachable fail INDEPENDENTLY, and folding them together makes the
   * weakest of the three decide what the reader is told.
   */
  handle(
    IPC.memoryRetro,
    async (_e, raw: Partial<RetroQuery>): Promise<Returns<FabricApi['memory']['retro']>> => {
      const now = new Date()
      const stamp = now.toISOString()
      const q = normaliseQuery(raw)
      const checked = checkCursor(q)
      if (!checked.ok)
        return envelope<RetroPage>({
          data: null,
          sources: [{ name: 'facts', status: 'error', asOf: null, errorCode: checked.reason }],
          asOf: stamp
        })

      let read = store.select('memory_facts', '*').eq('estate_id', ACTIVE_ESTATE)
      if (q.projectId) read = read.eq('project_id', q.projectId)
      if (q.kinds.length) read = read.in('kind', q.kinds)
      if (q.categories.length) read = read.in('category', q.categories)
      if (q.about) read = read.eq('about_namespace', q.about.namespace).eq('about_key', q.about.key)
      // `current` is what is true NOW; `history` is what the project used to
      // believe. Both are legitimate questions and neither is the other.
      if (q.state === 'current') read = read.is('valid_to', null)
      else if (q.state === 'history') read = read.not('valid_to', 'is', null)
      if (checked.cursor)
        read = read.or(
          `recorded_at.lt.${checked.cursor.afterRecordedAt},and(recorded_at.eq.${checked.cursor.afterRecordedAt},id.lt.${checked.cursor.afterId})`
        )

      const factRead = await read
        .order('recorded_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(q.pageSize)
      // NOT destructured past the error: a refused read must not become an
      // empty retro that reads as "no lessons here".
      const rows = (factRead.data ?? []) as MemoryFact[]

      // ── how often, as its OWN read ──
      //
      // A failure here yields `unknown`, never zero. "This happened once" built
      // out of a failed join is a claim about the estate manufactured by our
      // own outage — the same rule the memory screen applies to its counts.
      const occurrenceIds = [...new Set(rows.map((r) => r.occurrence_id).filter(Boolean))] as string[]
      const occurrenceRead = await store.selectIn(
        'memory_occurrences',
        'occurrence_id,grouping',
        'occurrence_id',
        occurrenceIds
      )
      if (occurrenceRead.failed) ops.failed('memory.occurrences-unreadable', new Error(occurrenceRead.failed))
      const groupingOf = new Map(
        (occurrenceRead.rows as { occurrence_id: string; grouping: string }[]).map((o) => [
          o.occurrence_id,
          o.grouping as OccurrenceGrouping
        ])
      )

      // How many DISTINCT episodes sit under the same subject. Counted per
      // `about` key, because that is what "this keeps happening" is about — the
      // subject, not one fact's own episode.
      const byAbout = new Map<string, { key: string; grouping: OccurrenceGrouping }[]>()
      for (const r of rows) {
        const key = r.about_namespace ? `${r.about_namespace}:${r.about_key}` : null
        if (!key || !r.occurrence_id) continue
        const grouping = groupingOf.get(r.occurrence_id)
        if (!grouping) continue
        const list = byAbout.get(key) ?? []
        list.push({ key: r.occurrence_id, grouping })
        byAbout.set(key, list)
      }

      // ── WHOSE the referenced sources are (UX28-06) ──
      //
      // Not the availability question below — that stays untested by design.
      // This is "which project does this task belong to", which the store can
      // answer, and it has to be answered here because the RENDERER only knows
      // the project it is being read in. It used to hand that to the resolver
      // as though it were the ref's, so a source naming a task in another
      // project opened inside this one, with the other project's id.
      //
      // `selectIn` because the list is as long as the page and no longer: a
      // filter whose length the data decides is the 414 this repository already
      // paid for once.
      const sourceTaskIds = [
        ...new Set(
          rows
            .map((r) => (r.source_ref ? parseRef(String(r.source_ref)) : null))
            .filter((ref): ref is NonNullable<typeof ref> => ref?.kind === 'task')
            .map((ref) => ref.id)
        )
      ]
      const ownerRead = await store.selectIn('project_tasks', 'id,project_id', 'id', sourceTaskIds)
      if (ownerRead.failed) ops.failed('memory.retro-source-owner-unreadable', new Error(ownerRead.failed))
      // A failed lookup leaves every owner null, which resolves as "cannot be
      // opened from here" rather than as "belongs to this project". The
      // reassuring default is the one that sends the operator somewhere wrong.
      const ownerOf = new Map(
        (ownerRead.rows as { id: string; project_id: string }[]).map((t) => [t.id, t.project_id])
      )

      const items: RetroItem[] = rows.map((r) => {
        const aboutKey = r.about_namespace ? `${r.about_namespace}:${r.about_key}` : null
        const recurrence: Recurrence = occurrenceRead.failed
          ? recurrenceUnknown(occurrenceRead.failed)
          : (() => {
              const counted = recurrenceOf(byAbout.get(aboutKey ?? '') ?? [])
              return { verifiedDistinct: counted.counted, proposed: counted.provisional, problem: null }
            })()
        return {
          factRef: r.id,
          subject: { kind: 'fact', id: r.id },
          category: r.category,
          kind: (r.kind as RetroItem['kind']) ?? 'note',
          claim: r.claim,
          actor: { kind: r.actor_kind, id: r.actor_id },
          // NO RESOLVER IS RUN HERE, and the type says so rather than implying
          // a check nobody performed: opening a source is the renderer's act,
          // and a read that claimed availability it never tested would be the
          // defect this card names.
          evidence: evidenceOf({
            raw: r.source_ref,
            owner: (() => {
              const ref = r.source_ref ? parseRef(String(r.source_ref)) : null
              return ref?.kind === 'task' ? (ownerOf.get(ref.id) ?? null) : null
            })()
          }),
          about: r.about_namespace ? { namespace: r.about_namespace, key: r.about_key as string } : null,
          recurrence,
          recordedAt: r.recorded_at,
          validFrom: r.valid_from,
          validTo: r.valid_to,
          supersedes: r.supersedes_requested,
          supersededBy: r.superseded_by,
          conflict:
            r.correction_outcome === 'conflict_proposed' || r.correction_outcome === 'rejected'
              ? {
                  status: r.correction_outcome,
                  reason: r.correction_reason,
                  previousRef: r.supersedes_requested
                }
              : null
        }
      })

      const head = await store
        .select('journal', 'seq')
        .eq('estate_id', ACTIVE_ESTATE)
        .order('seq', { ascending: false })
        .limit(1)
        .maybeSingle()

      return envelope<RetroPage>({
        data: pageOf(items, q, String((head.data as { seq: number } | null)?.seq ?? 0)),
        sources: [
          factRead.error
            ? { name: 'facts', status: 'error', asOf: null, errorCode: factRead.error.message }
            : { name: 'facts', status: 'ok', asOf: stamp },
          occurrenceRead.failed
            ? { name: 'occurrences', status: 'error', asOf: null, errorCode: occurrenceRead.failed }
            : { name: 'occurrences', status: 'ok', asOf: stamp },
          head.error
            ? { name: 'journal-head', status: 'error', asOf: null, errorCode: head.error.message }
            : { name: 'journal-head', status: 'ok', asOf: stamp }
        ],
        asOf: stamp,
        freshness: 'fresh'
      })
    }
  )

  handle(IPC.memoryOverview, async (_e, projectId: string): Promise<Returns<FabricApi['memory']['overview']>> => {
    // A thin dispatcher. These eight lines held three decisions and used the
    // RAW client, which is the one way to miss `scopeFilters` — see
    // `memoryOverviewRead.ts` for what that cost and why it is drivable now.
    return memoryOverviewFor(store, projectId, new Date().toISOString())
  })

  handle(
    IPC.memoryMisses,
    async (_e, projectId: string, limit?: number): Promise<Returns<FabricApi['memory']['misses']>> => {
      const { data, error } = await store
        .select('memory_retrievals', 'store,query,asked_at,session_id')
        .eq('project_id', projectId)
        .eq('hits', 0)
        .order('asked_at', { ascending: false })
        .limit(limit ?? 20)
      if (error) throw new Error(`the retrieval log could not be read: ${error.message}`)
      return (data ?? []).map((row) => ({
        store: row.store as string,
        query: row.query as string,
        askedAt: row.asked_at as string,
        bySession: (row.session_id as string | null) ?? null
      }))
    }
  )

  handle(IPC.goalsList, async (_e, projectId: string): Promise<Returns<FabricApi['goals']['list']>> => {
    const { data, error } = await store
      .select('goals', '*')
      .eq('project_id', projectId)
      .order('created_at')
    if (error) throw new Error(`goals read failed: ${error.message}`)
    return (data ?? []) as GoalRow[]
  })

  /**
   * A goal, and the field this handler deliberately does NOT offer (M146 step 7).
   *
   * `goals.autonomy` has existed since migration 1 with a CHECK for
   * safe/guarded/maximum, and NOTHING READS IT. The policy floor decides per
   * effect and per grant; it has never consulted a goal. So every goal is
   * written `safe` and the operator is not offered the choice — a control whose
   * promise cannot be kept is worse than an absent one, because the operator
   * would reasonably believe that setting it to `guarded` changed what an agent
   * may do here, and it would change nothing at all.
   *
   * Return trigger: the first time the floor consults a goal. Then the choice
   * appears, and it will mean what it says.
   */
  handle(IPC.goalsDefine, async (_e, projectId: string, title: string): Promise<Returns<FabricApi['goals']['define']>> => {
    const text = title?.trim()
    if (!text) throw new Error('a goal needs a title')
    const id = randomUUID()
    await journal.append({
      estateId: ACTIVE_ESTATE,
      type: 'goal.defined@1',
      actor: OPERATOR_ACTOR,
      projectId,
      payload: { id, title: text, autonomy: 'safe' }
    })
    const { data, error } = await store.select('goals', '*').eq('id', id).single()
    if (error) throw new Error(`goal read-back failed: ${error.message}`)
    return data as GoalRow
  })

  handle(
    IPC.tasksPrioritise,
    async (_e, taskId: string, goalId: string, position: number): Promise<Returns<FabricApi['tasks']['prioritise']>> => {
      const { data: task } = await store
        .select('project_tasks', 'project_id')
        .eq('id', taskId)
        .single()
      await journal.append({
        estateId: ACTIVE_ESTATE,
        type: 'task.prioritised@1',
        actor: OPERATOR_ACTOR,
        projectId: task?.project_id as string,
        payload: { task_id: taskId, goal_id: goalId, position }
      })
    }
  )

  handle(IPC.filesRead, (event, file: string): Returns<FabricApi['files']['read']> => readFile(file, fileRoots, scopeOf(event)))
  handle(
    IPC.filesWrite,
    async (event, file: string, content: string, expectedHash: string, grantId?: string): Promise<Returns<FabricApi['files']['write']>> => {
      const scope = scopeOf(event)
      // M139 — the first floored effect in the product, and it is one that was
      // ALREADY HAPPENING. Overwriting content that changed on disk replaces work
      // an agent may have written seconds ago; until now the only thing between
      // that and silent loss was a banner, and nothing in the estate recorded it.
      //
      // No grant means an ordinary save: the hash check decides, and a conflict
      // comes back for the operator to look at. A grant means the operator has
      // seen the diff and asked for the overwrite by name — so policy decides,
      // and the write happens only if it says so.
      if (!grantId) return writeFile(file, content, expectedHash, fileRoots, false, scope)

      const request = {
        estateId: ACTIVE_ESTATE,
        projectId: null,
        actionClass: 'file.overwrite',
        floorClass: 'deletion' as const,
        actor: OPERATOR_ACTOR,
        target: fileRoots.resolve(file, scope),
        grantId
      }
      const decision = await policy.decide(request)
      if (decision.verdict !== 'allow')
        // The refusal is returned, not thrown: the editor must be able to show
        // WHY it was refused, and an exception here would surface as the raw
        // 'Error invoking remote method' string M106 is about.
        return { ok: false, reason: 'refused', detail: decision.reason } as WriteResult
      // ADR-0050 — the fence, then the act, then what was OBSERVED. The order
      // is the contract: past `beginDispatch` the estate may never learn what
      // happened, so the grant is spent there and the effect sits at
      // `dispatching` until something observes it. A crash between these two
      // lines leaves `outcome_unknown`, which is the truth — the old code left
      // no row at all, so an overwritten file looked like one never written.
      const dispatch = await policy.beginDispatch(request, decision)
      const result = writeFile(file, content, expectedHash, fileRoots, true, scope)
      await policy.observeEffect(request, dispatch, {
        outcome: result.ok ? 'succeeded' : 'failed_known',
        // Fabric performed this act itself, so the evidence is its own return
        // value rather than somebody's account of it.
        evidence: result.ok ? `write ok: ${file}` : `write refused: ${result.reason}`
      })
      return result
    }
  )

  handle(IPC.filesRequestOverwrite, async (event, file: string): Promise<Returns<FabricApi['files']['requestOverwrite']>> => {
    const scope = scopeOf(event)
    // The operator saw the diff and chose. That choice is the authority, and it
    // names this file, expires in a minute and is spent once — so it cannot sit
    // around authorising the next overwrite too.
    const { grantId, expiresAt } = await policy.issueGrant({
      estateId: ACTIVE_ESTATE,
      projectId: null,
      floorClass: 'deletion',
      target: fileRoots.resolve(file, scope),
      actor: OPERATOR_ACTOR,
      ttlMs: 60_000
    })
    return { grantId, expiresAt }
  })
  // M109 — the return type is DERIVED from the contract, so `tsc` compares the
  // handler with what the renderer was promised. Nothing tied the two before,
  // which is how `Promise<void>` sat over a function that resolves to an error
  // string.
  handle(
    IPC.filesOpenExternally,
    async (event, file: string): Promise<Returns<FabricApi['files']['openExternally']>> => {
      // BOUNDED, like its three siblings (AX-15). `shell.openPath` asks the
      // operating system to OPEN the file with whatever handler is registered
      // for it — strictly more than reading it — and this was the one file
      // primitive SEC-REQ-016 did not reach.
      const allowed = resolveForOpen(file, fileRoots, scopeOf(event))
      if (!allowed.ok) return { ok: false, reason: allowed.reason }
      // An empty string is `shell.openPath`'s way of saying it worked.
      const reason = await shell.openPath(allowed.path)
      return reason ? { ok: false, reason } : { ok: true }
    }
  )
  handle(IPC.windowsOpenFile, (_e, file: string): Returns<FabricApi['windows']['openFile']> => openFileWindow(file))

  handle(IPC.reposList, (_e, projectId: string): Promise<Returns<FabricApi['repos']['list']>> => listRepos(projectId))

  handle(IPC.reposChoose, async (event): Promise<Returns<FabricApi['repos']['choose']>> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'multiSelections', 'createDirectory'],
      message: 'Choose one or more repository folders'
    })
    if (result.canceled) return []
    // Choosing a folder in the native dialog is the operator saying yes to it;
    // it becomes reachable immediately, before any attach is journalled.
    //
    // TO THIS WINDOW (S02.roots). It used to go into the one shared set, so a
    // folder opened once stayed reachable from every other window and every
    // agent session for the life of the process, and outlived the window that
    // asked. A choice made in one place is not a decision about everywhere.
    for (const p of result.filePaths) fileRoots.allow(p, scopeOf(event))
    return result.filePaths
  })

  handle(IPC.reposAttach, async (event, projectId: string, paths: string[]): Promise<Returns<FabricApi['repos']['attach']>> => {
    // The same admission as projects.create (iteration 2, errors finding 2): this window's own folders,
    // by their real paths, none held by another project (REQ-04), or nothing is attached.
    await attachRepos(projectId, await admitReposFor(event, projectId, paths))
    await refreshFileRoots()
    return listRepos(projectId)
  })

  handle(IPC.reposDetach, async (_e, projectId: string, repoId: string): Promise<Returns<FabricApi['repos']['detach']>> => {
    await journal.append({
      estateId: ACTIVE_ESTATE,
      type: 'project.repo.detached@1',
      actor: OPERATOR_ACTOR,
      projectId,
      payload: { id: repoId }
    })
    await refreshFileRoots()
    return listRepos(projectId)
  })

  handle(IPC.filesList, (event, dir: string): Returns<FabricApi['files']['list']> => listDirectory(dir, fileRoots, scopeOf(event)))

  handle(IPC.settingsRead, (): Returns<FabricApi['settings']['read']> => readSettings())
  handle(IPC.settingsWrite, (_e, next: Partial<AppSettings>): Returns<FabricApi['settings']['write']> => {
    const written = writeSettings(next)
    // Applied now, not at next launch: a power setting that takes effect
    // tomorrow is a power setting that did not work today. Applied from what was
    // COMMITTED, so a refused write does not change the policy either.
    power?.setPolicy(written.settings.keepAwake)
    return written
  })

  handle(IPC.terminalMemoryBackends, (): Returns<FabricApi['terminal']['memoryBackends']> => [
    { id: 'local', available: true, reason: null },
    {
      id: 'cloud',
      available: false,
      // Honest: hosted estates are horizon 4 (ADR-0016). The option exists so
      // the switch is there when hosting lands; it is never silently ignored.
      reason: 'hosted-estates-not-built'
    }
  ])

  handle(IPC.projectsUpdate, async (_e, input: UpdateProjectInput): Promise<Returns<FabricApi['projects']['update']>> => {
    const payload: Record<string, unknown> = { id: input.id }
    if (input.name !== undefined) payload.name = input.name.trim()
    if (input.purpose !== undefined) payload.purpose = input.purpose?.trim() || null
    await journal.append({
      estateId: ACTIVE_ESTATE,
      type: 'project.updated@1',
      actor: OPERATOR_ACTOR,
      projectId: input.id,
      payload
    })
    return readProject(input.id)
  })

  handle(IPC.projectsList, async (): Promise<Returns<FabricApi['projects']['list']>> => {
    const { data, error } = await store
      .select('projects', '*')
      .eq('estate_id', ACTIVE_ESTATE)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
    if (error) throw new Error(`projects list failed: ${error.message}`)
    return (data ?? []) as ProjectRow[]
  })

  // M109 — NARROWED to the contract. `journal.replay` selects every column and
  // returns `JournalEvent`, and this channel declares `FeedEvent`, which is
  // smaller: wider rows were crossing the bridge than the renderer was promised.
  // Nothing broke, and that is the problem — the contract stops being the
  // boundary the moment more than it says goes through, and the next column
  // added to the journal would travel to the renderer without a decision.
  handle(
    IPC.feedReplay,
    async (_e, fromSeq: number): Promise<Returns<FabricApi['feed']['replay']>> => {
      const rows = await journal.replay(ACTIVE_ESTATE, fromSeq ?? 0)
      return rows.map((r) => ({
        estate_id: r.estate_id,
        seq: r.seq,
        type: r.type,
        actor: r.actor,
        project_id: r.project_id,
        occurred_at: r.occurred_at,
        payload: r.payload
      }))
    }
  )

  handle(
    IPC.memoryRemember,
    async (
      _e,
      projectId: string,
      claim: string,
      sourceRef?: string,
      supersedes?: string,
      about?: { namespace?: string; key?: string } | null,
      category?: string
    ): Promise<Returns<FabricApi['memory']['remember']>> => {
    const text = claim?.trim()
    if (!text) throw new Error('a fact needs a claim')
    const id = randomUUID()
    await journal.append({
      estateId: ACTIVE_ESTATE,
      type: 'memory.project.recorded@1',
      actor: OPERATOR_ACTOR,
      projectId,
      payload: {
        id,
        claim: text,
        source_ref: sourceRef?.trim() || null,
        kind: 'note',
        // M182 — the category is the OPERATOR's here, and it is still validated
        // rather than trusted: an unknown one is refused by the schema, and
        // this defaults rather than passing a misspelling through.
        category: INSIGHT_CATEGORIES.includes((category ?? '') as InsightCategory)
          ? category
          : DEFAULT_CATEGORY,
        about: normaliseAbout(about),
        // Correcting something closes its window rather than removing it (M48).
        supersedes: supersedes || null
      }
    })
    // The read-back is the RECEIPT, and it now carries what became of the
    // correction. A person may supersede anyone, so their burial normally
    // lands — but not when the target was already corrected by somebody else,
    // and that case used to disappear into a WHERE clause that matched nothing
    // while the form cleared itself as though it had worked.
    const { data, error } = await store.select('memory_facts', '*').eq('id', id).single()
    if (error) throw new Error(`memory read-back failed: ${error.message}`)
    return data as MemoryFact
  })

  /** How many facts one memory read returns. Named because a cap is a claim
   *  about completeness, and an unnamed number cannot be one. */
  const MEMORY_PAGE = 100

  handle(
    IPC.memorySearch,
    async (
      _e,
      projectId: string,
      query: string,
      includeSuperseded?: boolean,
      category?: string
    ): Promise<Returns<FabricApi['memory']['search']>> => {
    query = query?.trim() ? cleanOriginalText(query).trim() : ''
    let q = store.select('memory_facts', '*').eq('project_id', projectId)
    // What is true NOW is the default. A superseded fact is still there and
    // still readable; it just stops answering as if nothing had changed.
    if (!includeSuperseded) q = q.is('valid_to', null)
    // M182 — the filter the closed category exists FOR. An unknown value is
    // ignored rather than applied: filtering by a category nothing can hold
    // would return an empty list that reads as "there is nothing here".
    if (INSIGHT_CATEGORIES.includes((category ?? '') as InsightCategory))
      q = q.eq('category', category as string)
    if (query?.trim()) q = q.textSearch('search', query.trim(), { type: 'plain', config: 'english' })
    const { data, error } = await q.order('recorded_at', { ascending: false }).limit(MEMORY_PAGE)
    if (error) throw new Error(`memory search failed: ${error.message}`)
    // The operator's searches count too (M46). A project where the PERSON keeps
    // searching and finding nothing is the same finding as one where the agents
    // do, and leaving the operator out would have made the number flattering.
    if (query?.trim()) {
      journal
        .append({
          estateId: ACTIVE_ESTATE,
          type: 'memory.retrieved@1',
          actor: OPERATOR_ACTOR,
          projectId,
          payload: {
            id: randomUUID(),
            session_id: null,
            store: 'facts',
            query: prepareRetrievalText(query),
            hits: (data ?? []).length
          }
        })
        .catch((e) => ops.failed('index.could-not-record-a-retrieval', e, { note: 'could not record a retrieval:' }))
    }
    return (data ?? []) as MemoryFact[]
  })

  handle(IPC.terminalOptions, (): Returns<FabricApi['terminal']['options']> => launchOptions())

  handle(
    IPC.terminalOpen,
    async (
      _e,
      projectId: string,
      optionId: string,
      firstInstruction?: string,
      permissionMode?: string | null
    ): Promise<Returns<FabricApi['terminal']['open']>> => {
      const project = await readProject(projectId)
      // ONE RULE, and the surface reads the same one (UXA-C04). This choice
      // used to live only here, so the launcher could not say where the agent
      // was about to start — and with no repository attached it starts in the
      // operator's own home folder, with write tools.
      const place = launchPlace(project.repo_path)
      const cwd = place.place === 'repository' ? place.path : app.getPath('home')
      const session = await ptys.open(projectId, cwd, optionId, null, permissionMode ?? null)
      syncPower()
      if (firstInstruction?.trim()) {
        // The same delivery as the task path, and it must be: two ways of
        // handing an agent its first instruction is two behaviours to keep
        // matched, and one of them would eventually stop being fixed (M103).
        ptys.deliverWhenReady(session.sessionId, firstInstruction.trim())
      }
      return session
    }
  )

  handle(IPC.terminalList, (_e, projectId?: string): Returns<FabricApi['terminal']['list']> => ptys.list(projectId))
  handle(
    IPC.terminalScrollback,
    (_e, sessionId: string): Returns<FabricApi['terminal']['scrollback']> => ptys.scrollbackOf(sessionId)
  )

  /**
   * One agent's history, from the journal (SCR-39).
   *
   * Both halves in one list and in ORDER: what the agent said about itself and
   * what Fabric observed. Splitting them into two panels would let a reader
   * take either as the account, and the whole point of keeping them apart in
   * the STORE is that they can be read against each other here.
   */
  handle(IPC.terminalHistory, async (_e, sessionId: string): Promise<Returns<FabricApi['terminal']['history']>> => {
    const { data, error } = await store
      .select('journal', '*')
      .eq('estate_id', ACTIVE_ESTATE)
      .or(`payload->>session_id.eq.${sessionId},payload->>owner.eq.${sessionId}`)
      .order('seq')
      .limit(AUTOMATION_WINDOW)
    if (error) throw new Error(`the session history could not be read: ${error.message}`)
    return (data ?? []) as FeedEvent[]
  })

  handle(IPC.terminalClaims, async (_e, projectId: string): Promise<Returns<FabricApi['terminal']['claims']>> => {
    const { data, error } = await store
      .select('agent_stages', 'session_id,stage,step,of_steps,note,reported_at')
      .eq('project_id', projectId)
    if (error) throw new Error(`agent claims read failed: ${error.message}`)
    return (data ?? []).map((r) => ({
      sessionId: r.session_id as string,
      stage: r.stage as string,
      step: (r.step as number | null) ?? null,
      ofSteps: (r.of_steps as number | null) ?? null,
      note: (r.note as string | null) ?? null,
      reportedAt: r.reported_at as string
    }))
  })
  handle(IPC.terminalGet, (_e, sessionId: string): Returns<FabricApi['terminal']['get']> => ptys.get(sessionId))
  ipcMain.on(IPC.terminalWrite, (_e, sessionId: string, data: string) => ptys.write(sessionId, data))
  ipcMain.on(IPC.terminalResize, (_e, sessionId: string, cols: number, rows: number) =>
    ptys.resize(sessionId, cols, rows)
  )
  handle(IPC.terminalEnd, async (_e, sessionId: string, options?: { force?: boolean }): Promise<Returns<FabricApi['terminal']['end']>> => {
    if (typeof sessionId !== 'string' || !UUID.test(sessionId)) throw new Error('Invalid session identity')
    return stopRuntime.stop(sessionId, 'operator_stop', { force: options?.force === true })
  })
  handle(IPC.terminalDismiss, (_e, sessionId: string): Returns<FabricApi['terminal']['dismiss']> => {
    ptys.dismiss(sessionId)
    sessionWindows.get(sessionId)?.close()
  })

  handle(IPC.windowsOpenSession, (_e, sessionId: string): Returns<FabricApi['windows']['openSession']> => openSessionWindow(sessionId))
}

function rendererTarget(query: string): { url?: string; file?: string; search: string } {
  return process.env.ELECTRON_RENDERER_URL
    ? { url: `${process.env.ELECTRON_RENDERER_URL}?${query}`, search: query }
    : { file: path.join(import.meta.dirname, '../renderer/index.html'), search: query }
}

function openSessionWindow(sessionId: string): void {
  const existing = sessionWindows.get(sessionId)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    return
  }
  const session = ptys.get(sessionId)
  const w = new BrowserWindow({
    ...WINDOW_CHROME,
    width: 1000,
    height: 680,
    title: session ? `${session.optionId} · ${session.cwd}` : 'Session',
    webPreferences: { preload: path.join(import.meta.dirname, '../preload/index.cjs'), sandbox: true }
  })
  const target = rendererTarget(`session=${sessionId}`)
  if (target.url) void w.loadURL(target.url)
  else void w.loadFile(target.file!, { search: target.search })
  sessionWindows.set(sessionId, w)
  // Read now: after 'closed' the window's webContents is destroyed and reading it throws.
  const contentsId = w.webContents.id
  w.on('closed', () => {
    revokeWindowRoots(contentsId)
    sessionWindows.delete(sessionId)
  })
}


function openFileWindow(filePath: string): void {
  const existing = fileWindows.get(filePath)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    return
  }
  const w = new BrowserWindow({
    ...WINDOW_CHROME,
    width: 1000,
    height: 720,
    title: filePath,
    webPreferences: { preload: path.join(import.meta.dirname, '../preload/index.cjs'), sandbox: true }
  })
  const target = rendererTarget(`file=${encodeURIComponent(filePath)}`)
  if (target.url) void w.loadURL(target.url)
  else void w.loadFile(target.file!, { search: target.search })
  fileWindows.set(filePath, w)
  const contentsId = w.webContents.id
  w.on('closed', () => {
    revokeWindowRoots(contentsId)
    fileWindows.delete(filePath)
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    ...WINDOW_CHROME,
    ...windowIcon(),
    width: 1440,
    height: 900,
    title: 'Fabric',
    webPreferences: { preload: path.join(import.meta.dirname, '../preload/index.cjs'), sandbox: true }
  })
  // Read now, not in 'closed': by then webContents is destroyed, and the TypeError it threw raised
  // Electron's modal error box, so quitting the app hung on it (found in the C5 real-app run).
  const contentsId = mainWindow.webContents.id
  mainWindow.on('closed', () => {
    // A folder this window was allowed to reach does not outlive it (S02.roots).
    revokeWindowRoots(contentsId)
    mainWindow = null
  })
  if (process.env.ELECTRON_RENDERER_URL) void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void mainWindow.loadFile(path.join(import.meta.dirname, '../renderer/index.html'))
}

/**
 * One Fabric per machine (IMP-06).
 *
 * THE RECONCILER'S ASSUMPTION IS THAT THERE IS EXACTLY ONE OF US. It sweeps
 * every `running` task at startup on the reasoning that a task belonging to
 * this estate cannot be alive when the process has only just begun — which is
 * true of one process and false of two. A second launch therefore:
 *
 *   - abandons every task the first instance's live sessions are running,
 *   - releases every lease agents are holding, so two start the same work, and
 *   - RECOVERS the first instance's open transcript spools and settles them,
 *     deleting the record of sessions that are still printing into it.
 *
 * Three sweeps, each correct alone, each destructive from a second copy. The
 * fix is one guard that makes the assumption true rather than three defensive
 * checks that each try to guess whether they are the only one.
 *
 * Taken BEFORE `whenReady`, because the lock decides whether this process
 * should exist at all — and a losing instance must not reach bootstrap, where
 * the sweeps are. The smoke run takes it too: failing loudly beside a live
 * instance is better than a green smoke test that corrupted one.
 */
const isPrimary = app.requestSingleInstanceLock()
if (!isPrimary) {
  ops.record({
    op: 'startup.secondInstance',
    outcome: 'ok',
    level: 'warn',
    detail: { note: 'another Fabric holds the single-instance lock; this process is exiting' },
    ctx: { correlationId: ops.correlate() }
  })
  app.quit()
} else {
  app.on('second-instance', () => {
    // Someone tried to open Fabric again. Show them the one they have rather
    // than doing nothing, which reads as the application being broken.
    const [existing] = BrowserWindow.getAllWindows()
    if (existing) {
      if (existing.isMinimized()) existing.restore()
      existing.focus()
    }
  })
}

app.whenReady().then(async () => {
  // `app.quit()` is asynchronous, so a losing instance still reaches here. The
  // flag is what actually stops it — the first version of this guard relied on
  // quit alone and would have let the sweeps run anyway.
  if (!isPrimary) return

  // M111 — before any window exists, because the default menu is what binds
  // Cmd+W to Close Window, and a tabbed app cannot afford that key for one
  // frame. Built from Electron's roles so copy, paste, quit and the window
  // controls survive: replacing the default with a hand-written minimum takes
  // Cmd+C away from every field in the product.
  installMenu()

  // M116 — before the splash, so the first thing on the dock is already the mark.
  applyAppIcon()
  await startOrExplain()
})

/** Everything that can fail on the way to a window — extracted so the Retry
 *  button has something to press. */
async function startOrExplain(): Promise<void> {
  try {
    const meta = await bootstrap()
    registerIpc(meta)

    if (process.env.SMOKE) {
      const probeEvent = await journal.append({
        estateId: ACTIVE_ESTATE,
        type: 'terminal.closed@1',
        actor: { kind: 'system', id: 'smoke' },
        payload: { smoke: true }
      })
      const events = await journal.replay(ACTIVE_ESTATE, probeEvent.seq - 1)
      const { error } = await store.select('projects', 'id').limit(1)
      if (error) throw new Error(`smoke projection read failed: ${error.message}`)
      if (!events.find((e) => e.seq === probeEvent.seq)) throw new Error('smoke replay did not return the probe')
      const { error: memError } = await store.select('memory_facts', 'id').limit(1)
      if (memError) throw new Error(`smoke memory read failed: ${memError.message}`)
      const opts = launchOptions()
      const probe = await fetch(surface.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer nonsense' },
        body: '{}'
      })
      if (probe.status !== 401) throw new Error(`agent surface accepted an unknown credential (${probe.status})`)
      console.log(
        `SMOKE OK — estate=${meta.estateName}, probe seq=${probeEvent.seq}, surface=${surface.endpoint ? 'up, refuses unknown credentials' : 'down'}, launch options=${opts
          .map((o) => `${o.id}:${o.available ? 'yes' : 'no'}`)
          .join(',')}`
      )
      app.quit()
      return
    }

    createWindow()
  } catch (e) {
    // `explainAndQuit` is the loudest path in the product: it classifies the
    // failure, shows the operator a dialog naming it, writes startup-failure.log
    // and records it below. Silence is the one thing this is not.
    ops.failed('startup.bootstrap', e)
    explainAndQuit(e)
  }
}

/**
 * M100 — say why, on screen, instead of dying quietly.
 *
 * `console.error` then `app.quit()` meant the operator double-clicked the app
 * and NOTHING HAPPENED: no window, no dialog, and in a packaged Electron app
 * no terminal is attached, so the diagnosis went somewhere nobody would ever
 * look. The product's first impression, whenever anything was wrong, was that
 * it does not work at all.
 */
function explainAndQuit(e: unknown): void {
  const failure = classifyStartupFailure(e)

  // SMOKE NEXT, and the order is not a detail: `showMessageBoxSync` is modal,
  // and a modal dialog in a headless run does not fail — it WAITS, forever, and
  // the check meant to catch a broken build becomes a hung job. The smoke path
  // keeps its old shape and gains the classification, so a failing CI run names
  // the precondition instead of dumping a raw error.
  if (process.env.SMOKE) {
    // The ONE console.error kept on purpose, and `check-ops.mjs` exempts this
    // line by name: under SMOKE there IS a terminal reading stdout — it is CI —
    // and the operations log lives in a userData directory the runner throws
    // away. Recorded to the log as well, so the two agree.
    ops.failed('startup.smoke', new Error(failure.title), { cause: failure.cause, detail: failure.detail })
    // process.env.SMOKE — exempt, see above
    console.error(`SMOKE FAILED (${failure.cause}) — ${failure.title}\n${failure.detail}`)
    app.quit()
    process.exitCode = 1
    return
  }

  // Written before the dialog names it, so the path in the dialog is a path
  // that exists. This is also the only log there is: nothing else in a packaged
  // app writes one, so pointing at "the log" without creating it would be a
  // second silence dressed as help.
  const logPath = path.join(app.getPath('userData'), 'startup-failure.log')
  try {
    mkdirSync(path.dirname(logPath), { recursive: true })
    writeFileSync(
      logPath,
      `${new Date().toISOString()}  ${failure.cause}\n${failure.title}\n\n${failure.detail}\n`,
      { encoding: 'utf8', mode: 0o600 }
    )
  } catch (writeError) {
    // A log we cannot write must not become the reason nothing is shown.
    ops.failed('index.could-not-write-the-startup-failure-log', writeError, { note: 'could not write the startup failure log:' })
  }
  ops.failed('index.failure', e, { note: `bootstrap failed (${failure.cause}):` })

  for (;;) {
    const plan = startupDialog(failure, { retryable: !pastRetryPoint, logPath })
    const choice = dialog.showMessageBoxSync({
      type: 'error',
      title: 'Fabric could not start',
      message: plan.message,
      detail: plan.detail,
      buttons: plan.buttons,
      defaultId: plan.defaultId,
      cancelId: plan.buttons.length - 1,
      noLink: true
    })
    const pressed = plan.buttons[choice]
    if (pressed === 'Retry') {
      void startOrExplain()
      return
    }
    if (pressed === 'Copy the details') {
      // Copying must not dismiss the dialog: an operator who copies then wants
      // to retry would otherwise have to reopen the app to get the button back.
      clipboard.writeText(`${failure.cause}\n${failure.title}\n\n${failure.detail}`)
      continue
    }
    app.quit()
    process.exitCode = 1
    return
  }
}

let quitting = false
app.on('before-quit', (e) => {
  if (quitting || !ptys || !stopRuntime) return
  // Quit requests scoped termination. A deadline leaves unresolved ownership
  // durable; closing the host does not manufacture a successful Stop receipt.
  e.preventDefault()
  quitting = true
  void stopRuntime
    .shutdown()
    .then(() => surface?.stop())
    .finally(() => app.quit())
})

// Closing a window is not quitting the IDE: PTY sessions live in the main
// process. Cmd+Q is the real quit and ends sessions.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => {
  if (mainWindow === null && !process.env.SMOKE) createWindow()
})
