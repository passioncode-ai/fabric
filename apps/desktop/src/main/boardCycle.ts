// #region board-cycle — docs: docs/evidence/plans/2026-11-17-board-apart-waves.md#3-the-waves
/**
 * The board's cycle, composed (ADR-0195 W2a.4): the routine tick and the chain advance behind one admission, the runtime
 * observer, the sweep of abandoned work, the board dispatcher with its wake and watch, the people-ask bridge, the daily
 * digests sent to Observatory, and the 60 s cycle that runs them, each with its own timer stopped at quit. Until W2a.4
 * this was a block of `main/index.ts#registerIpc`; it moved as it stood, every name it read there now a field of
 * `BoardCycleDeps`. What is the window's is given: its terminals, the quota reading, `startTask`, the doors its buttons
 * call (`decisions`, BoardDecisions), the reading of «Нужны вы», and the machine's sleep (`clock`, BoardClock).
 */
import path from 'node:path'
import { closeSync, fsyncSync, openSync, readFileSync, renameSync, writeSync } from 'node:fs'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Journal } from '@fabric/journal'
import { createAbandonedSweep, readBoardRequests, readBriefGaps, readRecentTurns, readReviewAges, readRunningTasks, readSweepClaims } from './abandonedSweepRun.ts'
import type { AccessStore } from './accessStore.ts'
import { createAdmitExisting } from './admitExisting.ts'
import type { AgentSurface } from './agentSurface'
import { registryDirs } from './agentRegistry.ts'
import type { BoardState } from './boardState.ts'
import { createDispatchWake, toOperatorMarks, type ToOperatorWhy } from './boardDispatchRun.ts'
import { createRemoteQuestions, primaryFolder, remoteTargetFor, wireBoardDispatch } from './boardDispatchWiring.ts'
import { readResumeCandidates, readResumeState, resumeSince } from './boardResumeRead.ts'
import { tickBoard } from './boardService.ts'
import { createChainAdvance } from './chainAdvance'
import { createCommsOperatorRead } from './commsOperatorRead.ts'
import { cleanOriginalText } from './desktopIngress.ts'
import { findOnPath, widenProbePath } from './executorDetect.ts'
import { createObservatoryClient, findObservatoryServer } from './observatoryMemory.ts'
import { createOpsDigestCollector } from './opsDigestCollector.ts'
import type { OpsDigestRun } from './opsDigestRun.ts'
import { BINDING_TOKEN_FILE, createOpsDigestPass, createOpsDigestSender } from './opsDigestSend.ts'
import { ops } from './opsSink'
import { createPeopleApply, createPeopleAskBridge, isAskRecord, PEOPLE_ASK_WATCH_MS, type AskRecord, type PeopleAskDeps, type PeopleDoors, type ProjectFacts } from './peopleAskRun.ts'
import { admitAccessAct } from './relayedAccess.ts'
import { createRoutineTick } from './routineTick'
import { createRunLifecycle, type RunLifecycle } from './runLifecycle.ts'
import { createRuntimeObserver } from './runtimeObserver.ts'
import type { ScopedStore } from './scopedStore'
import { sessionEnvironment } from './sessionEnv.ts'
import { readSettings, readSettingsState } from './settings'
import { readMachineLimitStops } from './switchboardSessions.ts'
import type { PtyManager } from './pty'
import { readRunHolds, type HeldSession } from './workRead.ts'
import { acceptReviewByDefault, moveDoneLeftRunningToReview, moveReleasedLeftRunningToBacklog, releaseLapsedClaim } from './workRelease.ts'
import { dispatcherRuns, remoteOwnerOf, sessionLiveForDispatch, suspendedSince, WATCH_MS } from '../shared/boardDispatch.ts'
import { advancesWatermark, runCyclePasses } from '../shared/cyclePort.ts'
import type { HostWindow } from '../shared/harnessBreak.ts'
import { routesOf } from '../shared/peopleAsk.ts'
import { createUnattendedAdmission } from '../shared/unattendedAdmission.ts'
import { SESSION_STALE_MS } from '../shared/workClaims.ts'

type RoutineDeps = Parameters<typeof createRoutineTick>[0]

/** BoardClock (ADR-0195 W2a.4): how long the machine slept, as the process that runs the cycle observed it. */
export interface BoardClock {
  /** The host window the runtime observer judges a pass against (`harnessBreak.ts`). */
  hostWindow(): HostWindow
  /** Milliseconds the machine slept since `from` (`boardDispatch.ts#suspendedSince`). */
  suspendedSince(from: number): number
}

export interface BoardCycleDeps {
  quit: { readonly quitting: boolean; onQuit(fn: () => void): void }
  db: SupabaseClient
  store: ScopedStore
  journal: Journal
  estateId: string
  operator: { kind: 'person'; id: string }
  state: BoardState
  surface: AgentSurface
  /** The folder the board's own files are kept in (`userData`). */
  userData: string
  terminals: Pick<PtyManager, 'list' | 'get'>
  taskBySession: ReadonlyMap<string, string>
  processStartedAt: number
  quotaRead: RoutineDeps['quota']
  startTask: RoutineDeps['startTask']
  clock: BoardClock
  /** BoardDecisions: the doors the window's buttons call, for an answer the people-ask bridge applies. */
  decisions: PeopleDoors
  /** «Нужны вы» whole, as Главная reads it. */
  personItems: PeopleAskDeps['readItems']
  accessRequest: AccessStore['request']
  opsDigest(): OpsDigestRun | null
  host: {
    ownsStack(): boolean
    freeDiskNow(): number | null
    cachedOrigin(repoPath: string): Promise<string | null>
    heldSessions(projectId?: string): HeldSession[]
    sessionSignOf(sessionId: string): { lastSignAt: number | null } | null
    projectRepos(projectId: string): Promise<Array<{ path: string; is_primary: boolean }>>
  }
  onRuns(runs: RunLifecycle): void
}

export function startBoardCycle(d: BoardCycleDeps): { admitExisting: ReturnType<typeof createAdmitExisting> } {
  const { quit, db, store, journal, estateId: ACTIVE_ESTATE, operator: OPERATOR_ACTOR, state: boardState, surface, terminals: ptys,
    taskBySession, processStartedAt: PROCESS_STARTED_AT, startTask } = d
  const { ownsStack, freeDiskNow, cachedOrigin, heldSessions, sessionSignOf, projectRepos } = d.host
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
  const runs = createRunLifecycle({
    db,
    estateId: ACTIVE_ESTATE,
    actor: OPERATOR_ACTOR,
    onFailure: (op, says) => ops.failed(op, new Error(says))
  })
  d.onRuns(runs)
  // Runs this process cannot see a session for are COUNTED, never ended: absence on this host is not
  // proof of exit (managed stop owns endings). The count makes an orphaned run visible in the ops log.
  void runs.reconcile(ptys.list().map((s) => s.sessionId)).then((r) => {
    if (r.unobserved !== null) ops.record({ op: 'run.reconcile', outcome: 'ok', detail: { unobserved: r.unobserved }, ctx: { correlationId: ops.correlate() } })
  }, (e) => ops.failed('run.reconcile', e))
  const tick = createRoutineTick({
    store,
    journal,
    quota: d.quotaRead,
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
    quota: d.quotaRead,
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
    host: d.clock.hostWindow
  })

  // #region abandoned-sweep-wiring — docs: docs/evidence/specs/2026-10-26-0313-w2-abandoned-work-sweep.md#requirements
  // The sweep of abandoned work (CO-427): every third pass of the cycle below. Its reads are the screens' own (claims,
  // running tasks), the operator's read door onto the board, and the observer's last pass over Fabric's terminals.
  const sweepBoard = createCommsOperatorRead({ rpc: (fn, args) => db.rpc(fn, args) })
  const abandonedSweep = createAbandonedSweep({
    now: () => Date.now(),
    readClaims: (now) => readSweepClaims(store, now, sessionSignOf),
    readRunningTasks: () => readRunningTasks(store),
    // CO-409 (the 0.3.16 review, PL-1): a request the dispatcher gave up on after two empty runs is the operator's,
    // whatever its state, and shows in «На проверке».
    readRequests: async (now) => {
      const r = await readBoardRequests(sweepBoard, ACTIVE_ESTATE, now)
      const given = boardState.dispatcher.get()?.toOperator() ?? new Map<string, ToOperatorWhy>()
      const marked = given.size ? r.requests.map((x) => (given.has(x.requestId) ? { ...x, toOperator: true, ...toOperatorMarks(given.get(x.requestId)!) } : x)) : r.requests
      // CO-559 (§3.8): an inbox item given to the operator is a message, not a request: it joins the sweep as its own row.
      const inbox = (boardState.dispatcher.get()?.inboxGiven() ?? []).map((g) => ({ requestId: g.messageId, targetProjectId: g.projectId, requesterProjectId: '',
        state: 'queued', movedAt: g.at, answerUnreadSince: null, toOperator: true, inbox: true }))
      // T6 (the turn-end spec): a left task three runs never took is the operator's, a row of its own.
      const leftToOperator = (boardState.dispatcher.get()?.resumeGiven() ?? []).map((g) => ({ taskId: g.taskId, projectId: g.projectId, at: g.at }))
      return { ...r, requests: [...marked, ...inbox], ...(leftToOperator.length ? { leftToOperator } : {}) }
    },
    // 0.3.14 wave 2: the session hooks' turns, to see a session changing files with no claim.
    readTurns: (now) => readRecentTurns(store, now),
    // 0.3.14 wave 2: the claimed tasks' briefs, to remind a claim of the parts it has not written.
    readBriefGaps: (taskIds) => readBriefGaps(store, taskIds),
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
    // 0.3.14 wave 2: a done release whose move to review did not land is moved there, read back.
    moveDoneToReview: async (taskId, projectId) => projectId
      ? moveDoneLeftRunningToReview(store, (e) => journal.append({ estateId: ACTIVE_ESTATE, ...e }), taskId, projectId)
      : { task_moved_to: null, failed: 'the task names no project' },
    // The 0.3.14 review, iteration 1, ER-6: a release other than done whose move back to backlog did not land.
    moveReleasedToBacklog: async (taskId, projectId) => projectId
      ? moveReleasedLeftRunningToBacklog(store, (e) => journal.append({ estateId: ACTIVE_ESTATE, ...e }), taskId, projectId)
      : { task_moved_to: null, failed: 'the task names no project' },
    // CO-537: work left in review past three days is accepted by default, read back.
    readReviews: () => readReviewAges(store, Date.now()),
    acceptReview: async (taskId, projectId, movedAt) => projectId
      ? acceptReviewByDefault(store, (e) => journal.append({ estateId: ACTIVE_ESTATE, ...e }), taskId, projectId, movedAt)
      : { accepted: false, failed: 'the task names no project' },
    unresolvedRuns: async (taskIds) => (await readRunHolds(store, taskIds)).map((h) => h.taskId),
    // SW-7: the sweep's receipt, estate-level (no project), as the system that swept.
    recordSwept: async (receipt) => { await journal.append({ estateId: ACTIVE_ESTATE, type: 'work.swept@1', actor: { kind: 'system', id: 'abandoned-sweep' }, payload: { ...receipt } }) },
    quitting: () => quit.quitting,
    processStartedAt: PROCESS_STARTED_AT
  })
  boardState.sweep.set(abandonedSweep)
  const sweep = abandonedSweep
  // #endregion abandoned-sweep-wiring

  // #region board-dispatch-cycle — docs: docs/evidence/specs/2026-11-04-on-demand-sessions.md#3-the-flow
  // CO-409 wave 2: a board request no session answers starts a run of the default agent, behind Settings' switch.
  const dispatcher = wireBoardDispatch({
    estateId: ACTIVE_ESTATE,
    comms: sweepBoard,
    repos: projectRepos,
    sessionLive: (projectId) => sessionLiveForDispatch(heldSessions(projectId), Date.now(), SESSION_STALE_MS),
    // 2026-11-12 (C1): on a board another machine's Fabric may also read, only the machine named for it dispatches.
    switchOn: () => dispatcherRuns(readSettings(), ownsStack()),
    // 2026-11-12 (C2): a run here is judged on time awake; the power monitor's record of sleep, above.
    suspendedSince: d.clock.suspendedSince,
    // CO-551, stage A: the machine Settings names for runs (none by default), and the operator's board door to post a
    // run's answer from there as the request's target Project.
    // 2026-11-11: by the owner of the project's repository (`dispatchTargets`), else `dispatchTarget`.
    remoteTarget: async (projectId) => {
      const s = readSettings()
      // A folder that cannot be read takes the one `dispatchTarget`, as an owner the map does not name does.
      const folder = Object.keys(s.dispatchTargets).length ? await primaryFolder(projectRepos, projectId).catch(() => null) : null
      return remoteTargetFor(folder, s.dispatchTargets, s.dispatchTarget)
    },
    board: (projectId) => surface.operatorBoard(projectId, OPERATOR_ACTOR.id),
    quitting: () => quit.quitting,
    freeDisk: () => freeDiskNow(),
    file: path.join(d.userData, 'board-dispatches.json'),
    env: process.env,
    log: (op, outcome, detail) => ops.record({ op, outcome, level: outcome === 'ok' ? 'info' : 'warn', detail, ctx: { correlationId: ops.correlate() } }),
    // §3.11, the board supervisor (the operator, 2026-11-16): work a session left open is continued by a new run, while
    // «Продолжать начатую работу без меня» is on (by default).
    resume: {
      on: () => readSettings().resumeLeftWork,
      // DA-1 (0.3.22 review, iteration 2): only work left since the supervisor began on this machine is continued.
      read: (now, requestState) => readResumeCandidates(store, now, requestState, resumeSince(path.join(d.userData, 'resume-since.json'), now, (e) => ops.failed('board.resume-since', e, { note: 'the supervisor keeps its start in memory until Fabric quits' }))),
      state: (taskId, releasedAt) => readResumeState(store, taskId, releasedAt),
      // §3.12: a task whose session Switchboard will resume after a usage limit waits for that session.
      limitStops: () => readMachineLimitStops(sessionEnvironment(process.env))
    },
    // T5 (the turn-end spec §4.3): a run on another machine asks a person through the project's question, as
    // fabric_question_ask does; «Нужны вы» shows it and the people-ask bridge carries it to the PM agent.
    questions: createRemoteQuestions({ store, append: (e) => journal.append(e), estateId: ACTIVE_ESTATE, clean: cleanOriginalText })
  })
  boardState.dispatcher.set(dispatcher)
  quit.onQuit(() => { void dispatcher.close() })
  boardState.dispatchWake.set(createDispatchWake(() => { if (!quit.quitting) void dispatcher.onPass() }))
  quit.onQuit(() => boardState.dispatchWake.get()?.stop())
  // CO-559 (§3.8): the dispatcher watches on its own 30 s cadence, beside the cycle and never inside its window (a start
  // can wait on Switchboard for a minute; its own guard keeps one pass at a time).
  const dispatchWatch = setInterval(() => { if (!quit.quitting) void dispatcher.onPass() }, WATCH_MS)
  dispatchWatch.unref?.()
  quit.onQuit(() => clearInterval(dispatchWatch))
  // #endregion board-dispatch-cycle

  // #region people-ask-wiring — docs: docs/evidence/specs/2026-11-16-people-ask-bridge.md#4-the-pass
  // Task 11ebbf83 (the operator, 2026-11-16): «Нужны вы» decided from Telegram through the organization's PM agent. Its own
  // pass beside the dispatcher, one at a time; every decision goes through the door the window's button calls.
  const peopleFile = path.join(d.userData, 'people-asks.json')
  let peopleProjects: { at: number; rows: Array<{ id: string; name: string; business: string | null; status: string | null }> } | null = null
  const peopleProjectRows = async (): Promise<Array<{ id: string; name: string; business: string | null; status: string | null }>> => {
    if (peopleProjects && Date.now() - peopleProjects.at < 60_000) return peopleProjects.rows
    const { data, error } = await store.select('projects', 'id,name,business,status').eq('estate_id', ACTIVE_ESTATE)
    if (error) throw new Error(`the projects could not be read: ${error.message}`)
    peopleProjects = { at: Date.now(), rows: (data ?? []) as Array<{ id: string; name: string; business: string | null; status: string | null }> }
    return peopleProjects.rows
  }
  const peopleRoutesFile = path.join(d.userData, 'people-ask-routes.json')
  let peopleRoutesUnread = false
  const peopleFactsOf = async (row: { id: string; name: string; business: string | null }): Promise<ProjectFacts> => {
    const folder = await primaryFolder(projectRepos, row.id).catch(() => null)
    const origin = folder ? await cachedOrigin(folder) : null
    return { id: row.id, name: row.name, business: row.business ?? null, owner: origin ? remoteOwnerOf(origin) : null }
  }
  // BoardDecisions (ADR-0195 W2a.4): an answer from Telegram is applied through the doors the window's buttons call,
  // given here by the process that runs the cycle.
  const peopleDoors = createPeopleApply(d.decisions)
  const peopleAsk = createPeopleAskBridge({
    now: () => Date.now(),
    // As the dispatcher (C1): on a board another machine's Fabric may also read, only the machine named for it runs.
    switchOn: () => { const s = readSettings(); return s.peopleAsk !== false && (ownsStack() || s.dispatchOnSharedBoard) },
    quitting: () => quit.quitting,
    readItems: d.personItems,
    async projectOf(entry): Promise<ProjectFacts | null> {
      const rows = await peopleProjectRows()
      const named = entry.access ? (entry.access.enroll?.projectName ?? entry.access.respond?.projectName ?? null) : null
      const row = entry.projectId ? rows.find((r) => r.id === entry.projectId)
        : named ? rows.find((r) => r.name === named && r.status !== 'archived') : undefined
      return row ? peopleFactsOf(row) : null
    },
    async projectFacts(projectId) {
      const row = (await peopleProjectRows()).find((r) => r.id === projectId)
      return row ? peopleFactsOf(row) : null
    },
    // The routes this machine holds (they name private organizations, so they never live in this repository).
    routes: () => {
      let text: string
      try { text = readFileSync(peopleRoutesFile, 'utf8') } catch {
        // No file: the routes this repository may name, and the PM projects found by their own responder.
        return routesOf(undefined)
      }
      try { return routesOf(JSON.parse(text)) } catch {
        if (!peopleRoutesUnread) { peopleRoutesUnread = true; ops.record({ op: 'people.ask.routes-unread', outcome: 'failed', level: 'warn', detail: { note: 'people-ask-routes.json is not JSON; the defaults are used' }, ctx: { correlationId: ops.correlate() } }) }
        return routesOf(undefined)
      }
    },
    async allowAccess(requestId) {
      const row = await d.accessRequest(requestId)
      if (!row) return false
      const read = readSettingsState()
      return admitAccessAct({ verb: 'allow', request: { callee: row.callee, capabilities: row.capabilities, asked_by_binding: row.asked_by_binding },
        callerBindingId: null, machineTrust: read.status === 'unreadable' ? null : read.value.machineTrust }).ok
    },
    async responders() {
      const r = await sweepBoard.responders(ACTIVE_ESTATE)
      if (!r.ok) throw new Error(`the board's responders could not be read: ${r.error.message}`)
      return r.responders
    },
    epoch: (project) => surface.operatorBoard(project, OPERATOR_ACTOR.id).epoch(),
    submit: (project, input) => surface.operatorBoard(project, OPERATOR_ACTOR.id).submit(input),
    reply: (project, input) => surface.operatorBoard(project, OPERATOR_ACTOR.id).reply(input),
    cancel: (project, input) => surface.operatorBoard(project, OPERATOR_ACTOR.id).cancel(input),
    async thread(threadId) {
      // Through the operator's read door, at most five pages of 100: a people-ask thread holds a request and its answers.
      const out = []
      let after = 0
      for (let page = 0; page < 5; page++) {
        const r = await sweepBoard.list(ACTIVE_ESTATE, threadId, after, 100)
        if (!r.ok) throw new Error(`the thread could not be read: ${r.error.message}`)
        out.push(...r.messages)
        if (!r.more) break
        after = r.lastSeq
      }
      return out
    },
    apply: peopleDoors,
    load() {
      let text: string
      try { text = readFileSync(peopleFile, 'utf8') } catch {
        // No file yet (first run): nothing was asked that this process must remember.
        return []
      }
      return JSON.parse(text) as unknown
    },
    save(records: AskRecord[]) {
      // Written whole, synced, then renamed over the old file, as board-dispatches.json: never a torn file.
      const tmp = `${peopleFile}.tmp`
      const fd = openSync(tmp, 'w', 0o600)
      try { writeSync(fd, JSON.stringify(records.filter(isAskRecord))); fsyncSync(fd) } finally { closeSync(fd) }
      renameSync(tmp, peopleFile)
    },
    log: (op, outcome, detail) => ops.record({ op, outcome, level: outcome === 'ok' ? 'info' : 'warn', detail, ctx: { correlationId: ops.correlate() } })
  })
  const peopleWatch = setInterval(() => { if (!quit.quitting) void peopleAsk.onPass() }, PEOPLE_ASK_WATCH_MS)
  peopleWatch.unref?.()
  quit.onQuit(() => clearInterval(peopleWatch))
  // #endregion people-ask-wiring

  // #region ops-digest-send-wiring — docs: docs/evidence/specs/2026-11-04-agents-logs-and-the-improvement-loop.md#23-logs-read-every-hour-and-every-day-and-the-improvement-loop-co-500-co-502-co-503
  // CO-503: the closed days' digests go to Observatory once an hour, under the operator's ops.digest.record binding.
  const digestToken = path.join(d.userData, BINDING_TOKEN_FILE)
  const digestObservatory = createObservatoryClient(
    async () => findObservatoryServer(await findOnPath('project-observatory', await widenProbePath(process.env.PATH ?? '', process.env))),
    60_000,
    ['--binding-token-file', digestToken]
  )
  const digestSender = createOpsDigestSender({ tokenFile: digestToken, call: digestObservatory.call })
  const digestSend = createOpsDigestPass({
    ready: digestSender.ready,
    pass: createOpsDigestCollector({
      ownDir: path.join(d.userData, 'digests'),
      servicesDir: registryDirs().services,
      send: digestSender.send,
      accepts: digestSender.accepts
    }).pass,
    log: (outcome, detail) => ops.record({ op: 'ops.digest-send', outcome, level: outcome === 'failed' ? 'warn' : 'info', detail, ctx: { correlationId: ops.correlate() } })
  })
  quit.onQuit(() => { void digestObservatory.close() })
  // #endregion ops-digest-send-wiring

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
    // CO-503: beside the cycle too; at most once an hour, its own guard keeps one collection at a time.
    if (!quit.quitting) void digestSend.onPass()
    // CO-500: an hour the clock has passed closes even when nothing was recorded since.
    try {
      d.opsDigest()?.tick()
    } catch (e) {
      ops.failed('ops.digest-tick', e, { note: 'the hourly reading of the log did not close this pass' })
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
  return { admitExisting }
}
// #endregion board-cycle
