// #region ipc-window-policy — docs: docs/adr/0020-provider-views-are-sandboxed-extensions-and-layout-is-host-owned.md#provider-views-are-sandboxed-extensions-workspace-layout-is-host-owned
/**
 * Which window may speak which IPC channel (CO-091, REQ-31; ADR-0020 §4).
 *
 * Every Fabric window used to receive the whole bridge, so a detached session window could replay the
 * journal of every project (`feed.replay`), write any file a root admitted, and decide hub access. The
 * filesystem half was bounded by SEC-REQ-016 (`fileRoots`); this bounds the rest by WHO is asking.
 *
 * THE MAIN PROCESS IS THE AUTHORITY. It registers each window with its kind when it creates it
 * (`main/windowRegistry.ts`) and checks every call at the handler boundary (`index.ts#handle`,
 * `index.ts#listen`) and every broadcast (`index.ts#broadcast`). The preload narrows what it exposes to
 * the same map (`preload/api.ts#exposedApi`) as a second wall, never the first: a preload runs in the
 * renderer's own process.
 *
 * DEFAULT DENY. A channel is open to the kinds its rule names and to no other; a channel without a rule
 * is refused for everybody (`authorise` → `undeclared`), the mapped type below makes a missing rule a
 * compile error, and `scripts/check-ipc-contract.mjs` fails the gate on one.
 *
 * `own` binds a detached window to its subject: a session window may speak only about the session it
 * shows, an editor only about the file it holds — the call's first argument must be that subject.
 *
 * Pure: it is bundled into the sandboxed preload as well as the main process.
 */
import { IPC } from './types.ts'

export const WINDOW_KINDS = ['main', 'session', 'editor'] as const
/** The Fabric window kinds: the main shell, a detached session terminal, a detached file editor. */
export type WindowKind = (typeof WINDOW_KINDS)[number]

/** `any`: every call by that kind. `own`: only calls whose first argument is the window's subject. */
export type Grant = 'any' | 'own'
export type ChannelRule = Readonly<Partial<Record<WindowKind, Grant>>>
export type IpcKey = keyof typeof IPC

/** What the main process knows of a window: its kind and, for a detached window, what it shows. */
export interface WindowEntry {
  readonly kind: WindowKind
  /** The session id (a session window) or the real path (an editor window). */
  readonly subject?: string
}

/** Why a call was refused. Constants only: a refusal never carries a call's arguments. */
export type RefusalReason = 'unregistered' | 'undeclared' | 'kind' | 'subject'

const MAIN_ONLY: ChannelRule = { main: 'any' }
/** The boot every window runs: its settings, the persona provider, which window it is, crash reports. */
const EVERY_WINDOW: ChannelRule = { main: 'any', session: 'any', editor: 'any' }
const MAIN_AND_OWN_SESSION: ChannelRule = { main: 'any', session: 'own' }
const MAIN_AND_OWN_FILE: ChannelRule = { main: 'any', editor: 'own' }

/**
 * One rule per channel, measured 2026-10-11 against what each window's renderer calls today: a session
 * window — `SessionWindow.tsx`, `SessionStop.tsx`, `TerminalView.tsx`; an editor window —
 * `EditorWindow.tsx`; every window — `App.tsx#App` (settings), `launch/persona.tsx` (persona),
 * `App.tsx#Shell` (meta), `CrashBoundary.tsx` (renderer errors). Everything else is the main window's.
 * Broadcasts (`projectsRepoChanged`, `terminalData`, `terminalExit`, `tabsCloseActive`) are read the
 * other way: the kinds that may RECEIVE them.
 */
export const CHANNEL_RULES: { readonly [K in IpcKey]: ChannelRule } = {
  projectsCreate: MAIN_ONLY,
  projectsUpdate: MAIN_ONLY,
  projectsUpdateSettings: MAIN_ONLY,
  projectsSaveSettings: MAIN_ONLY,
  draftsRead: MAIN_ONLY,
  draftsSave: MAIN_ONLY,
  draftsDiscard: MAIN_ONLY,
  draftsRestore: MAIN_ONLY,
  actsHistory: MAIN_ONLY,
  actsUndo: MAIN_ONLY,
  ceoStatus: MAIN_ONLY,
  ceoCall: MAIN_ONLY,
  ceoSelect: MAIN_ONLY,
  historyList: MAIN_ONLY,
  historyExport: MAIN_ONLY,
  historyChoose: MAIN_ONLY,
  historyRestore: MAIN_ONLY,
  historyCheck: MAIN_ONLY,
  historyOpen: MAIN_ONLY,
  historyPending: MAIN_ONLY,
  historyRestored: MAIN_ONLY,
  projectsList: MAIN_ONLY,
  projectsStats: MAIN_ONLY,
  transcriptsList: MAIN_ONLY,
  transcriptsGet: MAIN_ONLY,
  contextPast: MAIN_ONLY,
  projectsRepoStates: MAIN_ONLY,
  projectsRelations: MAIN_ONLY,
  projectsSetBusiness: MAIN_ONLY,
  projectsOnboard: MAIN_ONLY,
  projectsPeople: MAIN_ONLY,
  projectsAnalytics: MAIN_ONLY,
  projectsGraph: MAIN_ONLY,
  projectsRepoChanged: MAIN_ONLY,
  linksOpen: MAIN_ONLY,
  linksPending: MAIN_ONLY,
  runsStatus: MAIN_ONLY,
  memoryPreview: MAIN_ONLY,
  memoryRetro: MAIN_ONLY,
  tasksStart: MAIN_ONLY,
  tasksStartExisting: MAIN_ONLY,
  tasksList: MAIN_ONLY,
  tasksMove: MAIN_ONLY,
  tasksClose: MAIN_ONLY,
  tasksDetail: MAIN_ONLY,
  tasksNote: MAIN_ONLY,
  tasksPromote: MAIN_ONLY,
  tasksBrief: MAIN_ONLY,
  attentionList: MAIN_ONLY,
  boardQuery: MAIN_ONLY,
  boardResolved: MAIN_ONLY,
  boardDeferred: MAIN_ONLY,
  boardDefer: MAIN_ONLY,
  boardReopen: MAIN_ONLY,
  boardAddTopic: MAIN_ONLY,
  releasesList: MAIN_ONLY,
  releasesRecord: MAIN_ONLY,
  releasesVerify: MAIN_ONLY,
  questionAnswer: MAIN_ONLY,
  goalsList: MAIN_ONLY,
  goalsDefine: MAIN_ONLY,
  tasksPrioritise: MAIN_ONLY,
  gatewayOffer: MAIN_ONLY,
  workspaceState: MAIN_ONLY,
  workspaceChoose: MAIN_ONLY,
  workspaceDecline: MAIN_ONLY,
  workspaceCheck: MAIN_ONLY,
  workspaceImport: MAIN_ONLY,
  tabsRead: MAIN_ONLY,
  tabsWrite: MAIN_ONLY,
  tabsCloseActive: MAIN_ONLY,
  automationsRead: MAIN_ONLY,
  proposalDecide: MAIN_ONLY,
  routinesList: MAIN_ONLY,
  routinesDefine: MAIN_ONLY,
  routinesSetEnabled: MAIN_ONLY,
  agentsList: MAIN_ONLY,
  agentsCreate: MAIN_ONLY,
  tasksFileIdea: MAIN_ONLY,
  tasksResearch: MAIN_ONLY,
  reposList: MAIN_ONLY,
  reposChoose: MAIN_ONLY,
  reposAttach: MAIN_ONLY,
  reposDetach: MAIN_ONLY,
  filesList: MAIN_ONLY,
  filesRead: MAIN_AND_OWN_FILE,
  filesWrite: MAIN_AND_OWN_FILE,
  filesRequestOverwrite: MAIN_AND_OWN_FILE,
  filesOpenExternally: MAIN_AND_OWN_FILE,
  filesRecoveryKeep: MAIN_AND_OWN_FILE,
  filesRecoveryFlush: MAIN_AND_OWN_FILE,
  filesRecoveryRead: MAIN_AND_OWN_FILE,
  windowsOpenFile: MAIN_ONLY,
  settingsRead: EVERY_WINDOW,
  settingsWrite: MAIN_ONLY,
  settingsAgentCatalog: MAIN_ONLY,
  settingsLoginItem: MAIN_ONLY,
  settingsFolderTrustLocked: MAIN_ONLY,
  settingsClaudeInbound: MAIN_ONLY,
  settingsSetClaudeInbound: MAIN_ONLY,
  settingsReadiness: MAIN_ONLY,
  terminalMemoryBackends: MAIN_ONLY,
  feedReplay: MAIN_ONLY,
  commsThreads: MAIN_ONLY,
  commsList: MAIN_ONLY,
  commsThreadPage: MAIN_ONLY,
  commsHeads: MAIN_ONLY,
  commsResponders: MAIN_ONLY,
  commsFacts: MAIN_ONLY,
  commsTimeline: MAIN_ONLY,
  commsRelated: MAIN_ONLY,
  commsSearch: MAIN_ONLY,
  commsPending: MAIN_ONLY,
  commsWaiting: MAIN_ONLY,
  commsOpenArtifact: MAIN_ONLY,
  attentionGrant: MAIN_ONLY,
  analyticsStatus: MAIN_ONLY,
  analyticsSetEnabled: MAIN_ONLY,
  hubOverview: MAIN_ONLY,
  hubDecide: MAIN_ONLY,
  hubRevokeGrant: MAIN_ONLY,
  hubRevokeAgent: MAIN_ONLY,
  hubDisconnectAgent: MAIN_ONLY,
  hubLetAgentIn: MAIN_ONLY,
  hubClearDenial: MAIN_ONLY,
  hubConnect: MAIN_ONLY,
  hubDisconnect: MAIN_ONLY,
  favouritesList: MAIN_ONLY,
  favouritesToggle: MAIN_ONLY,
  favouritesReplace: MAIN_ONLY,
  favouritesOrder: MAIN_ONLY,
  favouritesMove: MAIN_ONLY,
  startChooseFolder: MAIN_ONLY,
  startInspect: MAIN_ONLY,
  startScan: MAIN_ONLY,
  startCancelScan: MAIN_ONLY,
  startLastScan: MAIN_ONLY,
  startCreateFolder: MAIN_ONLY,
  startExecutors: MAIN_ONLY,
  startAdapterSkills: MAIN_ONLY,
  personaRead: EVERY_WINDOW,
  personaSave: MAIN_ONLY,
  searchRun: MAIN_ONLY,
  digestRead: MAIN_ONLY,
  digestSeen: MAIN_ONLY,
  memoryOverview: MAIN_ONLY,
  memoryMisses: MAIN_ONLY,
  decisionsList: MAIN_ONLY,
  harnessRead: MAIN_ONLY,
  diagnosticsRead: MAIN_ONLY,
  estateSummary: MAIN_ONLY,
  terminalHistory: MAIN_ONLY,
  memoryRemember: MAIN_ONLY,
  memorySearch: MAIN_ONLY,
  terminalOptions: MAIN_ONLY,
  terminalFallback: MAIN_ONLY,
  terminalOpen: MAIN_ONLY,
  terminalList: MAIN_ONLY,
  terminalClaims: MAIN_ONLY,
  workProject: MAIN_ONLY,
  workEstate: MAIN_ONLY,
  workHome: MAIN_ONLY,
  workBoard: MAIN_ONLY,
  workSession: MAIN_ONLY,
  workRelease: MAIN_ONLY,
  terminalGet: MAIN_AND_OWN_SESSION,
  terminalScrollback: MAIN_AND_OWN_SESSION,
  terminalWrite: MAIN_AND_OWN_SESSION,
  terminalResize: MAIN_AND_OWN_SESSION,
  terminalEnd: MAIN_AND_OWN_SESSION,
  terminalAttestOver: MAIN_AND_OWN_SESSION,
  terminalDismiss: MAIN_AND_OWN_SESSION,
  terminalData: MAIN_AND_OWN_SESSION,
  terminalExit: MAIN_AND_OWN_SESSION,
  windowsOpenSession: MAIN_ONLY,
  metaInfo: EVERY_WINDOW,
  opsRendererError: EVERY_WINDOW,
  stackExposure: MAIN_ONLY,
  // CO-374: the stack's health is said in the detached console and editor windows too; a read, nothing more.
  stackHealth: EVERY_WINDOW,
  stackHealthChanged: EVERY_WINDOW
}

/** Channel value (`feed:replay`) → its key, so a rule is found from what Electron hands the wrapper. */
const KEY_OF: ReadonlyMap<string, IpcKey> = new Map(
  (Object.entries(IPC) as Array<[IpcKey, string]>).map(([key, value]) => [value, key])
)

function grantOf(kind: WindowKind, channel: string): Grant | undefined {
  const key = KEY_OF.get(channel)
  return key ? CHANNEL_RULES[key][kind] : undefined
}

/** Whether `entry` may make this call. The first argument is compared only under an `own` grant. */
export function authorise(
  entry: WindowEntry | undefined,
  channel: string,
  args: readonly unknown[]
): { ok: true } | { ok: false; reason: RefusalReason } {
  if (!entry) return { ok: false, reason: 'unregistered' }
  if (!KEY_OF.has(channel)) return { ok: false, reason: 'undeclared' }
  const grant = grantOf(entry.kind, channel)
  if (!grant) return { ok: false, reason: 'kind' }
  if (grant === 'own' && (entry.subject === undefined || args[0] !== entry.subject)) return { ok: false, reason: 'subject' }
  return { ok: true }
}

/** Whether a main→renderer message may be delivered to this window: the same rule, read the other way. */
export function mayReceive(entry: WindowEntry | undefined, channel: string, args: readonly unknown[]): boolean {
  return authorise(entry, channel, args).ok
}

/** Every channel key a kind may speak, in any form. */
export function channelsFor(kind: WindowKind): IpcKey[] {
  return (Object.keys(CHANNEL_RULES) as IpcKey[]).filter((key) => CHANNEL_RULES[key][kind] !== undefined)
}

/** Whether a kind may speak a channel at all, subject aside — what the preload narrows by. */
export function kindMaySpeak(kind: WindowKind, channel: string): boolean {
  return grantOf(kind, channel) !== undefined
}

export const REFUSAL_CODE = 'ipc_window_refused'

/** The refusal's message: the code first, so the renderer can tell it from a handler's own failure. */
export function refusalMessage(channel: string, kind: WindowKind | 'unregistered', reason: RefusalReason): string {
  return `${REFUSAL_CODE}: ${channel} is not open to this window (kind ${kind}, ${reason})`
}

/** Whether an error message — as Electron rewraps it across `invoke` — is a window refusal. */
export function isWindowRefusal(message: string): boolean {
  return message.includes(`${REFUSAL_CODE}: `)
}

/** The preload's argument carrying the window kind (`webPreferences.additionalArguments`). */
export const WINDOW_KIND_ARG = '--fabric-window-kind='

/** The argument the main process gives a window of this kind. */
export function windowKindArg(kind: WindowKind): string {
  return `${WINDOW_KIND_ARG}${kind}`
}

/** The kind the main process gave this renderer, or null when it gave none this build knows. */
export function windowKindFromArgv(argv: readonly string[]): WindowKind | null {
  const kind = argv.find((a) => a.startsWith(WINDOW_KIND_ARG))?.slice(WINDOW_KIND_ARG.length) ?? ''
  return (WINDOW_KINDS as readonly string[]).includes(kind) ? (kind as WindowKind) : null
}
// #endregion ipc-window-policy
