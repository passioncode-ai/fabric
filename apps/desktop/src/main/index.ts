// The v1 control plane (ADR-0031 §2): the only Supabase client, the journal
// writer, the PTY host and the IPC surface — all here, never in the renderer.

import { BrowserWindow, Notification, app, clipboard, dialog, ipcMain, net, powerMonitor, shell } from 'electron'
import { CONFIGURED, saveProjectSettings } from './commands/projectSettingsCommand.ts'
import { landed, type SaveSettingsInput } from '../shared/projectSettings.ts'
import path from 'node:path'
import { existsSync, readFileSync, realpathSync, statfsSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createJournal, type Journal } from '@fabric/journal'
import { createDesktopJournal, cleanOriginalText, prepareTaskText, prepareIdeaText, prepareRetrievalText } from './desktopIngress.ts'
import { commitBoardCommand, commitPreparedAnswer, commitPreparedImport, commitReleaseCommand } from './commandIngressAdapters.ts'
import { createHash, randomUUID } from 'node:crypto'
import { fixPath, halfUpDeps, recoverStack, resolveSupabaseEnv, stackDatabaseContainer, stackStatusEnv, startStack, stopStartingStack } from './env'
import { resolveHealingHalfUp } from './stackHalfUp.ts'
import { exposureNeedsCheck, stackExposure, stackPorts, type StackExposure } from './stackExposure.ts'
import { applyAppIcon, windowIcon } from './appIcon'
import { isFloorClass, Policy } from './policy'
import { launchOption, launchOptions, PtyManager, setFolderTrust, setPermissionPreference } from './pty'
import { trustFolderForClaude } from './claudeTrust.ts'
import { classifyFailure } from '../shared/failure.ts'
import { createPreparedLaunchInputs } from './preparedLaunchInput.ts'
import { createManagedLaunch, type LaunchInput } from './managedLaunch.ts'
import { createNativeStopRuntime } from './nativeStopRuntime.ts'
import { createTranscriptRecovery } from './transcriptRecovery.ts'
import { createTranscriptReceipt } from './transcriptReceipt.ts'
import { createStopHostIdentity } from './stopHostIdentity.ts'
import { AgentSurface } from './agentSurface'
import { AgentRegistry, registryDirs } from './agentRegistry.ts'
import { linkWindowPlan, resolveLink, type LinkRoute } from '../shared/linkRoute.ts'
import { createLinkHold, createLinkOutbox } from '../shared/linkOutbox.ts'
import { createAccessStore, type AccessStore } from './accessStore.ts'
import { AccessService } from './accessService.ts'
import { startHub, withdrawHub } from './hub.ts'
import { hubServerFor } from './hubTools.ts'
import { EnrolledSessions, enrollSession, joinBoardSession, resolveAgentFolder, type FolderDeps } from './sessionEnroll.ts'
import { createProjectAdmission } from './projectAdmission.ts'
import { createOnboardingFiler, writePersonBusiness } from './projectOnboarding.ts'
import { readGitPeople } from './gitPeople.ts'
import { projectAnalytics, readNewestPaged } from '../shared/projectAnalytics.ts'
import { composeGraph } from '../shared/projectGraph.ts'
import { folderProjectId, gitTopLevel } from './folderResolver.ts'
import { readGitFacts } from './gitFacts.ts'
import { promises as fsPromises } from 'node:fs'
import { resolveBacklogSource } from './backlogSource.ts'
import { createLeaseRefReader, originOf, lsRemoteLeases } from './agentSyncLeases.ts'
import { resolveProject } from '../shared/projectResolve.ts'
import { loginItemFor, loginItemState, startsInBackground, type LoginItemState } from '../shared/loginItem.ts'
import { existingTempRoots } from './tempRoots.ts'
import { releaseByOperator, releaseLapsedClaim, releaseSessionClaims } from './workRelease.ts'
import { createAbandonedSweep, readBoardRequests, readRunningTasks, readSweepClaims, type AbandonedSweep } from './abandonedSweepRun.ts'
import { readHome, readProjectWork, readRunHolds, readTaskBoard, readWhereWork, type HeldSession } from './workRead.ts'
import { FABRIC_SELF } from '../shared/access.ts'
import { createAgentCall } from './hubCall.ts'
import { createObservatoryVault } from './observatoryVault.ts'
import { FABRIC_INBOX, ProductConnector } from './productConnect.ts'
import { forwardToProduct } from './productForwarder.ts'
import { ConsentPresenter } from './consentPresenter.ts'
import { CONNECTABLE_PRODUCTS, agentFacts, askLines, pendingFacts, productName, type ConnectProblem, type HubActResult, type HubDownCode, type HubOverview } from '../shared/access.ts'
import { translator, type Locale, type Translate } from '../renderer/src/i18n/translate.ts'
import { notifyLineOf } from '../renderer/src/attentionTitle.ts'
import type { StringKey } from '../renderer/src/i18n/en.ts'
import { FileRoots, listDirectory, readFile, resolveForOpen, writeFile } from './files'
import { readSessionHistory } from '../shared/sessionHistory.ts'
import { externalLink, isAppDocument, type AppEntry } from './navigationGuard.ts'
import { createWindowRegistry, type IpcWindowRefused } from './windowRegistry.ts'
import { windowKindArg } from '../shared/ipcWindowPolicy.ts'
import { shouldReload } from './rendererRecovery.ts'
import { createBundleCompiler } from './sessionBundle'
import { createTranscriptStore } from './transcripts'
import { compileContextPack, contextDemandFor, type LaunchTrigger, type ContextPack } from './contextPack'
import { refreshFileRootsFrom } from './fileRootsRefresh.ts'
import { readSettings, readSettingsState, writeSettings } from './settings'
import { createPowerKeeper, type PowerKeeper } from './power'
import { createRepoStateReader } from './repoState'
import { createCodeStatsReader } from './codeStats'
import { createQuotaReader, personReturned, resetKeychainRefusal } from './quota'
import { createQuitCoordinator, spawnQuitReaper } from './quit.ts'
import { createEditorRecovery } from './editorRecovery.ts'
import { readGateway } from './gateway'
import { classifyStartupFailure, freeDiskGb, startupDialog, type StartupFailure } from '../shared/startupFailure'
import { dockerIsUnreachable, stackAlreadyRunning } from '../shared/stackStartRetry.ts'
import { STARTUP_WAIT_LINES, retryAfterSeconds, stackBackoffMs, startupHeals, startupWaitLines, type StackHealthView, type StackRefusal } from '../shared/stackWatch.ts'
import { createStackWatch, type StackWatch } from './stackWatch.ts'
import { closeHubStandby, openHubStandby, type StandbyOpen } from './hubStandby.ts'
import { appendBounded } from './boundedLog.ts'
import { pingDocker } from './dockerPing.ts'
import { readBuildManifestCandidates, withSchemaReadiness } from './schemaReadiness.ts'
import { linkOutcome, linkRefusal } from '../shared/taskLinks.ts'
import { splashProgress } from '../shared/splashProgress'
import { checkWorkspace, importWorkspace, initRepository, writeWorkspace } from './workspace'
import {
  IPC,
  type CreateProjectInput,
  type DiagnosticsView,
  type AnswerReceipt,
  type PinResult,
  type SettingsWrite,
  type MemoryBackend,
  type MemoryBackendOption,
  type MemoryFact,
  type ProjectRow,
  type ProjectRelation,
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
  type FabricApi,
  type RendererErrorInfo
} from '../shared/types'
import { createCeoConversationHost } from './ceoConversationHost.ts'
import { createCeoChatBinding } from './ceoChatBinding.ts'
import { DEFAULT_ESTATE, activeEstateUnreadable, readActiveEstate, recordActiveEstate } from './activeEstate.ts'
import { createBackups } from './backup.ts'
import { tickBoard } from './boardService.ts'
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
import { boardEntries, cutBoard, PERSON_KINDS, scopeBoard, type BoardCut, type BoardQuestion } from '../shared/board'
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
import { answerSaid, type AnswerOption } from '../shared/answerCommit'
import { projectWeight, type ProjectSignals } from '../shared/projectWeight'
import { ops, useOps } from './opsSink'
import { createCommsOperatorRead } from './commsOperatorRead.ts'
import { createIpcOutcomeLog } from './ipcOutcome.ts'
import { agentCounts, createAnalytics, installationPath, type Analytics } from './analytics'
import { homedir } from 'node:os'
import { decideProposal } from './commands/proposalCommands.ts'
import { withDeliveryHeader } from '../shared/deliveryState.ts'
import { continuationText, routeContinuation, type ContinuationState } from '../shared/continuation.ts'
import { createRuntimeObserver, DEFAULT_THRESHOLDS } from './runtimeObserver.ts'
import { deriveLiveness } from '../shared/liveness.ts'
import { declaredCapabilities, isAvailable } from '../shared/capabilityReport.ts'
import { AGENTS } from '../shared/agents.ts'
import type { RunStatusView } from '../shared/runStatus.ts'
import { advancesWatermark, runCyclePasses } from '../shared/cyclePort.ts'
import { causeOf, type OpsLevel } from '../shared/opsLog'

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
const ipcOutcomes = createIpcOutcomeLog()
function handle(
  channel: string,
  fn: (event: Electron.IpcMainInvokeEvent, ...args: never[]) => unknown
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    // CO-091: the window's kind decides, here and not in the preload. A refusal is a typed rejection.
    const refused = refusedFor(event, channel, args)
    if (refused) throw refused
    const done = ops.begin(`ipc.${channel}`, { correlationId: ops.correlate() })
    try {
      // A7-002: the bridge grants file writes and access decisions, so only
      // Fabric's own renderer document may drive it. The navigation guard keeps
      // every window on that document; this is the guard's second wall.
      if (!senderAllowed(event)) throw new Error(`the sender is not Fabric's renderer (${event.senderFrame?.url ?? 'no frame'})`)
      const result = await fn(event, ...(args as never[]))
      // 0.3.9 BD-5/BD-6 (`ipcOutcome.ts`): a reply carrying ok: false is never logged ok, and a polled channel writes
      // a line only when its state changes.
      const line = ipcOutcomes.decide(channel, result)
      if (line) done(line.outcome, line.detail ? { detail: line.detail } : undefined)
      return result
    } catch (e) {
      done('failed', { error: e })
      throw e
    }
  })
}

/** The dev server's URL, or null: never in a packaged build, which loads only its own files (ER-6, ER-9). */
function devServer(): string | null {
  return app.isPackaged ? null : (process.env.ELECTRON_RENDERER_URL ?? null)
}

/** The one document every window of this app holds (audit 2026-10-05 A7-002). */
const APP_ENTRY: AppEntry = {
  // A packaged app has no dev server: an inherited ELECTRON_RENDERER_URL there would name an origin the
  // windows never load, and the guard would let any page on it drive the bridge (0.3.2 verification ER-9).
  devOrigin: devServer(),
  indexFile: path.join(import.meta.dirname, '../renderer/index.html')
}

// #region ipc-window-authority — docs: docs/adr/0020-provider-views-are-sandboxed-extensions-and-layout-is-host-owned.md#provider-views-are-sandboxed-extensions-workspace-layout-is-host-owned
/**
 * Which window is which, written where each window is built (`createWindow`, `openSessionWindow`,
 * `openFileWindow`) and removed when it closes (CO-091, REQ-31). The rule per channel is
 * `shared/ipcWindowPolicy.ts#CHANNEL_RULES`; a window this registry does not know is refused everything.
 */
const windowKinds = createWindowRegistry()

/** The refusal for this call, recorded, or null when the sender's kind may make it. */
function refusedFor(
  event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent,
  channel: string,
  args: readonly unknown[]
): IpcWindowRefused | null {
  const refused = windowKinds.check(event.sender.id, channel, args)
  if (refused)
    ops.record({
      op: 'ipc.window-refused',
      outcome: 'failed',
      level: 'warn',
      // Constants only — the channel, the kind and why. Never the arguments, never the window's subject.
      detail: refused.detail(),
      ctx: { correlationId: ops.correlate() }
    })
  return refused
}
// #endregion ipc-window-authority

function senderAllowed(event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent): boolean {
  try {
    return isAppDocument(event.senderFrame?.url ?? '', APP_ENTRY)
  } catch {
    // A frame whose url cannot be read is not Fabric's renderer either.
    return false
  }
}

/**
 * The fire-and-forget counterpart of handle(). A send has no answer channel to
 * carry a failure back, and a throw inside `ipcMain.on` reaches Electron's
 * default handler — a blocking error dialog (audit 2026-10-05 A7-009) — so the
 * failure is recorded instead. The sender wall is handle()'s own (A7-002), and
 * `check-ops.mjs` refuses a bare `ipcMain.on` so the next listener inherits
 * both.
 */
function listen(channel: string, fn: (event: Electron.IpcMainEvent, ...args: never[]) => void, note?: string): void {
  ipcMain.on(channel, (event, ...args) => {
    // CO-091: a send has no answer to carry the refusal, so the ops record is the whole of it.
    if (refusedFor(event, channel, args)) return
    if (!senderAllowed(event)) {
      ops.failed(`ipc.${channel}`, new Error(`the sender is not Fabric's renderer (${event.senderFrame?.url ?? 'no frame'})`))
      return
    }
    try {
      fn(event, ...(args as never[]))
    } catch (e) {
      ops.failed(`ipc.${channel}`, e, note ? { note } : undefined)
    }
  })
}
import { installMenu } from './menu'
import { createKeyedQueue, liveSessionOf, planTaskStart, readbackFallbackRow, refuseSetupWithoutSurface } from './taskRetry'
import { adapterSkills } from './adapterSkills'
import { decideNotification, rememberTold, type ShowOutcome } from '../shared/notify.ts'
import { createUnattendedAdmission } from '../shared/unattendedAdmission.ts'
import { createAdmitExisting } from './admitExisting.ts'
import { createRunLifecycle, type RunLifecycle } from './runLifecycle.ts'
import { createIdentity, LOCAL_OPERATOR_PERSON, type Identity } from './identity.ts'
import { repairSeedOnlyEstate, seedRepairDb, retireSeedOwner, seedRetireDb, operatorStartedAt, LEGACY_SEED_PERSON } from './seedRepair.ts'

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
  resolutionsOf,
  sweptSources,
  type AttentionItem,
  type AttentionSources,
  type JournalActRow
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
import { readMachineAgentCatalog } from './agentCatalogRead.ts'
import { readInbound, setInbound } from './claudeInbound.ts'
import { readFabricReadiness } from './fabricReadinessRead.ts'
import { FOLDER_HELD_SAYS, createFolderLocks } from './launchFolderLock.ts'
import { createRunnerFallback, describeExhausted, launchRoute, openWithFallback } from './runnerFallback.ts'
import { FALLBACK_OPTION, presetNeedsSurface } from '../shared/runnerRoute.ts'
import { settingsPatch, workingLanguageOfRead } from '../shared/appSettings.ts'
import { folderTrustOverridden, trustsAgentFolders } from '../shared/folderTrust.ts'
import { fetchWithDeadline } from './dbDeadline.ts'
import { RunnerUnavailable, SpawnFailure, type LaunchRoute } from './pty'
import { keepScan, lastScan } from './startPaths.ts'
import { createProjectFolder } from './projectFolder.ts'
import { ParentChoices, ScanCandidates, indexImported, realOrResolved, walkPickFor } from './startChoices.ts'
import { sessionEnvironment } from './sessionEnv.ts'
import { projectNameProblem, scanViewOf, type CandidateView, type FolderFacts, type ScanView } from '../shared/startPaths.ts'
import { livenessFor } from './livenessRead.ts'
import { classifyObservationGap, type HostWindow } from '../shared/harnessBreak.ts'
import { createDrafts } from './onboardingDrafts.ts'
import { createAgentExecutors, createKeptOut } from './keptOut.ts'
import { validateKeptOutFile, type KeptOutFile } from '../shared/keptOut.ts'
import { localStore } from './localStore.ts'
import { validateDraftFile, validateDiscardedFile } from '../shared/onboardingDraft.ts'
import type { DraftFile, DiscardedFile } from '../shared/onboardingDraft.ts'
import { createActs } from './acts.ts'
import { createActLog } from './actLog.ts'
import { createWorldExecutors } from './actExecutors.ts'
import { createRunOverConsole, createRunOverExecutors, runOverRefusal } from './actRunExecutors.ts'
import { createSessionExecutors, sessionStopOutcome, type ConsoleSnapshot } from './actSessionExecutors.ts'
import { createDraftExecutors } from './actDraftExecutors.ts'
import { actQueryOf, answerOf } from './actIpc.ts'
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
let admission: ReturnType<typeof createProjectAdmission>
/** W2 S3/S4: files a project's onboarding task; set where the journal and store exist (below), read by the IPC handler. */
let fileOnboardingTask: ((projectId: string, name: string) => Promise<{ taskId: string; filed: boolean }>) | null = null

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
/** ADR-0115: the hub's moving parts, built with the surface. Null until bootstrap reaches them. */
let hub: {
  registry: AgentRegistry
  access: AccessService
  accessStore: AccessStore
  connector: ProductConnector
  presenter: ConsentPresenter
  /** The door token while the hub is published; null when it is not. */
  doorToken: string | null
  /** Why the hub is not listening, when it is not. */
  down: string | null
  downCode: HubDownCode | undefined
  downFact: string | undefined
} | null = null
/** The coding agents the person disconnected (ADR-0160 §3, SCN-167): kept out until let back in. On this computer,
 *  beside the hub's credentials; `localStore` resolves its folder per call, so this is safe before the app is ready. */
const keptOutAgents = createKeptOut(localStore<KeptOutFile>('kept-out-agents.json', {}, validateKeptOutFile))
let mainWindow: BrowserWindow | null = null

// #region fabric-link-handler — docs: docs/ux/scenarios.md#scn-142-open-fabric-from-a-products-button-in-that-products-project-and-go-on-in-a-coding-agent
/**
 * `fabric://` links (contract DEC-0040): a product's Fabric button opens one; macOS hands it to `open-url`, Windows and
 * Linux to a second instance's argv (or this process's argv at a cold start). Links that arrive before startup has
 * finished, or while no main window exists, wait for it — and a link that finds no window opens one (ER-2), the way the
 * consent presenter does. The link itself is never logged: it is the operator's, and a refused one may carry anything;
 * the notice is.
 */
let linkRegistry: AgentRegistry | null = null
/** Set where startup sets `windowReady` (that `let` is declared further down, after the argv read below runs). */
let linkStartupDone = false
/** Past eight waiting links the oldest goes, and never in silence (0.3.5 review i2 ER-7): the drop is logged (not the
 *  link) and the window that opens them says how many were not opened. */
const linkDropped = (where: 'before-window' | 'before-page'): void =>
  ops.record({ op: 'link.dropped', outcome: 'ok', level: 'warn', detail: { where, limit: 8, note: 'the oldest waiting link was not opened; the window says so' }, ctx: { correlationId: ops.correlate() } })
const pendingLinks = createLinkHold<string>(8, () => linkDropped('before-window'))
const isFabricLink = (s: string): boolean => /^fabric:\/\//i.test(s)
/** A resolved link waits until the page says it listens (`links:pending`), so a cold start does not lose it. */
const linkOutbox = createLinkOutbox<LinkRoute>((result) => mainWindow?.webContents.send(IPC.linksOpen, result), 8, {
  onDrop: () => linkDropped('before-page'),
  mark: (newest, dropped) => ({ ...newest, dropped: (newest.dropped ?? 0) + dropped })
})
function acceptLink(url: string): void {
  if (!isFabricLink(url)) return
  const plan = linkWindowPlan({ startupDone: linkStartupDone, hasWindow: mainWindow !== null })
  if (plan === 'open') { void openLink(url); return }
  pendingLinks.hold(url)
  // The new window's first load opens what waited (`linksWindowReady`).
  if (plan === 'hold-and-open-window') createWindow()
}
function linksStartupDone(): void {
  linkStartupDone = true
}
async function openLink(url: string, dropped = 0): Promise<void> {
  // A failed read is `link-unreadable`, said in the window — never routed against an empty list (ER-1, UX-14).
  const result = await resolveLink(url, {
    projects: async () => {
      const { data, error } = await store.select('projects', 'id,name').eq('estate_id', ACTIVE_ESTATE).eq('status', 'active')
      if (error) throw new Error(`the projects could not be read: ${error.message}`)
      return (data ?? []) as Array<{ id: string; name: string }>
    },
    remotes: async (projectId) => (await projectReposWithRemotes(projectId)).map((r) => r.remote),
    services: () => (linkRegistry?.snapshot().entries ?? [])
      .filter((e) => e.kind === 'service')
      .map((e) => ({ key: e.key, id: e.id, repository: e.repository })),
    failed: (e) => ops.failed('link.open', e, { note: 'the link was answered with link-unreadable' })
  })
  ops.record({ op: 'link.open', outcome: 'ok', level: result.notice === 'link-refused' || result.notice === 'link-unreadable' ? 'warn' : 'info', detail: { notice: result.notice }, ctx: { correlationId: ops.correlate() } })
  // The window closed while the link was read: it waits for the one acceptLink opens.
  if (!mainWindow) { acceptLink(url); return }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
  linkOutbox.deliver(dropped > 0 ? { ...result, dropped } : result)
}
function linksWindowReady(): void {
  const { links, dropped } = pendingLinks.take()
  // In the order they came, so the newest is shown last and carries how many were dropped before it.
  void (async () => {
    for (const [i, url] of links.entries()) await openLink(url, i === links.length - 1 ? dropped : 0)
  })().catch((e) => ops.failed('link.open', e, { note: 'the waiting links were not all opened' }))
}
// macOS: delivered before or after `ready`, so registered at once.
app.on('open-url', (event, url) => {
  event.preventDefault()
  acceptLink(url)
})
// Windows and Linux: a cold start carries the link in argv.
for (const arg of process.argv.slice(1)) if (isFabricLink(arg)) acceptLink(arg)
// #endregion fabric-link-handler
// One owner for quitting (CO-191, lifecycle LC-01): the re-quit after the drain runs on a
// macrotask, `window-all-closed` quits once quitting, every scheduler stops first, and a
// hard deadline ends the process if anything stalls.
const quit = createQuitCoordinator({
  app,
  ready: () => !!ptys && !!stopRuntime,
  // 0.3.9 review ER-1: until the main window is up, the splash, the wait window and the failure dialog's window are
  // the start's own; their going is not the person closing Fabric's last window (Windows and Linux quit on that).
  starting: () => !windowReady,
  // Quit requests scoped termination. A deadline leaves unresolved ownership
  // durable; closing the host does not manufacture a successful Stop receipt.
  shutdown: () => stopRuntime.shutdown().then(() => surface?.stop()),
  onDeadline: () => ops.failed('app.quit-deadline', new Error('quit_deadline'), { note: 'the drain or teardown stalled; the process was ended at the deadline' }),
  onSchedulerError: (e) => ops.failed('app.quit-scheduler-stop', e, { note: 'a scheduler failed to stop; the others were stopped and the quit continues' }),
  // Outside the process: ends it 15 s after quitting began even when Electron's teardown stalls.
  armReaper: (ms) => { try { spawnQuitReaper(ms) } catch (e) { ops.failed('app.quit-reaper', e, { note: 'the outside quit guard did not start; the in-process deadline stands' }) } }
})
/** sessionId → taskId, so a session's exit can close the task that opened it. */
const taskBySession = new Map<string, string>()
/** The sweep of abandoned work (0.3.13 wave 2, CO-427), built with the cycle; the surface reads its nudges (SW-4). */
let abandonedSweep: AbandonedSweep | null = null
/** When this process started: the sweep releases a lapsed claim only when this process knew it (CO-427, SW-8). */
const PROCESS_STARTED_AT = Date.now()
/** `tasks.start` calls that name the same task id, one at a time (taskRetry.ts#createKeyedQueue). */
const oneTaskAtATime = createKeyedQueue()
/** The fallback walk that chose a task's runner, between `tasks.start` and the session's opening (ADR-0125). */
const routeByTask = new Map<string, LaunchRoute>()
let runnerFallback: ReturnType<typeof createRunnerFallback>

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
  // CO-091: a message goes only to the windows its channel names — a session window hears its own
  // session's output, never another's, and an editor hears no terminal at all.
  for (const w of allWindows()) if (windowKinds.receives(w.webContents.id, channel, args)) w.webContents.send(channel, ...args)
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

// #region background-launch — docs: AGENTS.md#lifecycle
/**
 * `--background` (lifecycle LC-07/LC-09, agreed with the machine's lifecycle broker on 2026-10-03): start and
 * do the normal startup work, but create no window and take no focus — no splash, no main window — until the
 * person activates the app (Dock click, Cmd+Tab, an explicit open), which `activate` turns into the window.
 * A non-activating launch (`activates=false`) without the flag still raised the splash and the main window
 * and took focus. Only a fresh launch carries arguments; an open of a running Fabric leaves it as it is.
 */
// CO-322: the system opening Fabric at login is a background start too; read once Electron is ready (applyLoginItem).
let BACKGROUND_LAUNCH = process.argv.includes('--background')
/** Injected by electron.vite.config.ts from FABRIC_ANALYTICS_APP_KEY at build time; empty in source builds. */
declare const __FABRIC_ANALYTICS_APP_KEY__: string
const ANALYTICS_APP_KEY: string | null = (typeof __FABRIC_ANALYTICS_APP_KEY__ === 'string' && __FABRIC_ANALYTICS_APP_KEY__) || null
let analytics: Analytics | null = null
// The counts `app_active` carries; set by the analytics wiring so the switch's IPC can send today's count once the
// person answers the first-run disclosure (A7-012), instead of an hour later.
let analyticsCounts: (() => Promise<Record<string, number>>) | null = null
/** Set once startup has registered everything a window needs; an activation before that waits for it. */
let windowReady = false
let activatedDuringStartup = false
/**
 * CO-322: register or remove Fabric as a login item, as the person's setting says (on by default), and on the first
 * call read whether the system opened this start at login, which is a background start. A refusal is recorded and
 * changes nothing else: the setting stays what the person chose.
 */
function applyLoginItem(enabled: boolean, atStart: boolean): void {
  try {
    if (atStart && process.platform === 'darwin' && app.isPackaged)
      BACKGROUND_LAUNCH = startsInBackground(process.argv, app.getLoginItemSettings().wasOpenedAtLogin)
    const item = loginItemFor(enabled, process.platform, app.isPackaged)
    if (!item) return
    app.setLoginItemSettings(item)
    // setLoginItemSettings returns nothing on a refusal; the system's own status is the only receipt (ER-3).
    const state = readLoginItem()
    if (state.supported && enabled && state.system !== 'on')
      ops.record({ op: 'app.login-item', outcome: 'unknown', level: 'warn', detail: { enabled, system: state.system }, ctx: { correlationId: ops.correlate() } })
  } catch (e) {
    ops.failed('app.login-item', e, { enabled })
  }
}
/** What the system says about Fabric's login item; never throws (a refused read is `unknown`). */
function readLoginItem(): LoginItemState {
  return loginItemState(process.platform, app.isPackaged, () =>
    app.getLoginItemSettings(process.platform === 'win32' ? { args: ['--background'] } : undefined))
}
// #endregion background-launch

// The IDE opens with one click: if the local stack is down, start it ourselves
// instead of sending the operator to a terminal.
// The two literals below mirror --bg and --ink of the style pack by hand: this
// window is painted before any stylesheet exists, which is why the palette gate
// scopes itself to the renderer. They are the only hand-copied colours in the
// app, and moving the pack means updating this line.
/** CO-306: the splash speaks the interface's language; a settings file that cannot be read is English. */
function splashLocale(): string | null {
  try { const read = readSettingsState(); return read.status === 'unreadable' ? null : read.value.locale } catch (e) {
    ops.failed('splash.locale-read', e, { note: 'the splash speaks English' })
    return null
  }
}

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
        `<body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#0c0e10;color:#e6e9ec;font:14px -apple-system,sans-serif"><p>${text.replace(/[<>&]/g, ' ')}</p></body>`
      )
  )
  return w
}

/** What the last network check of the local stack found (audit A7-001); null until it has run. */
let lastStackExposure: StackExposure | null = null
/** The check in flight, so a reader waits for it rather than reading "not checked yet". */
let stackExposureCheck: Promise<void> | null = null
/** The stack's API URL, kept so the renderer's read can re-check a stale result. */
let stackApiUrl: string | null = null

/**
 * Whether the stack's ports answer on this Mac's network addresses (`stackExposure.ts` says why Fabric
 * reports this rather than changing the binding). The result is shown in Diagnostics and recorded once.
 */
async function checkStackExposure(apiUrl: string): Promise<void> {
  let dbUrl: string | undefined
  try {
    dbUrl = (await stackStatusEnv()).DB_URL
  } catch (e) {
    // An external stack (SUPABASE_URL given) or a status that cannot be read: the API port is still checked.
    ops.record({ op: 'stack.exposure-db-port-unknown', outcome: 'unknown', level: 'info', detail: { reason: e instanceof Error ? e.message : String(e) }, ctx: { correlationId: ops.correlate() } })
  }
  try {
    lastStackExposure = await stackExposure(stackPorts([apiUrl, dbUrl]))
    if (lastStackExposure.exposed.length > 0)
      ops.record({
        op: 'stack.exposed-on-network',
        outcome: 'ok',
        level: 'warn',
        detail: { exposed: lastStackExposure.exposed, note: 'the local database answers on this Mac\'s network address with default credentials; the warning at the top of Fabric\'s window gives the remedy' },
        ctx: { correlationId: ops.correlate() }
      })
  } catch (e) {
    ops.failed('stack.exposure-check', e, { note: 'whether the local stack is reachable from the network is unknown' })
  } finally {
    stackExposureCheck = null
  }
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
    const splash = process.env.SMOKE || BACKGROUND_LAUNCH || startupWaitWindow ? null : splashWindow(splashProgress({ elapsedMs: 0, lastLine: null, locale: splashLocale() }))
    if (splash) quitWhenPersonCloses(splash)
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
      const text = splashProgress({ elapsedMs: Date.now() - startedAt, lastLine, locale: splashLocale() })
      // `executeJavaScript` rather than a reload: a reload would restart the
      // very paint this exists to deliver.
      void splash.webContents
        .executeJavaScript(`document.querySelector('p').textContent = ${JSON.stringify(text)}`)
        .catch(() => {
          /* the window went away mid-update; the finally below is the authority */
        })
    }, 500)
    try {
      try {
        await startStack((line) => {
          lastLine = line
        })
      } catch (e) {
        // 0.3.13 review ER-1: a CLI that refuses with «already running» may be refusing a half-up stack; the heal
        // below reads the stack and restarts it once. Any other failure is the start's.
        if (!stackAlreadyRunning(e instanceof Error ? e.message : String(e))) throw e
      }
      // CO-428: a start that found the database up may have left rest and auth gone; heal that once.
      return await resolveHealingHalfUp(halfUpDeps(() => startStack((line) => { lastLine = line })))
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

/** Whether the process-level failure handlers are installed; bootstrap may run again after a Retry. */
let processFailuresRecorded = false

async function bootstrap(): Promise<{ estateId: string; estateName: string }> {
  // FIRST, before anything that can fail. A monitor initialised after the thing
  // it is supposed to explain is a monitor that misses the startup.
  useOps(createOps({ dir: path.join(app.getPath('userData'), 'logs') }))
  // Audit A7-009: a stray rejection or exception reached a console a packaged app does not have, or
  // Electron's blocking error dialog. Both are recorded where Diagnostics reads them, and the process
  // goes on: the quit path (`quit.ts`) is what ends it, on its own deadline.
  // Once per process: the startup dialog's Retry runs bootstrap again (0.3.2 verification ER-7).
  if (!processFailuresRecorded) {
    processFailuresRecorded = true
    process.on('unhandledRejection', (reason) => ops.failed('process.unhandled-rejection', reason))
    process.on('uncaughtException', (error) => ops.failed('process.uncaught-exception', error))
  }
  // ST-3: the hub's port and hub.json come up before the stack, answering every call `stack-starting` until the
  // database is ready; the hub takes the same sockets over below (`startHub`, standby). Once per process: a retry
  // keeps the standby it has.
  if (!hubStandby && !process.env.SMOKE) {
    const early = registryDirs()
    const reg = new AgentRegistry({ servicesDir: early.services, providersDir: early.providers })
    reg.refresh()
    hubStandby = await openHubStandby({ claimedPorts: reg.claimedPorts(), root: early.root, refusal: startupRefusal })
    const opened = hubStandby
    quit.onQuit(() => { if (hubStandby === opened) void closeHubStandby(opened, early.root) })
  }
  await fixPath()
  // Which Estate: the recorded choice, or the default. An unreadable choice stops here with its
  // reason; Fabric never opens another Estate in its place.
  const active = readActiveEstate(app.getPath('userData'))
  if (active.status === 'unreadable') throw activeEstateUnreadable(active.problem)
  ACTIVE_ESTATE = active.estateId
  const env = await resolveEnvStartingStackIfNeeded()
  ceoConnection = { url: env.url, serviceKey: env.serviceKey }
  // Audit A7-001: off the startup path — the answer is a warning, never a reason to wait.
  stackApiUrl = env.url
  stackExposureCheck = checkStackExposure(env.url)
  db = createClient(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Every request ends by a deadline; a caller's own `.abortSignal(…)` still ends it sooner (audit A7-010).
    global: { fetch: fetchWithDeadline() }
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

  // #region seed-repair-wiring — docs: docs/adr/0131-a-database-only-the-old-seed-has-touched-is-given-to-the-local-operator.md#decision
  // THE IDENTITY GATE, before the retry point and before the hub opens (0.3.4 i2 ER-2, UX-3): a refused start then
  // offers Retry, and no agent can write into an estate Fabric could not open. A database a fresh install since
  // 0.2.0 made (CO-241, ADR-0131) owned the default estate as a person this app never runs as; only that
  // untouched shape is granted, through the door. Identity is read again after any attempt, so a grant another
  // start made meanwhile is found (i1 ER-4) and is not logged as a failure (i2 ER-3).
  {
    let gate = await identity.establish()
    let seedRepairWhy: string | null = null
    if (!gate.ok && gate.why === 'not_a_member' && estate && ACTIVE_ESTATE === DEFAULT_ESTATE) {
      const repair = await repairSeedOnlyEstate(seedRepairDb(db), { estateId: ACTIVE_ESTATE, operator: LOCAL_OPERATOR_PERSON, commandId: randomUUID() })
      gate = await identity.establish()
      ops.record({
        op: 'identity.seed-repair', outcome: repair.repaired || gate.ok ? 'ok' : 'failed',
        level: repair.repaired ? 'warn' : gate.ok ? 'info' : 'error',
        detail: repair.repaired ? { granted: 'owner' } : { why: repair.why, ...(gate.ok ? { found: 'a membership, on reading again' } : {}) },
        ctx: { correlationId: ops.correlate(), estateId: ACTIVE_ESTATE }
      })
      if (!repair.repaired && !gate.ok) seedRepairWhy = repair.why
    }
    if (!gate.ok)
      throw new Error(`identity could not be established: ${gate.says}` +
        (seedRepairWhy ? ` — the repair for a database only the old seed touched did not apply: ${seedRepairWhy}` : ''))
    // CO-242: a repaired estate's old seed owner `…0002` is retired through the membership door — before the hub opens,
    // on this start or on the first start of a database 0.3.4 repaired. The estate is the operator's either way, so a
    // failure is logged and the start goes on; a shape the rule leaves alone (every later start) records nothing.
    if (ACTIVE_ESTATE === DEFAULT_ESTATE) {
      const retire = await retireSeedOwner(seedRetireDb(db), { estateId: ACTIVE_ESTATE, operator: LOCAL_OPERATOR_PERSON, commandId: randomUUID() })
      if (retire.retired || !retire.left)
        ops.record({
          op: 'identity.seed-retire', outcome: retire.retired ? 'ok' : 'failed', level: retire.retired ? 'warn' : 'error',
          detail: retire.retired ? { revoked: LEGACY_SEED_PERSON } : { why: retire.why },
          ctx: { correlationId: ops.correlate(), estateId: ACTIVE_ESTATE }
        })
    }
  }
  // #endregion seed-repair-wiring

  // M100 — the point after which retrying in place is NOT safe. Observed as we
  // cross it, never inferred from whatever error arrives: a second attempt
  // would open a second listener and register every IPC handler twice, and a
  // failure we cannot place is a failure we must not offer to repeat.
  pastRetryPoint = true
  // #region hub-wiring — docs: docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md#decision
  // ADR-0115: the same surface is the hub. The registry is read from the contract's directories, the
  // standing access lives in migration 76's projections, a product's secret lives in Project
  // Observatory's vault, and the operator answers in a native prompt (or the queue).
  const dirs = registryDirs()
  const registry = new AgentRegistry({ servicesDir: dirs.services, providersDir: dirs.providers })
  registry.refresh()
  linkRegistry = registry
  const stopWatching = registry.watch()
  quit.onQuit(stopWatching)
  const accessStore = createAccessStore({ db, journal, estateId: ACTIVE_ESTATE })
  const vault = createObservatoryVault()
  const hubState = { doorToken: null as string | null, down: null as string | null, downCode: undefined as HubDownCode | undefined, downFact: undefined as string | undefined }
  const connector = new ProductConnector({
    store: accessStore,
    vault,
    // Each estate's connections keep their secrets in slots of their own (DA-6, verification 0.3.1).
    estateId: ACTIVE_ESTATE,
    origin: () => (hubState.doorToken ? surface.origin : ''),
    openExternal: (url) => shell.openExternal(url),
    actor: () => OPERATOR_ACTOR
  })
  let access: AccessService | null = null
  const presenter = new ConsentPresenter({
    window: () => mainWindow,
    showMessageBox: (parent, options) => dialog.showMessageBox(parent as BrowserWindow, options),
    notify: (title, body, onClick) => {
      if (!Notification.isSupported()) return false
      try {
        const n = new Notification({ title, body })
        n.on('click', onClick)
        n.show()
        return true
      } catch (e) {
        ops.failed('hub.consent.notify', e)
        return false
      }
    },
    openWindow: () => { if (mainWindow === null) createWindow() },
    decide: (requestId, decision) => (access as AccessService).decide(requestId, decision, OPERATOR_ACTOR),
    connect: async (product) => (product === FABRIC_INBOX.product ? connector.begin(FABRIC_INBOX) : { ok: false, problem: { code: 'no-flow' }, reason: `${product} has no connect flow` }),
    // The prompt speaks the operator's language, read when it is made (UX-2).
    say: () => translator(readSettings().locale),
    stillPending: async (requestId) => {
      const r = await accessStore.request(requestId)
      return !!r && r.status === 'pending' && Date.parse(r.expires_at) > Date.now()
    },
    // A6-036: read when the prompt is made and before an Allow connects, not only when the request arrived.
    connected: async (product) => (await accessStore.liveConnection(product)) !== null
  })
  // #region session-enroll-wiring — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#decision
  // How Fabric reads a folder an agent names — once, for the enrollment and for the ask, so the prompt shows the
  // same fact the enrollment acts on (ADR-0134 amendment 2). The worktree probe is the resolver's own, asynchronous.
  // #region project-onboarding — docs: docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md#decisions-the-questions-the-scenarios-leave-open
  /** Files a project's onboarding task once (its id is derived from the project's), recorded as Fabric's own act; a task
   *  found with part of its brief unwritten is completed, and two presses at once run one after the other (DA-5). */
  const fileOnboarding = createOnboardingFiler({
    readTask: async (taskId) => {
      const existing = await store.select('project_tasks', 'id,brief_what,brief_why,brief_expected').eq('id', taskId).maybeSingle()
      if (existing.error) throw new Error(`the onboarding task could not be read: ${existing.error.message}`)
      const row = existing.data as { brief_what: string | null; brief_why: string | null; brief_expected: string | null } | null
      return row ? { brief: { what: row.brief_what, why: row.brief_why, expected: row.brief_expected } } : null
    },
    append: (event) => journal.append({ estateId: ACTIVE_ESTATE, actor: { kind: 'system', id: 'fabric-onboarding' }, ...event }),
    locale: () => { const settings = readSettingsState(); return settings.status === 'unreadable' ? null : settings.value.locale },
    failed: (e, detail) => ops.failed('onboarding.file', e, detail)
  })
  fileOnboardingTask = fileOnboarding
  // #endregion project-onboarding
  admission = createProjectAdmission({
    estateId: ACTIVE_ESTATE,
    append: (event) => journal.append({ ...event, estateId: ACTIVE_ESTATE }),
    readProject: readAdmissionProject,
    listRepos,
    readImported: readImportedIndex,
    listRemovals: readRepoRemovals,
    refresh: refreshFileRoots,
    mirror: mirrorWorkspaceNow,
    home: homedir(),
    // W2-7 (0.3.12, OF-31): a new project's onboarding task, in the queue, with its brief written; never filed twice.
    onboard: async (projectId, name) => { await fileOnboarding(projectId, name) }
  })
  const enrollFolders: FolderDeps = {
    admittedFolders: async () => {
      const repos = await store.selectAll('project_repos', 'path,project_id,remote_key,kind', { orderBy: ['project_id', 'path'] })
      if (repos.failed) throw new Error(`repositories read failed: ${repos.failed}`)
      return (repos.rows as Array<{ path: string; project_id: string; remote_key: string | null; kind: 'primary' | 'checkout' | 'worktree' | null }>).map((r) => ({
        projectId: r.project_id,
        path: r.path,
        remoteKey: r.remote_key,
        ...(r.kind ? { kind: r.kind } : {})
      }))
    },
    detachedFolders: readRepoRemovals,
    realpath: (folder) => {
      try {
        return realpathSync.native(folder)
      } catch {
        // A folder that does not exist is resolveAgentFolder's typed bad-folder answer, not a failure to record.
        return null
      }
    },
    remoteOf: originOf,
    gitTopLevel,
    inspectFolder,
    projectIdForFolder: (root) => folderProjectId(ACTIVE_ESTATE, root),
    home: homedir()
  }
  // The enrolled sessions this process minted, by binding and grant: a revocation of either ends them at the surface.
  // The cap evicts by last call, and an evicted session's next call is told why (0.3.5 review i2 ER-4); a rejoin's
  // replaced bearer goes alone (ER-5).
  const enrolled = new EnrolledSessions({
    end: (sessionId, reason) => surface.revokeSession(sessionId, reason),
    state: (token) => surface.credentialState(token),
    lastSign: (sessionId) => surface.sessionSign(sessionId)?.lastSignAt ?? null,
    drop: (token) => surface.revokeCredential(token)
  })
  access = new AccessService({
    store: accessStore,
    registry,
    // ADR-0160 §4 (0.3.7 wave 3): an agent's ask of a product's resources is a question on Главная (the board's access
    // item, Разрешить / Не разрешать), never a native prompt or a notification. The request is journalled and read from
    // there (attention.ts); nothing pops up. The presenter stays for the queue Settings → Agent access still shows.
    present: (request) => { ops.record({ op: 'hub.access.asked-on-home', outcome: 'ok', detail: { request_id: request.row.id }, ctx: { correlationId: ops.correlate() } }) },
    connected: async (product) => (await accessStore.liveConnection(product)) !== null,
    // Who may ask Fabric itself for a session: a coding agent of the runner catalogue whose program is found on this
    // computer (pty.ts#launchOption — the shell row has none and asks for nothing); which projects exist: this
    // estate's; and the folder, resolved by Fabric.
    enrollment: {
      runner: (id) => {
        const a = AGENTS.find((x) => x.id === id && x.program)
        return a ? { key: a.id, name: a.label, summary: a.description ?? null } : null
      },
      available: async (key) => (await launchOption(key))?.available === true,
      project: async (id) => enrollProject(id),
      resolve: async (folder) => {
        const f = await resolveAgentFolder(folder, enrollFolders)
        return f.ok
          ? {
              ok: true,
              projectId: f.projectId,
              root: f.root,
              real: f.real,
              projectName: f.projectName,
              how: f.how,
              candidate: f.candidate,
              remoteKey: f.remoteKey
            }
          : { ok: false, message: f.message }
      },
      admit: async (folder, agentId) => {
        const project = await admission.enroll({ ...folder, real: folder.real ?? folder.root }, agentId)
        return { id: project.id, name: project.name, root: folder.root, how: folder.how }
      }
    },
    // ADR-0160 §3 (0.3.7 wave 3): an agent the person disconnected is refused at the door until let back in.
    keptOut: (key) => keptOutAgents.has(key)
  })
  // #endregion session-enroll-wiring
  const agentCall = createAgentCall({ access, store: accessStore, vault, forward: forwardToProduct, estateId: ACTIVE_ESTATE })
  // A revoked binding never calls again: its idempotency memory goes at once (DA-3, verification 0.3.1).
  access.onBindingRevoked((bindingId) => agentCall.forgetBinding(bindingId))
  // ADR-0134 §3: a revoked binding or grant ends the coding-agent sessions enrolled under it; the next call is refused.
  access.onBindingRevoked((bindingId) => { enrolled.endForBinding(bindingId) })
  access.onGrantRevoked((grantId) => { enrolled.endForGrant(grantId) })
  // COM03-10: a revoked board.respond grant releases the responder slots it admitted (best effort; the in-statement
  // authority recheck is what refuses).
  access.onGrantRevoked((grantId) => { void surface?.releaseBoardGrant(grantId) })
  // CO-200: the counts of refusals not yet journalled are written as the app quits (best effort, within the drain).
  quit.onQuit(() => { void agentCall.flush() })
  hub = { registry, access, accessStore, connector, presenter, get doorToken() { return hubState.doorToken }, get down() { return hubState.down }, get downCode() { return hubState.downCode }, get downFact() { return hubState.downFact } }
  const hubAccess = access
  surface = new AgentSurface({
    db, journal, ptys: () => ptys, policy, estateId: ACTIVE_ESTATE,
    // SW-4: a session's nudges from the sweep of abandoned work ride on its fabric_work_list and fabric_heartbeat.
    nudges: (sessionId, projectId) => abandonedSweep?.takeNudges(sessionId, projectId) ?? [],
    // P-24: the interface's language is the agents' working language, read at each fabric_whoami.
    // OF-38: off in Settings, the hub names no working language and the agents keep their own.
    // A settings file that could not be read answers with defaults; unknown is not on, so it names no language
    // (0.3.11 review, iteration 2, ER-3: the person may have switched it off).
    language: () => workingLanguageOfRead(readSettingsState()),
    // ADR-0176 §3: an unreadable settings file reads as not trusted (null), never as the person's last answer.
    machineTrust: () => { const read = readSettingsState(); return read.status === 'unreadable' ? null : read.value.machineTrust },
    hub: {
      doorToken: () => hubState.doorToken,
      access: hubAccess,
      tools: (principal) => hubServerFor(principal, {
        access: hubAccess,
        call: agentCall,
        enroll: (binding, args) => enrollSession(binding, args, {
          ...enrollFolders,
          liveGrants: (b) => hubAccess.liveGrantsOf(b),
          projectName: async (id) => (await enrollProject(id))?.name ?? null,
          mint: (projectId, sessionId, taskId, origin) => surface.mint(projectId, sessionId, taskId, origin),
          sessions: enrolled,
          stillLive: (bindingId, grantId) => hubAccess.enrollmentLive(bindingId, grantId),
          journal: (type, projectId, payload) =>
            journal.append({ estateId: ACTIVE_ESTATE, type, actor: { kind: 'system', id: 'fabric-hub' }, projectId, payload })
        }),
        // #region board-join-wiring — docs: docs/adr/0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md#4-service-agents-join-with-a-board-session
        // A board session ends with its binding or any of its board.respond grants (EnrolledSessions, as ADR-0134 §3).
        // ADR-0134's safeguards too (wave-2 fix 11): spare-bearer reuse, a board-session cap, the grants read again after
        // the mint, and the grants' earliest expiry, past which the session ends at its next call.
        // F9: the contract's folder attribution over Fabric's own state (shared/projectResolve.ts).
        resolveProject: (folder) => resolveProject(folder, {
          admitted: enrollFolders.admittedFolders,
          detached: readRepoRemovals,
          // Off the main thread (0.3.7 review ER-6): a caller's path on a mount that does not answer no longer stalls
          // the window; the resolve's own deadline answers `pending` meanwhile.
          realpath: (p) => fsPromises.realpath(p).catch(() => null),
          // DEC-0092 (0.3.7 review PL-4): a folder outside Git is null; a probe that failed or timed out is
          // `unreadable`, and the answer is `pending` rather than a plain-folder attribution.
          git: async (dir) => {
            const r = await readGitFacts(dir)
            if (r.kind === 'none') return null
            if (r.kind === 'unreadable') {
              ops.record({ op: 'hub.project.resolve.git', outcome: 'failed', level: 'warn', detail: { why: r.why }, ctx: { correlationId: ops.correlate() } })
              return { unreadable: r.why }
            }
            return { toplevel: r.toplevel, commonDir: r.commonDir, origin: r.origin }
          },
          home: homedir(),
          tempRoots: existingTempRoots(),
          platform: process.platform
        }) as Promise<Record<string, unknown>>,
        joinBoard: (binding, args) => joinBoardSession(binding, args, {
          check: (bindingId, projectId) => surface.boardJoinCheck(bindingId, projectId),
          liveGrants: (b) => hubAccess.liveGrantsOf(b),
          mint: (projectId, sessionId, taskId, origin) => surface.mint(projectId, sessionId, taskId, origin),
          sessions: enrolled,
          stillLive: (bindingId, grantId) => hubAccess.enrollmentLive(bindingId, grantId)
        })
        // #endregion board-join-wiring
      }),
      callback: (product, req, res) => connector.callback(product, req, res)
    },
    // #region work-claims-wiring — docs: docs/ux/scenarios.md#scn-140-agents-ask-fabric-who-is-working-on-what-claim-their-task-are-warned-of-related-work-and-release-it
    work: {
      resolveSource: (projectId, source) => resolveBacklogSource(source, { repos: () => projectReposWithRemotes(projectId) }),
      leaseRefs: (projectId) => projectLeaseRefs(projectId),
      // An enrolled session ends the way a revocation ends it; a launched one is only revoked (its terminal goes on).
      endSession: (sessionId, reason) => enrolled.endSession(sessionId, reason)
    },
    // A session's claims end with it (REQ-38): its terminal exited, its enrollment was revoked or evicted, the app quits.
    onSessionEnded: async (sessionId, why) => {
      await releaseSessionClaims(store, (e) => journal.append({ estateId: ACTIVE_ESTATE, ...e }), sessionId, why)
    }
    // #endregion work-claims-wiring
  })
  // THE PORT IS STABLE OR THERE IS NO HUB (ADR-0115 §1). A port the configuration refuses, or one a
  // registered agent claims, or one another program holds, closes the hub with its reason (Settings →
  // Agent access shows it) — and the sessions Fabric starts keep their surface on an ephemeral port, as
  // before the hub existed, with the external ingress closed: no hub.json, no door token (`startHub`,
  // driven by hub-door-db).
  const started = await startHub({ surface, env: process.env, claimedPorts: registry.claimedPorts(), root: dirs.root, standby: hubStandby?.open ? hubStandby : null })
  // The standby's sockets are the surface's now, or it stops: either way it holds the port no longer.
  if (hubStandby?.open && hubStandby.standby.origin) void hubStandby.standby.stop()
  hubStandby = null
  if (started.open) {
    hubState.doorToken = started.doorToken
    quit.onQuit(() => {
      hubState.doorToken = null
      const w = withdrawHub(dirs.root)
      if (!w.removed) ops.record({ op: 'hub.withdraw', outcome: 'ok', level: 'warn', detail: { reason: w.reason }, ctx: { correlationId: ops.correlate() } })
    })
  } else { hubState.down = started.down; hubState.downCode = started.downCode; hubState.downFact = started.downFact }
  // #endregion hub-wiring

  // #region usage-analytics-wiring — docs: docs/ANALYTICS.md#which-builds-send
  // Counts only (passioncode-ai/fabric#12). The App Key exists only in a release build; any other build sends
  // nothing and Settings shows the switch as unavailable.
  analytics = createAnalytics({
    appKey: ANALYTICS_APP_KEY,
    appVersion: app.getVersion(),
    packaged: app.isPackaged,
    osName: process.platform === 'darwin' ? 'macOS' : process.platform === 'win32' ? 'Windows' : 'Linux',
    installationFile: installationPath(process.platform, process.env, homedir()),
    stateFile: path.join(app.getPath('userData'), 'analytics-state.json'),
    fetch: (url, init) => fetch(url, init),
    log: (line) => ops.record({ op: 'analytics.flush', outcome: line.outcome === 'sent' ? 'ok' : line.outcome === 'kept' ? 'unknown' : 'failed',
      level: line.outcome === 'sent' ? 'info' : 'warn', detail: line, ctx: { correlationId: ops.correlate() } })
  })
  const usageCounts = async (): Promise<Record<string, number>> => {
    const count = async (q: PromiseLike<{ count: number | null; error: unknown }>): Promise<number | null> => {
      try { const r = await q; return r.error ? null : (r.count ?? null) } catch (e) {
        ops.failed('analytics.count', e, { note: 'a usage count could not be read; it is left out of the event' }); return null
      }
    }
    // Live grants, callee and agent only: `agentCounts` keeps a coding agent's enrollment apart from product access.
    const agents = async (): Promise<ReturnType<typeof agentCounts> | null> => {
      try {
        const r = await db.from('access_grants').select('agent_id,callee,capability').eq('estate_id', ACTIVE_ESTATE).is('revoked_at', null).gt('expires_at', new Date().toISOString()).limit(10_000)
        return r.error ? null : agentCounts((r.data ?? []) as Array<{ agent_id: string; callee: string; capability: string }>)
      } catch (e) {
        ops.failed('analytics.count', e, { note: 'a usage count could not be read; it is left out of the event' }); return null
      }
    }
    const [projects, products, agentsNow] = await Promise.all([
      count(db.from('projects').select('id', { count: 'exact', head: true }).eq('estate_id', ACTIVE_ESTATE).eq('status', 'active')),
      count(db.from('product_connections').select('id', { count: 'exact', head: true }).eq('estate_id', ACTIVE_ESTATE).is('removed_at', null)),
      agents()
    ])
    // An unreadable count is absent, never a zero (an unknown stays unknown).
    return Object.fromEntries(Object.entries({ projects, products_connected: products, ...(agentsNow ?? {}) }).filter(([, v]) => v !== null)) as Record<string, number>
  }
  analyticsCounts = usageCounts
  // Held by `analytics.ts` until the person answers the disclosure (A7-012): nothing leaves before that.
  void usageCounts().then((c) => analytics?.started(BACKGROUND_LAUNCH ? 'background' : 'ordinary', c))
  // One `app_active` per UTC day while Fabric runs; the hourly check also notices another app's switch.
  const activeTimer = setInterval(() => {
    if (!analytics || analytics.refresh() !== 'on') return
    void usageCounts().then((c) => analytics?.activeTick(c))
  }, 3600_000)
  activeTimer.unref()
  void usageCounts().then((c) => analytics?.activeTick(c))
  quit.onQuit(() => { clearInterval(activeTimer); analytics?.stop() })
  // #endregion usage-analytics-wiring

  // Every repository attached to any project in this estate. Rebuilt from the
  // projection rather than remembered, so a detach actually closes the door.
  await refreshFileRoots()

  // #region prepared-launch-composition — docs: docs/execution/harness-waves/prepared-launch-input.md#contract
  // Content preparation bounds, not resource capacity defaults. No resource adapter
  // is enabled here: a future trusted composition must share this producer with it.
  const preparedInputs = createPreparedLaunchInputs({store,estateId:ACTIVE_ESTATE,
    maxEntries:32,maxInstructionBytes:65536,contextBudget:12000,timeoutMs:10000})
  const recordContext = async (sessionId:string,projectId:string,taskId:string|null,pack:ContextPack) => {
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
  }
  // #endregion prepared-launch-composition

  const bundles = createBundleCompiler({
    preparedInputs,
    recordPreparedContext: packet => recordContext(packet.sessionId,packet.projectId,packet.taskId,packet.context),
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
      await recordContext(sessionId,projectId,taskId,pack)
      return pack.markdown
    }
  })

  // A new process has no evidence that sessions on other hosts have exited.

  power = createPowerKeeper()
  power.setPolicy(readSettings().keepAwake)

  const transcripts = createTranscriptStore({ root: app.getPath('userData') })

  // OF-12: Fabric's Claude Code sessions start in a folder they already trust (claudeTrust.ts).
  // CO-348: only while the person's switch in Settings is on, read at each start (and never when the environment says 0).
  setFolderTrust((folder) => trustFolderForClaude(folder), () => trustsAgentFolders(readSettings(), process.env))
  // One permission choice for every agent this machine starts (CO-305, ADR-0168), read at each launch.
  setPermissionPreference(() => readSettings().agentPermissions)
  ptys = new PtyManager(journal, ACTIVE_ESTATE, {
    onData: (sessionId, data, written) => broadcast(IPC.terminalData, sessionId, data, written),
    onExit: async (sessionId, exitCode) => {
      const requestedByFabric = !!ptys.get(sessionId)?.termination || quit.quitting
      broadcast(IPC.terminalExit, sessionId, exitCode)
      syncPower()
      // Observed local exit revokes Fabric credentials even if Run lookup is
      // unavailable. Repeated revocation in the finalizer is idempotent.
      try { bundles.discard(sessionId) } catch (e) {
        ops.failed('session.exit-revoke', new Error('Local credential revocation remains unproved'), { sessionId, cause: causeOf(e) })
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

// #region work-claims-reads — docs: docs/ux/scenarios.md#scn-141-see-where-work-is-across-every-project--sessions-claims-review-and-sessions-with-no-project
/** agent-sync's lease refs, read-only and kept a minute (REQ-08); the remotes the backlog links resolve by, kept five. */
const leaseRefReader = createLeaseRefReader({ remoteOf: originOf, lsRemote: lsRemoteLeases })
const remoteCache = new Map<string, { at: number; remote: Promise<string | null> }>()
function cachedOrigin(repoPath: string): Promise<string | null> {
  const hit = remoteCache.get(repoPath)
  if (hit && Date.now() - hit.at < 300_000) return hit.remote
  // A remote that cannot be read resolves by folder only; the address still names the repository by its folder.
  const remote = originOf(repoPath).catch((e) => {
    ops.failed('work.origin-read', e as Error, { note: 'this repository resolves backlog rows by its folder only' })
    return null
  })
  remoteCache.set(repoPath, { at: Date.now(), remote })
  return remote
}
async function projectRepos(projectId: string): Promise<Array<{ path: string; is_primary: boolean }>> {
  const { data, error } = await store.select('project_repos', 'path,is_primary').eq('project_id', projectId)
  if (error) throw new Error(`the project's repositories could not be read: ${error.message}`)
  return (data ?? []) as Array<{ path: string; is_primary: boolean }>
}
async function projectReposWithRemotes(projectId: string): Promise<Array<{ path: string; remote: string | null }>> {
  const repos = await projectRepos(projectId)
  return Promise.all(repos.map(async (r) => ({ path: r.path, remote: await cachedOrigin(r.path) })))
}
async function projectLeaseRefs(projectId: string) {
  const repos = await projectRepos(projectId)
  const primary = repos.find((r) => r.is_primary) ?? repos[0]
  if (!primary) return null
  return { ...(await leaseRefReader.read(primary.path)), repository: primary.path }
}
/** Every session the screens show: what the surface holds (launched and enrolled) and the terminals running. */
function heldSessions(projectId?: string): HeldSession[] {
  const out = new Map<string, HeldSession>()
  for (const s of surface?.heldSessions(projectId) ?? []) {
    // A board session is a service answering the board's requests, not an agent at work: it is not counted or listed
    // among the sessions working (0.3.6 review i3 DA-2).
    if (s.surface === 'board') continue
    out.set(s.sessionId, { sessionId: s.sessionId, projectId: s.projectId, agent: s.agent, cameIn: s.cameIn, console: false, startedAt: s.startedAt, lastSignAt: surface.sessionSign(s.sessionId)?.lastSignAt ?? null })
  }
  for (const p of ptys?.list(projectId) ?? []) {
    if (!p.running) continue
    const at = Date.parse(p.lastActivityAt)
    const held = out.get(p.sessionId)
    // A running terminal is a console Fabric holds: «Open session» opens it (0.3.5 review UX-3).
    out.set(p.sessionId, held
      ? { ...held, agent: held.agent ?? p.optionId, console: true, folder: p.cwd, lastSignAt: Math.max(held.lastSignAt ?? 0, at) || null }
      : { sessionId: p.sessionId, projectId: p.projectId || null, agent: p.optionId, cameIn: 'launched', console: true, folder: p.cwd, startedAt: Date.parse(p.startedAt), lastSignAt: at })
  }
  return [...out.values()]
}
/** A claim's session as the screens read it: held by this surface, or a terminal still running. */
function sessionSignOf(sessionId: string): { lastSignAt: number | null } | null {
  const held = surface?.sessionSign(sessionId)
  if (held) return held
  const p = ptys?.get(sessionId)
  return p?.running ? { lastSignAt: Date.parse(p.lastActivityAt) } : null
}
// #endregion work-claims-reads

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
  } catch (e) {
    ops.failed('session.exit-diagnostic', new Error('Exit diagnostic remains unavailable'), { sessionId, cause: causeOf(e) })
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
    catch (e) { ops.failed('startup.transcript-recovery', new Error('capture_recovery_pending'), { cause: causeOf(e) }) }
    if (generation === recoveryGeneration) {
      recoveryTimer = setTimeout(() => void tick(), delay)
      recoveryTimer.unref()
    }
  }
  void tick()
}
quit.onQuit(() => { recoveryGeneration++; if (recoveryTimer) clearTimeout(recoveryTimer) })
// A quit during the splash ends the `supabase start` it launched (review m13).
quit.onQuit(stopStartingStack)

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
// Unsaved editor buffers, kept as the person types so no quit waits for an editor (ADR-0106 amendment).
const editorRecovery = createEditorRecovery({ dir: path.join(app.getPath('userData'), 'editor-recovery') })
try { editorRecovery.sweep() } catch (e) { ops.failed('editor.recovery-sweep', e, { note: 'old recovery records were not swept this start' }) }
// The person unlocking the screen is the action a held credential read waits for: a locked
// keychain is the usual reason a read was refused (lifecycle LC-04).
void app.whenReady().then(() => powerMonitor.on('unlock-screen', () => { resetKeychainRefusal(); quota.retryCredential() }))
// The person returning to Fabric re-checks a long-held token, so an account switch shows when they look.
app.on('browser-window-focus', () => personReturned())

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

/** The declared-workspace mirror, shared by IPC and agent admission. Fire-and-forget, with its failure logged. */
function mirrorWorkspaceNow(): void {
  const root = readSettings().workspace.path
  if (!root) return
  void writeWorkspace(root, store).catch((e) =>
    ops.failed('index.the-workspace-mirror-could-not-be-writte', e, { note: 'the workspace mirror could not be written:' })
  )
}

async function readAdmissionProject(id: string): Promise<ProjectRow | null> {
  const { data, error } = await store.select('projects', '*').eq('id', id).maybeSingle()
  if (error) throw new Error(`project read failed: ${error.message}`)
  return (data as ProjectRow | null) ?? null
}

async function readRepoRemovals() {
  const removed = await store.selectAll('project_repo_removals', 'id,project_id,path,remote_key,kind', { orderBy: ['project_id', 'id'] })
  if (removed.failed) throw new Error(`repository removals read failed: ${removed.failed}`)
  return removed.rows.map((row) => ({
    id: String(row.id),
    projectId: String(row.project_id),
    path: row.path === null ? null : String(row.path),
    remoteKey: row.remote_key === null ? null : String(row.remote_key),
    kind: row.kind === null ? null : String(row.kind) as 'primary' | 'checkout' | 'worktree'
  }))
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

/** A project of this estate by id, for an enrollment ask (ADR-0134); null when there is none. A failed read throws. */
async function enrollProject(id: string): Promise<{ id: string; name: string } | null> {
  const { data, error } = await store.select('projects', 'id,name').eq('id', id).maybeSingle()
  if (error) throw new Error(`project read failed: ${error.message}`)
  return (data as { id: string; name: string } | null) ?? null
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
  // The operator's acts and their inverse (ADR-0160 §2): built once the drafts and the launch exist, further down.
  let acts: ReturnType<typeof createActs>
  /** An act's refusal to the renderer: the executor's own sentence where it has one, else the reason code. */
  const refusedAs = (r: { reason: string; says?: string }): string => r.says ?? r.reason
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

  handle(IPC.linksPending, async (): Promise<Returns<FabricApi['links']['pending']>> => linkOutbox.claim())
  handle(IPC.metaInfo, async (e): Promise<Returns<FabricApi['meta']['info']>> => {
    // Which window this is comes from the one record the bridge is authorised by (CO-091), so the
    // window a renderer draws and the calls it is allowed cannot disagree.
    const me = windowKinds.entry(e.sender.id)
    const sessionId = me?.kind === 'session' ? (me.subject ?? null) : null
    const filePath = me?.kind === 'editor' ? (me.subject ?? null) : null
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
  // `mirrorNow` is called after every DECLARED change and never after an observed one.
  const mirrorNow = mirrorWorkspaceNow

  handle(IPC.projectsCreate, async (event, input: CreateProjectInput): Promise<Returns<FabricApi['projects']['create']>> => {
    // #region repo-path-admission — docs: docs/adr/0100-first-run-and-start-paths.md#boundary
    // The same canonical admission service used by agent enrollment: window reach is checked here, and a repeat of
    // the same create finishes it rather than making a sibling (projectAdmission.ts).
    return admission.create(input, OPERATOR_ACTOR, {
      granted: (folder, scope) => fileRoots.resolve(folder, scope),
      candidates: scanCandidates
    }, scopeOf(event))
    // #endregion repo-path-admission
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

  // #region project-profile-ipc — docs: docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md#slices-in-order
  // W2 S4: the project page's profile, the business the person sets, the onboarding task and the people from Git.
  handle(IPC.projectsRelations, async (_e, projectId: string): Promise<Returns<FabricApi['projects']['relations']>> => {
    const { data, error } = await store.select('project_relations', 'kind,target,note').eq('project_id', projectId).order('kind').order('target')
    if (error) throw new Error(`the project's relations could not be read: ${error.message}`)
    return (data ?? []) as ProjectRelation[]
  })
  handle(IPC.projectsSetBusiness, async (_e, projectId: string, business: string): Promise<Returns<FabricApi['projects']['setBusiness']>> => {
    // DA-2: the person's business always applies; DA-9: only to a project this estate holds, read before the append.
    return writePersonBusiness<ProjectRow>({
      readProject: async (id) => {
        const { data, error } = await store.select('projects', '*').eq('id', id).maybeSingle()
        return { row: (data as ProjectRow | null) ?? null, error: error?.message ?? null }
      },
      append: (payload) => journal.append({ estateId: ACTIVE_ESTATE, type: 'project.profiled@1', actor: OPERATOR_ACTOR, projectId, payload })
    }, projectId, business)
  })
  handle(IPC.projectsOnboard, async (_e, projectId: string): Promise<Returns<FabricApi['projects']['onboard']>> => {
    const { data, error } = await store.select('projects', 'id,name').eq('id', projectId).single()
    if (error || !data) throw new Error(`the project could not be read: ${error?.message ?? 'no row'}`)
    if (!fileOnboardingTask) throw new Error('the onboarding task cannot be filed before the journal is open')
    return fileOnboardingTask(projectId, (data as { name: string }).name)
  })
  handle(IPC.projectsPeople, async (_e, projectId: string): Promise<Returns<FabricApi['projects']['people']>> => {
    const repos = await listRepos(projectId)
    return readGitPeople(projectId, repos.map((r) => r.path))
  })
  handle(IPC.projectsAnalytics, async (_e, projectId: string): Promise<Returns<FabricApi['projects']['analytics']>> => {
    const now = Date.now()
    const since = new Date(now - 8 * 7 * 86_400_000).toISOString()
    // DA-1: a task reaches done by the person's close (task.closed@1), so the moves and the closes are read together.
    // DA-4: newest first, paged past the gateway's 1000 rows and bounded; a bound reached is said on the page.
    // 0.3.12 review i2 ER-5, DA-3: paged by `seq` below the last one read, so a move journaled mid-read is not counted twice.
    const work = await readNewestPaged<{ seq: number; type: string; payload: { task_id?: string; from?: string | null; to?: string; outcome?: string }; occurred_at: string }>(
      (before, limit) => {
        const q = store.select('journal', 'seq,type,payload,occurred_at').in('type', ['task.moved@1', 'task.closed@1']).eq('project_id', projectId)
          .gte('occurred_at', since)
        return (before === null ? q : q.lt('seq', before)).order('seq', { ascending: false }).limit(limit)
      },
      { maxRows: 5000, key: (r) => Number(r.seq) })
    if (work.failed) throw new Error(`the task moves could not be read: ${work.failed}`)
    const taskMoves = work.rows.filter((r) => r.type === 'task.moved@1' && typeof r.payload?.task_id === 'string' && typeof r.payload?.to === 'string')
      .map((r) => ({ taskId: r.payload.task_id as string, from: r.payload.from ?? null, to: r.payload.to as string, at: r.occurred_at }))
    const taskCloses = work.rows.filter((r) => r.type === 'task.closed@1' && typeof r.payload?.task_id === 'string' && typeof r.payload?.outcome === 'string')
      .map((r) => ({ taskId: r.payload.task_id as string, outcome: r.payload.outcome as string, at: r.occurred_at }))
    const ids = [...new Set([...taskMoves, ...taskCloses].map((m) => m.taskId))]
    const tasks = await store.selectIn('project_tasks', 'id,started_at', 'id', ids)
    if (tasks.failed) throw new Error(`the tasks could not be read: ${tasks.failed}`)
    // The oldest first, so the oldest one waiting is the one named; counted exactly, past the bound of 1000 rows.
    const questions = await store.select('questions', 'asked_at', { count: 'exact' }).eq('project_id', projectId).eq('status', 'open')
      .order('asked_at', { ascending: true }).limit(1000)
    if (questions.error) throw new Error(`the questions could not be read: ${questions.error.message}`)
    return projectAnalytics({
      moves: taskMoves,
      closes: taskCloses,
      createdAt: new Map((tasks.rows as Array<{ id: string; started_at: string }>).map((r) => [r.id, r.started_at])),
      openQuestions: ((questions.data ?? []) as Array<{ asked_at: string }>).map((q) => ({ askedAt: q.asked_at })),
      questionCount: typeof questions.count === 'number' ? questions.count : undefined,
      capped: work.capped,
      now
    })
  })
  handle(IPC.projectsGraph, async (): Promise<Returns<FabricApi['projects']['graph']>> => {
    // DA-4: every active project and every relation, paged past the gateway's 1000 rows over a stable order; a read past
    // selectAll's ceiling fails and says so rather than drawing part of the estate.
    const projectsRead = await store.selectAll('projects', 'id,name,summary,business,repo_path', { eq: [['status', 'active']], orderBy: ['id'] })
    if (projectsRead.failed) throw new Error(`the projects could not be read: ${projectsRead.failed}`)
    const relationsRead = await store.selectAll('project_relations', 'project_id,kind,target', { orderBy: ['project_id', 'kind', 'target'] })
    if (relationsRead.failed) throw new Error(`the relations could not be read: ${relationsRead.failed}`)
    const threadsRead = await db.rpc('board_threads_operator', { p_estate_id: ACTIVE_ESTATE })
    if (threadsRead.error) throw new Error(`the board's threads could not be read: ${threadsRead.error.message}`)
    // The operator's thread read answers {ok, threads} or a refusal {error}; a refusal is said, never drawn as no threads.
    const answer = threadsRead.data as { ok?: boolean; threads?: unknown; error?: { message?: string } } | null
    if (!answer || answer.ok !== true || !Array.isArray(answer.threads)) throw new Error(`the board's threads could not be read: ${answer?.error?.message ?? 'an answer this build cannot read'}`)
    const threads = answer.threads as Array<{ participants?: unknown; messageCount?: unknown }>
    return composeGraph({
      projects: projectsRead.rows as unknown as Array<{ id: string; name: string; summary: string | null; business: string | null; repo_path: string | null }>,
      relations: relationsRead.rows as unknown as Array<{ project_id: string; kind: 'depends-on' | 'used-by' | 'same-business' | 'talks-to' | 'other'; target: string }>,
      threads: threads.filter((x) => Array.isArray(x.participants)).map((x) => ({ participants: x.participants as string[], messageCount: typeof x.messageCount === 'number' ? x.messageCount : 0 }))
    })
  })
  // #endregion project-profile-ipc

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
    /** A NEW task's id chosen by the caller, so a retry names the same task (0.3.3 onboarding). */
    taskId?: string
    // run/node/revision/attempt idempotency key. Recorded on the started event
    // so a repeated advance is one attempt, not two.
    idempotencyKey?: string
    launchAdmission?: LaunchInput['admission']
    /** The fallback walk that chose `optionId` (ADR-0125). */
    route?: LaunchRoute | null
  }): Promise<{ task: TaskRow; session: { sessionId: string } }> => {
      const { instruction, title } = prepareTaskText(input.instruction)
      const id = input.followerId ?? input.taskId ?? randomUUID()
      if (input.route) routeByTask.set(id, input.route)
      try {
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
      // The session runs: a failed read-back must not hide it, or the window calls it "not created" and offers a
      // second agent in the same folder (iteration 2, ER-3). The row is what this call journalled.
      if (error || !data) {
        ops.failed('tasks.readback', new Error(error?.message ?? 'no row'), { taskId: id })
        return { task: readbackFallbackRow({ id, projectId: input.projectId, title, instruction }) as unknown as TaskRow, session: { sessionId: launched.sessionId } }
      }
      return { task: data as TaskRow, session: { sessionId: launched.sessionId } }
      } finally { routeByTask.delete(id) }
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

  handle(IPC.tasksStart, async (_e, input: Parameters<FabricApi['tasks']['start']>[0]): Promise<Returns<FabricApi['tasks']['start']>> => {
    // ADR-0125: the fallback choice is resolved HERE, before the task exists, so the task records the
    // runner that runs it and never the choice. A managed task never attaches: its admission mints a
    // new session.
    let optionId = input.optionId
    let route: LaunchRoute | null = null
    // The setup preset records through Fabric's tools; main holds the line whatever the window chose — a runner by
    // name, a created agent or the fallback order (0.3.3 verification, iteration 2, UX-2/ER-5/DA-1).
    const needsSurface = presetNeedsSurface(input.preset)
    if (optionId === FALLBACK_OPTION) {
      const walk = await runnerFallback.walk(input.projectId, { kind: 'task', permissionMode: input.permissionMode ?? null, needsSurface })
      if (walk.state === 'exhausted') throw new Error(describeExhausted(walk))
      optionId = walk.runner
      route = launchRoute(walk)
    }
    if (needsSurface) {
      let runner = optionId
      if (UUID.test(optionId)) {
        const { data, error } = await store.select('agent_bindings', 'provider_ref').eq('id', optionId).maybeSingle()
        if (error || !data) throw new Error('The selected agent could not be read. Refresh its configuration.')
        runner = data.provider_ref as string
      }
      refuseSetupWithoutSurface(runner, surface.endpoint !== '')
    }
    // A caller-chosen id makes a retry the SAME task (taskRetry.ts#planTaskStart); two starts naming one id run one
    // after the other (createKeyedQueue), so the second finds the first's task.
    const begin = async (): Promise<{ task: TaskRow; session: { sessionId: string } }> => {
      const plan = await planTaskStart<TaskRow>(input, async (id) => await store.select('project_tasks', '*').eq('id', id).maybeSingle(),
        (id) => liveSessionOf(taskBySession, (sessionId) => ptys.get(sessionId)?.running === true, id))
      if (plan.kind === 'running') return { task: plan.task, session: { sessionId: plan.sessionId } }
      if (plan.kind === 'again') {
        const again = await launchManaged({ taskId: plan.task.id, trigger: 'operator', permissionMode: input.permissionMode })
        if (!again.started) throw new Error(again.says)
        return { task: plan.task, session: { sessionId: again.sessionId } }
      }
      return startTask({ projectId: input.projectId, instruction: input.instruction, optionId, taskId: plan.taskId,
        preset: input.preset, presetEdited: input.presetEdited, permissionMode: input.permissionMode, route })
    }
    return typeof input.taskId === 'string' ? oneTaskAtATime(input.taskId, begin) : begin()
  })

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
    // The same `mayMove` ladder, asked inside the executor (`actExecutors.ts`), so an undo meets the rules the move met.
    const r = await acts.perform('task.move', { task_id: String(taskId), to: String(to) })
    if (r.ok) return { ok: true }
    return { ok: false, reason: r.reason === 'task_gone' ? 'that task no longer exists' : refusedAs(r) }
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
      const { data: task, error: readError } = await store
        .select('project_tasks', 'id,project_id,status,title,instruction')
        .eq('id', taskId)
        .maybeSingle()
      // A read that failed is not "no such task" (0.3.3 final recheck): the screen reads that sentence as nothing to
      // cancel, so a failure must say itself.
      if (readError) return { ok: false, reason: `the task could not be read: ${readError.message}` }
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
      const closedTitle = ((task.title as string | null) ?? (task.instruction as string | null) ?? '').trim().slice(0, 120) || null
      await acts.note({ kind: 'task.close', projectId: task.project_id as string, subject: { type: 'task', id: taskId, label: closedTitle },
        said: { key: 'act.task.close', params: { task: closedTitle, outcome } }, inverse: null, whyNot: 'task_closed' })
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
      message: translator(readSettings().locale)('dialog.workspaceChoose')
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

  // #region abandoned-sweep-wiring — docs: docs/evidence/specs/2026-10-26-0313-w2-abandoned-work-sweep.md#requirements
  // The sweep of abandoned work (CO-427): every third pass of the cycle below. Its reads are the screens' own (claims,
  // running tasks), the operator's read door onto the board, and the observer's last pass over Fabric's terminals.
  const sweepBoard = createCommsOperatorRead({ rpc: (fn, args) => db.rpc(fn, args) })
  abandonedSweep = createAbandonedSweep({
    now: () => Date.now(),
    readClaims: (now) => readSweepClaims(store, now, sessionSignOf),
    readRunningTasks: () => readRunningTasks(store),
    readRequests: (now) => readBoardRequests(sweepBoard, ACTIVE_ESTATE, now),
    // A terminal's own last output or typed input (PtyManager `lastActivityAt`); NaN for one Fabric no longer runs,
    // so it is never judged quiet.
    terminals: () => observer.latest().map((o) => {
      const p = ptys.get(o.sessionId)
      return {
        sessionId: o.sessionId, projectId: o.projectId, taskId: taskBySession.get(o.sessionId) ?? null,
        liveness: o.state, since: new Date(o.since).toISOString(), lastActivityAt: p ? Date.parse(p.lastActivityAt) : Number.NaN
      }
    }),
    releaseLapsed: (claimId, reason) => releaseLapsedClaim(store, (e) => journal.append({ estateId: ACTIVE_ESTATE, ...e }), claimId, reason),
    unresolvedRuns: async (taskIds) => (await readRunHolds(store, taskIds)).map((h) => h.taskId),
    // SW-7: the sweep's receipt, estate-level (no project), as the system that swept.
    recordSwept: async (receipt) => { await journal.append({ estateId: ACTIVE_ESTATE, type: 'work.swept@1', actor: { kind: 'system', id: 'abandoned-sweep' }, payload: { ...receipt } }) },
    quitting: () => quit.quitting,
    processStartedAt: PROCESS_STARTED_AT
  })
  const sweep = abandonedSweep
  // #endregion abandoned-sweep-wiring

  // #region cycle-run — docs: docs/adr/0037-the-telegram-bot-answers-by-reply-and-fabric-has-no-always-on-process.md#decision
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
    //
    // EACH STEP IN ITS OWN TRY (release review iteration 3, finding 6): a throwing routine tick no longer
    // stops the chain pass or the observer for the cycle. `runCyclePasses` composes the states.
    const { state, says, observed } = await runCyclePasses(
      {
        tick,
        // The chain pass reports too: a pass that could not read its links is not a completed window.
        advanceChains,
        sample: async () => (await observer.sample()).length
      },
      { failed: (step, e) => ops.failed(step, e) }
    )
    // The project board's upkeep (COM-02.3, ADR-0149 §7): deadlines, epoch rotation, retention. Its own step:
    // it starts no agent work, so it does not change the window this receipt describes; a failure is logged.
    await tickBoard((fn, args) => db.rpc(fn, args), ACTIVE_ESTATE)
    // SW-1: every third pass sweeps abandoned work. Its own step, like the board's: it changes no window this receipt
    // describes, and a failure is recorded and never stops the receipt below.
    try {
      await sweep.onPass()
    } catch (e) {
      ops.failed('cycle.sweep', e, { note: 'the sweep of abandoned work failed this pass; the cycle receipt is still written' })
    }
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
  // #endregion cycle-run

  // A quitting process starts no cycle: a windowless Fabric that kept its 60 s cycle could
  // start agent sessions and write receipts saying the app was open (CO-191).
  const ticker = setInterval(() => {
    if (quit.quitting) return
    void runCycle()
  }, TICK_MS)
  quit.onQuit(() => clearInterval(ticker))

  handle(IPC.workspaceImport, async (): Promise<Returns<FabricApi['workspace']['adopt']>> => {
    const picked = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      message: translator(readSettings().locale)('dialog.workspaceImport')
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
    const [notes, links, lease, events, blockers] = await Promise.all([
      store.select('task_notes', '*').eq('task_id', taskId).order('created_at'),
      store.select('task_links', '*').eq('task_id', taskId),
      store.select('leases', 'owner_session,expires_at,write_scopes').eq('work_id', taskId).maybeSingle(),
      store
        .select('journal', '*')
        .eq('project_id', (task as TaskRow).project_id)
        .or(`payload->>id.eq.${taskId},payload->>task_id.eq.${taskId},payload->>work.eq.${taskId}`)
        .order('seq'),
      // What blocks THIS task: another task's `blocks` link pointing at it (SCN-174 step 2, CO-401).
      store.select('task_links', 'task_id').eq('target_id', taskId).eq('rel', 'blocks')
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

    const blockerIds = ((blockers as { data: Array<{ task_id: string }> | null }).data ?? []).map((l) => l.task_id)
    const blockerRead = await store.selectIn('project_tasks', 'id,title,instruction,status', 'id', blockerIds)
    // A blocker list that could not be read is left out, and the page says nothing rather than «nothing blocks it».
    if (blockerRead.failed) ops.failed('tasks.detail-blockers-unreadable', new Error(blockerRead.failed))
    const targets = (links.data ?? []).map((l) => l.target_id as string)
    const titleRead = await store.selectIn('project_tasks', 'id,title,instruction', 'id', targets)
    if (titleRead.failed) ops.failed('tasks.detail-titles-unreadable', new Error(titleRead.failed))
    const titles = titleRead.rows
    return {
      task: task as TaskRow,
      ...(blockerRead.failed || (blockers as { error: unknown }).error ? {} : {
        blockedBy: blockerRead.rows.map((r) => ({ id: r.id as string, title: ((r.title as string | null) ?? (r.instruction as string)) || (r.id as string), status: r.status as TaskState }))
      }),
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
    const [reviews, expired, refusals, projects, proposals, grants] = await Promise.all([
      store
        .select('project_tasks', 'id,project_id,title,brief_what,instruction,started_at')
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
        .order('created_at'),
      // What resolves a refusal: the operator's grants for the same act (A1-001). The same window as
      // the decisions, newest first: a grant older than every refusal in view resolves none of them.
      store
        .select('journal', 'seq,project_id,payload')
        .eq('estate_id', ACTIVE_ESTATE)
        .eq('type', 'grant.issued@1')
        .order('seq', { ascending: false })
        .limit(REFUSAL_WINDOW)
    ])
    const names = Object.fromEntries(
      (projects.data ?? []).map((row) => [row.id as string, row.name as string])
    )
    // This read already answers the question navigation needs. A lease's
    // `work_id` is a task id only when a task carries it; it was asked here for
    // a TITLE and the answer thrown away, so `AttentionPanel` went on treating
    // every lease as a task and opening a page for one that does not exist.
    // SW-9: the latest sweep's findings join the queue as abandoned work; the tasks they name are read here with the
    // leases', for a title and to know whether each is a task.
    const swept = abandonedSweep?.current() ?? null
    const taskRead = await store.selectIn(
      'project_tasks',
      'id,title,instruction',
      'id',
      [...new Set([
        ...(expired.data ?? []).map((l) => l.work_id as string),
        ...(swept?.findings ?? []).map((f) => f.taskId).filter((id): id is string => id !== null)
      ])]
    )
    if (taskRead.failed) ops.failed('leases.titles-unreadable', new Error(taskRead.failed))
    const titles = Object.fromEntries(
      taskRead.rows.map((row) => [
        row.id as string,
        (row.title as string | null) ?? (row.instruction as string)
      ])
    )
    const isTask = new Set(taskRead.rows.map((row) => row.id as string))
    // ADR-0115: an external agent waiting on consent is in the same queue, until answered or expired.
    let accessRows: NonNullable<AttentionSources['access']> = []
    let accessError: { message: string } | null = null
    if (hub) {
      try {
        const now = Date.now()
        // Live requests filtered by the database (DA-5): a page of the oldest rows went blank after 500 unanswered asks.
        const waiting = (await hub.accessStore.requests({ status: 'pending', liveAt: new Date(now).toISOString() })).filter((r) => Date.parse(r.expires_at) > now)
        const connected = new Map<string, boolean>()
        for (const callee of new Set(waiting.map((r) => r.callee))) connected.set(callee, (await hub.accessStore.liveConnection(callee)) !== null)
        // FACTS, never sentences: the queue phrases them in the operator's language (UX-2), on the prompt's facts.
        accessRows = waiting.map((r) => pendingFacts(r, connected.get(r.callee) ?? false, homedir()))
      } catch (e) {
        // Not silence: the receipt below names this source as failed, so the queue reads as partial.
        accessError = { message: (e as Error).message }
      }
    }
    const sources = obligationReceipts(
      [
        { source: 'access-requests', error: accessError },
        { source: 'reviews', error: reviews.error },
        { source: 'leases', error: expired.error },
        { source: 'refusals', error: refusals.error },
        { source: 'grants', error: grants.error },
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
      access: accessRows,
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
      swept: sweptSources(swept?.findings ?? [], titles, isTask),
      resolutions: resolutionsOf((grants.data ?? []) as JournalActRow[], (refusals.data ?? []) as JournalActRow[]),
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
      if (!r.repeated) {
        // The answer is an act with «reopen» as its inverse (ADR-0160 §2). Best effort and never silent: the answer stands.
        try {
          const q = await store.select('questions', 'text').eq('id', input.questionId).maybeSingle()
          const text = ((q.data as { text?: string } | null)?.text ?? '').trim()
          await acts.note({ kind: 'question.answer', projectId: input.projectId, refSeq: typeof r.answered_seq === 'number' ? r.answered_seq : null,
            subject: { type: 'question', id: input.questionId, label: text.slice(0, 120) || null },
            said: { key: 'act.question.answer', params: { question: text.slice(0, 120) || null, answer: answerSaid(input).slice(0, 120) } },
            inverse: { kind: 'question.reopen', args: { question_id: input.questionId } } })
        } catch (e) { ops.failed('acts.answer-note', e, { question_id: input.questionId }) }
      }
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
  // ADR-0125: the fallback order's machine side, over the same sessions and surface the launches use.
  runnerFallback = createRunnerFallback({
    order: () => readSettings().runnerFallback.order,
    detect: (runners) => detectExecutors(runners, { env: sessionEnvironment(process.env) }),
    surfaceUp: () => surface.endpoint !== '',
    attachable: (projectId, runner, mode, skip) => ptys.attachable(projectId, runner, mode, new Set([...taskBySession.keys(), ...skip]))
  })
  // CO-236: a folder whose last launch has an unknown outcome is held while that process runs.
  const folderLocks = createFolderLocks({ running: (sessionId) => ptys.get(sessionId)?.running === true })
  const launchManaged = createManagedLaunch({
    db, estateId: ACTIVE_ESTATE, actor: OPERATOR_ACTOR,
    folder: {
      held: async (taskId) => {
        if (!folderLocks.any()) return false
        const { data, error } = await store.select('project_tasks', 'project_id').eq('id', taskId).maybeSingle()
        // An unreadable task cannot be placed in a folder: refused rather than started beside an unknown run, and said as
        // unread, not as an agent that may still be running (0.3.13 review ER-7).
        if (error) return 'unread'
        return Boolean(data && folderLocks.holder(data.project_id as string))
      },
      lock: (projectId, sessionId) => folderLocks.lock(projectId, sessionId)
    },
    authority: () => identity.held(),
    admit: (taskId, sessionId, trigger, prepared) => {
      const held = identity.held()
      return admitExisting({ estateId: ACTIVE_ESTATE, taskId, actor: OPERATOR_ACTOR,
        sessionId, trigger, personId: held?.personId, revision: held?.revision }, prepared)
    },
    prepare: async (receipt, input, prepared, unit) => {
      const project = await readProject(receipt.project_id!)
      if (!project.repo_path) throw new Error('Choose an available project folder before starting an agent.')
      const optionId = receipt.option_id || 'claude-code'
      // The fallback walk that chose this runner, when one did (ADR-0125); journalled with the opening.
      const route = input.taskId ? routeByTask.get(input.taskId) ?? null : null
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
            async () => (await identity.guard()).ok && await validateLaunch(), route, prepared, unit)
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
    limit: number,
    /** CO-391: only what a person can resolve (`PERSON_KINDS`), as the home's «Нужны вы» shows. */
    personOnly = false
  ): Promise<ReadEnvelope<BoardCut>> => {
    const now = new Date()
    const stamp = now.toISOString()
    const [obligations, questionRead, blockRead, projectRead, deferralRead] = await Promise.all([
      readAttentionWithSources(stamp),
      store
        .select('questions', 'id,project_id,text,kind,asked_at,status,revision,options,asked_by_kind,asked_by_id')
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

    // CO-391: an asking agent named by the runner its session claimed work as; a read that fails names no agent.
    const askerSessions = [...new Set((questionRead.data ?? []).filter((q) => q.asked_by_kind === 'agent').map((q) => q.asked_by_id as string))]
    const askerRead = askerSessions.length ? await store.selectIn('work_claims', 'owner_session,agent', 'owner_session', askerSessions) : { rows: [], failed: null }
    const agentOf = new Map<string, string>()
    for (const r of (askerRead.rows ?? []) as Array<{ owner_session: string; agent: string | null }>) if (r.agent) agentOf.set(r.owner_session, r.agent)
    const questions: BoardQuestion[] = (questionRead.data ?? []).filter((q) => !setAside.has(q.id as string)).map((q) => ({
      askedBy: q.asked_by_kind === 'person' ? { kind: 'person' as const, agent: null } : { kind: 'agent' as const, agent: agentOf.get(q.asked_by_id as string) ?? null },
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
    const kinds = personOnly ? all.filter((e) => PERSON_KINDS.has(e.kind)) : all
    const scoped = projectId ? scopeBoard(kinds, projectId) : kinds

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

  handle(IPC.boardQuery, (_e, q?: { projectId?: string | null; limit?: number; personOnly?: boolean }): Promise<Returns<FabricApi['board']['query']>> =>
    readBoard(q?.projectId ?? null, q?.limit ?? 5, q?.personOnly === true)
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

  // #region comms-screen — docs: docs/ux/screens.md#scr-81-project-comms
  // SCR-81 — the operator's read onto the project board, over the same service-role
  // client the agent surface uses for the board's participant half. The read logic
  // (unavailable is never empty; the board's refusals travel unchanged) lives in
  // `commsOperatorRead.ts`, where the tests can reach it without a database.
  const commsRead = createCommsOperatorRead({
    rpc: (fn, args) => db.rpc(fn, args),
    // SCN-146 alt path: read only when the board holds no thread — messages the journal records without their texts.
    journalMessages: async (estateId) => {
      const r = await db.from('journal').select('seq', { count: 'exact', head: true }).eq('estate_id', estateId).eq('type', 'comms.message_submitted@1')
      return r.error || typeof r.count !== 'number' ? null : r.count
    },
    // `comms:open-artifact`: the read module refuses every scheme but https before this is reached.
    openExternal: (url) => shell.openExternal(url)
  })
  handle(IPC.commsThreads, (): Promise<Returns<FabricApi['comms']['threads']>> => commsRead.threads(ACTIVE_ESTATE))
  handle(IPC.commsList, (_e, threadId: string | null, afterSeq: number, limit?: number): Promise<Returns<FabricApi['comms']['list']>> =>
    commsRead.list(ACTIVE_ESTATE, threadId ?? null, afterSeq, limit))
  // Wave 4's reads (migration 89). The renderer's arguments are unknown here: each method checks them before the door.
  handle(IPC.commsThreadPage, (_e, filter: unknown, before: unknown, limit?: number): Promise<Returns<FabricApi['comms']['threadPage']>> =>
    commsRead.threadPage(ACTIVE_ESTATE, filter, before, typeof limit === 'number' ? limit : 50))
  handle(IPC.commsHeads, (): Promise<Returns<FabricApi['comms']['heads']>> => commsRead.heads(ACTIVE_ESTATE))
  handle(IPC.commsResponders, (): Promise<Returns<FabricApi['comms']['responders']>> => commsRead.responders(ACTIVE_ESTATE))
  handle(IPC.commsFacts, (_e, messages: unknown): Promise<Returns<FabricApi['comms']['facts']>> => commsRead.facts(ACTIVE_ESTATE, messages))
  handle(IPC.commsTimeline, (_e, requestId: unknown): Promise<Returns<FabricApi['comms']['timeline']>> => commsRead.timeline(ACTIVE_ESTATE, requestId))
  handle(IPC.commsRelated, (_e, threadId: unknown): Promise<Returns<FabricApi['comms']['related']>> => commsRead.related(ACTIVE_ESTATE, threadId))
  handle(IPC.commsSearch, (_e, query: unknown, before: unknown): Promise<Returns<FabricApi['comms']['search']>> => commsRead.search(ACTIVE_ESTATE, query, before))
  handle(IPC.commsPending, (): Promise<Returns<FabricApi['comms']['pending']>> => commsRead.pending(ACTIVE_ESTATE))
  handle(IPC.commsWaiting, (): Promise<Returns<FabricApi['comms']['waiting']>> => commsRead.waiting(ACTIVE_ESTATE))
  handle(IPC.commsOpenArtifact, (_e, url: unknown): Promise<Returns<FabricApi['comms']['openArtifact']>> => commsRead.openArtifact(url))
  // #endregion comms-screen

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
  handle(IPC.releasesRecord, async (_e, input: unknown): Promise<Returns<FabricApi['releases']['record']>> => {
    const done = await commitReleaseCommand(boardDeps(), 'record', input)
    // A release is published outward: its act says it cannot be undone, and why (ADR-0160 §2).
    if (done.state === 'committed' && !done.repeated) {
      const i = (input ?? {}) as { name?: unknown; projectId?: unknown }
      const label = typeof i.name === 'string' ? i.name.slice(0, 120) : null
      await acts.note({ kind: 'release.record', projectId: typeof i.projectId === 'string' ? i.projectId : null, refSeq: done.seq,
        subject: { type: 'release', id: done.releaseId, label }, said: { key: 'act.release.record', params: { release: label } },
        inverse: null, whyNot: 'published' })
    }
    return done
  })
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
        // Said in the interface's language, as the screens say it: a row with no title read is named in words and a
        // finding of the sweep says why it was found, never an id (0.3.13 review, iteration 1, UX-7).
        let noticeLocale: Locale = 'en'
        try { noticeLocale = readSettings().locale } catch { /* English, as the startup dialog falls back */ }
        const sayNotice = translator(noticeLocale)
        const d = decideNotification(
          // The OBLIGATION's key, not its subject's: a task in review whose
          // lease has also expired is two things waiting, and one key for both
          // would tell the operator about only the first of them, ever.
          items.map((i) => ({ id: attentionKey(i), title: notifyLineOf(i, sayNotice, noticeLocale), projectName: i.projectName })),
          told,
          focused,
          (count) => sayNotice('notify.burst', { count })
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
  quit.onQuit(() => clearInterval(notifier))

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
      // The class is the renderer's word, checked before any append (audit A2-015), never cast.
      if (!isFloorClass(input.floorClass)) throw new Error(`"${String(input.floorClass)}" is not a floor class.`)
      // The answer is returned (A1-001): the act says "allowed until …" instead of offering itself again.
      const { grantId, expiresAt } = await policy.issueGrant({
        estateId: ACTIVE_ESTATE,
        projectId: input.projectId,
        floorClass: input.floorClass,
        target: input.target,
        actor: OPERATOR_ACTOR,
        // An hour. Long enough for an agent to notice and act, short enough
        // that an authorisation nobody used stops being one.
        ttlMs: 60 * 60 * 1000
      })
      return { grantId, expiresAt }
    }
  )

  // #region usage-analytics-ipc — docs: docs/ANALYTICS.md#nothing-before-the-disclosure
  handle(IPC.analyticsStatus, async (): Promise<Returns<FabricApi['analytics']['status']>> =>
    ({ availability: analytics ? analytics.refresh() : (ANALYTICS_APP_KEY ? 'unavailable-file' : 'unavailable-no-key'), sentBefore: analytics?.sentBefore() ?? false }))
  handle(IPC.analyticsSetEnabled, async (_e, enabled: unknown): Promise<Returns<FabricApi['analytics']['setEnabled']>> => {
    if (typeof enabled !== 'boolean') throw new Error('analytics: the switch takes true or false')
    const availability = analytics ? analytics.setEnabled(enabled) : (ANALYTICS_APP_KEY ? 'unavailable-file' : 'unavailable-no-key')
    // The first answer to the disclosure also releases today's `app_active`, which was held with everything else.
    if (availability === 'on' && analyticsCounts) void analyticsCounts().then((c) => analytics?.activeTick(c))
    return { availability }
  })
  // #endregion usage-analytics-ipc

  // #region hub-ipc — docs: docs/ux/scenarios.md#scn-132-an-external-agent-asks-for-access-and-the-operator-decides
  /** Agent access (ADR-0115, SCR-52 → Agent access): what is waiting, what is granted, what is connected. */
  const hubReady = (): NonNullable<typeof hub> => {
    if (!hub) throw new Error('agent access is not ready yet')
    return hub
  }
  handle(IPC.hubOverview, async (): Promise<Returns<FabricApi['hub']['overview']>> => {
    const h = hubReady()
    const ov = await h.access.overview()
    const products: HubOverview['products'] = []
    const connected = new Map<string, boolean>()
    for (const product of CONNECTABLE_PRODUCTS) {
      const c = await h.accessStore.liveConnection(product)
      connected.set(product, c !== null)
      const last = h.connector.lastOutcome(product)
      products.push({
        product,
        name: productName(product),
        connection: c ? { server: c.server, level: c.level, connectedAt: c.connected_at, keyExpiresAt: c.key_expires_at } : null,
        lastAttempt: !last ? null
          : last.outcome === 'waiting' ? { outcome: 'waiting', at: last.since, reconnect: last.reconnect }
          : last.outcome === 'connected' ? { outcome: 'connected', at: last.at, reconnect: last.reconnect }
          : last.outcome === 'failed' ? { outcome: 'failed', at: last.at, problem: last.problem }
          : { outcome: 'denied', at: last.at }
      })
    }
    // FACTS, never sentences (UX-2): the renderer phrases every line in the operator's language.
    return {
      hub: h.doorToken ? { listening: true, origin: surface.origin } : { listening: false, reason: h.down ?? 'the hub is not listening', code: h.downCode, fact: h.downFact },
      products,
      pending: ov.pending.map((r) => pendingFacts(r, connected.get(r.callee) ?? false, homedir())),
      agents: ov.bindings.map((b) => ({
        bindingId: b.id,
        agent: agentFacts(b.agent_id, b.registry),
        since: b.created_at,
        grants: b.grants.map((g) => ({ grantId: g.id, callee: g.callee, capability: g.capability, resource: g.resource, line: askLines({ capabilities: [g.capability], resources: [g.resource], registry: g.registry ?? b.registry })[0], expiresAt: g.expires_at }))
      })),
      denials: ov.denials.map((r) => ({ requestId: r.id, agent: agentFacts(r.agent_id, r.registry), callee: r.callee, ask: askLines(r), deniedAt: r.decided_at })),
      keptOut: { readable: keptOutAgents.readable(), agents: keptOutAgents.list() }
    }
  })
  /** The product's connect flow, by name; a product without one is a code, not a sentence. */
  const beginConnect = async (h: NonNullable<typeof hub>, product: string, reconnect = false): Promise<{ ok: true } | { ok: false; problem: ConnectProblem; reason: string }> => {
    if (product !== FABRIC_INBOX.product) return { ok: false, problem: { code: 'no-flow' }, reason: `${product} has no connect flow` }
    const r = await h.connector.begin(FABRIC_INBOX, { reconnect })
    return r.ok ? { ok: true } : r
  }
  handle(IPC.hubDecide, async (_e, requestId: string, decision: 'allowed' | 'denied'): Promise<Returns<FabricApi['hub']['decide']>> => {
    const h = hubReady()
    if (decision !== 'allowed' && decision !== 'denied') return { ok: false, reason: 'a decision is allowed or denied' }
    const row = await h.accessStore.request(String(requestId))
    const done: HubActResult = await h.access.decide(String(requestId), decision, OPERATOR_ACTOR)
    // Fabric itself (ADR-0134, a coding agent's enrollment) is not a product: there is nothing to connect.
    if (done.ok && decision === 'allowed' && row && row.callee !== FABRIC_SELF && !(await h.accessStore.liveConnection(row.callee))) {
      // The Allow is recorded either way; a product that could not be opened is said beside it (UX-5).
      const started = await beginConnect(h, row.callee)
      if (!started.ok) return { ok: true, connect: { problem: started.problem } }
    }
    return done
  })
  handle(IPC.hubRevokeGrant, async (_e, grantId: string): Promise<Returns<FabricApi['hub']['revokeGrant']>> =>
    hubReady().access.revokeGrant(String(grantId), OPERATOR_ACTOR))
  handle(IPC.hubRevokeAgent, async (_e, bindingId: string): Promise<Returns<FabricApi['hub']['revokeAgent']>> => {
    const h = hubReady()
    // The agent's name, read before the revocation, so История can say which agent it was (CO-353): the name its
    // request was registered under, else the catalogue's, else its id; an unreadable binding leaves the act unnamed.
    const named = await (async (): Promise<string | null> => {
      try {
        const b = await h.accessStore.binding(String(bindingId))
        if (!b) return null
        const asked = await h.accessStore.request(b.request_id)
        return asked?.registry?.name ?? AGENTS.find((a) => a.id === b.agent_id)?.label ?? b.agent_id
      } catch (e) {
        ops.failed('hub.access.revoke-name-unreadable', e, { binding_id: String(bindingId) })
        return null
      }
    })()
    const done = await h.access.revokeBinding(String(bindingId), OPERATOR_ACTOR)
    // The credential is gone and cannot be revived: the agent asks again and gets a new one (ADR-0160 §2: said, not hidden).
    if (done.ok) await acts.note({ kind: 'agent.disconnect', projectId: null, subject: { type: 'agent', id: String(bindingId), label: named },
      said: { key: 'act.agent.disconnect', params: { agent: named } }, inverse: null, whyNot: 'credential_gone' })
    return done
  })
  // #region kept-out-ipc — docs: docs/ux/scenarios.md#scn-167-a-coding-agent-opened-outside-fabric-is-let-in-and-the-person-disconnects-it-with-one-press
  handle(IPC.hubDisconnectAgent, async (_e, agentId: unknown): Promise<Returns<FabricApi['hub']['disconnectAgent']>> =>
    answerOf(await acts.perform('agent.disconnect', { agent_id: typeof agentId === 'string' ? agentId : '' })))
  handle(IPC.hubLetAgentIn, async (_e, agentId: unknown): Promise<Returns<FabricApi['hub']['letAgentIn']>> =>
    answerOf(await acts.perform('agent.let_in', { agent_id: typeof agentId === 'string' ? agentId : '' })))
  // #endregion kept-out-ipc
  handle(IPC.hubClearDenial, async (_e, requestId: string): Promise<Returns<FabricApi['hub']['clearDenial']>> =>
    hubReady().access.clearDenial(String(requestId), OPERATOR_ACTOR))
  handle(IPC.hubConnect, async (_e, product: string, opts?: { reconnect?: unknown }): Promise<Returns<FabricApi['hub']['connect']>> =>
    // Replacing a live connection's key is the operator's explicit Reconnect, never a side effect of Connect.
    beginConnect(hubReady(), String(product), opts?.reconnect === true))
  handle(IPC.hubDisconnect, async (_e, product: string): Promise<Returns<FabricApi['hub']['disconnect']>> =>
    hubReady().connector.disconnect(String(product)))
  // #endregion hub-ipc

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
  const drafts = createDrafts(
    localStore<DraftFile>('onboarding-drafts.json', {}, validateDraftFile),
    localStore<DiscardedFile>('discarded-drafts.json', {}, validateDiscardedFile)
  )

  // #region acts-wiring — docs: docs/ux/scenarios.md#scn-169-undo-an-act-or-read-why-it-cannot-be-undone
  const labelOf = (optionId: string): string => AGENTS.find((a) => a.id === optionId)?.label ?? optionId
  const consoleOf = (s: ReturnType<PtyManager['get']>): ConsoleSnapshot | null =>
    s ? { sessionId: s.sessionId, projectId: s.projectId, optionId: s.optionId, permissionMode: s.permissionMode, cwd: s.cwd, label: labelOf(s.optionId) } : null
  const projectNameOf = async (projectId: string): Promise<string | null> => {
    try { return (await readProject(projectId)).name } catch { /* not silence: the sentence is worded without the name */ return null }
  }
  acts = createActs({
    log: createActLog({ journal, store, estateId: ACTIVE_ESTATE }),
    actor: OPERATOR_ACTOR,
    onRecordFailed: (kind, e) => ops.failed('acts.record', e, { kind }),
    executors: {
      ...createWorldExecutors({
        store, journal, estateId: ACTIVE_ESTATE, actor: OPERATOR_ACTOR, rpc: (name, args) => db.rpc(name, args),
        sessionLive: (id) => heldSessions().some((s) => s.sessionId === id), pathExists: (p) => existsSync(p),
        newId: () => randomUUID(), now: () => Date.now(), foldersChanged: refreshFileRoots
      }),
      ...createRunOverExecutors({
        rpc: (name, args) => db.rpc(name, args) as never, estateId: ACTIVE_ESTATE, actor: OPERATOR_ACTOR as { kind: 'person'; id: string },
        taskTitle: async (id) => ((await store.select('project_tasks', 'title').eq('id', id).maybeSingle()).data as { title?: string } | null)?.title ?? null,
        projectOf: async (id) => ((await store.select('project_tasks', 'project_id').eq('id', id).maybeSingle()).data as { project_id?: string } | null)?.project_id ?? null,
        stopOf: async (id) => ((await store.select('run_stop_commands', 'state,basis').eq('command_id', id).maybeSingle()).data as { state: string; basis: string | null } | null) ?? null,
        // UX-1 / ER-7: the console follows the act both ways, so «Отменить» gives back «Работа закончена».
        settled: createRunOverConsole({ get: (id) => ptys.get(id)?.termination, set: (t) => ptys.setTermination(t) }).settled
      }),
      ...createSessionExecutors({
        runnerAvailable: async (id) => (UUID.test(id) ? true : (await launchOption(id))?.available === true),
        stop: async (sessionId) => {
          const r = await stopRuntime.stop(sessionId, 'operator_stop')
          return { sessionId, state: r.state, reasonCode: r.reasonCode, ...(r.taskId ? { taskId: r.taskId } : {}) }
        },
        snapshot: (id) => { const s = ptys.get(id); return s?.running ? consoleOf(s) : null },
        projectName: projectNameOf,
        startAgain: async (a) => {
          if (a.task_id) {
            const r = await launchManaged({ taskId: a.task_id, trigger: 'operator', ...(a.permission_mode ? { permissionMode: a.permission_mode } : {}) })
            if (!r.started) throw new Error(r.says)
            return { sessionId: r.sessionId, label: labelOf(a.option_id) }
          }
          const project = await readProject(a.project_id)
          const place = launchPlace(project.repo_path)
          const cwd = a.cwd && existsSync(a.cwd) ? a.cwd : place.place === 'repository' ? place.path : app.getPath('home')
          const opened = await ptys.open(a.project_id, cwd, a.option_id, null, a.permission_mode)
          syncPower()
          return { sessionId: opened.sessionId, label: labelOf(a.option_id) }
        }
      }),
      ...createDraftExecutors(drafts),
      // «Отключить» / «Пустить снова» (ADR-0160 §3, SCN-167): each the other's inverse.
      ...createAgentExecutors({
        keptOut: keptOutAgents,
        liveBindingsOf: async (agentId) => (await hubReady().accessStore.liveBindings()).filter((b) => b.agent_id === agentId && b.revoked_at === null).map((b) => b.id),
        revoke: async (bindingId) => {
          const r = await hubReady().access.revokeBinding(bindingId, OPERATOR_ACTOR)
          return r.ok ? { ok: true } : { ok: false, reason: r.code ?? r.reason }
        },
        nameOf: (agentId) => AGENTS.find((a) => a.id === agentId)?.label ?? null
      })
    }
  })
  handle(IPC.actsHistory, (_e, query?: unknown): Promise<Returns<FabricApi['acts']['history']>> => acts.history(actQueryOf(query)))
  handle(IPC.actsUndo, async (_e, seq: unknown): Promise<Returns<FabricApi['acts']['undo']>> => {
    if (typeof seq !== 'number' || !Number.isSafeInteger(seq) || seq < 1) return { ok: false, reason: 'not_an_act' }
    return answerOf(await acts.undo(seq))
  })
  handle(IPC.draftsDiscard, async (_e, tabId: unknown): Promise<Returns<FabricApi['drafts']['discard']>> =>
    answerOf(await acts.perform('draft.discard', { tab_id: typeof tabId === 'string' ? tabId : '' })))
  handle(IPC.draftsRestore, async (_e, discardId: unknown): Promise<Returns<FabricApi['drafts']['restore']>> =>
    answerOf(await acts.perform('draft.restore', { discard_id: typeof discardId === 'string' ? discardId : '' })))
  // #endregion acts-wiring

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
    const picked = await dialog.showOpenDialog({ properties: ['openDirectory'], message: translator(readSettings().locale)('dialog.archiveChoose') })
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
  // A5-014, A3-005: what waits for a result and what can still be opened are main's files, not the panel's state.
  handle(IPC.historyPending, (): Returns<FabricApi['history']['pending']> => privateHistory?.pending() ?? [])
  handle(IPC.historyRestored, (): Returns<FabricApi['history']['restored']> => privateHistory?.restoredEstates() ?? [])
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
  // #region start-paths-ipc — docs: docs/adr/0129-onboarding-is-four-actions-and-agent-work-runs-in-the-coding-agents-console.md#boundary
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
    const say = translator(readSettings().locale)
    const message = say(purpose === 'scan' ? 'dialog.scanChoose' : purpose === 'parent' ? 'dialog.parentChoose' : 'dialog.projectChoose')
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
      // A save that did not commit is SAID (`kept: false`), never ignored (iteration 3, docs finding 2).
      const kept = keepScan(result)
      if (!kept && !result.cancelled) ops.record({ op: 'start.scan.keep', outcome: 'failed', level: 'warn', detail: { candidates: result.candidates.length }, ctx: { correlationId: ops.correlate() } })
      const view: ScanView = scanViewOf(result, (await withImported(result.candidates)) as CandidateView[], kept?.scannedAt ?? null)
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
    return scanViewOf(kept, (await withImported(kept.candidates)) as CandidateView[], kept.scannedAt)
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
      // Every catalogued runner with a program (ADR-0125): the list was a hard-coded copy of the catalogue.
      AGENTS.filter((a) => a.program).map((a) => ({ id: a.id, label: a.label, program: a.program as string, connected: a.connectsToSurface })),
      { env: sessionEnvironment(process.env) }
    )
  )
  // Read-only: where the chosen coding agent reads skills (REQ-04). An id that is not a string reads as none.
  handle(IPC.startAdapterSkills, (_e, agentId: unknown): Promise<Returns<FabricApi['start']['adapterSkills']>> =>
    adapterSkills(typeof agentId === 'string' ? agentId : ''))
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
   * Fabric's own server; since CO-325 a console also keeps the MCP servers the
   * operator's coding agent is set up with, and only a created agent runs with
   * `--strict-mcp-config` (sessionBundle.ts). The screen says which.
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
    const [first, operatorMembership, projects, sessions, tasksClosed, facts, decisions, grants, events] =
      await Promise.all([
        store.select('journal', 'occurred_at').eq('estate_id', ACTIVE_ESTATE).order('seq').limit(1).maybeSingle(),
        // CO-242: an estate the seed repair gave the operator started, for them, at the repair.
        store.select('memberships', 'created_at, changed_by').eq('estate_id', ACTIVE_ESTATE).eq('person_id', LOCAL_OPERATOR_PERSON).maybeSingle(),
        count(store.select('projects', 'id', head).eq('estate_id', ACTIVE_ESTATE)),
        count(store.select('session_transcripts', 'session_id', head).eq('estate_id', ACTIVE_ESTATE)),
        count(store.select('project_tasks', 'id', head).eq('estate_id', ACTIVE_ESTATE).in('status', ['done', 'cancelled'])),
        count(store.select('memory_facts', 'id', head).eq('estate_id', ACTIVE_ESTATE).is('valid_to', null)),
        count(store.select('memory_facts', 'id', head).eq('estate_id', ACTIVE_ESTATE).eq('kind', 'decision')),
        count(store.select('grants', 'id', head).eq('estate_id', ACTIVE_ESTATE)),
        count(store.select('journal', 'seq', head).eq('estate_id', ACTIVE_ESTATE))
      ])
    return {
      tenure: tenureFrom(operatorStartedAt((operatorMembership.data as { created_at?: string; changed_by?: string | null } | null) ?? null)
        ?? (first.data?.occurred_at as string | undefined) ?? null, new Date()),
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

  // Audit A7-001: the exposure warning above every screen reads this. A stale result is re-checked, and a
  // check in flight is waited for (bounded), so the first read after start is not "nothing found".
  handle(IPC.stackExposure, async (): Promise<Returns<FabricApi['stack']['exposure']>> => {
    // Stale, or never finished (the first check failed): check again (0.3.2 verification ER-10, UX-6).
    if (stackApiUrl && exposureNeedsCheck(lastStackExposure, stackExposureCheck !== null, Date.now())) stackExposureCheck = checkStackExposure(stackApiUrl)
    if (stackExposureCheck) await Promise.race([stackExposureCheck, new Promise((r) => setTimeout(r, 5_000))])
    return lastStackExposure
  })

  // ST-2, ST-1 (0.3.9): the stack's health as the runtime watch last read it; the window also hears each change.
  handle(IPC.stackHealth, (): Returns<FabricApi['stack']['health']> => stackHealthNow)

  // Audit A7-009: a renderer failure is recorded beside the program's own — the boundary and the
  // root's `onUncaughtError` send it here, because the renderer's console reaches nobody.
  listen(IPC.opsRendererError, (_e, info: RendererErrorInfo) => {
    ops.failed('renderer.error', new Error(info.message), { stack: info.stack ?? undefined, component: info.component ?? undefined })
  })

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
        .select('memory_facts', 'id,claim,source_ref,actor_kind,recorded_at,superseded_by,valid_to')
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
  // Editor recovery (ADR-0106 amendment): the unsaved buffer of a file this window may open, keyed by its
  // resolved path. A path outside the window's roots is refused exactly as a read would be.
  handle(IPC.filesRecoveryKeep, (event, file: string, content: string | null, baseHash: string): Returns<FabricApi['files']['recoveryKeep']> =>
    editorRecovery.keep(fileRoots.resolve(file, scopeOf(event)), content, baseHash))
  handle(IPC.filesRecoveryRead, (event, file: string): Returns<FabricApi['files']['recoveryRead']> => {
    const r = editorRecovery.read(fileRoots.resolve(file, scopeOf(event)))
    return r ? { content: r.content, baseHash: r.baseHash, at: r.at } : null
  })
  // Fire-and-forget from beforeunload: the last keystrokes before a quit land before the window goes.
  listen(
    IPC.filesRecoveryFlush,
    (event, file: string, content: string | null, baseHash: string) => {
      editorRecovery.keep(fileRoots.resolve(file, `win:${event.sender.id}`), content, baseHash)
    },
    'the last unsaved keystrokes were not kept; the debounced copy stands'
  )
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
      if (!grantId) return writeFile(file, content, expectedHash, fileRoots, scope)

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
      const result = writeFile(file, content, expectedHash, fileRoots, scope)
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
      ttlMs: 60_000,
      // The one act the write asks for (filesWrite's request): the grant authorises no other (A7-015).
      actionClass: 'file.overwrite'
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
      message: translator(readSettings().locale)('dialog.reposChoose')
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
    // The one admission service (ADR-0136 amendment 2): this window's own folders, by their real paths, none held by
    // another project (REQ-04), each recorded with its remote and kind.
    const before = new Set((await listRepos(projectId)).map((r) => r.id))
    await admission.attach(projectId, paths, OPERATOR_ACTOR, {
      granted: (folder, scope) => fileRoots.resolve(folder, scope),
      candidates: scanCandidates
    }, scopeOf(event))
    const after = await listRepos(projectId)
    // Each folder this press attached is an act with its inverse (ADR-0160 §2): detach it again.
    for (const r of after.filter((x) => !before.has(x.id)))
      await acts.note({ kind: 'repo.attach', projectId, subject: { type: 'repo', id: r.id, label: r.label ?? r.path },
        said: { key: 'act.repo.attach', params: { folder: r.label ?? r.path } }, inverse: { kind: 'repo.detach', args: { repo_id: r.id } } })
    return after
  })

  handle(IPC.reposDetach, async (_e, projectId: string, repoId: string): Promise<Returns<FabricApi['repos']['detach']>> => {
    // At once, no question (ADR-0160 §1); the act keeps the folder's path so «Отменить» attaches it again, and the
    // detach leaves the tombstone automatic enrollment respects (ADR-0164 §5); undoing it clears the tombstone.
    const r = await acts.perform('repo.detach', { repo_id: String(repoId) })
    if (!r.ok && r.reason !== 'folder_gone') throw new Error(refusedAs(r))
    return listRepos(projectId)
  })

  handle(IPC.filesList, (event, dir: string): Returns<FabricApi['files']['list']> => listDirectory(dir, fileRoots, scopeOf(event)))

  handle(IPC.settingsRead, (): Returns<FabricApi['settings']['read']> => readSettings())
  // Read-only: Switchboard's catalogue of coding agents for Settings (0.6.31+; agentCatalogRead.ts).
  handle(IPC.settingsAgentCatalog, (): Promise<Returns<FabricApi['settings']['agentCatalog']>> =>
    readMachineAgentCatalog(sessionEnvironment(process.env)))
  // CO-407: Claude Code's cross-session messages, only by the person's switch; and the launcher doctor, only on asking.
  const inboundAnswer = (r: ReturnType<typeof readInbound>) =>
    'unreadable' in r ? { unreadable: true as const } : { accepting: r.accepting, value: r.value, ...(r.notSaved ? { notSaved: r.notSaved } : {}) }
  handle(IPC.settingsClaudeInbound, async (): Promise<Returns<FabricApi['settings']['claudeInbound']>> => inboundAnswer(readInbound()))
  handle(IPC.settingsSetClaudeInbound, async (_e, on: unknown): Promise<Returns<FabricApi['settings']['setClaudeInbound']>> => {
    const r = await setInbound(on === true)
    const notSaved = 'unreadable' in r ? undefined : r.notSaved
    ops.record({ op: 'settings.claude-inbound', outcome: 'unreadable' in r || notSaved ? 'failed' : 'ok', detail: { on: on === true, ...('unreadable' in r ? { why: 'unreadable' } : notSaved ? { why: notSaved.reason, ...('code' in notSaved ? { code: notSaved.code } : {}) } : {}) }, ctx: { correlationId: ops.correlate() } })
    return inboundAnswer(r)
  })
  handle(IPC.settingsReadiness, (): Promise<Returns<FabricApi['settings']['readiness']>> => readFabricReadiness(sessionEnvironment(process.env)))
  // Read-only: whether launch at login is offered here, and what the system reports (0.3.7 review UX-3, ER-3).
  handle(IPC.settingsLoginItem, (): Returns<FabricApi['settings']['loginItem']> => readLoginItem())
  // Read-only: whether the environment keeps folder trust off whatever the switch says (0.3.13 review, iteration 1, UX-9).
  handle(IPC.settingsFolderTrustLocked, (): Returns<FabricApi['settings']['folderTrustLocked']> => folderTrustOverridden(process.env))
  handle(IPC.settingsWrite, (_e, raw: unknown): Returns<FabricApi['settings']['write']> => {
    // A window changes only the preferences it shows; tabs and the workspace folder are main's (audit A7-008/A7-025).
    const checked = settingsPatch(raw)
    if (!checked.ok) return { settings: readSettings(), saved: false, reason: checked.reason }
    const next = checked.patch
    const written = writeSettings(next)
    // Applied now, not at next launch: a power setting that takes effect
    // tomorrow is a power setting that did not work today. Applied from what was
    // COMMITTED, so a refused write does not change the policy either.
    power?.setPolicy(written.settings.keepAwake)
    if (next.launchAtLogin !== undefined) applyLoginItem(written.settings.launchAtLogin, false)
    // The menu speaks the language the windows speak, from the moment it is chosen.
    // A menu that fails to rebuild must not fail a write that is already on disk (iteration 2, ER-8).
    if (next.locale !== undefined) {
      try { installMenu(written.settings.locale, windowKinds) } catch (e) { ops.failed('settings.menu', e) }
    }
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
    const args: Record<string, string | null> = { project_id: input.id }
    if (input.name !== undefined) args.name = input.name.trim()
    if (input.purpose !== undefined) args.purpose = input.purpose?.trim() || null
    // A save is immediate and recorded with the old words, so «Отменить» puts them back (ADR-0160; SCN-165).
    const r = await acts.perform('project.rename', args)
    if (!r.ok) throw new Error(`project update failed: ${refusedAs(r)}`)
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

  handle(IPC.terminalOptions, (): Promise<Returns<FabricApi['terminal']['options']>> => launchOptions())
  // The preview walks the order as the launch will: a task's preset adds the launch's needs (CO-234).
  handle(IPC.terminalFallback, async (_e, projectId: string, kind: 'terminal' | 'task', permissionMode?: string | null, preset?: string | null): Promise<Returns<FabricApi['terminal']['fallback']>> =>
    runnerFallback.configured()
      ? { configured: true, walk: await runnerFallback.walk(projectId, {
          kind: kind === 'task' ? 'task' : 'terminal',
          permissionMode: permissionMode ?? null,
          needsSurface: kind === 'task' && presetNeedsSurface(typeof preset === 'string' ? preset : null)
        }) }
      : { configured: false, walk: null })

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
      // CO-236: no second coding agent in a folder an unresolved launch may still be writing in (a plain shell is no agent).
      if (optionId !== 'shell' && folderLocks.holder(projectId)) throw new Error(FOLDER_HELD_SAYS)
      // ONE RULE, and the surface reads the same one (UXA-C04). This choice
      // used to live only here, so the launcher could not say where the agent
      // was about to start — and with no repository attached it starts in the
      // operator's own home folder, with write tools.
      const place = launchPlace(project.repo_path)
      const cwd = place.place === 'repository' ? place.path : app.getPath('home')
      // CO-229: the held session this launch attached to is claimed until its first instruction is delivered.
      let claimed: string | null = null
      const session = optionId === FALLBACK_OPTION
        ? await openWithFallback({
            walk: (failed, skip) => runnerFallback.walk(projectId, { kind: 'terminal', permissionMode: permissionMode ?? null }, failed, skip),
            open: (runner, route) => ptys.open(projectId, cwd, runner, null, permissionMode ?? null, null, undefined, undefined, route),
            get: (sessionId) => ptys.get(sessionId),
            claim: (sessionId) => { const ok = ptys.claimAttach(sessionId); if (ok) claimed = sessionId; return ok },
            // ADR-0125 §4: nothing started — the walk may move on. Everything else stops it.
            unavailable: (error) => error instanceof SpawnFailure || error instanceof RunnerUnavailable,
            record: (op, detail) => ops.record({ op, outcome: op === 'runner.fallback-attached' ? 'ok' : 'failed',
              level: op === 'runner.fallback-attached' ? 'info' : 'warn', detail, ctx: { correlationId: ops.correlate() } })
          })
        : await ptys.open(projectId, cwd, optionId, null, permissionMode ?? null)
      syncPower()
      const release = (): void => { if (claimed) ptys.releaseAttach(claimed) }
      if (firstInstruction?.trim()) {
        // The same delivery as the task path, and it must be: two ways of
        // handing an agent its first instruction is two behaviours to keep
        // matched, and one of them would eventually stop being fixed (M103).
        // The claim ends when the instruction is written (or refused): the session is busy from then on.
        void ptys.deliverWhenReady(session.sessionId, firstInstruction.trim()).finally(release)
          .catch((e) => ops.failed('terminal.first-instruction', e, { note: 'the first instruction was not delivered' }))
      } else release()
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
  handle(IPC.terminalHistory, async (_e, sessionId: string): Promise<Returns<FabricApi['terminal']['history']>> =>
    // The newest events, in the order they happened, behind a session-id check (A5-001; `sessionHistory.ts`).
    readSessionHistory(() => store.select('journal', '*') as never, ACTIVE_ESTATE, sessionId) as Promise<FeedEvent[]>
  )

  // #region work-ipc — docs: docs/ux/scenarios.md#scn-140-agents-ask-fabric-who-is-working-on-what-claim-their-task-are-warned-of-related-work-and-release-it
  handle(IPC.workProject, async (_e, projectId: string): Promise<Returns<FabricApi['work']['project']>> => {
    const scoped = createScopedStore(db, { kind: 'project', estateId: ACTIVE_ESTATE, projectId })
    return readProjectWork(scoped, { now: Date.now(), session: sessionSignOf, sessions: heldSessions(projectId), leases: () => projectLeaseRefs(projectId) })
  })
  handle(IPC.workEstate, async (): Promise<Returns<FabricApi['work']['estate']>> =>
    readWhereWork(store, { now: Date.now(), session: sessionSignOf, sessions: heldSessions() }))
  handle(IPC.workHome, async (): Promise<Returns<FabricApi['work']['home']>> =>
    readHome(store, { now: Date.now(), session: sessionSignOf, sessions: heldSessions() }))
  handle(IPC.workBoard, async (_e, projectId?: unknown): Promise<Returns<FabricApi['work']['board']>> =>
    readTaskBoard(store, { now: Date.now(), session: sessionSignOf, sessions: heldSessions(), projectId: typeof projectId === 'string' && /^[0-9a-f-]{36}$/.test(projectId) ? projectId : null }))
  handle(IPC.workRelease, async (_e, claimId: string): Promise<Returns<FabricApi['work']['release']>> => {
    if (typeof claimId !== 'string' || !/^[0-9a-f-]{36}$/.test(claimId)) return { released: false, reason: 'not-found' }
    // One press, no question (ADR-0160 §1); the act is recorded with «take it again» as its inverse.
    const r = await acts.perform('claim.release', { claim_id: claimId })
    if (r.ok) return { released: true, claimId }
    return { released: false, reason: r.reason === 'claim_gone' ? 'not-found' : r.reason === 'already_released' ? 'already-released' : 'unconfirmed' }
  })
  // #endregion work-ipc

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
  // Fire-and-forget, so the failure is recorded, not thrown into Electron's error dialog
  // (audit A7-009); a failed write has already halted that session's automated input
  // (`PtyManager.write`). The wrapper also refuses a sender that is not Fabric's renderer (A7-002).
  listen(IPC.terminalWrite, (_e, sessionId: string, data: string) => ptys.write(sessionId, data))
  listen(IPC.terminalResize, (_e, sessionId: string, cols: number, rows: number) => ptys.resize(sessionId, cols, rows))
  handle(IPC.terminalEnd, async (_e, sessionId: string, options?: { force?: boolean }): Promise<Returns<FabricApi['terminal']['end']>> => {
    if (typeof sessionId !== 'string' || !UUID.test(sessionId)) throw new Error('Invalid session identity')
    // What the console was, read BEFORE it stops: «start it again where it stood» needs the place and the way it ran.
    const stood = consoleOf(ptys.get(sessionId))
    const result = await stopRuntime.stop(sessionId, 'operator_stop', { force: options?.force === true })
    if (stood) {
      const outcome = sessionStopOutcome(stood, result, await projectNameOf(stood.projectId))
      if (outcome) await acts.note(outcome)
    }
    return result
  })
  // #region terminal-attest-over — docs: docs/adr/0170-the-person-says-an-ended-runs-work-is-over.md#decision
  // «Работа закончена» (CO-327): the person's attestation goes through the act service, so it is recorded with its undo.
  handle(IPC.terminalAttestOver, async (_e, sessionId: string): Promise<Returns<FabricApi['terminal']['attestOver']>> => {
    if (typeof sessionId !== 'string' || !UUID.test(sessionId)) throw new Error('Invalid session identity')
    const t = ptys.get(sessionId)?.termination
    if (!t || t.state === 'requested' || !t.runId || !t.taskId || !t.commandId) return { ok: false, why: 'run_gone' }
    if (t.state !== 'outcome_unknown') return { ok: false, why: 'run_resolved' }
    const result = await acts.perform('run.attest', { run_id: t.runId, session_id: sessionId, command_id: t.commandId, task_id: t.taskId })
    if (!result.ok) return { ok: false, ...runOverRefusal(result) }
    // The executor's `settled` (createRunOverConsole) already settled the console; this is the same receipt read back.
    const now = ptys.get(sessionId)?.termination
    return { ok: true, receipt: now && now.state === 'stopped' ? now : { ...t, state: 'stopped', basis: 'attested', reasonCode: 'attested' } }
  })
  // #endregion terminal-attest-over
  handle(IPC.terminalDismiss, (_e, sessionId: string): Returns<FabricApi['terminal']['dismiss']> => {
    ptys.dismiss(sessionId)
    sessionWindows.get(sessionId)?.close()
  })

  handle(IPC.windowsOpenSession, (_e, sessionId: string): Returns<FabricApi['windows']['openSession']> => openSessionWindow(sessionId))
}

function rendererTarget(query: string): { url?: string; file?: string; search: string } {
  // A packaged build loads only its own files, whatever it inherited (0.3.2 verification ER-6).
  return devServer()
    ? { url: `${devServer()}?${query}`, search: query }
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
    webPreferences: { preload: path.join(import.meta.dirname, '../preload/index.cjs'), sandbox: true, additionalArguments: [windowKindArg('session')] }
  })
  const target = rendererTarget(`session=${sessionId}`)
  if (target.url) void w.loadURL(target.url)
  else void w.loadFile(target.file!, { search: target.search })
  sessionWindows.set(sessionId, w)
  // Read now: after 'closed' the window's webContents is destroyed and reading it throws.
  const contentsId = w.webContents.id
  windowKinds.register(contentsId, { kind: 'session', subject: sessionId })
  w.on('closed', () => {
    windowKinds.forget(contentsId)
    revokeWindowRoots(contentsId)
    sessionWindows.delete(sessionId)
  })
}


function openFileWindow(requested: string): void {
  // One window per FILE, not per spelling: two spellings of one path opened two editors over one kept
  // buffer, and the last writer won (third lifecycle review). The real path is the key.
  let filePath = requested
  try { filePath = realpathSync.native(requested) } catch { /* not there (yet): the window says so itself */ }
  const existing = fileWindows.get(filePath)
  // A window whose renderer crashed is replaced, not focused: focusing a dead editor showed nothing.
  if (existing && !existing.isDestroyed() && !existing.webContents.isCrashed()) {
    existing.focus()
    return
  }
  if (existing && !existing.isDestroyed()) existing.destroy()
  const w = new BrowserWindow({
    ...WINDOW_CHROME,
    width: 1000,
    height: 720,
    title: filePath,
    webPreferences: { preload: path.join(import.meta.dirname, '../preload/index.cjs'), sandbox: true, additionalArguments: [windowKindArg('editor')] }
  })
  const target = rendererTarget(`file=${encodeURIComponent(filePath)}`)
  if (target.url) void w.loadURL(target.url)
  else void w.loadFile(target.file!, { search: target.search })
  fileWindows.set(filePath, w)
  const contentsId = w.webContents.id
  windowKinds.register(contentsId, { kind: 'editor', subject: filePath })
  w.on('closed', () => {
    windowKinds.forget(contentsId)
    revokeWindowRoots(contentsId)
    // Only this window's entry: a crashed window being replaced must not remove its replacement.
    if (fileWindows.get(filePath) === w) fileWindows.delete(filePath)
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    ...WINDOW_CHROME,
    ...windowIcon(),
    width: 1440,
    height: 900,
    title: 'Fabric',
    webPreferences: { preload: path.join(import.meta.dirname, '../preload/index.cjs'), sandbox: true, additionalArguments: [windowKindArg('main')] }
  })
  // Read now, not in 'closed': by then webContents is destroyed, and the TypeError it threw raised
  // Electron's modal error box, so quitting the app hung on it (found in the C5 real-app run).
  const contentsId = mainWindow.webContents.id
  windowKinds.register(contentsId, { kind: 'main' })
  // A request that waited while Fabric was in the background is shown when the window comes forward (UX-3).
  mainWindow.on('focus', () => hub?.presenter.resume())
  mainWindow.on('show', () => hub?.presenter.resume())
  mainWindow.on('closed', () => {
    windowKinds.forget(contentsId)
    // A folder this window was allowed to reach does not outlive it (S02.roots).
    revokeWindowRoots(contentsId)
    mainWindow = null
  })
  // A new page listens only once it has claimed what waited (`links:pending`).
  mainWindow.webContents.on('did-start-loading', () => linkOutbox.reset())
  mainWindow.webContents.once('did-finish-load', linksWindowReady)
  if (devServer()) void mainWindow.loadURL(devServer()!)
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
  app.on('second-instance', (_event, argv) => {
    for (const arg of argv) if (isFabricLink(arg)) acceptLink(arg)
    // A second launch during a background start (Windows: «Пуск» while the login start still waits for Docker) is the
    // person asking for the window; remember it as an activation, as macOS's `activate` does (0.3.7 review i2 UX-2).
    if (!windowReady) { activatedDuringStartup = true; if (startupWait) showStartupWait(); return }
    // Someone tried to open Fabric again. Show them the one they have rather
    // than doing nothing, which reads as the application being broken.
    const [existing] = BrowserWindow.getAllWindows()
    if (existing) {
      if (existing.isMinimized()) existing.restore()
      existing.focus()
    } else if (linkStartupDone && !process.env.SMOKE) createWindow() // as activation does: none open (ER-2)
  })
}

app.whenReady().then(async () => {
  // `app.quit()` is asynchronous, so a losing instance still reaches here. The
  // flag is what actually stops it — the first version of this guard relied on
  // quit alone and would have let the sweeps run anyway.
  if (!isPrimary) return

  applyLoginItem(readSettings().launchAtLogin, true)

  // M111 — before any window exists, because the default menu is what binds
  // Cmd+W to Close Window, and a tabbed app cannot afford that key for one
  // frame. Built from Electron's roles so copy, paste, quit and the window
  // controls survive: replacing the default with a hand-written minimum takes
  // Cmd+C away from every field in the product.
  installMenu(readSettings().locale, windowKinds)
  // The fabric:// scheme (DEC-0040): a development run registers the electron binary with this app's entry.
  try {
    if (process.defaultApp && process.argv[1]) app.setAsDefaultProtocolClient('fabric', process.execPath, [path.resolve(process.argv[1])])
    else app.setAsDefaultProtocolClient('fabric')
  } catch (e) {
    ops.failed('link.register', e)
  }

  // M116 — before the splash, so the first thing on the dock is already the mark.
  applyAppIcon()
  await startOrExplain()
})

// #region startup-wait — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#stability
/**
 * ST-3 of the 0.3.9 stability audit: a start that met Docker or the database not ready ended in quit, and nothing tried
 * again (2026-10-20: four short-lived processes in 25 min and an agent-driven start loop for 55 min). Now, for the
 * causes waiting heals (`shared/stackWatch.ts#startupHeals`), Fabric stays up: the hub standby answers agents
 * `stack-starting`, a small window says what Fabric waits for (none in a background start until the person asks for
 * Fabric), each failure is appended to startup-failure.log, and the start runs again after 10 s, 20 s, 40 s … 2 min.
 * A cause that will not heal keeps the startup dialog. A quit at any point ends the wait (LC-02).
 */
let hubStandby: StandbyOpen | null = null
let startupWait: { attempt: number; nextAt: number; failure: StartupFailure; since: number; timer: ReturnType<typeof setTimeout> | null } | null = null
let startupWaitWindow: BrowserWindow | null = null
let startupWaitTicker: ReturnType<typeof setInterval> | null = null
/** A start that failed for good: the standby says so to agents until the person retries or quits. */
let startupBroken: StartupFailure | null = null

/** What the hub standby answers while the start waits. */
function startupRefusal(): StackRefusal {
  if (startupBroken)
    return { code: 'stack-unavailable', reason: `Fabric could not start: ${startupBroken.title} Nothing of this call was done. The person at this computer is shown why; call again later.`, retryAfterS: 60 }
  return {
    code: 'stack-starting',
    reason: `Fabric is starting and its ${startupWait && waitsForDocker(startupWait.failure) ? 'Docker engine' : 'database'} is not ready yet. Nothing of this call was done. Wait and call again.`,
    retryAfterS: retryAfterSeconds(startupWait ? startupWait.nextAt - Date.now() : 10_000)
  }
}

function waitsForDocker(failure: StartupFailure): boolean {
  return dockerIsUnreachable(failure.detail) || /Docker did not answer within/.test(failure.detail)
}

function freeDiskNow(): number | null {
  try {
    const st = statfsSync(app.getPath('userData'))
    return st.bavail * st.bsize
  } catch {
    // Unreadable: nothing names the disk, and the wait goes on without it.
    return null
  }
}

function startupWaitText(): Record<string, string> {
  let say: Translate = translator('en')
  let locale = 'en'
  try { const chosen = readSettings().locale; locale = chosen; say = translator(chosen) } catch { /* English, as the startup dialog falls back */ }
  const w = startupWait
  if (!w) return {}
  // The lines and their order are `shared/stackWatch.ts#startupWaitLines`: the disk first when it is low (review i2
  // UX-3), the agents line only while the standby holds the hub's port (review i2 UX-8).
  const lines = startupWaitLines({
    say: say as (key: string, vars?: Record<string, string | number>) => string,
    failure: w.failure,
    waitsForDocker: waitsForDocker(w.failure),
    freeDiskBytes: freeDiskNow(),
    locale,
    platform: process.platform,
    nextInS: w.timer ? Math.max(0, Math.ceil((w.nextAt - Date.now()) / 1000)) : null,
    attempt: w.attempt + 1,
    standby: hubStandby === null ? null : hubStandby.open ? { open: true } : { open: false, reason: hubStandby.reason },
    logPath: path.join(app.getPath('userData'), 'startup-failure.log')
  })
  return Object.fromEntries(lines.map((l) => [l.id, l.text]))
}

/** The window that says what the start waits for; shown once, updated in place. */
function showStartupWait(): void {
  if (process.env.SMOKE || !startupWait) return
  if (startupWaitWindow && !startupWaitWindow.isDestroyed()) {
    startupWaitWindow.show()
    return
  }
  const t = startupWaitText()
  const esc = (v: string): string => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
  const page = `<!doctype html><meta charset="utf-8"><title>${esc(t.title ?? '')}</title><style>p:empty{display:none}</style><body style="margin:0;padding:20px 24px;background:#0c0e10;color:#e6e9ec;font:13px -apple-system,sans-serif;line-height:1.45">` +
    STARTUP_WAIT_LINES.map((k) => `<p id="${k}" style="margin:0 0 8px${k === 'title' ? ';font-weight:600;font-size:14px' : ''}${k === 'log' || k === 'agentsWhy' ? ';opacity:.7;font-size:12px' : ''}">${esc(t[k] ?? '')}</p>`).join('') + '</body>'
  // Sized to its text (0.3.9 review UX-5): the fixed 460 × 240 cut the Russian text, and with the low-disk line the
  // next-try line was the last one seen. The content area starts at the longest measured case (Russian with the disk
  // line, 330 px at 460 px wide) and then follows the page's own height; the person may resize it.
  const win = new BrowserWindow({ width: STARTUP_WAIT_WIDTH, height: STARTUP_WAIT_HEIGHT, useContentSize: true, resizable: true, minWidth: 360, minHeight: 160, minimizable: true, maximizable: false, fullscreenable: false, title: t.title, show: true, backgroundColor: WINDOW_CHROME.backgroundColor, webPreferences: { sandbox: true, contextIsolation: true } })
  startupWaitWindow = win
  quitWhenPersonCloses(win)
  win.on('closed', () => { if (startupWaitWindow === win) startupWaitWindow = null })
  win.webContents.once('did-finish-load', () => fitStartupWait(win))
  void win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(page))
  startupWaitTicker ??= setInterval(() => {
    const ww = startupWaitWindow
    if (!ww || ww.isDestroyed()) return
    const text = startupWaitText()
    void ww.webContents
      .executeJavaScript(`for (const [k, v] of Object.entries(${JSON.stringify(text)})) { const p = document.getElementById(k); if (p) p.textContent = v }`)
      .then(() => fitStartupWait(ww))
      .catch(() => {
        /* the window went away mid-update; its 'closed' handler is the authority */
      })
  }, 1_000)
}

const STARTUP_WAIT_WIDTH = 460
/** The longest measured page (Russian with the low-disk line: 330 px at 460 px wide), with room to spare. */
const STARTUP_WAIT_HEIGHT = 360
const STARTUP_WAIT_MAX_HEIGHT = 640

/** The wait window's content area follows its page's height, so no line is below the edge (UX-5). */
function fitStartupWait(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  void win.webContents
    .executeJavaScript('Math.ceil(document.body.scrollHeight)')
    .then((h: unknown) => {
      if (win.isDestroyed() || typeof h !== 'number' || !Number.isFinite(h)) return
      const [width, height] = win.getContentSize()
      const want = Math.max(160, Math.min(STARTUP_WAIT_MAX_HEIGHT, h))
      if (Math.abs(want - height) > 4) win.setContentSize(width, want)
    })
    .catch(() => {
      /* the window went away mid-measure; its 'closed' handler is the authority */
    })
}

/**
 * A window of the start (the splash, the wait window) closed by the person: on Windows and Linux that is closing
 * Fabric's only window, which quits there, as it did before 0.3.9. `destroy()` (the start ending the window itself)
 * emits no 'close', so only the person's act reaches this; `window-all-closed` is ignored while the start runs (ER-1).
 */
function quitWhenPersonCloses(win: BrowserWindow): void {
  win.on('close', () => { if (process.platform !== 'darwin' && !quit.quitting) app.quit() })
}

/** A start that waiting heals failed: record it, show the wait, and try again after the backoff. */
function waitAndRetryStart(failure: StartupFailure): void {
  const attempt = (startupWait?.attempt ?? 0) + 1
  const delay = stackBackoffMs(attempt)
  const since = startupWait?.since ?? Date.now()
  startupWait = { attempt, nextAt: Date.now() + delay, failure, since, timer: null }
  const free = freeDiskNow()
  const logPath = path.join(app.getPath('userData'), 'startup-failure.log')
  const written = appendBounded(logPath, `${new Date().toISOString()}  ${failure.cause} (waiting, try ${attempt})\n${failure.title}\n\n${failure.detail}${free === null ? '' : `\n\nfree disk: ${freeDiskGb(free)} GB`}\n\n`)
  if (!written.ok) ops.failed('startup.wait-log', written.error)
  ops.record({
    op: 'startup.waiting', outcome: 'unknown', level: 'warn',
    detail: { cause: failure.cause, waits_for: waitsForDocker(failure) ? 'docker' : 'database', attempt, next_try_s: Math.round(delay / 1000), ...(free === null ? {} : { free_disk_gb: freeDiskGb(free) }) },
    ctx: { correlationId: ops.correlate() }
  })
  // The window comes forward at the first wait only (0.3.9 review iteration 3, UX-1): a later try changes its text in
  // place (the ticker), and a window the person closed stays closed until they activate Fabric (activate,
  // second-instance), so an outage of hours does not pull Fabric over their work at every try.
  if (attempt === 1 && (!BACKGROUND_LAUNCH || activatedDuringStartup)) showStartupWait()
  const wait = startupWait
  wait.timer = setTimeout(() => {
    wait.timer = null
    if (quit.quitting) return
    void startOrExplain()
  }, delay)
  wait.timer.unref?.()
}

/** The start succeeded, or failed for good: the wait ends, recorded once with how it ended. */
function startupWaitDone(ended: 'started' | 'failed'): void {
  const w = startupWait
  if (!w) return
  startupWait = null
  if (w.timer) clearTimeout(w.timer)
  if (startupWaitTicker) clearInterval(startupWaitTicker)
  startupWaitTicker = null
  if (startupWaitWindow && !startupWaitWindow.isDestroyed()) startupWaitWindow.destroy()
  startupWaitWindow = null
  ops.record({ op: 'startup.waited', outcome: ended === 'started' ? 'ok' : 'failed', level: 'warn', detail: { ended, tries: w.attempt, waited_s: Math.round((Date.now() - w.since) / 1000) }, ctx: { correlationId: ops.correlate() } })
}
quit.onQuit(() => {
  if (startupWait?.timer) clearTimeout(startupWait.timer)
  if (startupWaitTicker) clearInterval(startupWaitTicker)
})
// #endregion startup-wait

// #region runtime-stack-watch — docs: docs/evidence/plans/2026-10-21-core-reliability/README.md#stability
/** ST-2, ST-1: the stack and the disk while Fabric runs (`main/stackWatch.ts`). */
let stackWatch: StackWatch | null = null
let stackHealthNow: StackHealthView | null = null

/** Whether Fabric owns the stack (it started it, so it may start it again): not when SUPABASE_URL names another. */
function ownsStack(): boolean {
  return !(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function startStackWatch(): void {
  if (stackWatch) return
  const local = ownsStack()
  stackWatch = createStackWatch({
    readDatabase: async (signal) => {
      const { error } = await db.rpc('schema_version').abortSignal(signal)
      return !error
    },
    // The default socket, then OrbStack's own: an OrbStack-only Mac may have no /var/run/docker.sock.
    pingDocker: local ? async () => (await pingDocker(null)) || (process.platform === 'darwin' && (await pingDocker(path.join(homedir(), '.orbstack', 'run', 'docker.sock')))) : null,
    freeDisk: freeDiskNow,
    // One `supabase start` per try, and none when Docker says the containers are gone (a deliberate stop) or running
    // (a database still coming up): 0.3.9 review ER-3.
    recover: local ? () => recoverStack() : null,
    containers: local ? () => stackDatabaseContainer() : null,
    onChange: (view, refusal) => {
      stackHealthNow = view
      surface?.setUnavailable(refusal)
      broadcast(IPC.stackHealthChanged, view)
    }
  })
  stackHealthNow = stackWatch.view()
  stackWatch.start()
  // One reading at once, so a disk already low is said now rather than in 30 s.
  void stackWatch.tick()
}
quit.onQuit(() => stackWatch?.stop())
// #endregion runtime-stack-watch

/** Everything that can fail on the way to a window — extracted so the Retry
 *  button has something to press. */
async function startOrExplain(): Promise<void> {
  try {
    // A Retry from the dialog is a new start: agents are told it is starting, not that it failed.
    startupBroken = null
    const meta = await bootstrap()
    registerIpc(meta)
    if (!process.env.SMOKE) startStackWatch()

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
      const opts = await launchOptions()
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

    // A background launch opens no window until the person activates the app (`activate` below); an
    // activation that arrived while startup was still running opens it now.
    windowReady = true
    linksStartupDone()
    // A link that arrived during a background launch is a person's act: it opens the window as activation does.
    if (!BACKGROUND_LAUNCH || activatedDuringStartup || pendingLinks.size > 0) createWindow()
    // After the main window exists (ER-1): the wait window is never the last window to go while the start hands over.
    startupWaitDone('started')
  } catch (e) {
    // `explainAndQuit` is the loudest path in the product: it classifies the
    // failure, shows the operator a dialog naming it, writes startup-failure.log
    // and records it below. Silence is the one thing this is not.
    // A quit during the splash ends `supabase start` on purpose; that is not a startup failure to explain
    // or to log as one (third review: it wrote a false stack-start-timed-out failure log).
    if (quit.quitting) { ops.failed('startup.interrupted', e, { note: 'startup was ended by a quit; nothing to explain' }); return }
    ops.failed('startup.bootstrap', e)
    // ST-3: Docker or the database not ready yet heals by waiting. Fabric stays up, its hub refuses with
    // `stack-starting`, the person sees what it waits for, and the start is tried again (10 s growing to 2 min).
    const failure = classifyStartupFailure(e)
    if (!pastRetryPoint && !process.env.SMOKE && startupHeals(failure)) {
      waitAndRetryStart(failure)
      return
    }
    startupBroken = failure
    // The dialog's window is created before its first await, so it exists before the wait window goes (ER-1).
    const explained = explainAndQuit(e)
    startupWaitDone('failed')
    void explained
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
async function explainAndQuit(e: unknown): Promise<void> {
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
  // The data volume's free space, read once: a full disk stops Docker and the stack's own words never say so. It goes
  // into the log and the copied details too, which is what a report is read from (0.3.8 review UX-5).
  let freeDiskBytes: number | null = null
  try { const st = statfsSync(app.getPath('userData')); freeDiskBytes = st.bavail * st.bsize } catch { freeDiskBytes = null /* unreadable: nothing names the disk */ }
  const diskNote = freeDiskBytes === null ? '' : `\n\nfree disk: ${freeDiskGb(freeDiskBytes)} GB`
  // ST-4: appended and bounded, so every failed start of an outage is kept, not only the last.
  const written = appendBounded(logPath, `${new Date().toISOString()}  ${failure.cause}\n${failure.title}\n\n${failure.detail}${diskNote}\n\n`)
  // A log we cannot write must not become the reason nothing is shown.
  if (!written.ok) ops.failed('index.could-not-write-the-startup-failure-log', written.error, { note: 'could not write the startup failure log:' })
  ops.failed('index.failure', e, { note: `bootstrap failed (${failure.cause}):` })

  // ASYNC, not `showMessageBoxSync` (lifecycle review 2026-10-03, finding 8): a synchronous modal blocks
  // the main thread, so a SIGTERM or a logout while it was open went unanswered — the process was still
  // alive 25 s later and the quit deadline was never armed. With the dialog awaited, a quit proceeds and
  // the loop stops asking.
  // A PARENT WINDOW, not a free-standing dialog (confirmation review 2026-10-03): on macOS a message box
  // with no parent runs a modal loop that blocks the main thread even through the async API — no timer
  // fired and SIGTERM went unanswered for 20 s — while the same box as a sheet on a window let the quit
  // finish in 410 ms. The window carries the failure's title, so it reads as part of the message.
  // The operator's language when the settings can be read; a failure to read them is not this dialog's
  // business, and English is what it fell back to before (0.3.3).
  const escapeHtml = (v: string): string => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
  let say: Translate = translator('en')
  let locale = 'en'
  try { locale = readSettings().locale; say = translator(readSettings().locale) } catch { /* English */ }
  const windowTitle = say('startup.windowTitle')
  const page = `<!doctype html><meta charset="utf-8"><title>${escapeHtml(windowTitle)}</title><body style="font:13px -apple-system,sans-serif;margin:24px">${escapeHtml(windowTitle)}</body>`
  const parent = new BrowserWindow({ width: 480, height: 160, resizable: false, minimizable: false, maximizable: false, fullscreenable: false, title: windowTitle, show: true, webPreferences: { sandbox: true, contextIsolation: true } })
  void parent.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(page))
  while (!quit.quitting) {
    const plan = startupDialog(failure, { retryable: !pastRetryPoint, logPath, freeDiskBytes, locale, say: (key, vars) => say(key as StringKey, vars) })
    const { response: choice } = await dialog.showMessageBox(parent, {
      type: 'error',
      title: windowTitle,
      message: plan.message,
      detail: plan.detail,
      buttons: plan.buttons,
      defaultId: plan.defaultId,
      cancelId: plan.buttons.length - 1,
      noLink: true
    })
    // A quit that arrived while the dialog was open wins over whatever the dialog answered.
    if (quit.quitting) return
    const pressed = plan.actions[choice]
    if (pressed === 'retry') {
      if (!parent.isDestroyed()) parent.destroy()
      void startOrExplain()
      return
    }
    if (pressed === 'copy') {
      // Copying must not dismiss the dialog: an operator who copies then wants
      // to retry would otherwise have to reopen the app to get the button back.
      clipboard.writeText(`${failure.cause}\n${failure.title}\n\n${failure.detail}${diskNote}`)
      continue
    }
    if (quit.quitting) return
    app.quit()
    process.exitCode = 1
    return
  }
}

app.on('before-quit', (e) => quit.beforeQuit(e))
// A quit is never stopped by an editor's beforeunload: its unsaved buffer is already in the editor
// recovery store (kept as the person types, flushed on unload), so the quit proceeds and the next open of
// that file offers it back (ADR-0106 amendment). A cancelled unload during a quit would only leave the
// deadline to end the process.
app.on('web-contents-created', (_e, contents) => {
  contents.on('will-prevent-unload', (event) => { if (quit.quitting) event.preventDefault() })
  // #region navigation-guard — docs: docs/adr/0020-provider-views-are-sandboxed-extensions-and-layout-is-host-owned.md#provider-views-are-sandboxed-extensions-workspace-layout-is-host-owned
  // Audit A7-002: a Fabric window holds Fabric's renderer document and nothing else, because whatever
  // document stands in it gets the preload's whole bridge. Embedded views (`browserView`) show other
  // products' pages by design and carry no bridge, so the guard is for windows only.
  if (contents.getType() !== 'window') return
  const elsewhere = (event: Electron.Event, url: string): void => {
    // A splash or error window is a data: page Fabric wrote itself; it navigates nowhere either.
    if (isAppDocument(url, APP_ENTRY)) return
    event.preventDefault()
    const link = externalLink(url)
    if (link) void shell.openExternal(link).catch((e) => ops.failed('window.open-external', e))
    else ops.record({ op: 'window.navigation-refused', outcome: 'ok', level: 'warn', detail: { scheme: url.split(':')[0] }, ctx: { correlationId: ops.correlate() } })
  }
  contents.on('will-navigate', elsewhere)
  contents.on('will-redirect', elsewhere)
  contents.setWindowOpenHandler(({ url }) => {
    const link = externalLink(url)
    if (link) void shell.openExternal(link).catch((e) => ops.failed('window.open-external', e))
    else ops.record({ op: 'window.open-refused', outcome: 'ok', level: 'warn', detail: { scheme: url.split(':')[0] }, ctx: { correlationId: ops.correlate() } })
    return { action: 'deny' }
  })
  // Audit A7-009: a renderer that dies or hangs is recorded, not lost in a console nobody has.
  // DO-6 (0.3.2 verification): a dead renderer is a blank window — the error boundary died with it — so
  // the window is reloaded, unless it keeps dying (`rendererRecovery.ts`), when it is left as it is.
  const reloads: number[] = []
  contents.on('render-process-gone', (_ev, details) => {
    ops.failed('window.renderer-gone', new Error(details.reason), { exitCode: details.exitCode })
    const now = Date.now()
    if (!shouldReload({ reason: details.reason, quitting: quit.quitting, recentReloads: reloads, now })) return
    reloads.push(now)
    // A window closing in the same tick has no contents left to reload.
    if (!contents.isDestroyed()) contents.reload()
  })
  contents.on('unresponsive', () => ops.record({ op: 'window.unresponsive', outcome: 'unknown', level: 'warn', ctx: { correlationId: ops.correlate() } }))
  contents.on('responsive', () => ops.record({ op: 'window.responsive', outcome: 'ok', level: 'info', ctx: { correlationId: ops.correlate() } }))
  // #endregion navigation-guard
})

// Closing a window is not quitting the IDE: PTY sessions live in the main
// process. Cmd+Q is the real quit and ends sessions — and once a quit has begun,
// the last window closing finishes it on macOS too (CO-191).
app.on('window-all-closed', () => quit.windowAllClosed(process.platform))
app.on('activate', () => {
  if (process.env.SMOKE) return
  // Before startup has finished there is nothing a window could show yet: remember the activation. While the start
  // waits for Docker or the database (ST-3), the person who asks for Fabric is shown what it waits for.
  if (!windowReady) { activatedDuringStartup = true; if (startupWait) showStartupWait(); return }
  if (mainWindow === null) createWindow()
})
