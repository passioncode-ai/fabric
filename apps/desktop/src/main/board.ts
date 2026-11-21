// #region board — docs: docs/evidence/plans/2026-11-17-board-apart-waves.md#3-the-waves
/**
 * The board's hub, composed (ADR-0195 W2a.3): the agent registry, the standing access, a product's connector, the
 * projects' admission, the coding agents' enrolment and the agent surface, published by `startHub` on the hub's port.
 * Until W2a.3 this was the body of `main/index.ts`'s bootstrap; it moved as it stood, every name it read from that module
 * now a field of `BoardHubDeps`, so `fabric-board` (W2c.1) builds the same hub from its own entry. What is the window's
 * stays the window's and is given here: the hub ports (`hubPorts.ts`), the consent presenter, and the late History acts.
 * Each part is handed back as soon as it exists (`onRegistry`, `onAdmission`, …), at the moment `index.ts` used to assign
 * it, so a call that arrives while the hub starts finds what it found before.
 */
import { realpathSync, promises as fsPromises } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { isScratchFolder } from '../shared/scratchFolder.ts'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Journal } from '@fabric/journal'
import { AccessService } from './accessService.ts'
import { createAccessStore, type AccessStore } from './accessStore.ts'
import { createActs } from './acts.ts'
import { AgentRegistry, registryDirs } from './agentRegistry.ts'
import { AgentSurface } from './agentSurface'
import { createAgentFolders } from './agentFolders.ts'
import { originOf, type LeaseRefsRead } from './agentSyncLeases.ts'
import { resolveBacklogSource } from './backlogSource.ts'
import type { BoardState } from './boardState.ts'
import type { ConsentPresenter } from './consentPresenter.ts'
import { answerAssigned, type AssignDeps } from './crossProjectAssign.ts'
import { folderProjectId, gitTopLevel } from './folderResolver.ts'
import { readGitFacts } from './gitFacts.ts'
import { startHub, withdrawHub } from './hub.ts'
import { createAgentCall } from './hubCall.ts'
import type { HubPorts } from './hubPorts.ts'
import type { StandbyOpen } from './hubStandby.ts'
import { hubServerFor } from './hubTools.ts'
import { createObservatoryVault } from './observatoryVault.ts'
import { ops } from './opsSink'
import { createPeerCheck } from './peerAccount.ts'
import type { Policy } from './policy'
import { FABRIC_INBOX, ProductConnector } from './productConnect.ts'
import { forwardToProduct } from './productForwarder.ts'
import { createProjectAdmission } from './projectAdmission.ts'
import { inspectFolder } from './projectDiscovery.ts'
import { createOnboardingFiler } from './projectOnboarding.ts'
import { launchOption } from './pty'
import { createRevokeAgent } from './relayedAccess.ts'
import { handBackResumedClaims } from './resumedClaims.ts'
import type { ScopedStore } from './scopedStore'
import { EnrolledSessions, enrollSession, joinBoardSession, resolveAgentFolder, type FolderDeps } from './sessionEnroll.ts'
import { createMachineSessionHolds } from './sessionHolds.ts'
import { readSettingsState } from './settings'
import type { ScanCandidates } from './startChoices.ts'
import { existingTempRoots } from './tempRoots.ts'
import { releaseSessionClaims } from './workRelease.ts'
import { readRunHolds } from './workRead.ts'
import { AGENTS } from '../shared/agents.ts'
import type { HubDownCode } from '../shared/access.ts'
import { resolveProject } from '../shared/projectResolve.ts'
import { createInboxAutoConnect } from './inboxAutoConnect.ts'

type Admission = ReturnType<typeof createProjectAdmission>
type AdmissionDeps = Parameters<typeof createProjectAdmission>[0]
type Acts = ReturnType<typeof createActs>

/** What the hub is handed back as, for the window's doors (`index.ts#hub`). */
export interface BoardHub {
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
}

export interface BoardHubDeps {
  quit: { onQuit(fn: () => void): void }
  db: SupabaseClient
  store: ScopedStore
  journal: Journal
  policy: Policy
  estateId: string
  operator: { kind: 'person'; id: string }
  state: BoardState
  /** The hub's ports over the process that runs it, made once the registry exists (`hubPorts.ts`). */
  ports(registry: AgentRegistry): HubPorts
  /** The window's consent prompt; null-safe until the access service exists (it is made just after). */
  presenter(parts: { accessStore: AccessStore; connector: ProductConnector; access: () => AccessService | null }): ConsentPresenter
  /** The standby that held the hub's port while the stack started, and its release once the surface took the port. */
  standby: StandbyOpen | null
  releaseStandby(): void
  keptOut: { has(key: string): boolean }
  scanCandidates: ScanCandidates
  /** History's acts, which exist only once the window's doors are registered: null before. */
  acts(): Acts | null
  assignDeps(): AssignDeps
  projects: {
    read: AdmissionDeps['readProject']
    listRepos: AdmissionDeps['listRepos']
    readImported: AdmissionDeps['readImported']
    listRemovals: AdmissionDeps['listRemovals']
    refreshFileRoots: AdmissionDeps['refresh']
    mirror: AdmissionDeps['mirror']
    enrollProject(id: string): Promise<{ id: string; name: string } | null>
    reposWithRemotes(projectId: string): Promise<Array<{ path: string; remote: string | null }>>
    leaseRefs(projectId: string): Promise<(LeaseRefsRead & { repository: string }) | null>
  }
  onRegistry(registry: AgentRegistry): void
  onOnboardingFiler(file: (projectId: string, name: string) => Promise<{ taskId: string; filed: boolean }>): void
  onAdmission(admission: Admission): void
  onSurface(surface: AgentSurface): void
  onHub(hub: BoardHub): void
}

export async function startBoardHub(d: BoardHubDeps): Promise<void> {
  const { quit, db, store, journal, policy, estateId: ACTIVE_ESTATE, operator: OPERATOR_ACTOR, state: boardState } = d
  const { read: readAdmissionProject, listRepos, readImported: readImportedIndex, listRemovals: readRepoRemovals, refreshFileRoots,
    mirror: mirrorWorkspaceNow, enrollProject, reposWithRemotes: projectReposWithRemotes, leaseRefs: projectLeaseRefs } = d.projects
  const scanCandidates = d.scanCandidates
  const markBindingPersonEnded = boardState.personEnded.markBinding
  const markGrantPersonEnded = boardState.personEnded.markGrant
  // History's acts are the window's and come later: before them an act is said in the operations log (the CO-506 review, N1).
  const noteAct = async (outcome: Parameters<Acts['note']>[0], opts: Parameters<Acts['note']>[1]) => {
    const acts = d.acts()
    return acts ? acts.note(outcome, opts) : ops.record({ op: 'acts.record', outcome: 'failed', level: 'warn', detail: { kind: outcome.kind, reason: 'history not ready' }, ctx: { correlationId: ops.correlate() } })
  }
  // eslint-disable-next-line prefer-const -- assigned once below, read by closures made before it exists
  let surface: AgentSurface
  const dirs = registryDirs()
  const registry = new AgentRegistry({ servicesDir: dirs.services, providersDir: dirs.providers })
  registry.refresh()
  d.onRegistry(registry)
  // The registry's one watch also asks the Inbox auto-connect (`autoConnectInbox` below) on every change.
  let onRegistryChange: (() => void) | null = null
  const stopWatching = registry.watch(() => onRegistryChange?.())
  quit.onQuit(stopWatching)
  // ADR-0195 W1: what the hub reads from this process (the terminals, the sweep, the settings, the registry), one
  // implementation of each port (`hubPorts.ts`); `fabric-board` gives its own in W2.
  const hubPorts = d.ports(registry)
  const accessStore = createAccessStore({ db, journal, estateId: ACTIVE_ESTATE })
  const vault = createObservatoryVault()
  const hubState = { doorToken: null as string | null, down: null as string | null, downCode: undefined as HubDownCode | undefined, downFact: undefined as string | undefined }
  const connector = new ProductConnector({
    store: accessStore,
    vault,
    // Each estate's connections keep their secrets in slots of their own (DA-6, verification 0.3.1).
    estateId: ACTIVE_ESTATE,
    origin: () => (hubState.doorToken ? surface.origin : ''),
    openExternal: hubPorts.links.openExternal,
    handlerFor: hubPorts.links.handlerFor,
    actor: () => OPERATOR_ACTOR
  })
  // The owner, 2026-11-20: Fabric connects itself to Inbox, no button (`inboxAutoConnect.ts`): at the hub's start, on every
  // change of the registry and every 5 minutes; each try is decided by the module's rules.
  const autoConnectInbox = createInboxAutoConnect({
    trust: () => hubPorts.settings.machineTrust(),
    inRegistry: () => registry.snapshot().entries.some((e) => e.id === FABRIC_INBOX.product),
    connected: async () => (await accessStore.liveConnection(FABRIC_INBOX.product)) !== null,
    last: () => connector.lastOutcome(FABRIC_INBOX.product),
    // The person's Disconnect (the newest connection removed) or Deny (the newest answer since it), from the database,
    // so neither is undone by the next tick nor forgotten at a restart (0.3.27 review ER-69).
    saidNo: async () => {
      const c = await store.select('product_connections', 'connected_at,removed_at,removed_by').eq('product', FABRIC_INBOX.product).order('connected_at', { ascending: false }).limit(1)
      if (c.error) throw new Error(c.error.message)
      const newest = (c.data as Array<{ connected_at: string; removed_at: string | null; removed_by: string | null }> | null)?.[0] ?? null
      // A restore re-inserts the connection already removed (`removed_by` 'restore-boundary'): no one said no (run nine, ER-84).
      if (newest?.removed_at && newest.removed_by !== 'restore-boundary') return true
      const r = await store.select('journal', 'occurred_at,payload').eq('type', 'product.connect.refused@1').eq('payload->>product', FABRIC_INBOX.product).order('seq', { ascending: false }).limit(1)
      if (r.error) throw new Error(r.error.message)
      const refused = (r.data as Array<{ occurred_at: string; payload: { outcome?: string } }> | null)?.[0] ?? null
      return refused?.payload?.outcome === 'denied' && (!newest || Date.parse(refused.occurred_at) > Date.parse(newest.connected_at))
    },
    begin: async () => (hubState.doorToken ? connector.begin(FABRIC_INBOX) : { ok: false }),
    record: (op, detail) => ops.record({ op, outcome: detail.started ? 'ok' : 'failed', level: detail.started ? 'info' : 'warn', detail, ctx: { correlationId: ops.correlate() } })
  })
  onRegistryChange = () => { void autoConnectInbox() }
  const autoConnectTimer = setInterval(() => { void autoConnectInbox() }, 5 * 60_000)
  autoConnectTimer.unref?.()
  quit.onQuit(() => clearInterval(autoConnectTimer))
  setTimeout(() => { void autoConnectInbox() }, 15_000).unref?.()
  let access: AccessService | null = null
  // The consent presenter is the window's (a native prompt and a notification); it reads the hub's parts it is given.
  const presenter = d.presenter({ accessStore, connector, access: () => access })
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
  d.onOnboardingFiler(fileOnboarding)
  // #endregion project-onboarding
  const admission = createProjectAdmission({
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
  d.onAdmission(admission)
  const enrollFolders: FolderDeps = {
    scratch: (folder) => isScratchFolder(folder, homedir(), tmpdir()),
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
    // there (attention.ts); nothing pops up. The presenter stays for the queue Agent access still shows.
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
    keptOut: (key) => d.keptOut.has(key),
    // CO-506: an organization's machine grants no answering at once; unreadable reads as unmarked, as the surface's.
    machineTrust: hubPorts.settings.machineTrust
  })
  // #endregion session-enroll-wiring
  const agentCall = createAgentCall({ access, store: accessStore, vault, forward: forwardToProduct, estateId: ACTIVE_ESTATE })
  // A revoked binding never calls again: its idempotency memory goes at once (DA-3, verification 0.3.1).
  access.onBindingRevoked((bindingId) => agentCall.forgetBinding(bindingId))
  // ADR-0134 §3: a revoked binding or grant ends the coding-agent sessions enrolled under it; the next call is refused.
  boardState.personEnded.attach(enrolled)
  access.onBindingRevoked((bindingId) => { enrolled.endForBinding(bindingId) })
  access.onGrantRevoked((grantId) => { enrolled.endForGrant(grantId) })
  // COM03-10: a revoked board.respond grant releases the responder slots it admitted (best effort; the in-statement
  // authority recheck is what refuses).
  access.onGrantRevoked((grantId) => { void surface?.releaseBoardGrant(grantId) })
  // CO-200: the counts of refusals not yet journalled are written as the app quits (best effort, within the drain).
  quit.onQuit(() => { void agentCall.flush() })
  d.onHub({ registry, access, accessStore, connector, presenter, get doorToken() { return hubState.doorToken }, get down() { return hubState.down }, get downCode() { return hubState.downCode }, get downFact() { return hubState.downFact } })
  const hubAccess = access
  const sessionHolds = createMachineSessionHolds(process.env, (sessionId, until, why) =>
    ops.failed('session.hold', new Error(why), { session_id: sessionId, until, note: 'the duty officer may close this session; the next claim, renewal or release asks again' }))
  surface = new AgentSurface({
    db, journal, ptys: hubPorts.terminals, policy, estateId: ACTIVE_ESTATE,
    // ADR-0197: the CEO's tools, for its own console only (absent in the board's own entry).
    ...(hubPorts.ceo ? { ceo: hubPorts.ceo } : {}),
    // SW-4: a session's nudges from the sweep of abandoned work ride on its fabric_work_list and fabric_heartbeat.
    nudges: hubPorts.sweep.takeNudges,
    // 0.3.14 wave 2: and on every turn the session hooks observe (fabric_session_observe), from the same queue, shown
    // there and never taken (the review, iteration 1, PL-1: an adapter before 0.51.2 throws a turn's answer away).
    turnNudges: hubPorts.sweep.showTurnNudges,
    // CO-459 (DEC-0140 PR-3): a turn's reported branch, for this machine's screens only, never journalled or shared.
    reportBranch: (sessionId, branch) => boardState.branches.set(sessionId, branch),
    // T4 (the turn-end spec §4.4): a Claude Code session holding a claim is held by Switchboard until the claim ends.
    holdSession: (runtimeSessionId, until) => { void sessionHolds.set(runtimeSessionId, until) },
    // CO-458: a task assigned from another project answers its board request once released done (never awaited).
    onDoneInReview: (taskId) => { void answerAssigned(d.assignDeps(), taskId).then((r) => { if (r.reason) ops.record({ op: 'tasks.assign-answer', outcome: 'failed', level: 'warn', detail: { task_id: taskId, reason: r.reason }, ctx: { correlationId: ops.correlate() } }) }, (e: unknown) => ops.failed('tasks.assign-answer', e)) },
    // P-24: the interface's language is the agents' working language, read at each fabric_whoami.
    // OF-38: off in Settings, the hub names no working language and the agents keep their own.
    // An unreadable settings file names no language and reads as not trusted (`hubPorts.ts#windowHubPorts`).
    language: hubPorts.settings.language,
    machineTrust: hubPorts.settings.machineTrust,
    // The operator, 2026-11-07: the agents of this machine for every session's fabric_whoami (`machine.agents-first`).
    machineAgents: hubPorts.registry.machineAgents,
    // CO-514 (DEC-0154 HA-2 (b), HA-3): another account's process is refused before its request is read.
    peerAccount: createPeerCheck(),
    // CO-409 (§3.1): a board request a session stored wakes the dispatcher when its grace ends, not a cycle later.
    onRequestStored: () => boardState.dispatchWake.get()?.wake(),
    // CO-489: the project page's «Выбрать папку…» and «Убрать» as a session's door, through the one admission service;
    // each change is an act History undoes, written with the session as its author.
    folders: createAgentFolders({
      attach: (projectId, paths, actor) => admission.attach(projectId, paths, actor, { granted: (real) => real, candidates: scanCandidates, home: homedir() }),
      detach: (projectId, repoId, actor) => admission.detach(projectId, repoId, actor),
      listRepos,
      listRemovals: readRepoRemovals,
      isRepository: async (folder) => (await inspectFolder(folder)).git,
      realpath: (folder) => {
        try {
          return realpathSync.native(folder)
        } catch {
          // No folder at that path: the door answers `missing` (attach) or matches the recorded path (detach).
          return null
        }
      },
      note: noteAct
    }),
    // CO-506: Agent access's buttons as an agent's door, on the operator's relayed words (`relayedAccess.ts`). Revoking a
    // whole agent writes the same act History shows for the button.
    access: {
      overview: () => hubAccess.overview(),
      request: (id) => accessStore.request(id),
      decide: (id, verdict, actor, relayed) => hubAccess.decide(id, verdict, actor, relayed),
      revokeGrant: (id, actor, relayed) => { markGrantPersonEnded(id); return hubAccess.revokeGrant(id, actor, relayed) },
      revokeAgent: createRevokeAgent({
        nameOf: async (bindingId) => {
          const b = await accessStore.binding(bindingId).catch((e: unknown) => { ops.failed('hub.access.revoke-name-unreadable', e, { binding_id: bindingId }); return null })
          return b ? ((await accessStore.request(b.request_id).catch(() => null))?.registry?.name ?? AGENTS.find((a) => a.id === b.agent_id)?.label ?? b.agent_id) : null
        },
        // An agent relaying the operator's words revokes as the person (CO-506): its sessions' tasks are not continued.
        revokeBinding: (bindingId, actor, relayed) => { markBindingPersonEnded(bindingId); return hubAccess.revokeBinding(bindingId, actor, relayed) },
        // Before registerIpc made History's acts the revocation still stands and its event keeps the actor and the words;
        // the missing act is said in the operations log (the CO-506 review, N1).
        note: noteAct
      }),
      machineTrust: hubPorts.settings.machineTrust,
      grantOwnRespond: (proof) => hubAccess.grantOwnProjectRespond(proof)
    },
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
            journal.append({ estateId: ACTIVE_ESTATE, type, actor: { kind: 'system', id: 'fabric-hub' }, projectId, payload }),
          // On-demand spec §3.12: a session Switchboard resumed after a usage limit takes back the claims it left.
          resumeClaims: async (a) => {
            const r = await handBackResumedClaims(store, (e) => journal.append({ estateId: ACTIVE_ESTATE, ...e }), {
              ...a, now: Date.now(), runHolds: async (ids) => (await readRunHolds(store, ids)).map((h) => h.taskId)
            })
            if (r.handedBack.length) surface.noteClaims(a.sessionId)
            if (r.handedBack.length || r.refused.length)
              ops.record({ op: 'hub.session.resume-claims', outcome: r.refused.length ? 'failed' : 'ok', level: r.refused.length ? 'warn' : 'info',
                detail: { session_id: a.sessionId, handed_back: r.handedBack.length, refused: r.refused.length }, ctx: { correlationId: ops.correlate() } })
          }
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
      // PL-1 (0.3.22 review, iteration 3): a session the person ended releases its claims as the person's own release,
      // which the board supervisor does not continue.
      const byPerson = boardState.personEnded.take(sessionId) ? OPERATOR_ACTOR : undefined
      await releaseSessionClaims(store, (e) => journal.append({ estateId: ACTIVE_ESTATE, ...e }), sessionId, why, byPerson)
    }
    // #endregion work-claims-wiring
  })
  d.onSurface(surface)
  // THE PORT IS STABLE OR THERE IS NO HUB (ADR-0115 §1). A port the configuration refuses, or one a
  // registered agent claims, or one another program holds, closes the hub with its reason (Settings →
  // Agent access shows it) — and the sessions Fabric starts keep their surface on an ephemeral port, as
  // before the hub existed, with the external ingress closed: no hub.json, no door token (`startHub`,
  // driven by hub-door-db).
  const started = await startHub({ surface, env: process.env, claimedPorts: registry.claimedPorts(), root: dirs.root, standby: d.standby?.open ? d.standby : null })
  // The standby's sockets are the surface's now, or it stops: either way it holds the port no longer.
  if (d.standby?.open && d.standby.standby.origin) void d.standby.standby.stop()
  d.releaseStandby()
  if (started.open) {
    hubState.doorToken = started.doorToken
    quit.onQuit(() => {
      hubState.doorToken = null
      const w = withdrawHub(dirs.root)
      if (!w.removed) ops.record({ op: 'hub.withdraw', outcome: 'ok', level: 'warn', detail: { reason: w.reason }, ctx: { correlationId: ops.correlate() } })
    })
  } else { hubState.down = started.down; hubState.downCode = started.downCode; hubState.downFact = started.downFact }
}
// #endregion board
