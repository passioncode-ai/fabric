// The typed bridge — the renderer's entire surface (iteration-1-modules.md §10).

import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type FabricApi } from '../shared/types'

const api: FabricApi = {
  projects: {
    create: (input) => ipcRenderer.invoke(IPC.projectsCreate, input),
    update: (input) => ipcRenderer.invoke(IPC.projectsUpdate, input),
    updateSettings: (input) => ipcRenderer.invoke(IPC.projectsUpdateSettings, input),
    saveSettings: (input) => ipcRenderer.invoke(IPC.projectsSaveSettings, input),
    list: () => ipcRenderer.invoke(IPC.projectsList),
    stats: (projectId) => ipcRenderer.invoke(IPC.projectsStats, projectId),
    repoStates: (projectId) => ipcRenderer.invoke(IPC.projectsRepoStates, projectId),
    onRepoChanged: (cb) => {
      const listener = (_e: unknown, repoPath: string): void => cb(repoPath)
      ipcRenderer.on(IPC.projectsRepoChanged, listener)
      return () => ipcRenderer.removeListener(IPC.projectsRepoChanged, listener)
    }
  },
  drafts: {
    read: () => ipcRenderer.invoke(IPC.draftsRead),
    save: (next) => ipcRenderer.invoke(IPC.draftsSave, next)
  },
  history: {
    list: () => ipcRenderer.invoke(IPC.historyList),
    export: () => ipcRenderer.invoke(IPC.historyExport),
    choose: () => ipcRenderer.invoke(IPC.historyChoose),
    restore: (token, name) => ipcRenderer.invoke(IPC.historyRestore, token, name),
    check: (operationId) => ipcRenderer.invoke(IPC.historyCheck, operationId),
    open: (estateId) => ipcRenderer.invoke(IPC.historyOpen, estateId)
  },
  ceo: {
    status: () => ipcRenderer.invoke(IPC.ceoStatus),
    call: (method, args) => ipcRenderer.invoke(IPC.ceoCall, method, args),
    select: (conversationId) => ipcRenderer.invoke(IPC.ceoSelect, conversationId)
  },
  tasks: {
    startExisting: (taskId: string) => ipcRenderer.invoke(IPC.tasksStartExisting, taskId),
    start: (input) => ipcRenderer.invoke(IPC.tasksStart, input),
    list: (projectId) => ipcRenderer.invoke(IPC.tasksList, projectId),
    move: (taskId, to) => ipcRenderer.invoke(IPC.tasksMove, taskId, to),
    close: (taskId, outcome, reason) => ipcRenderer.invoke(IPC.tasksClose, taskId, outcome, reason),
    detail: (taskId) => ipcRenderer.invoke(IPC.tasksDetail, taskId),
    note: (taskId, body) => ipcRenderer.invoke(IPC.tasksNote, taskId, body),
    promote: (noteId) => ipcRenderer.invoke(IPC.tasksPromote, noteId),
    brief: (taskId, section, body) => ipcRenderer.invoke(IPC.tasksBrief, taskId, section, body),
    prioritise: (taskId, goalId, position) =>
      ipcRenderer.invoke(IPC.tasksPrioritise, taskId, goalId, position),
    fileIdea: (projectId, text) => ipcRenderer.invoke(IPC.tasksFileIdea, projectId, text),
    research: (taskId, optionId) => ipcRenderer.invoke(IPC.tasksResearch, taskId, optionId)
  },
  automations: {
    read: (projectId) => ipcRenderer.invoke(IPC.automationsRead, projectId)
  },
  routines: {
    list: (projectId) => ipcRenderer.invoke(IPC.routinesList, projectId),
    define: (input) => ipcRenderer.invoke(IPC.routinesDefine, input),
    setEnabled: (id, enabled) => ipcRenderer.invoke(IPC.routinesSetEnabled, id, enabled)
  },
  agents: {
    list: (projectId) => ipcRenderer.invoke(IPC.agentsList, projectId),
    create: (input) => ipcRenderer.invoke(IPC.agentsCreate, input)
  },
  tabs: {
    read: () => ipcRenderer.invoke(IPC.tabsRead),
    write: (state) => ipcRenderer.invoke(IPC.tabsWrite, state),
    onCloseActive: (handler) => {
      const fn = (): void => handler()
      ipcRenderer.on('tab:closeActive', fn)
      return () => ipcRenderer.removeListener('tab:closeActive', fn)
    }
  },
  workspace: {
    state: () => ipcRenderer.invoke(IPC.workspaceState),
    choose: () => ipcRenderer.invoke(IPC.workspaceChoose),
    decline: () => ipcRenderer.invoke(IPC.workspaceDecline),
    check: () => ipcRenderer.invoke(IPC.workspaceCheck),
    adopt: () => ipcRenderer.invoke(IPC.workspaceImport)
  },
  gateway: {
    offer: () => ipcRenderer.invoke(IPC.gatewayOffer)
  },
  proposals: {
    decide: (id, decision) => ipcRenderer.invoke(IPC.proposalDecide, id, decision)
  },
  questions: {
    answer: (input) => ipcRenderer.invoke(IPC.questionAnswer, input)
  },
  releases: {
    list: (q) => ipcRenderer.invoke(IPC.releasesList, q),
    record: (input) => ipcRenderer.invoke(IPC.releasesRecord, input),
    verify: (input) => ipcRenderer.invoke(IPC.releasesVerify, input)
  },
  board: {
    query: (q) => ipcRenderer.invoke(IPC.boardQuery, q),
    resolved: (q) => ipcRenderer.invoke(IPC.boardResolved, q),
    deferred: (q) => ipcRenderer.invoke(IPC.boardDeferred, q),
    defer: (input) => ipcRenderer.invoke(IPC.boardDefer, input),
    reopen: (input) => ipcRenderer.invoke(IPC.boardReopen, input),
    addTopic: (input) => ipcRenderer.invoke(IPC.boardAddTopic, input)
  },
  attention: {
    list: () => ipcRenderer.invoke(IPC.attentionList),
    grant: (input) => ipcRenderer.invoke(IPC.attentionGrant, input)
  },
  analytics: {
    status: () => ipcRenderer.invoke(IPC.analyticsStatus),
    setEnabled: (enabled) => ipcRenderer.invoke(IPC.analyticsSetEnabled, enabled)
  },
  hub: {
    overview: () => ipcRenderer.invoke(IPC.hubOverview),
    decide: (requestId, decision) => ipcRenderer.invoke(IPC.hubDecide, requestId, decision),
    revokeGrant: (grantId) => ipcRenderer.invoke(IPC.hubRevokeGrant, grantId),
    revokeAgent: (bindingId) => ipcRenderer.invoke(IPC.hubRevokeAgent, bindingId),
    clearDenial: (requestId) => ipcRenderer.invoke(IPC.hubClearDenial, requestId),
    connect: (product, opts) => ipcRenderer.invoke(IPC.hubConnect, product, opts),
    disconnect: (product) => ipcRenderer.invoke(IPC.hubDisconnect, product)
  },
  goals: {
    list: (projectId) => ipcRenderer.invoke(IPC.goalsList, projectId),
    define: (projectId, title) => ipcRenderer.invoke(IPC.goalsDefine, projectId, title)
  },
  repos: {
    list: (projectId) => ipcRenderer.invoke(IPC.reposList, projectId),
    choose: () => ipcRenderer.invoke(IPC.reposChoose),
    attach: (projectId, paths) => ipcRenderer.invoke(IPC.reposAttach, projectId, paths),
    detach: (projectId, repoId) => ipcRenderer.invoke(IPC.reposDetach, projectId, repoId)
  },
  files: {
    list: (dir) => ipcRenderer.invoke(IPC.filesList, dir),
    read: (file) => ipcRenderer.invoke(IPC.filesRead, file),
    write: (file, content, expectedHash, grantId) =>
      ipcRenderer.invoke(IPC.filesWrite, file, content, expectedHash, grantId),
    requestOverwrite: (file) => ipcRenderer.invoke(IPC.filesRequestOverwrite, file),
    openExternally: (file) => ipcRenderer.invoke(IPC.filesOpenExternally, file),
    recoveryKeep: (file, content, baseHash) => ipcRenderer.invoke(IPC.filesRecoveryKeep, file, content, baseHash),
    recoveryFlush: (file, content, baseHash) => ipcRenderer.send(IPC.filesRecoveryFlush, file, content, baseHash),
    recoveryRead: (file) => ipcRenderer.invoke(IPC.filesRecoveryRead, file)
  },
  settings: {
    read: () => ipcRenderer.invoke(IPC.settingsRead),
    write: (next) => ipcRenderer.invoke(IPC.settingsWrite, next)
  },
  feed: {
    replay: (fromSeq) => ipcRenderer.invoke(IPC.feedReplay, fromSeq)
  },
  quota: {
    read: () => ipcRenderer.invoke(IPC.quotaRead)
  },
  transcripts: {
    list: (projectId) => ipcRenderer.invoke(IPC.transcriptsList, projectId),
    get: (sessionId) => ipcRenderer.invoke(IPC.transcriptsGet, sessionId),
    context: (sessionId) => ipcRenderer.invoke(IPC.contextPast, sessionId)
  },
  diagnostics: {
    read: (query) => ipcRenderer.invoke(IPC.diagnosticsRead, query)
  },
  stack: {
    exposure: () => ipcRenderer.invoke(IPC.stackExposure)
  },
  ops: {
    rendererError: (info) => ipcRenderer.send(IPC.opsRendererError, info)
  },
  favourites: {
    list: () => ipcRenderer.invoke(IPC.favouritesList),
    toggle: (projectId) => ipcRenderer.invoke(IPC.favouritesToggle, projectId),
    replace: (release, add) => ipcRenderer.invoke(IPC.favouritesReplace, release, add),
    order: () => ipcRenderer.invoke(IPC.favouritesOrder),
    move: (projectId, dir, rest) => ipcRenderer.invoke(IPC.favouritesMove, projectId, dir, rest)
  },
  start: {
    chooseFolder: (purpose, defaultPath) => ipcRenderer.invoke(IPC.startChooseFolder, purpose, defaultPath),
    inspect: (folder) => ipcRenderer.invoke(IPC.startInspect, folder),
    scan: (root) => ipcRenderer.invoke(IPC.startScan, root),
    cancelScan: () => ipcRenderer.invoke(IPC.startCancelScan),
    lastScan: () => ipcRenderer.invoke(IPC.startLastScan),
    createFolder: (input) => ipcRenderer.invoke(IPC.startCreateFolder, input),
    executors: () => ipcRenderer.invoke(IPC.startExecutors),
    adapterSkills: (agentId: string) => ipcRenderer.invoke(IPC.startAdapterSkills, agentId)
  },
  persona: {
    read: () => ipcRenderer.invoke(IPC.personaRead),
    save: (next) => ipcRenderer.invoke(IPC.personaSave, next)
  },
  search: {
    run: (query) => ipcRenderer.invoke(IPC.searchRun, query)
  },
  digest: {
    read: (projectId) => ipcRenderer.invoke(IPC.digestRead, projectId),
    seen: (projectId, boundary) => ipcRenderer.invoke(IPC.digestSeen, projectId, boundary)
  },
  estate: {
    summary: () => ipcRenderer.invoke(IPC.estateSummary)
  },
  harness: {
    read: (projectId) => ipcRenderer.invoke(IPC.harnessRead, projectId)
  },
  decisions: {
    list: (projectId) => ipcRenderer.invoke(IPC.decisionsList, projectId)
  },
  runs: {
    status: (sessionId: string) => ipcRenderer.invoke(IPC.runsStatus, sessionId)
  },
  memory: {
    preview: (projectId: string, budget?: number) => ipcRenderer.invoke(IPC.memoryPreview, projectId, budget),
    overview: (projectId) => ipcRenderer.invoke(IPC.memoryOverview, projectId),
    misses: (projectId, limit) => ipcRenderer.invoke(IPC.memoryMisses, projectId, limit),
    remember: (projectId, claim, sourceRef, supersedes, about, category) =>
      ipcRenderer.invoke(IPC.memoryRemember, projectId, claim, sourceRef, supersedes, about, category),
    retro: (query) => ipcRenderer.invoke(IPC.memoryRetro, query),
    search: (projectId, query, includeSuperseded, category) =>
      ipcRenderer.invoke(IPC.memorySearch, projectId, query, includeSuperseded, category)
  },
  terminal: {
    options: () => ipcRenderer.invoke(IPC.terminalOptions),
    fallback: (projectId, kind, permissionMode) => ipcRenderer.invoke(IPC.terminalFallback, projectId, kind, permissionMode),
    memoryBackends: () => ipcRenderer.invoke(IPC.terminalMemoryBackends),
    open: (projectId, optionId, firstInstruction, permissionMode) =>
      ipcRenderer.invoke(IPC.terminalOpen, projectId, optionId, firstInstruction, permissionMode),
    list: (projectId) => ipcRenderer.invoke(IPC.terminalList, projectId),
    claims: (projectId) => ipcRenderer.invoke(IPC.terminalClaims, projectId),
    history: (sessionId) => ipcRenderer.invoke(IPC.terminalHistory, sessionId),
    get: (sessionId) => ipcRenderer.invoke(IPC.terminalGet, sessionId),
    scrollback: (sessionId) => ipcRenderer.invoke(IPC.terminalScrollback, sessionId),
    write: (sessionId, data) => ipcRenderer.send(IPC.terminalWrite, sessionId, data),
    resize: (sessionId, cols, rows) => ipcRenderer.send(IPC.terminalResize, sessionId, cols, rows),
    end: (sessionId, options) => ipcRenderer.invoke(IPC.terminalEnd, sessionId, options),
    dismiss: (sessionId) => ipcRenderer.invoke(IPC.terminalDismiss, sessionId),
    onData: (cb) => {
      const listener = (_e: unknown, sessionId: string, data: string, written: number): void =>
        cb(sessionId, data, written)
      ipcRenderer.on(IPC.terminalData, listener)
      return () => ipcRenderer.removeListener(IPC.terminalData, listener)
    },
    onExit: (cb) => {
      const listener = (_e: unknown, sessionId: string, exitCode: number): void =>
        cb(sessionId, exitCode)
      ipcRenderer.on(IPC.terminalExit, listener)
      return () => ipcRenderer.removeListener(IPC.terminalExit, listener)
    }
  },
  windows: {
    openSession: (sessionId) => ipcRenderer.invoke(IPC.windowsOpenSession, sessionId),
    openFile: (filePath) => ipcRenderer.invoke(IPC.windowsOpenFile, filePath)
  },
  meta: {
    info: () => ipcRenderer.invoke(IPC.metaInfo)
  }
}

contextBridge.exposeInMainWorld('fabric', api)
