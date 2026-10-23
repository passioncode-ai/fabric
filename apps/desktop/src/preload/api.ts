// #region preload-window-subset — docs: docs/adr/0020-provider-views-are-sandboxed-extensions-and-layout-is-host-owned.md#provider-views-are-sandboxed-extensions-workspace-layout-is-host-owned
// The typed bridge — the renderer's entire surface (iteration-1-modules.md §10) — and the part of it one
// window kind is given (CO-091, REQ-31).
//
// `createApi` is the whole bridge over any `ipcRenderer`-shaped object. `exposedApi` keeps only the
// methods whose channel the window's kind may speak (`shared/ipcWindowPolicy.ts#CHANNEL_RULES`). This is
// the SECOND wall: the main process refuses the same calls at its handler boundary whatever the preload
// exposes (`main/windowRegistry.ts`), because the preload runs in the renderer's own process.
//
// No Electron import at runtime: the sandboxed preload (`index.ts`) hands it `ipcRenderer`, and the tests
// hand it a recorder.

import type { IpcRenderer } from 'electron'
import { IPC, type FabricApi, type StackHealthView } from '../shared/types.ts'
import { kindMaySpeak, type WindowKind } from '../shared/ipcWindowPolicy.ts'

/** The part of `ipcRenderer` the bridge uses. */
export type BridgeIpc = Pick<IpcRenderer, 'invoke' | 'send' | 'on' | 'removeListener'>

export function createApi(ipc: BridgeIpc): FabricApi {
  return {
    projects: {
      create: (input) => ipc.invoke(IPC.projectsCreate, input),
      update: (input) => ipc.invoke(IPC.projectsUpdate, input),
      updateSettings: (input) => ipc.invoke(IPC.projectsUpdateSettings, input),
      saveSettings: (input) => ipc.invoke(IPC.projectsSaveSettings, input),
      list: () => ipc.invoke(IPC.projectsList),
      stats: (projectId) => ipc.invoke(IPC.projectsStats, projectId),
      repoStates: (projectId) => ipc.invoke(IPC.projectsRepoStates, projectId),
      relations: (projectId) => ipc.invoke(IPC.projectsRelations, projectId),
      setBusiness: (projectId, business) => ipc.invoke(IPC.projectsSetBusiness, projectId, business),
      onboard: (projectId) => ipc.invoke(IPC.projectsOnboard, projectId),
      people: (projectId) => ipc.invoke(IPC.projectsPeople, projectId),
      onRepoChanged: (cb) => {
        const listener = (_e: unknown, repoPath: string): void => cb(repoPath)
        ipc.on(IPC.projectsRepoChanged, listener)
        return () => ipc.removeListener(IPC.projectsRepoChanged, listener)
      }
    },
    drafts: {
      read: () => ipc.invoke(IPC.draftsRead),
      save: (next) => ipc.invoke(IPC.draftsSave, next),
      discard: (tabId) => ipc.invoke(IPC.draftsDiscard, tabId),
      restore: (discardId) => ipc.invoke(IPC.draftsRestore, discardId)
    },
    history: {
      list: () => ipc.invoke(IPC.historyList),
      export: () => ipc.invoke(IPC.historyExport),
      choose: () => ipc.invoke(IPC.historyChoose),
      restore: (token, name) => ipc.invoke(IPC.historyRestore, token, name),
      check: (operationId) => ipc.invoke(IPC.historyCheck, operationId),
      open: (estateId) => ipc.invoke(IPC.historyOpen, estateId),
      pending: () => ipc.invoke(IPC.historyPending),
      restored: () => ipc.invoke(IPC.historyRestored)
    },
    ceo: {
      status: () => ipc.invoke(IPC.ceoStatus),
      call: (method, args) => ipc.invoke(IPC.ceoCall, method, args),
      select: (conversationId) => ipc.invoke(IPC.ceoSelect, conversationId)
    },
    tasks: {
      startExisting: (taskId: string) => ipc.invoke(IPC.tasksStartExisting, taskId),
      start: (input) => ipc.invoke(IPC.tasksStart, input),
      list: (projectId) => ipc.invoke(IPC.tasksList, projectId),
      move: (taskId, to) => ipc.invoke(IPC.tasksMove, taskId, to),
      close: (taskId, outcome, reason) => ipc.invoke(IPC.tasksClose, taskId, outcome, reason),
      detail: (taskId) => ipc.invoke(IPC.tasksDetail, taskId),
      note: (taskId, body) => ipc.invoke(IPC.tasksNote, taskId, body),
      promote: (noteId) => ipc.invoke(IPC.tasksPromote, noteId),
      brief: (taskId, section, body) => ipc.invoke(IPC.tasksBrief, taskId, section, body),
      prioritise: (taskId, goalId, position) =>
        ipc.invoke(IPC.tasksPrioritise, taskId, goalId, position),
      fileIdea: (projectId, text) => ipc.invoke(IPC.tasksFileIdea, projectId, text),
      research: (taskId, optionId) => ipc.invoke(IPC.tasksResearch, taskId, optionId)
    },
    automations: {
      read: (projectId) => ipc.invoke(IPC.automationsRead, projectId)
    },
    routines: {
      list: (projectId) => ipc.invoke(IPC.routinesList, projectId),
      define: (input) => ipc.invoke(IPC.routinesDefine, input),
      setEnabled: (id, enabled) => ipc.invoke(IPC.routinesSetEnabled, id, enabled)
    },
    agents: {
      list: (projectId) => ipc.invoke(IPC.agentsList, projectId),
      create: (input) => ipc.invoke(IPC.agentsCreate, input)
    },
    tabs: {
      read: () => ipc.invoke(IPC.tabsRead),
      write: (state) => ipc.invoke(IPC.tabsWrite, state),
      onCloseActive: (handler) => {
        const fn = (): void => handler()
        ipc.on(IPC.tabsCloseActive, fn)
        return () => ipc.removeListener(IPC.tabsCloseActive, fn)
      }
    },
    workspace: {
      state: () => ipc.invoke(IPC.workspaceState),
      choose: () => ipc.invoke(IPC.workspaceChoose),
      decline: () => ipc.invoke(IPC.workspaceDecline),
      check: () => ipc.invoke(IPC.workspaceCheck),
      adopt: () => ipc.invoke(IPC.workspaceImport)
    },
    gateway: {
      offer: () => ipc.invoke(IPC.gatewayOffer)
    },
    proposals: {
      decide: (id, decision) => ipc.invoke(IPC.proposalDecide, id, decision)
    },
    questions: {
      answer: (input) => ipc.invoke(IPC.questionAnswer, input)
    },
    releases: {
      list: (q) => ipc.invoke(IPC.releasesList, q),
      record: (input) => ipc.invoke(IPC.releasesRecord, input),
      verify: (input) => ipc.invoke(IPC.releasesVerify, input)
    },
    board: {
      query: (q) => ipc.invoke(IPC.boardQuery, q),
      resolved: (q) => ipc.invoke(IPC.boardResolved, q),
      deferred: (q) => ipc.invoke(IPC.boardDeferred, q),
      defer: (input) => ipc.invoke(IPC.boardDefer, input),
      reopen: (input) => ipc.invoke(IPC.boardReopen, input),
      addTopic: (input) => ipc.invoke(IPC.boardAddTopic, input)
    },
    attention: {
      list: () => ipc.invoke(IPC.attentionList),
      grant: (input) => ipc.invoke(IPC.attentionGrant, input)
    },
    analytics: {
      status: () => ipc.invoke(IPC.analyticsStatus),
      setEnabled: (enabled) => ipc.invoke(IPC.analyticsSetEnabled, enabled)
    },
    hub: {
      overview: () => ipc.invoke(IPC.hubOverview),
      decide: (requestId, decision) => ipc.invoke(IPC.hubDecide, requestId, decision),
      revokeGrant: (grantId) => ipc.invoke(IPC.hubRevokeGrant, grantId),
      revokeAgent: (bindingId) => ipc.invoke(IPC.hubRevokeAgent, bindingId),
      disconnectAgent: (agentId) => ipc.invoke(IPC.hubDisconnectAgent, agentId),
      letAgentIn: (agentId) => ipc.invoke(IPC.hubLetAgentIn, agentId),
      clearDenial: (requestId) => ipc.invoke(IPC.hubClearDenial, requestId),
      connect: (product, opts) => ipc.invoke(IPC.hubConnect, product, opts),
      disconnect: (product) => ipc.invoke(IPC.hubDisconnect, product)
    },
    goals: {
      list: (projectId) => ipc.invoke(IPC.goalsList, projectId),
      define: (projectId, title) => ipc.invoke(IPC.goalsDefine, projectId, title)
    },
    repos: {
      list: (projectId) => ipc.invoke(IPC.reposList, projectId),
      choose: () => ipc.invoke(IPC.reposChoose),
      attach: (projectId, paths) => ipc.invoke(IPC.reposAttach, projectId, paths),
      detach: (projectId, repoId) => ipc.invoke(IPC.reposDetach, projectId, repoId)
    },
    files: {
      list: (dir) => ipc.invoke(IPC.filesList, dir),
      read: (file) => ipc.invoke(IPC.filesRead, file),
      write: (file, content, expectedHash, grantId) =>
        ipc.invoke(IPC.filesWrite, file, content, expectedHash, grantId),
      requestOverwrite: (file) => ipc.invoke(IPC.filesRequestOverwrite, file),
      openExternally: (file) => ipc.invoke(IPC.filesOpenExternally, file),
      recoveryKeep: (file, content, baseHash) => ipc.invoke(IPC.filesRecoveryKeep, file, content, baseHash),
      recoveryFlush: (file, content, baseHash) => ipc.send(IPC.filesRecoveryFlush, file, content, baseHash),
      recoveryRead: (file) => ipc.invoke(IPC.filesRecoveryRead, file)
    },
    settings: {
      read: () => ipc.invoke(IPC.settingsRead),
      write: (next) => ipc.invoke(IPC.settingsWrite, next),
      agentCatalog: () => ipc.invoke(IPC.settingsAgentCatalog),
      loginItem: () => ipc.invoke(IPC.settingsLoginItem)
    },
    feed: {
      replay: (fromSeq) => ipc.invoke(IPC.feedReplay, fromSeq)
    },
    comms: {
      threads: () => ipc.invoke(IPC.commsThreads),
      list: (threadId, afterSeq, limit) => ipc.invoke(IPC.commsList, threadId, afterSeq, limit),
      threadPage: (filter, before, limit) => ipc.invoke(IPC.commsThreadPage, filter, before, limit),
      heads: () => ipc.invoke(IPC.commsHeads),
      responders: () => ipc.invoke(IPC.commsResponders),
      facts: (messages) => ipc.invoke(IPC.commsFacts, messages),
      timeline: (requestId) => ipc.invoke(IPC.commsTimeline, requestId),
      related: (threadId) => ipc.invoke(IPC.commsRelated, threadId),
      search: (query, before) => ipc.invoke(IPC.commsSearch, query, before),
      pending: () => ipc.invoke(IPC.commsPending),
      waiting: () => ipc.invoke(IPC.commsWaiting),
      openArtifact: (url) => ipc.invoke(IPC.commsOpenArtifact, url)
    },
    quota: {
      read: () => ipc.invoke(IPC.quotaRead)
    },
    transcripts: {
      list: (projectId) => ipc.invoke(IPC.transcriptsList, projectId),
      get: (sessionId) => ipc.invoke(IPC.transcriptsGet, sessionId),
      context: (sessionId) => ipc.invoke(IPC.contextPast, sessionId)
    },
    diagnostics: {
      read: (query) => ipc.invoke(IPC.diagnosticsRead, query)
    },
    stack: {
      exposure: () => ipc.invoke(IPC.stackExposure),
      health: () => ipc.invoke(IPC.stackHealth),
      onHealth: (cb) => {
        const listener = (_e: unknown, view: StackHealthView): void => cb(view)
        ipc.on(IPC.stackHealthChanged, listener)
        return () => ipc.removeListener(IPC.stackHealthChanged, listener)
      }
    },
    ops: {
      rendererError: (info) => ipc.send(IPC.opsRendererError, info)
    },
    favourites: {
      list: () => ipc.invoke(IPC.favouritesList),
      toggle: (projectId) => ipc.invoke(IPC.favouritesToggle, projectId),
      replace: (release, add) => ipc.invoke(IPC.favouritesReplace, release, add),
      order: () => ipc.invoke(IPC.favouritesOrder),
      move: (projectId, dir, rest) => ipc.invoke(IPC.favouritesMove, projectId, dir, rest)
    },
    start: {
      chooseFolder: (purpose, defaultPath) => ipc.invoke(IPC.startChooseFolder, purpose, defaultPath),
      inspect: (folder) => ipc.invoke(IPC.startInspect, folder),
      scan: (root) => ipc.invoke(IPC.startScan, root),
      cancelScan: () => ipc.invoke(IPC.startCancelScan),
      lastScan: () => ipc.invoke(IPC.startLastScan),
      createFolder: (input) => ipc.invoke(IPC.startCreateFolder, input),
      executors: () => ipc.invoke(IPC.startExecutors),
      adapterSkills: (agentId: string) => ipc.invoke(IPC.startAdapterSkills, agentId)
    },
    persona: {
      read: () => ipc.invoke(IPC.personaRead),
      save: (next) => ipc.invoke(IPC.personaSave, next)
    },
    search: {
      run: (query) => ipc.invoke(IPC.searchRun, query)
    },
    digest: {
      read: (projectId) => ipc.invoke(IPC.digestRead, projectId),
      seen: (projectId, boundary) => ipc.invoke(IPC.digestSeen, projectId, boundary)
    },
    estate: {
      summary: () => ipc.invoke(IPC.estateSummary)
    },
    harness: {
      read: (projectId) => ipc.invoke(IPC.harnessRead, projectId)
    },
    decisions: {
      list: (projectId) => ipc.invoke(IPC.decisionsList, projectId)
    },
    runs: {
      status: (sessionId: string) => ipc.invoke(IPC.runsStatus, sessionId)
    },
    memory: {
      preview: (projectId: string, budget?: number) => ipc.invoke(IPC.memoryPreview, projectId, budget),
      overview: (projectId) => ipc.invoke(IPC.memoryOverview, projectId),
      misses: (projectId, limit) => ipc.invoke(IPC.memoryMisses, projectId, limit),
      remember: (projectId, claim, sourceRef, supersedes, about, category) =>
        ipc.invoke(IPC.memoryRemember, projectId, claim, sourceRef, supersedes, about, category),
      retro: (query) => ipc.invoke(IPC.memoryRetro, query),
      search: (projectId, query, includeSuperseded, category) =>
        ipc.invoke(IPC.memorySearch, projectId, query, includeSuperseded, category)
    },
    links: {
      onOpen: (cb) => {
        const listener = (_e: unknown, route: Parameters<typeof cb>[0]): void => cb(route)
        ipc.on(IPC.linksOpen, listener)
        return () => ipc.removeListener(IPC.linksOpen, listener)
      },
      pending: () => ipc.invoke(IPC.linksPending)
    },
    acts: {
      history: (query) => ipc.invoke(IPC.actsHistory, query),
      undo: (seq) => ipc.invoke(IPC.actsUndo, seq)
    },
    work: {
      project: (projectId) => ipc.invoke(IPC.workProject, projectId),
      estate: () => ipc.invoke(IPC.workEstate),
      home: () => ipc.invoke(IPC.workHome),
      board: (projectId?: string | null) => ipc.invoke(IPC.workBoard, projectId ?? null),
      release: (claimId) => ipc.invoke(IPC.workRelease, claimId)
    },
    terminal: {
      options: () => ipc.invoke(IPC.terminalOptions),
      fallback: (projectId, kind, permissionMode, preset) => ipc.invoke(IPC.terminalFallback, projectId, kind, permissionMode, preset),
      memoryBackends: () => ipc.invoke(IPC.terminalMemoryBackends),
      open: (projectId, optionId, firstInstruction, permissionMode) =>
        ipc.invoke(IPC.terminalOpen, projectId, optionId, firstInstruction, permissionMode),
      list: (projectId) => ipc.invoke(IPC.terminalList, projectId),
      claims: (projectId) => ipc.invoke(IPC.terminalClaims, projectId),
      history: (sessionId) => ipc.invoke(IPC.terminalHistory, sessionId),
      get: (sessionId) => ipc.invoke(IPC.terminalGet, sessionId),
      scrollback: (sessionId) => ipc.invoke(IPC.terminalScrollback, sessionId),
      write: (sessionId, data) => ipc.send(IPC.terminalWrite, sessionId, data),
      resize: (sessionId, cols, rows) => ipc.send(IPC.terminalResize, sessionId, cols, rows),
      end: (sessionId, options) => ipc.invoke(IPC.terminalEnd, sessionId, options),
      attestOver: (sessionId) => ipc.invoke(IPC.terminalAttestOver, sessionId),
      dismiss: (sessionId) => ipc.invoke(IPC.terminalDismiss, sessionId),
      onData: (cb) => {
        const listener = (_e: unknown, sessionId: string, data: string, written: number): void =>
          cb(sessionId, data, written)
        ipc.on(IPC.terminalData, listener)
        return () => ipc.removeListener(IPC.terminalData, listener)
      },
      onExit: (cb) => {
        const listener = (_e: unknown, sessionId: string, exitCode: number): void =>
          cb(sessionId, exitCode)
        ipc.on(IPC.terminalExit, listener)
        return () => ipc.removeListener(IPC.terminalExit, listener)
      }
    },
    windows: {
      openSession: (sessionId) => ipc.invoke(IPC.windowsOpenSession, sessionId),
      openFile: (filePath) => ipc.invoke(IPC.windowsOpenFile, filePath)
    },
    meta: {
      info: () => ipc.invoke(IPC.metaInfo)
    }
  }
}

/** The channel a bridge method speaks, learned by calling it once against a recorder. Every method is one
 *  synchronous `invoke`, `send` or `on` (`test/ipc-window-policy.test.mjs` holds that). */
function channelOf(ns: string, method: string): string | null {
  let channel: string | null = null
  const note = (c: string): void => { channel ??= c }
  const probe: BridgeIpc = {
    invoke: ((c: string) => { note(c); return Promise.resolve(undefined) }) as BridgeIpc['invoke'],
    send: ((c: string) => { note(c) }) as BridgeIpc['send'],
    on: ((c: string) => { note(c); return probe }) as unknown as BridgeIpc['on'],
    removeListener: (() => probe) as unknown as BridgeIpc['removeListener']
  }
  const fn = (createApi(probe) as unknown as Record<string, Record<string, (...a: unknown[]) => unknown>>)[ns]?.[method]
  // The probe's promise settles with nothing, and a subscription it returned is simply dropped.
  if (typeof fn === 'function') fn(() => {})
  return channel
}

/** The bridge a window of `kind` is given: only the methods its kind may speak; nothing for no kind. */
export function exposedApi(kind: WindowKind | null, ipc: BridgeIpc): Partial<FabricApi> {
  if (!kind) return {}
  const full = createApi(ipc) as unknown as Record<string, Record<string, unknown>>
  const out: Record<string, Record<string, unknown>> = {}
  for (const [ns, methods] of Object.entries(full)) {
    const kept = Object.fromEntries(Object.entries(methods).filter(([name]) => {
      const channel = channelOf(ns, name)
      return channel !== null && kindMaySpeak(kind, channel)
    }))
    if (Object.keys(kept).length) out[ns] = kept
  }
  return out as Partial<FabricApi>
}
// #endregion preload-window-subset
