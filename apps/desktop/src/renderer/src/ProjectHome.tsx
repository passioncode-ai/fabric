import { FALLBACK_OPTION, useFallbackChoice } from './useFallbackChoice'
import { useEffect, useRef, useState } from 'react'
import {
  conflictOf,
  draftOf,
  isDirty,
  landed,
  type SettingsField,
  type ProjectSettingsWrite
} from '../../shared/projectSettings.ts'
import { markOf, type FeedMarks } from '../../shared/feedMarks.ts'
import type {
  RoutineRow,
  AutomationStateRow,
  AgentClaim,
  FeedEvent,
  LaunchOption,
  MemoryFact,
  ProjectRow,
  ProjectStats,
  Quota,
  RepoRow,
  RepoState,
  SessionTranscript,
  TaskRow,
  TerminalSession
} from '../../shared/types'
import { affects, POLL_MS } from '../../shared/repoWatch'
import { failed, forSubject, pending, settled, type KeyedRead } from '../../shared/keyedRead'
import { factsSubject, type FactsQuery } from '../../shared/factsQuery'
import { isTrustworthy, type RunStatusView } from '../../shared/runStatus'
import type { TaskList } from '../../shared/types'
import type { EntityRef } from '../../shared/entityRef.ts'
import {
  INSIGHT_CATEGORIES,
  corrected,
  describeCorrection,
  type Correction,
  type InsightCategory
} from '../../shared/memoryContract.ts'
import { Feed } from './Feed'
import { CreatedAgents } from './CreatedAgents'
import {
  Banner,
  Board,
  BoardColumn,
  Button,
  Caret,
  Claim,
  EmptyState,
  Field,
  FileTree,
  Panel,
  Row,
  StateChip,
  type ChipTone,
  Stat,
  StatStrip,
  StatusBar,
  StatusCell,
  StatusDot,
  Tail,
  TaskCard,
  Tick,
  Toolbar
} from './components'
import { sessionTone } from './sessionTone'
import { SessionStop, StopStatus } from './SessionStop'
import { useT } from './i18n'
import { Tasks } from './Tasks'
import type { TaskDraft } from '../../shared/taskDraft.ts'
import { TaskPage } from './TaskPage'
import { PlanSection } from './PlanSection'
import { DecisionsSection } from './DecisionsSection'
import { HarnessSection } from './HarnessSection'
import { BoardPanel } from './BoardPanel'
import { RetroSection } from './RetroSection'
import { DiagnosticsSection } from './DiagnosticsSection'
import { MemoryOverviewSection } from './MemoryOverviewSection'
import { DigestSection } from './DigestSection'
import { since, since as ago, until as ahead } from './duration'
import { runnerLabel } from './runnerLabel'
import { explainError } from './start/StartPaths'
import { ProjectLaunch } from './launch/ProjectLaunch'
import { go } from './evidence'
import { describeMove } from '../../shared/provenance.ts'
import { nextDue } from '../../shared/routine.ts'
import { isStuck } from '../../shared/automations.ts'
import { LADDER, mayMove, type TaskState } from '../../shared/ladder.ts'
import { wasRewritten, type PastContext } from '../../shared/pastContext.ts'
import { launchPlace } from '../../shared/launchPlace.ts'

export function ProjectHome({
  project,
  sessions,
  feed,
  marks,
  onChanged,
  onSessionsChanged,
  onOpenWorkspace,
  requestedTask,
  onTaskOpened,
  onOpenEntity,
  taskDraft,
  onTaskDraftChange,
  onError,
  onBoard,
  onPlan,
  onPulse
}: {
  project: ProjectRow
  /** Null until read (M108). Filtering a list you have NOT read leaves it
   *  unread — null in, null out — so a panel cannot mistake "no rows for this
   *  project" for "no answer yet". */
  sessions: TerminalSession[] | null
  feed: FeedEvent[] | null
  /** One monotonic mark per event family (FA-08). Monotonic, so panels keep
   *  refreshing after the displayed feed hits its cap (M42) — and per family,
   *  so a heartbeat does not refresh a panel that reads no agents. Each reader
   *  below names what it reads; `[]` means everything, unchanged. */
  marks: FeedMarks
  onChanged: () => Promise<void> | void
  onSessionsChanged: () => Promise<void> | void
  onOpenWorkspace: () => void
  /** A task the CEO panel asked for. Cleared once shown, so navigating away
   *  and back does not re-open it against the operator's wishes. */
  requestedTask?: string | null
  onTaskOpened?: () => void
  /** Where a retro source goes (M154). Through the shell, because a source may
   *  name a thing in another project and this component owns one. */
  onOpenEntity?: (projectId: string, ref: EntityRef) => void
  /** The instruction being typed, owned by the app so it survives this
   *  component being remounted per project (UX-01). */
  taskDraft?: TaskDraft | null
  onTaskDraftChange?: (patch: Partial<TaskDraft>) => void
  onError: (e: string) => void
  /** The Board scoped to this project, optionally opened at one item (SCR-41). */
  onBoard?: (projectId: string, item?: string) => void
  /** Planning scoped to this project (SCR-40). */
  onPlan?: (projectId: string) => void
  /** This project's pulse (SCR-42). */
  onPulse?: (projectId: string) => void
}): React.JSX.Element {
  const t = useT()
  /**
   * KEYED TO THE PROJECT (UX28-02). This read had no fence of any kind: a slow
   * answer for the project the operator had left arrived and was rendered under
   * the new project's name, and a failed refresh raised a banner while leaving
   * the previous project's repositories on screen as though they were this
   * one's. The subject is the project id, so neither is reachable.
   */
  const [reposRead, setReposRead] = useState<KeyedRead<RepoRow[]> | null>(null)
  const [stats, setStats] = useState<ProjectStats | null>(null)
  const [claims, setClaims] = useState<AgentClaim[]>([])
  const [transcripts, setTranscripts] = useState<SessionTranscript[] | null>(null)
  const [repoStates, setRepoStates] = useState<RepoState[] | null>(null)
  const [quota, setQuota] = useState<Quota | null>(null)
  /** Null until read, so the board can tell "nothing here" from "not read yet"
   *  — the distinction EmptyState exists to keep (M108). */
  const [tasks, setTasks] = useState<TaskRow[] | null>(null)
  /** Whether the finished half of the list was cut short (M190). A plan that
   *  counts from a capped read presents a floor as a total. */
  const [closedCoverage, setClosedCoverage] = useState<TaskList['closed'] | null>(null)
  /** A task the board asked the give-a-task panel to load again. */
  const [reuse, setReuse] = useState<{ instruction: string; optionId: string; nonce: number } | null>(
    null
  )
  /** The task the operator opened. While it is set the main column shows that
   *  one task instead of the board — a detail view rather than a new window,
   *  because a task belongs to the project it is on and losing that frame is
   *  how a board becomes a list of orphans. */
  const [openTask, setOpenTask] = useState<string | null>(null)
  // Opening a task, or leaving it, starts at the top of the page — not at the scroll position of
  // the row that was clicked, which would open the workspace in its middle.
  useEffect(() => {
    document.querySelector('.app-main')?.scrollTo?.({ top: 0 })
  }, [openTask])

  useEffect(() => {
    if (!requestedTask) return
    setOpenTask(requestedTask)
    onTaskOpened?.()
  }, [requestedTask])

  const loadRepos = async (): Promise<void> => {
    const at = project.id
    try {
      const value = await window.fabric.repos.list(at)
      setReposRead((cur) => settled(cur, { subject: at, value, at: Date.now() }))
    } catch (e) {
      setReposRead((cur) => failed(cur, { subject: at, why: String(e) }))
      onError(String(e))
    }
  }
  const loadStats = async (): Promise<void> => {
    try {
      setStats(await window.fabric.projects.stats(project.id))
    } catch (e) {
      onError(String(e))
    }
  }

  const loadTranscripts = async (): Promise<void> => {
    try {
      setTranscripts(await window.fabric.transcripts.list(project.id))
    } catch (e) {
      onError(String(e))
    }
  }

  const loadRepoStates = async (): Promise<void> => {
    try {
      setRepoStates(await window.fabric.projects.repoStates(project.id))
    } catch (e) {
      onError(String(e))
    }
  }

  const loadQuota = async (): Promise<void> => {
    // Never fails the page: a quota we cannot read is a missing cell, not an error.
    try {
      setQuota(await window.fabric.quota.read())
    } catch {
      setQuota(null)
    }
  }

  const loadClaims = async (): Promise<void> => {
    try {
      setClaims(await window.fabric.terminal.claims(project.id))
    } catch (e) {
      onError(String(e))
    }
  }

  const loadTasks = async (): Promise<void> => {
    try {
      const list = await window.fabric.tasks.list(project.id)
      setTasks(list.tasks)
      // Kept, so the plan can say "at least N of M" rather than presenting a
      // capped count as a total (M190).
      setClosedCoverage(list.closed)
    } catch (e) {
      onError(String(e))
    }
  }

  // SIX LOADERS, SIX CLOCKS (FA-08). They were one effect on the journal's
  // high-water mark, so any event ran all six — and `agent.heartbeat@1` arrives
  // per session per interval and changes none of their answers. Each now
  // follows the families that can change what it reads. The marks are
  // monotonic, so a panel keeps refreshing after the displayed feed hits its
  // cap (M42).
  //
  // Repository state is NO LONGER READ HERE (M107). It was, and that put it on
  // the wrong clock twice over: every two seconds while an agent journals, and
  // never at all when nothing does. It now has its own two sources below — the
  // watcher for what `.git` shows, and an interval for what it does not.
  const repoMark = markOf(marks, ['project'])
  const claimMark = markOf(marks, ['agent'])
  const transcriptMark = markOf(marks, ['transcript'])
  const taskMark = markOf(marks, ['task', 'work', 'question', 'goal'])
  // Statistics count across many tables, and the quota is not a projection of
  // this journal at all — it is a vendor's answer about an account, and it
  // follows the journal only because nothing else was offering it a clock.
  // Narrowing either would be naming a set I cannot check, so both stay on
  // everything; the quota's own clock is CO-135.
  const wideMark = marks.all

  useEffect(() => {
    void loadRepos()
  }, [project.id, project.config_revision, repoMark])
  useEffect(() => {
    void loadClaims()
  }, [project.id, sessions?.length, claimMark])
  useEffect(() => {
    void loadTranscripts()
  }, [project.id, sessions?.length, transcriptMark])
  useEffect(() => {
    void loadTasks()
  }, [project.id, taskMark])
  useEffect(() => {
    void loadStats()
    void loadQuota()
  }, [project.id, project.config_revision, sessions?.length, wideMark])

  /** What this page currently shows, for the watcher to compare against.
   *  A ref rather than a dependency: the subscription must survive a repository
   *  being attached, and re-subscribing on every reading would drop events in
   *  the gap between the two. */
  const repoPaths = useRef<string[] | null>(null)
  // Synced in an effect, never written during render: a render React throws
  // away would otherwise leave the ref holding a value from a pass that never
  // happened. The one-frame lag costs at most a single missed refresh, and the
  // interval below covers it.
  // `forSubject` here rather than the raw read: the paths this page SHOWS are
  // the ones for the project it is showing, and a reading left over from the
  // previous project would filter the watcher's events against the wrong list.
  const shownRepos = forSubject(reposRead, project.id).value
  useEffect(() => {
    repoPaths.current = shownRepos?.map((r) => r.path) ?? null
  }, [shownRepos])

  useEffect(() => {
    void loadRepoStates()
    // The watcher's channel — live at last (M107). It carries the path that
    // moved, and this page answers only for repositories it shows.
    const off = window.fabric.projects.onRepoChanged((repoPath) => {
      if (affects(repoPath, repoPaths.current)) void loadRepoStates()
    })
    // And an interval, because `.git` is watched non-recursively: a file EDITED
    // in the working tree touches nothing under `.git` and fires no event at
    // all. Without this, an agent could rewrite twelve files while the strip
    // said "clean" — which is the defect M107 is named for, and the listener
    // alone does not fix it.
    const every = setInterval(() => {
      // A window nobody is looking at reads nothing. The next tick after it is
      // shown again is at most POLL_MS away, and `visibilitychange` below makes
      // that immediate.
      if (document.visibilityState === 'visible') void loadRepoStates()
    }, POLL_MS)
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void loadRepoStates()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      off()
      clearInterval(every)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [project.id])

  /** The detailed sections below the launch layout, reached by the navigation and the layout's links. */
  const toSection = (anchor: string): void => {
    setOpenTask(null)
    setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' }), 0)
  }
  const lastEventAt = (feed ?? []).reduce<string | null>((at, e) => (e.project_id === project.id && (!at || e.occurred_at > at) ? e.occurred_at : at), null)
  // SCR-39: an open task is the agent workspace, the whole page — as the design draws it — not a
  // column beside the project's other sections.
  if (openTask)
    return (
      <div className="project-home">
        <TaskPage
          project={project}
          taskId={openTask}
          onBack={() => setOpenTask(null)}
          onChanged={loadTasks}
          onError={onError}
          // The sibling list is navigable or it is a printout. TaskPage reloads on `taskId`.
          onOpenTask={setOpenTask}
        />
      </div>
    )
  return (
    <div className="project-home">
      {!openTask && (
        <ProjectLaunch
          project={project}
          tasks={tasks}
          sessions={sessions}
          feedMark={taskMark}
          lastEventAt={lastEventAt}
          onBoard={(item) => onBoard?.(project.id, item)}
          onPlan={() => onPlan?.(project.id)}
          onPulse={onPulse ? () => onPulse(project.id) : undefined}
          onOpenTask={setOpenTask}
          onNewTask={() => toSection('sec-tasks')}
          onSection={toSection}
        />
      )}
      {!openTask && (
        <section className="lp lp-journal-wide">
          <Panel id="sec-journal" title={t('launch.project.journalTitle')}>
            {/* THE NAVIGATOR THIS PAGE ALREADY HOLDS (UXA-C06): every row opens what it is about. */}
            <Feed events={feed} projects={[project]} compact onOpen={(id, ref) => onOpenEntity?.(id, ref)} />
          </Panel>
          <p className="lp-kicker lp-sections-kicker">{t('launch.project.allSections')}</p>
        </section>
      )}
      <ProjectHeader project={project} onChanged={onChanged} onError={onError} />
      <ProjectStatusBar
        stats={stats}
        repos={repoStates}
        quota={quota}
        running={sessions === null ? null : sessions.filter((s) => s.state === 'running').length}
      />
      <div className="project-columns">
        <div className="col-main">
          {openTask ? (
            <TaskPage
              project={project}
              taskId={openTask}
              onBack={() => setOpenTask(null)}
              onChanged={loadTasks}
              onError={onError}
              // The sibling list is navigable or it is a printout. TaskPage
              // reloads on `taskId`, so this is the whole of it.
              onOpenTask={setOpenTask}
            />
          ) : (
            <>
              <Tasks
                project={project}
                draft={taskDraft ?? null}
                onDraftChange={onTaskDraftChange}
                onStarted={onSessionsChanged}
                onError={onError}
                reuse={reuse}
                onReuseHandled={() => setReuse(null)}
                // Task work AND the agents created here: this screen offers
                // presets read from the board and a list of created agents, so
                // it is news of both that must reach it.
                feedMark={markOf(marks, ['task', 'work', 'question', 'goal', 'agent'])}
              />
              <DigestSection project={project} feedMark={wideMark} onError={onError} />
              <BoardPanel projectId={project.id} limit={10} feedMark={taskMark} />
              <MemoryOverviewSection project={project} feedMark={markOf(marks, ['memory'])} />
              <DecisionsSection project={project} feedMark={markOf(marks, ['memory'])} onError={onError} />
              {/* M154 — the reading half. Findings and traps have been written
                  since M149 and rendered by nothing; this is the first surface
                  that asks for them BY KIND. */}
              <RetroSection
                projectId={project.id}
                feedMark={markOf(marks, ['memory'])}
                onOpen={(id, ref) => onOpenEntity?.(id, ref)}
                onError={onError}
              />
              <PlanSection
                project={project}
                feedMark={taskMark}
                tasks={tasks}
                closedCoverage={closedCoverage}
                onChanged={loadTasks}
                onError={onError}
              />
              <BoardSection
                projectId={project.id}
                tasks={tasks}
                onMoved={loadTasks}
                onOpen={setOpenTask}
                onReuse={(task) =>
                  setReuse({
                    instruction: task.instruction,
                    optionId: task.option_id,
                    nonce: Date.now()
                  })
                }
              />
            </>
          )}
          <AgentsSection
            project={project}
            sessions={sessions}
            claims={claims}
            onSessionsChanged={onSessionsChanged}
            onError={onError}
          />
          <TranscriptsSection transcripts={transcripts} onError={onError} />
          <Collapsible title={t('files.title')} defaultOpen={false} id="sec-files">
            <FileTree root={project.repo_path} />
          </Collapsible>
          <Collapsible title={t('automations.title')} defaultOpen={false} id="sec-automations">
            <Automations project={project} onError={onError} />
          </Collapsible>
        </div>
        <div className="col-side">
          <HarnessSection project={project} feedMark={markOf(marks, ['grant', 'policy', 'effect'])} onError={onError} />
          <DiagnosticsSection />
          <ReposSection
            project={project}
            read={forSubject(reposRead, project.id)}
            onChanged={async () => {
              await loadRepos()
              await onChanged()
            }}
            onError={onError}
          />
          <Panel
            title={t('workspace.title')}
            actions={
              <Button tone="ghost" onClick={onOpenWorkspace}>
                {t('workspace.open')}
              </Button>
            }
          >
            <p className="muted">{t('workspace.hint')}</p>
          </Panel>
          <MemorySection project={project} onError={onError} />
        </div>
      </div>
    </div>
  )
}

/**
 * The board (M146 step 2) — READ-ONLY, and a projection of the journal rather
 * than a second store. Nothing here was typed twice: every card is a row of
 * `project_tasks`, which is itself replayed from events.
 *
 * IT FOLLOWS THE JOURNAL FOR FREE. The effect that loads it depends on
 * `feedMark`, the journal's high-water mark — so when an agent moves a task
 * through the surface, the next event bumps the mark and the board refetches.
 * There is no subscription to maintain and no polling to tune, because the feed
 * already had to solve this.
 *
 * FOUR COLUMNS, FIVE STATES. `cancelled` sits in `done` rather than in a column
 * of its own, carrying its reason on the card. A fifth column would spend a
 * quarter of the width on outcomes nobody is working on; hiding them entirely
 * would lose the reason, which is the one thing a cancellation is for.
 *
 * WHAT A CLICK MEANS, until step 5 gives every task a page: the useful thing
 * available in that column. A live card opens its session; a closed card offers
 * its instruction again. Both are replaced by the task page, and this comment
 * is the note that they are a stopgap rather than a design.
 */
export function BoardSection({
  projectId,
  tasks,
  onReuse,
  onMoved,
  onOpen
}: {
  projectId: string
  tasks: TaskRow[] | null
  onReuse: (task: TaskRow) => void
  onMoved: () => Promise<void>
  /** Opening a task now means ONE thing, which is what step 2's comment said
   *  would replace its two-meanings stopgap: the task page. Running a closed
   *  task again moved onto that page with everything else about the task. */
  onOpen: (taskId: string) => void
}): React.JSX.Element {
  const t = useT()
  const [dragging, setDragging] = useState<TaskRow | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<TaskRow | null>(null)
  /** M134 — what the operator is typing into the backlog before it is work. */
  const [idea, setIdea] = useState('')
  const [filing, setFiling] = useState(false)
  const [reason, setReason] = useState('')
  /**
   * Where a card has been moved to but the projection has not caught up.
   *
   * A separate map rather than a mutation of the rows, because an optimistic
   * state that cannot be withdrawn is a lie with no end. It is withdrawn on a
   * refusal, on a REJECTION (UX28-04 — that path had no `catch` at all), and
   * the moment the record disagrees with the guess in any direction.
   *
   * `from` is carried with `to` for the last of those. The settle rule used to
   * be "drop it when the row reaches the target", which keeps the guess alive
   * for every outcome that is not the target — including the two that matter:
   * somebody else moved the task somewhere THIRD, and the row left the list
   * entirely and came back. In both the operator's stale guess went on
   * overriding the record. The rule is now the other way round: the guess
   * survives only while the record still shows what it showed when the guess
   * was made.
   */
  const [moving, setMoving] = useState<Record<string, { from: TaskState; to: TaskState }>>({})
  /** Tasks with a command in flight. One task, one command: two answers for one
   *  card are reconciled in whatever order they arrive, so the later one wins
   *  by accident rather than by being later. */
  const [inFlight, setInFlight] = useState<readonly string[]>([])

  const read = tasks !== null
  const rows = (tasks ?? []).map((task) =>
    moving[task.id] ? { ...task, status: moving[task.id].to } : task
  )

  useEffect(() => {
    if (!tasks || Object.keys(moving).length === 0) return
    // THE RECORD OUTRANKS THE GUESS. A guess is kept only while the row still
    // reads as it did when the guess was made — so reaching the target drops
    // it, a third state drops it, and a row that has left the list drops it
    // rather than waiting forever for a target it will never report.
    const pending = Object.fromEntries(
      Object.entries(moving).filter(([id, move]) => tasks.find((x) => x.id === id)?.status === move.from)
    )
    if (Object.keys(pending).length !== Object.keys(moving).length) setMoving(pending)
  }, [tasks])

  /** Put the card back where the record has it, and stop holding the lock. */
  const withdraw = (taskId: string, why: string): void => {
    setMoving((m) => {
      const next = { ...m }
      delete next[taskId]
      return next
    })
    setProblem(why)
  }

  const apply = async (task: TaskRow, to: TaskState, why?: string): Promise<void> => {
    // One command per card. The control is disabled too, so this is the second
    // lock rather than the only one — a disabled control can still be driven
    // by a fast double event, and an interface should not be the only thing
    // standing between one intention and two commands.
    if (inFlight.includes(task.id)) return
    setProblem(null)
    setMoving((m) => ({ ...m, [task.id]: { from: task.status, to } }))
    setInFlight((f) => [...f, task.id])
    try {
      const result =
        to === 'done' || to === 'cancelled'
          ? await window.fabric.tasks.close(task.id, to, why)
          : await window.fabric.tasks.move(task.id, to)
      if (!result.ok) {
        // A REFUSAL: the command was understood and declined. The card goes
        // back AND the reason is shown — a silent revert is the defect an
        // optimistic interface is usually accused of; the revert is fine, the
        // silence is not.
        withdraw(task.id, result.reason)
        return
      }
      await onMoved()
    } catch (e) {
      // A REJECTION: the command never got an answer — the main process threw,
      // the transport died, the handler was not there. MEASURED (UX28-04):
      // this had no `catch`, and the call site is `void apply(...)`, so the
      // throw became an unhandled rejection, the optimistic entry was never
      // withdrawn, and the card sat in a column it never reached for the rest
      // of the session with nothing on screen to say so.
      //
      // A refusal and a rejection are different events. They end the same way:
      // the card is where the record says it is, and the operator is told.
      withdraw(task.id, String(e))
    } finally {
      setInFlight((f) => f.filter((id) => id !== task.id))
    }
  }

  const movesFor = (task: TaskRow): { value: string; label: string }[] =>
    LADDER[task.status]
      .filter((to) => mayMove('person', task.status, to).ok)
      .map((to) => ({
        value: to,
        label: to === 'cancelled' ? t('board.cancel') : t(`board.${to}` as 'board.backlog')
      }))

  const onPick = (task: TaskRow, to: string): void => {
    if (to === 'cancelled') {
      setReason('')
      setCancelling(task)
      return
    }
    void apply(task, to as TaskState)
  }

  const columns: { key: TaskState; label: string; empty: string; of: TaskRow[] }[] = [
    { key: 'backlog', label: t('board.backlog'), empty: t('board.emptyBacklog'), of: rows.filter((x) => x.status === 'backlog') },
    { key: 'running', label: t('board.running'), empty: t('board.emptyRunning'), of: rows.filter((x) => x.status === 'running') },
    { key: 'review', label: t('board.review'), empty: t('board.emptyReview'), of: rows.filter((x) => x.status === 'review') },
    { key: 'done', label: t('board.done'), empty: t('board.emptyDone'), of: rows.filter((x) => x.status === 'done' || x.status === 'cancelled') }
  ]

  const trailOf = (task: TaskRow): string | undefined => {
    if (task.status === 'backlog') return undefined
    if (task.status === 'cancelled')
      return t('board.cancelled', {
        reason: task.closed_reason ?? task.abandoned_reason ?? t('common.unknown')
      })
    if (task.status === 'done' && task.exit_code !== null)
      return t('board.exit', { code: task.exit_code })
    return t('board.ago', { time: since(task.finished_at ?? task.started_at, t) })
  }

  return (
    <Panel id="sec-board" title={t('board.title')} actions={<span className="muted">{t('board.legend')}</span>}>
      <p className="muted">{t('board.lede')}</p>
      {problem && (
        <Banner
          tone="warn"
          actions={<Button tone="ghost" onClick={() => setProblem(null)}>{t('common.keep')}</Button>}
        >
          {t('board.refused', { reason: problem })}
        </Banner>
      )}
      {/* CONFIRMED, AND THE RECORD HAS NOT CAUGHT UP (UX28-04). The command
          succeeded; the refetch after it may not have. Saying so is not the
          same as claiming the command failed, and the difference matters: one
          means "look again", the other means "it did not happen". The retry
          reconciles rather than re-issuing the command — re-sending a command
          that already succeeded is how one intention becomes two.
          `inFlight.length === 0` is what stops this being noise: while a
          command is unresolved the card is simply in flight, and a line that
          flashed on every successful move would train the operator to ignore
          the one time it means something. So it appears only once a command
          has SETTLED and the record still disagrees. */}
      {Object.keys(moving).length > 0 && inFlight.length === 0 && (
        <p className="muted" data-testid="board-unconfirmed">
          {t('board.unconfirmed', { count: Object.keys(moving).length })}{' '}
          <Button tone="ghost" data-testid="board-reconcile" onClick={() => void onMoved()}>
            {t('board.reconcile')}
          </Button>
        </p>
      )}
      {cancelling && (
        <Banner
          tone="warn"
          actions={
            <>
              <Button tone="ghost" onClick={() => setCancelling(null)}>{t('common.keep')}</Button>
              <Button
                tone="danger"
                onClick={() => {
                  const task = cancelling
                  setCancelling(null)
                  void apply(task, 'cancelled', reason)
                }}
              >
                {t('board.cancelConfirm')}
              </Button>
            </>
          }
        >
          <Field label={t('board.cancelReason')} hint={t('board.cancelHint')}>
            {(id) => (
              <input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />
            )}
          </Field>
        </Banner>
      )}
      {/* THE DOOR ONTO THE BOARD IS ALWAYS THERE (S01). It used to live inside
          the backlog COLUMN, which only renders once a task already exists — so
          a person with an empty project and an idea had nowhere to put it, and
          the empty state told them the board was empty without offering the one
          act that would change that. */}
      <Toolbar>
          <Field label={t('board.ideaLabel')}>
            {(id) => (
              <input
                id={id}
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder={t('board.ideaPlaceholder')}
              />
            )}
          </Field>
          <Button
            tone="quiet"
            disabled={!idea.trim() || filing}
            onClick={() => {
              const text = idea
              setFiling(true)
              void window.fabric.tasks
                .fileIdea(projectId, text)
                .then(async () => {
                  setIdea('')
                  await onMoved()
                })
                .catch((e) => setProblem(String(e)))
                .finally(() => setFiling(false))
            }}
          >
            {t('board.ideaFile')}
          </Button>
        </Toolbar>

      {read && rows.length === 0 ? (
        <EmptyState read={read}>{t('board.empty')}</EmptyState>
      ) : (
        <Board>
          {columns.map((column) => {
            const droppable =
              dragging !== null &&
              column.key !== dragging.status &&
              mayMove('person', dragging.status, column.key).ok
            return (
              <BoardColumn
                key={column.key}
                title={column.label}
                count={column.of.length}
                read={read}
                empty={column.empty}
                onDrop={
                  droppable
                    ? () => {
                        const task = dragging
                        setDragging(null)
                        onPick(task, column.key)
                      }
                    : undefined
                }
              >
                {/* M134 — the operator's own door onto the board. It is HERE
                    rather than beside the run field because the two acts are
                    different: that one starts a session, this one records a
                    thought and starts nothing. */}
                {column.of.map((task) => {
                  const closed = task.status === 'done' || task.status === 'cancelled'
                  return (
                    <TaskCard
                      key={task.id}
                      title={task.title ?? task.instruction}
                      origin={
                        task.origin_kind === null || task.origin_kind === 'person'
                          ? t('board.byPerson')
                          : t('board.byAgent')
                      }
                      by={
                        task.assigned_by && task.assigned_to
                          ? t('board.handoff', { by: task.assigned_by, to: task.assigned_to })
                          : null
                      }
                      trail={trailOf(task)}
                      note={(() => {
                        // M124 — the mover decides what this column is saying.
                        // `describeMove` is quiet everywhere it would add
                        // nothing, so this is not a line under every card.
                        const n = describeMove(task.status, task.moved_by_kind)
                        return n ? { text: t(n.key), warn: n.contradiction } : null
                      })()}
                      quiet={closed}
                      moves={movesFor(task)}
                      moveLabel={t('board.move')}
                      // One card, one command. The lock is per TASK, not per
                      // board: a slow command on one card must not stop the
                      // operator working on another.
                      moveBusy={inFlight.includes(task.id)}
                      onMove={(to) => onPick(task, to)}
                      onDragStart={closed ? undefined : () => setDragging(task)}
                      onOpen={() => onOpen(task.id)}
                    />
                  )
                })}
              </BoardColumn>
            )
          })}
        </Board>
      )}
    </Panel>
  )
}

/** A narrow line of facts that navigates: each cell scrolls to the section it
 *  counts, so the strip is a way in rather than a display case. */
/**
 * The status bar (M57) — one line, replacing a five-card grid that spent ~90px
 * saying two useful things and three about Fabric's own bookkeeping.
 *
 * What changed is not the density. `Memory facts` and `Journal events` measure
 * OUR STORE; an operator never asks those, and they moved to diagnostics. What
 * an operator does ask — what is the code doing, is anything blocked, how much
 * quota is left — was on no screen at all.
 *
 * The rule this component holds: **a cell with no source is absent, not zero.**
 * A dash reads as "nothing"; a zero reads as a measurement. Neither is true of
 * something we cannot see.
 */
/** Exported for its own test. The three numbers below were each measured,
 *  cached and unit-tested from the day their milestone shipped and rendered by
 *  NOBODY — a reader test stays green through exactly that, which is how the
 *  board came to be more generous than the product (M113). */
export function ProjectStatusBar({
  stats,
  repos,
  quota,
  running,
  blocked
}: {
  stats: ProjectStats | null
  repos: RepoState[] | null
  quota: Quota | null
  /**
   * Null until the session list has been read (M108, UXA-C05).
   *
   * It was a plain number fed `(sessions ?? []).filter(…).length`, and the cell
   * below renders "no agents running" for zero — so the first paint stated, as
   * a fact, that nothing was running in a project nobody had looked at. The
   * argument against that is in this very prop list, about the field directly
   * beneath: `blocked` is optional on purpose because "a hardcoded zero renders
   * as 'nothing is blocked', which is a measurement nobody took". One value
   * away, the same mistake was the default.
   */
  running: number | null
  /**
   * Absent until a session can actually report itself blocked (M51). It is
   * OPTIONAL rather than defaulted to zero on purpose: a hardcoded zero renders
   * as "nothing is blocked", which is a measurement nobody took, and it would go
   * on reading zero after M51 lands with nobody noticing the cell had died.
   */
  blocked?: number
}): React.JSX.Element {
  const t = useT()
  // `go` was local here and swallowed a missing target with `?.`. It lives in
  // `evidence.ts` now, reports a miss, and takes only anchors that exist —
  // M142's rule needs one implementation, not one per screen.

  const primary = repos?.[0] ?? null
  const others = Math.max(0, (repos?.length ?? 0) - 1)

  // The shared formatter, not a copy of it: two copies are how "2m" starts meaning two things.
  const since = (iso: string | null, tr = t): string => (iso ? ago(iso, tr) : '')
  const until = (iso: string | null): string => (iso ? ahead(iso, t) : '')

  return (
    <StatusBar label={t('stats.title')}>
      <StatusCell onClick={go('sec-agents')}>
        <StatusDot live={running !== null && running > 0} />
        <Tick>
          {running === null
            ? t('status.agentsUnread')
            : running > 0
              ? t('status.running', { n: running })
              : t('status.idleAgents')}
        </Tick>
        {blocked !== undefined && blocked > 0 && (
          <StateChip tone="danger">{t('status.blocked', { n: blocked })}</StateChip>
        )}
      </StatusCell>

      {primary && (
        <StatusCell onClick={go('sec-files')}>
          {/* M109 — `RepoState.error` was produced by the reader and rendered by
              nobody, so a repository whose git call FAILED showed its stale
              branch with full confidence, indistinguishable from one that simply
              has no branch. A failed read is not a fact about the branch. */}
          {primary.error ? (
            <Tick mono>{t('status.repoUnreadable')}</Tick>
          ) : (
            <Tick mono>{primary.branch ?? t('status.noBranch')}</Tick>
          )}
          {!primary.error && primary.ahead !== null && primary.ahead > 0 && (
            <Tick mono>{t('status.ahead', { n: primary.ahead })}</Tick>
          )}
          {!primary.error && primary.behind !== null && primary.behind > 0 && (
            <Tick mono>{t('status.behind', { n: primary.behind })}</Tick>
          )}
          <Tick>
            {primary.changed === 0 && primary.untracked === 0
              ? t('status.clean')
              : t('status.changed', { n: primary.changed })}
          </Tick>
          {primary.untracked > 0 && <Tick muted>{t('status.untracked', { n: primary.untracked })}</Tick>}
          {/* M56 said "last commit and its age" and shipped 2026-09-01. It was
              measured, cached and unit-tested from that day, and rendered
              NOWHERE — the board said shipped and the screen said nothing
              (M113). Suppressed with the rest when the read failed: an age is
              as stale as the branch beside it. */}
          {!primary.error &&
            (primary.lastCommit ? (
              <>
                <Tick muted>{t('status.lastCommit', { age: since(primary.lastCommit.at, t) })}</Tick>
                {/* The subject as well as the age. "last commit 2h ago" says the
                    repository is alive; the subject says what it did, and M56
                    named both. Truncated because the strip is one line. */}
                {primary.lastCommit.subject && (
                  <Tick muted>
                    {primary.lastCommit.subject.length > 44
                      ? primary.lastCommit.subject.slice(0, 43) + '…'
                      : primary.lastCommit.subject}
                  </Tick>
                )}
              </>
            ) : (
              <Tick muted>{t('status.noCommits')}</Tick>
            ))}
          {others > 0 && <Tick muted>{t('status.moreRepos', { n: others })}</Tick>}
        </StatusCell>
      )}

      {/* Absent, not zero, when there is no source: CO-096 established that no
          per-project cost exists, and an account not signed in has no quota. */}
      {quota?.fiveHour && (
        <StatusCell
          onClick={go('sec-journal')}
          title={
            quota.problem
              ? t('status.quotaStale', { age: `${quota.ageSeconds}s` })
              : t('status.quotaResets', { time: until(quota.fiveHour.resetsAt) })
          }
        >
          <Tick muted={quota.problem !== null}>
            {t('status.quota5h', { pct: Math.round(quota.fiveHour.utilization) })}
          </Tick>
          {quota.sevenDay && (
            <Tick muted={quota.problem !== null}>
              {t('status.quota7d', { pct: Math.round(quota.sevenDay.utilization) })}
            </Tick>
          )}
        </StatusCell>
      )}

      {/* M57 — what the CODE is doing. The milestone was marked shipped naming
          five numbers and not one existed; two of the five are not shippable at
          all and the row now says so rather than claiming them (M113). */}
      {stats?.code &&
        (stats.code.error ? (
          <StatusCell quiet>
            <Tick muted>{t('stats.codeUnreadable')}</Tick>
          </StatusCell>
        ) : (
          <StatusCell onClick={go('sec-files')}>
            <Tick>
              {t('stats.commits', {
                n: stats.code.commits ?? 0,
                days: stats.code.windowDays
              })}
            </Tick>
            {(stats.code.linesAdded ?? 0) + (stats.code.linesRemoved ?? 0) > 0 && (
              <Tick mono muted>
                {t('stats.movedLines', {
                  added: stats.code.linesAdded ?? 0,
                  removed: stats.code.linesRemoved ?? 0
                })}
              </Tick>
            )}
            {stats.code.trackedLines !== null && (
              <Tick muted>
                {t('stats.tracked', {
                  lines: stats.code.trackedLines,
                  files: stats.code.trackedFiles ?? 0
                })}
              </Tick>
            )}
          </StatusCell>
        ))}

      {stats?.lastActivityAt && (
        <StatusCell quiet>
          <Tick>{t('status.lastActivity', { time: since(stats.lastActivityAt, t) })}</Tick>
        </StatusCell>
      )}
    </StatusBar>
  )
}

function Collapsible({
  title,
  defaultOpen,
  children,
  id
}: {
  title: string
  defaultOpen: boolean
  children: React.ReactNode
  /** Anchor, so the statistics strip can scroll to the panel a number refers to. */
  id?: string
}): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Panel id={id}>
      <Button
        tone="quiet"
        className="disclosure"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {title}
        <Caret open={open} />
      </Button>
      {open && children}
    </Panel>
  )
}

export function ReposSection({
  project,
  read,
  onChanged,
  onError
}: {
  project: ProjectRow
  /** The reading, not the rows — so this panel can tell "no repositories" from
   *  "the list could not be read", and cannot render another project's. */
  read: KeyedRead<RepoRow[]>
  onChanged: () => Promise<void> | void
  onError: (e: string) => void
}): React.JSX.Element {
  const t = useT()
  // `?? []` as everywhere else on this page, so the three states are told apart
  // by the READ and never by whether the payload happens to be null. Keeping
  // `null` here made the `ready` guard below unreachable — a guard that cannot
  // fire reads as protection and is not any, and the inconsistency is what
  // would eventually be "simplified" in the wrong direction.
  const repos = read.value ?? []
  const add = async (): Promise<void> => {
    try {
      const picked = await window.fabric.repos.choose()
      if (!picked.length) return
      await window.fabric.repos.attach(project.id, picked)
      await onChanged()
    } catch (e) {
      onError(explainError(e, t))
    }
  }
  return (
    <Panel
      id="sec-repos"
      title={t('onboarding.repos')}
      actions={
        <Button tone="ghost" onClick={() => void add()}>
          {t('onboarding.addRepo')}
        </Button>
      }
    >
      <div className="repo-list">
        {read.state === 'failed' && (
          <p className="read-failed" data-testid="repos-list-failed">
            {t('reads.failed', { why: read.failedWhy ?? '' })}
          </p>
        )}
        {read.state === 'loading' && (
          <EmptyState read={false} waiting={t('app.loading')}>
            {t('onboarding.noRepos')}
          </EmptyState>
        )}
        {read.state === 'ready' && repos.length === 0 && (
          <EmptyState read>{t('onboarding.noRepos')}</EmptyState>
        )}
        {repos.map((r) => (
          <Row key={r.id}>
            <span className="mono">{r.path}</span>
            {r.is_primary && <StateChip>{t('onboarding.primary')}</StateChip>}
            <Button tone="ghost"
              onClick={async () => {
                if (r.is_primary && !window.confirm(t('repos.detachPrimaryConfirm'))) return
                try {
                  await window.fabric.repos.detach(project.id, r.id)
                  await onChanged()
                } catch (e) {
                  onError(String(e))
                }
              }}
            >
              {t('onboarding.removeRepo')}
            </Button>
          </Row>
        ))}
      </div>
    </Panel>
  )
}

export function ProjectHeader({
  project,
  onChanged,
  onError
}: {
  project: ProjectRow
  onChanged: () => Promise<void> | void
  onError: (e: string) => void
}): React.JSX.Element {
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(project.name)
  const [purpose, setPurpose] = useState(project.purpose ?? '')
  const [agent, setAgent] = useState(project.default_agent)
  const [agents, setAgents] = useState<LaunchOption[]>([])
  /** M127 — what this project may reach, and what the machine offers. */
  const [servers, setServers] = useState<string[]>(project.mcp_servers ?? [])
  const [offer, setOffer] = useState<{ reachable: boolean; servers: string[] } | null>(null)
  const [busy, setBusy] = useState(false)
  /**
   * The revision these words were typed against (UX28-11).
   *
   * Held in state rather than read from props at click time, because props move
   * while a person types and the base of a compare-and-set must be the one they
   * were looking at. It advances only where the operator has SEEN what changed:
   * a committed save, or a conflict whose diff is on screen.
   */
  const [base, setBase] = useState(project.config_revision)
  const [outcome, setOutcome] = useState<ProjectSettingsWrite | null>(null)
  /** Set when the project moved underneath a dirty draft. Not a reset. */
  const [moved, setMoved] = useState<ProjectRow | null>(null)

  const draft = { name, purpose, defaultAgent: agent, mcpServers: servers }

  /**
   * A DIFFERENT PROJECT is a different subject, and only that resets the form.
   *
   * This effect used to run on `[project.id, project.config_revision]` and copy
   * the props back over every field — so a background agent changing this
   * project's configuration erased an operator's half-typed purpose, with no
   * banner and nothing to undo it. Measured by a probe that types half a
   * sentence and moves the revision underneath. UX28-02 keyed reads by their
   * subject; this is the same rule on the write side, and `shared/drafts.ts`
   * already stated it: a draft belongs to the thing it was written for.
   */
  useEffect(() => {
    const fresh = draftOf(project)
    setName(fresh.name)
    setPurpose(fresh.purpose)
    setAgent(fresh.defaultAgent)
    setServers(fresh.mcpServers)
    setBase(project.config_revision)
    setOutcome(null)
    setMoved(null)
  }, [project.id])

  /**
   * The ground moved. Say so; change nothing.
   *
   * A clean form takes the new values — there is nothing to lose and the panel
   * must not show stale ones. A DIRTY form keeps every word and learns that its
   * base is behind, so the next save is refused by the command with the newer
   * values to compare. That refusal is the point: the surface never decides for
   * itself that overwriting somebody is fine, and SCN-003 asks for exactly this
   * — "revision conflict shows the newer diff and asks the operator to reapply
   * the draft".
   */
  useEffect(() => {
    if (project.config_revision === base) return
    if (!isDirty(draft, project)) {
      const fresh = draftOf(project)
      setName(fresh.name)
      setPurpose(fresh.purpose)
      setAgent(fresh.defaultAgent)
      setServers(fresh.mcpServers)
      setBase(project.config_revision)
      setMoved(null)
      return
    }
    setMoved(project)
  }, [project.config_revision])

  useEffect(() => {
    window.fabric.terminal.options().then(setAgents).catch((e) => onError(String(e)))
    // M127 — what the machine gateway offers. Unreachable is a real answer and
    // the section says so rather than showing an empty list, which would read as
    // "the gateway has nothing" instead of "there is no gateway".
    window.fabric.gateway.offer().then(setOffer).catch(() => setOffer({ reachable: false, servers: [] }))
  }, [])

  /**
   * ONE command, carrying the revision these words were typed against.
   *
   * It used to be two — `projects.update` for name and purpose, then
   * `projects.updateSettings` for the agent and servers — inside one `try` with
   * one `catch`. Two appends are two revisions, and when the second failed the
   * first had already landed while the banner said the save had not worked.
   *
   * The panel closes only when the change is IN THE JOURNAL. A refusal, a
   * conflict and a failure all leave it open with every word still in it,
   * because each of them is something the operator has to decide about.
   */
  const save = async (): Promise<void> => {
    setBusy(true)
    setOutcome(null)
    try {
      const result = await window.fabric.projects.saveSettings({
        id: project.id,
        baseRevision: base,
        name,
        purpose,
        defaultAgent: agent,
        mcpServers: servers
      })
      setOutcome(result)
      if (result.status === 'conflict') {
        // The diff is now on screen, so the base may advance: the next press
        // writes the operator's words over ground they have seen.
        setBase(result.currentRevision)
        setMoved(result.currentValue)
      }
      if (landed(result)) {
        setBase(result.revision)
        setMoved(null)
        await onChanged()
        setEditing(false)
      }
    } catch (e) {
      // A rejected invoke is the one case the command could not answer for —
      // reported as itself rather than as a refusal.
      setOutcome({ status: 'failed', reason: String(e) })
      onError(String(e))
    } finally {
      setBusy(false)
    }
  }

  /** What the outcome has to say, and nothing it does not. */
  const notice = ((): { tone: 'warn' | 'bad'; text: string } | null => {
    const fields = (list: readonly SettingsField[]): string =>
      list.map((f) => t(`project.field.${f}` as 'project.field.name')).join(', ')
    if (outcome?.status === 'refused')
      return { tone: 'warn', text: t('project.saveRefused', { reason: outcome.reason }) }
    if (outcome?.status === 'failed')
      return { tone: 'bad', text: t('project.saveFailed', { reason: outcome.reason }) }
    if (outcome?.status === 'written')
      return {
        tone: 'warn',
        text: t('project.saveWritten', {
          n: outcome.revision,
          fields: fields(outcome.fields),
          reason: outcome.reason
        })
      }
    if (outcome?.status === 'conflict')
      return { tone: 'warn', text: t('project.saveConflict', { n: outcome.currentRevision }) }
    if (moved) return { tone: 'warn', text: t('project.groundMoved', { n: moved.config_revision }) }
    return null
  })()

  /** Yours against what is stored now — SCN-003's "newer diff". */
  const diff = moved ? conflictOf(draft, moved) : []

  const takeTheirs = (): void => {
    if (!moved) return
    const fresh = draftOf(moved)
    setName(fresh.name)
    setPurpose(fresh.purpose)
    setAgent(fresh.defaultAgent)
    setServers(fresh.mcpServers)
    setBase(moved.config_revision)
    setMoved(null)
    setOutcome(null)
  }

  if (!editing) {
    return (
      <header className="project-header" id="sec-project-settings">
        {/* THE NOTICE OUTLIVES THE FORM, and it has to. A save that landed and
            could not be read back closes the panel — the change IS in the
            journal — and its caveat belongs on the values it makes doubtful,
            not on the form that is no longer there. Found by the probe: the
            message was rendered only inside the editing branch, so the one
            outcome that says "what you are looking at may be stale" was the one
            outcome nobody could see. UX28-02's rule, arrived at from the write
            side. */}
        {notice && (
          <p role="alert" className={notice.tone === 'bad' ? 'banner bad' : 'banner warn'}>
            {notice.text}
          </p>
        )}
        <div>
          <h1>{project.name}</h1>
          <p className="muted">{project.purpose || t('project.noPurpose')}</p>
          <p className="muted mono">{project.repo_path ?? t('project.noRepo')}</p>
        </div>
        <Toolbar align="end">
          <span className="muted mono">{t('project.revision', { n: project.config_revision })}</span>
          <Button tone="ghost" onClick={() => setEditing(true)}>
            {t('project.settings')}
          </Button>
        </Toolbar>
      </header>
    )
  }

  return (
    <header className="project-header editing" id="sec-project-settings">
      {/* `role="alert"` rather than a `data-testid`: a hyphenated JSX attribute
          on a component is silently dropped by TypeScript (UX28-04), and the
          role is what a screen reader needs anyway. */}
      {notice && (
        <p role="alert" className={notice.tone === 'bad' ? 'banner bad' : 'banner warn'}>
          {notice.text}
        </p>
      )}
      {diff.length > 0 && (
        <table className="settings-diff">
          <thead>
            <tr>
              <th />
              <th>{t('project.yours')}</th>
              <th>{t('project.theirs')}</th>
            </tr>
          </thead>
          <tbody>
            {diff.map((row) => (
              <tr key={row.field}>
                <th scope="row">{t(`project.field.${row.field}` as 'project.field.name')}</th>
                <td>{row.yours}</td>
                <td>{row.theirs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {moved && (
        <Toolbar align="end">
          <Button tone="ghost" onClick={takeTheirs}>
            {t('project.useTheirs')}
          </Button>
        </Toolbar>
      )}
      <div className="edit-grid">
        <label>
          {t('onboarding.name')}
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          {t('onboarding.purpose')}
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        </label>
        <label>
          {t('onboarding.defaultAgent')}
          <select value={agent} onChange={(e) => setAgent(e.target.value)}>
            {agents.map((o) => (
              <option key={o.id} value={o.id} disabled={!o.available}>
                {runnerLabel(o.id, t)}
              </option>
            ))}
          </select>
        </label>
        {/* M127 — which of the machine's gateway servers this project's sessions
            may reach. Names only: no credential is stored by Fabric, and a
            granted server is reached through the gateway, which holds the
            upstream key. */}
        <label>
          {t('project.servers')}
          {offer === null ? (
            <span className="muted">{t('project.serversReading')}</span>
          ) : !offer.reachable ? (
            <span className="muted">{t('project.serversNoGateway')}</span>
          ) : offer.servers.length === 0 ? (
            <span className="muted">{t('project.serversNone')}</span>
          ) : (
            <span>
              {offer.servers.map((name) => (
                <label key={name}>
                  <input
                    type="checkbox"
                    checked={servers.includes(name)}
                    onChange={(e) =>
                      setServers((prev) =>
                        e.target.checked ? [...prev, name] : prev.filter((x) => x !== name)
                      )
                    }
                  />
                  <span className="mono">{name}</span>
                </label>
              ))}
            </span>
          )}
        </label>
      </div>
      <Toolbar align="end">
        <Button onClick={() => void save()} disabled={busy || !name.trim()}>
          {busy ? t('project.saving') : t('project.save')}
        </Button>
        <Button tone="ghost" onClick={() => setEditing(false)}>
          {t('project.cancel')}
        </Button>
      </Toolbar>
    </header>
  )
}

/** Exported for the launch-place probe, as `ProjectStatusBar`, `BoardSection`
 *  and `AgentTile` in this same file already are: the sentence about where an
 *  agent will start has to be watched on the screen that shows it, not only in
 *  the rule that decides it (UXA-C04). */
export function AgentsSection({
  project,
  sessions,
  claims,
  onSessionsChanged,
  onError
}: {
  project: ProjectRow
  /** Null until read (M108, UXA-C05). The parent collapsed it with `?? []` at
   *  the call site, so the `read={sessions !== null}` below could never be
   *  false and the waiting line it carries was unreachable copy. */
  sessions: TerminalSession[] | null
  claims: AgentClaim[]
  onSessionsChanged: () => Promise<void> | void
  onError: (e: string) => void
}): React.JSX.Element {
  const t = useT()
  const [options, setOptions] = useState<LaunchOption[]>([])
  // ADR-0125: offered when this computer has a fallback order, and chosen by default then — the
  // operator set the order to be used. A coding agent picked by name still runs exactly that agent.
  const fallback = useFallbackChoice(project.id, 'terminal')
  const fallbackDefaulted = useRef(false)
  /** The person chose in this picker: from then on nothing chooses for them (ADR-0125 §2). */
  const touched = useRef(false)
  useEffect(() => {
    if (fallback.configured && !fallbackDefaulted.current && !touched.current) { fallbackDefaulted.current = true; setChoice(FALLBACK_OPTION) }
    // The order was emptied while it was chosen: back to the project's coding agent, never a choice that no longer exists.
    if (!fallback.configured && choice === FALLBACK_OPTION) setChoice(project.default_agent)
  }, [fallback.configured])
  /** The create form must not call "no program available" before the options were read. */
  const [optionsRead, setOptionsRead] = useState(false)
  const [choice, setChoice] = useState(project.default_agent)
  const [busy, setBusy] = useState(false)
  /** Where a launch will land, by the SAME rule the main process applies. */
  const place = launchPlace(project.repo_path)

  useEffect(() => {
    window.fabric.terminal
      .options()
      .then((o) => {
        setOptions(o)
        setOptionsRead(true)
        const wanted = o.find((x) => x.id === project.default_agent && x.available)
        setChoice((current) => current === FALLBACK_OPTION ? current : (wanted ? wanted.id : (o.find((x) => x.available)?.id ?? project.default_agent)))
      })
      .catch((e) => onError(String(e)))
  }, [project.default_agent])

  const launch = async (): Promise<void> => {
    setBusy(true)
    try {
      const s = await window.fabric.terminal.open(project.id, choice)
      await onSessionsChanged()
      await window.fabric.windows.openSession(s.sessionId)
    } catch (e) {
      onError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel
      id="sec-agents"
      title={t('agents.title')}
      actions={
        <Toolbar>
          <select value={choice} onChange={(e) => { touched.current = true; setChoice(e.target.value) }}
            aria-label={t('agents.pickOption')}
          >
            {fallback.configured && <option value={FALLBACK_OPTION}>{fallback.label}</option>}
          {options.map((o) => (
              <option key={o.id} value={o.id} disabled={!o.available}>
                {runnerLabel(o.id, t)}
                {o.available ? '' : ` — ${t('onboarding.unavailable')}`}
              </option>
            ))}
          </select>
          <Button onClick={() => void launch()} disabled={busy || options.length === 0}>
            {busy ? t('agents.launching') : t('agents.launch')}
          </Button>
        </Toolbar>
      }
    >
      {/* M125 — agents created in this project. The form is HERE and not in a
          settings dialog because creating one is ordinary work, and because the
          servers it may ask for are the project's grant, which is a decision
          made a few lines away. */}
      {/* WHERE IT WILL START, before it starts (UXA-C04). The main process
          resolves this as the project's repository or, failing that, the
          operator's home folder — and the launcher used to show a dropdown and
          a button. An agent with write tools starting in someone's home
          directory is a thing they are entitled to be told BEFORE the click,
          and `launchPlace` is the same function the main process decides it
          with, so the sentence cannot drift from the behaviour. */}
      <p className={place.place === 'repository' ? 'muted mono' : 'muted'}>
        {place.place === 'repository'
          ? t('agents.startsIn', { path: place.path })
          : t('agents.startsInHome')}
      </p>
      <CreatedAgents project={project} options={optionsRead ? options : null} />
      {(sessions?.length ?? 0) === 0 && (
        <EmptyState read={sessions !== null} waiting={t('agents.reading')}>
          {t('agents.empty')}
        </EmptyState>
      )}
      <div className="agent-grid">
        {(sessions ?? []).map((s) => (
          <AgentTile
            key={s.sessionId}
            session={s}
            claim={claims.find((c) => c.sessionId === s.sessionId) ?? null}
            onSessionsChanged={onSessionsChanged}
            onError={onError}
          />
        ))}
      </div>
    </Panel>
  )
}

/**
 * What the sessions actually did (M45) — the OBSERVATION beside the agent's
 * claim on the tile above. The list is L0 and L1; the whole body is fetched only
 * when a reader asks, because a project's transcripts are the largest thing it
 * holds and nobody wants them all to open a page.
 */
function TranscriptsSection({
  transcripts,
  onError
}: {
  transcripts: SessionTranscript[] | null
  onError: (e: string) => void
}): React.JSX.Element {
  const t = useT()
  const [openId, setOpenId] = useState<string | null>(null)
  const [body, setBody] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  /**
   * WHAT THE SESSION WAS GIVEN, beside what it said (AX-04).
   *
   * The packet store has held these bytes since PF-05.02 and nothing read them
   * back — `readPart` had zero consumers in the repository, so the durable
   * answer to "what did this session run from" existed on disk while no path in
   * the product asked for it. This is that path.
   */
  const [context, setContext] = useState<PastContext | null>(null)

  const open = async (sessionId: string): Promise<void> => {
    if (openId === sessionId) {
      setOpenId(null)
      setBody(null)
      setContext(null)
      return
    }
    setOpenId(sessionId)
    setBody(null)
    setContext(null)
    setLoading(true)
    try {
      // Read together, because they answer one question between them: what the
      // session was given, and what it did with it.
      const [full, given] = await Promise.all([
        window.fabric.transcripts.get(sessionId),
        window.fabric.transcripts.context(sessionId)
      ])
      setBody(full?.body ?? '')
      setContext(given)
    } catch (e) {
      onError(String(e))
      setOpenId(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Collapsible title={t('transcripts.title')} defaultOpen={false} id="sec-transcripts">
      {transcripts === null ? (
        <EmptyState read={false} waiting={t('transcripts.loading')}>
          {t('transcripts.empty')}
        </EmptyState>
      ) : transcripts.length === 0 ? (
        <EmptyState read>{t('transcripts.empty')}</EmptyState>
      ) : (
        <div>
          {transcripts.map((tr) => (
            <div key={tr.sessionId}>
              <Row
                onClick={() => void open(tr.sessionId)}
                trail={tr.endingProvenance === 'unknown' || tr.truncated ? (
                  <StateChip tone="warn">{t(tr.endingProvenance === 'unknown' ? 'transcripts.endingUnknown' : 'transcripts.truncated')}</StateChip>
                ) : undefined}
              >
                <span className="mono">{tr.annotation}</span>
              </Row>
              {openId !== tr.sessionId && <Tail>{tr.excerpt}</Tail>}
              {openId === tr.sessionId && (
                <div className="transcript-body">
                  {loading ? (
                    <EmptyState read={false} waiting={t('transcripts.loading')}>
                      {t('transcripts.empty')}
                    </EmptyState>
                  ) : (
                    <>
                      {tr.endingProvenance !== 'observed' && <p className="muted">{t(tr.endingProvenance === 'unknown' ? 'transcripts.recoveredDetail' : 'transcripts.legacyDetail')}</p>}
                      <pre className="mono">{body}</pre>
                      {context && (
                        <div>
                          <h4>{t('context.title')}</h4>
                          {context.held ? (
                            <>
                              <p className="muted">
                                {t('context.identity', {
                                  chars: String(context.chars),
                                  sha: context.sha256.slice(0, 12)
                                })}{' '}
                                {t('context.exact')}
                              </p>
                              <pre className="mono">{context.bytes}</pre>
                            </>
                          ) : wasRewritten(context.why) ? (
                            // LOUDER than an absence, and deliberately so: a
                            // blob that no longer hashes to what the packet
                            // records means something rewrote the record, which
                            // is not the same event as losing it.
                            <Banner tone="warn">
                              {t('context.rewritten')} {context.says}
                            </Banner>
                          ) : (
                            <p className="muted">
                              {t('context.absent')} {context.says}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  <Toolbar align="end">
                    <Button tone="ghost" onClick={() => void open(tr.sessionId)}>
                      {t('transcripts.close')}
                    </Button>
                  </Toolbar>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Collapsible>
  )
}

/**
 * True when the agent's account is materially older than the last thing Fabric
 * OBSERVED from that session — the agent is working and has stopped saying so.
 * Two minutes, because a stage report is cheap and an agent that has not managed
 * one in that long is not narrating its work.
 */
function claimIsBehind(reportedAt: string, lastActivityAt: string): boolean {
  return new Date(lastActivityAt).getTime() - new Date(reportedAt).getTime() > 120_000
}

/**
 * Agents created in this project, and the form that creates one (M125).
 *
 * WHAT IT REFUSES TO PRETEND. The server list offered here is the PROJECT's
 * grant, not the machine's: an agent cannot ask for something the project has
 * not been given, and offering it would be an invitation to a refusal. When the
 * project grants nothing the block says so rather than showing an empty box,
 * because "no servers offered" and "this project grants none" are different
 * facts and only one of them is actionable.
 */
/**
 * Routines: work that starts without anybody asking (M13).
 *
 * WHAT IT SAYS THAT A SCHEDULER USUALLY DOES NOT. A desktop application that is
 * closed runs nothing, and the list says so rather than implying a cron. And a
 * routine with no next-due time is shown as "as soon as Fabric looks" instead of
 * a fabricated timestamp — overdue and never-run are the same answer, and it is
 * not a time.
 */
/**
 * One surface for what runs without being asked (M65).
 *
 * THE HISTORY INCLUDES WHAT DID NOT HAPPEN. `routine.paused@1` is journalled so
 * a refusal can be seen, and a panel showing only successes would tell the
 * operator their automation is fine while it has been refused every night. A run
 * of pauses is stated as a sentence rather than left as rows to count — the
 * operator would do that derivation late, which is the same as not doing it.
 */
function Automations({
  project,
  onError
}: {
  project: ProjectRow
  onError: (m: string) => void
}): React.JSX.Element {
  const t = useT()
  const [data, setData] = useState<{
    running: { taskId: string; title: string; startedAt: string; routineId: string | null }[]
    routines: RoutineRow[]
    states: Record<string, AutomationStateRow>
  } | null>(null)

  const load = (): void => {
    window.fabric.automations
      .read(project.id)
      .then(setData)
      .catch((e) => onError(String(e)))
  }
  useEffect(load, [project.id])

  if (data === null) return <EmptyState read={false}>{t('automations.reading')}</EmptyState>

  return (
    <>
      <h3 className="task-history-head">{t('automations.running')}</h3>
      {data.running.length === 0 ? (
        <p className="muted">{t('automations.nothingRunning')}</p>
      ) : (
        data.running.map((r) => (
          <Row
            key={r.taskId}
            lead={
              <StateChip tone="info">
                {r.routineId ? t('automations.byRoutine') : t('automations.byHand')}
              </StateChip>
            }
            trail={<span className="muted">{since(r.startedAt, t)}</span>}
          >
            {r.title}
          </Row>
        ))
      )}

      <Routines project={project} onError={onError} states={data.states} onChanged={load} />
    </>
  )
}

function Routines({
  project,
  onError,
  states,
  onChanged
}: {
  project: ProjectRow
  onError: (m: string) => void
  /** One routine's folded history. Absent means no records yet, which is a
   *  different statement from "it has never run". */
  states: Record<string, AutomationStateRow>
  onChanged: () => void
}): React.JSX.Element {
  const t = useT()
  const [rows, setRows] = useState<RoutineRow[]>([])
  const [text, setText] = useState('')
  const [every, setEvery] = useState(1440)
  /** M132 — a routine that composes its instruction from the backlog. */
  const [kind, setKind] = useState<'fixed' | 'backlog'>('fixed')
  const [busy, setBusy] = useState(false)

  const load = (): void => {
    window.fabric.routines.list(project.id).then(setRows).catch((e) => onError(String(e)))
  }
  useEffect(load, [project.id])

  const define = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.fabric.routines.define({
        projectId: project.id,
        instruction: text,
        optionId: project.default_agent,
        everyMinutes: every,
        kind
      })
      setText('')
      load()
      onChanged()
    } catch (e) {
      onError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h3 className="task-history-head">{t('routines.title')}</h3>
      <p className="muted">{t('routines.lede')}</p>
      {rows.length === 0 && <p className="muted">{t('routines.none')}</p>}
      {rows.map((r) => (
        <Row
          key={r.id}
          lead={
            <StateChip tone={r.enabled ? 'info' : 'quiet'}>
              {r.kind === 'backlog'
                ? t('routines.everyBacklog', { minutes: r.every_minutes })
                : t('routines.every', { minutes: r.every_minutes })}
            </StateChip>
          }
          trail={
            <Button
              tone="ghost"
              onClick={() =>
                void window.fabric.routines.setEnabled(r.id, !r.enabled).then(load)
              }
            >
              {r.enabled ? t('routines.pause') : t('routines.resume')}
            </Button>
          }
        >
          {r.instruction}
          {/* M65 — what happened before, said rather than listed. A run of
              pauses is a fact about the routine; rows to count are a job the
              operator will do late. */}
          {isStuck(states[r.id]) && (
            <span className="muted">
              {' '}
              {t('automations.stuck', {
                count: states[r.id].consecutivePauses,
                why: states[r.id].stuckBecause ?? '—'
              })}
            </span>
          )}
          <span className="muted">
            {' '}
            {nextDue(
              {
                id: r.id,
                projectId: r.project_id,
                instruction: r.instruction,
                optionId: r.option_id,
                everyMinutes: r.every_minutes,
                lastRunAt: r.last_run_at,
                running: false,
                enabled: r.enabled
              },
              Date.now()
            ) ?? t('routines.soon')}
          </span>
        </Row>
      ))}
      <Toolbar>
        <Field label={t('routines.newInstruction')}>
          {(id) => <input id={id} value={text} onChange={(e) => setText(e.target.value)} />}
        </Field>
        <Field label={t('routines.newEvery')}>
          {(id) => (
            <input
              id={id}
              type="number"
              min={5}
              value={every}
              onChange={(e) => setEvery(Number(e.target.value))}
            />
          )}
        </Field>
        <Field label={t('routines.newKind')}>
          {(id) => (
            <select
              id={id}
              value={kind}
              onChange={(e) => setKind(e.target.value as 'fixed' | 'backlog')}
            >
              <option value="fixed">{t('routines.kindFixed')}</option>
              <option value="backlog">{t('routines.kindBacklog')}</option>
            </select>
          )}
        </Field>
        <Button tone="quiet" disabled={busy || !text.trim()} onClick={() => void define()}>
          {t('routines.add')}
        </Button>
      </Toolbar>
    </>
  )
}

/** Five states, and only one of them is an alarm (ADR-0040). `quiet` is not a
 *  fault and must not look like one, or the alerting state stops being read. */
function livenessTone(state: RunStatusView['observation']['liveness']): ChipTone {
  return state === 'working' ? 'good' : state === 'stalled' || state === 'gone' ? 'warn' : 'quiet'
}

export function AgentTile({
  session,
  claim,
  onSessionsChanged,
  onError
}: {
  session: TerminalSession
  /** What the agent says about itself. Rendered under its own heading, because
   *  it is an account and not a measurement (ADR-0008). */
  claim: AgentClaim | null
  onSessionsChanged: () => Promise<void> | void
  onError: (e: string) => void
}): React.JSX.Element {
  const t = useT()
  // What the estate has recorded about this session, composed from the run, the
  // heartbeat and the observation (M189). Null until it answers; the old chip
  // is what shows meanwhile rather than a blank.
  const [status, setStatus] = useState<RunStatusView | null>(null)
  /** When this snapshot was taken, so an old one can say so (AX-02). */
  const [asOf, setAsOf] = useState<number | null>(null)
  const [tick, setTick] = useState(0)

  /**
   * FRESHNESS THAT DOES NOT DEPEND ON TERMINAL OUTPUT (AX-02).
   *
   * This effect ran on `[session.sessionId, session.lastActivityAt]`, and
   * `lastActivityAt` moves only when the PTY prints something. So every change
   * the widget exists to show was invisible to it: a heartbeat that STOPS
   * produces no output, an answered question produces no output, and a host
   * waking from sleep produces no output. The chip said `working` for as long
   * as the agent stayed silent — which is the one moment it needed to say
   * something else.
   *
   * A bounded tick, on the interval the repository watcher already uses. Slow
   * on purpose, as `AttentionPanel` wrote down for the same reason: this is a
   * status, not a feed, and a widget that repaints faster than it can be read
   * is worse than one a few seconds stale.
   */
  useEffect(() => {
    const every = setInterval(() => {
      if (document.visibilityState === 'visible') setTick((n) => n + 1)
    }, POLL_MS)
    return () => clearInterval(every)
  }, [])

  useEffect(() => {
    let alive = true
    void window.fabric.runs
      .status(session.sessionId)
      .then((env) => {
        if (!alive) return
        if (env.data) {
          setStatus(env.data)
          setAsOf(env.asOf ? Date.parse(env.asOf) : Date.now())
        }
      })
      // A status that cannot be read leaves the tile as it was. It is a widget,
      // and failing to enrich it must not blank the thing it decorates (M106a)
      // — but the snapshot then keeps its own `asOf`, so a retained reading is
      // shown with its AGE rather than as the current one.
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [session.sessionId, session.lastActivityAt, tick])
  const since = (iso: string, tr = t): string => ago(iso, tr)
  return (
    <Panel
      quiet
      title={<Button tone="ghost" onClick={() => window.fabric.windows.openSession(session.sessionId).catch(e => onError(String(e)))}>
        {runnerLabel(session.optionId, t)}
      </Button>}
      actions={
        // M189 — what FABRIC SEES, not `session.state`. That was `stateOf`'s
        // sixty-second timer, which M178 replaced: a thinking agent, one
        // blocked on an unanswered question and one whose process is wedged all
        // read `idle` here while the estate had recorded which since M179.
        //
        // A reading whose coverage rests on nothing observed is NOT shown as a
        // confident state — that would put back the false alarm M181 removed.
        <Toolbar align="end">
          {/* HOW OLD THE READING IS, when it is old (AX-02). A retained
              snapshot used to be indistinguishable from a current one: the
              read failed, the tile kept what it had, and nothing said the
              answer had stopped being refreshed. Shown only past the poll
              interval, because an age on a reading taken a second ago is noise
              that teaches the operator to ignore the one that matters. */}
          {asOf !== null && Date.now() - asOf > POLL_MS * 2 && (
            <span className="muted" role="status">
              {t('agents.readingAge', { age: since(new Date(asOf).toISOString()) })}
            </span>
          )}
          {session.termination ? <StopStatus state={session.termination} /> : (
            <StateChip tone={status && isTrustworthy(status) ? livenessTone(status.observation.liveness) : 'quiet'} dot>
              {status ? t(`agents.liveness.${status.observation.liveness}` as 'agents.liveness.working') : t(`session.state.${session.state}`)}
            </StateChip>
          )}
        </Toolbar>
      }
    >
      {claim && (
        <Claim
          label={t('agents.claims')}
          stage={
            <>
              {claim.stage}
              {claim.step !== null && claim.ofSteps !== null
                ? t('agents.claimStep', { step: claim.step, of: claim.ofSteps })
                : ''}
            </>
          }
          // The age is the whole point of the distinction. Without it a claim
          // from three hours ago sits beside a measurement from four seconds ago
          // and nothing separates them.
          age={t('agents.claimAge', { time: since(claim.reportedAt, t) })}
          stale={claimIsBehind(claim.reportedAt, session.lastActivityAt)}
          staleTitle={t('agents.claimStale')}
        />
      )}
      <Tail>{session.tail || t('agents.noOutput')}</Tail>
      <p className="muted">
        {session.exitCode === null
          ? t('agents.activeAgo', {
              time: since(session.lastActivityAt, t),
              uptime: since(session.startedAt, t)
            })
          : t('agents.exited', { code: session.exitCode, time: since(session.lastActivityAt, t) })}
      </p>
      <SessionStop key={session.sessionId} session={session} refresh={onSessionsChanged} onError={onError} />
    </Panel>
  )
}

function MemorySection({
  project,
  onError
}: {
  project: ProjectRow
  onError: (e: string) => void
}): React.JSX.Element {
  const t = useT()
  const [query, setQuery] = useState('')
  const [claim, setClaim] = useState('')
  // Correcting a fact is an ACT with a target, not an edit: the old one keeps its
  // text and closes its window (M48). Holding the target here is what makes the
  // next thing typed a correction rather than a contradicting fact beside it.
  const [correcting, setCorrecting] = useState<MemoryFact | null>(null)
  const [showSuperseded, setShowSuperseded] = useState(false)
  /** M182 — which lesson, not which sort of statement. `null` is every one of
   *  them; an unknown value never reaches the read, which would return an empty
   *  list that reads as "there is nothing here". */
  const [category, setCategory] = useState<InsightCategory | null>(null)
  /**
   * WHAT HAPPENED to the last correction, when it was not what was asked.
   *
   * The form used to clear itself and reload whatever the projector had done —
   * so a correction refused because somebody else had already corrected that
   * fact looked exactly like one that worked.
   */
  const [correctionSaid, setCorrectionSaid] = useState<string | null>(null)

  /**
   * THE WHOLE QUESTION, not the half of it that used to be fenced (UX28-02).
   *
   * This read fenced on the search string alone: `latestQuery.current === q`.
   * Change the category and leave the text as it is — both requests carry the
   * same `q`, both pass the fence, and whichever the database answers last is
   * rendered, including the one for the category the operator has left. The
   * project had the same hole: two projects both asking with an empty string.
   * A subject built from every part the answer depends on closes both, and
   * `subjectOf` length-prefixes so no two combinations can collide.
   */
  const question: FactsQuery = { projectId: project.id, query, showSuperseded, category }
  const subject = factsSubject(question)
  const [read, setRead] = useState<KeyedRead<MemoryFact[]> | null>(null)
  const factsRead = forSubject(read, subject)
  const facts = factsRead.value ?? []
  const load = async (at: string): Promise<void> => {
    try {
      const found = await window.fabric.memory.search(
        question.projectId,
        question.query,
        question.showSuperseded,
        question.category ?? undefined
      )
      setRead((cur) => settled(cur, { subject: at, value: found, at: Date.now() }))
    } catch (e) {
      // BOTH, as in EstateAgents: the read carries the failure so the previous
      // category's facts are not left standing as this category's answer, and
      // the operator still gets the banner.
      setRead((cur) => failed(cur, { subject: at, why: String(e) }))
      onError(String(e))
    }
  }
  useEffect(() => {
    const h = setTimeout(() => void load(subject), 200)
    return () => clearTimeout(h)
  }, [subject])

  return (
    <Panel id="sec-memory" title={t('memory.title')}>
      <form
        className="memory-add"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!claim.trim()) return
          try {
            const written = await window.fabric.memory.remember(
              project.id,
              claim,
              undefined,
              correcting?.id,
              null,
              category ?? undefined
            )
            setClaim('')
            setCorrecting(null)
            // The RECEIPT, read off the row rather than assumed from the fact
            // that the call returned. Silence when the outcome is the one that
            // was asked for; a sentence when it is not.
            const outcome: Correction = {
              status: written.correction_outcome,
              reason: written.correction_reason,
              previousRef: written.supersedes_requested
            }
            setCorrectionSaid(
              outcome.status === 'not_requested' || corrected(outcome)
                ? null
                : describeCorrection(outcome)
            )
            await load(subject)
          } catch (err) {
            onError(String(err))
          }
        }}
      >
        <label className="visually-hidden" htmlFor="memory-add">
          {t('memory.add')}
        </label>
        <input
          id="memory-add"
          placeholder={t('memory.addPlaceholder')}
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
        />
        <Button type="submit" disabled={!claim.trim()}>
          {t('memory.add')}
        </Button>
      </form>
      {correcting && (
        <p className="correcting" role="status">
          <span>{t('memory.correcting', { claim: correcting.claim })}</span>
          <Button tone="ghost" onClick={() => setCorrecting(null)}>
            {t('memory.cancelCorrection')}
          </Button>
        </p>
      )}
      {/* Shown only when the outcome is NOT the one that was asked for. A
          receipt printed on every success is a receipt nobody reads. */}
      {correctionSaid && (
        <Banner
          tone="warn"
          actions={
            <Button tone="ghost" onClick={() => setCorrectionSaid(null)}>
              {t('common.dismiss')}
            </Button>
          }
        >
          {correctionSaid}
        </Banner>
      )}
      <label className="visually-hidden" htmlFor="memory-search">
        {t('memory.searchPlaceholder')}
      </label>
      <input
        id="memory-search"
        className="memory-search"
        placeholder={t('memory.searchPlaceholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <Button
        className="ghost memory-toggle"
        aria-pressed={showSuperseded}
        onClick={() => setShowSuperseded((v) => !v)}
      >
        {t(showSuperseded ? 'memory.hideSuperseded' : 'memory.showSuperseded')}
      </Button>
      {/* M182 — the filter the closed category exists for. A lesson about the
          runner and a lesson about this repository were the same row, and
          neither could be kept out of the other's reading. */}
      <Field label={t('memory.category')}>
        {(id) => (
          <select
            id={id}
            value={category ?? ''}
            onChange={(e) => setCategory((e.target.value || null) as InsightCategory | null)}
          >
            <option value="">{t('memory.categoryAll')}</option>
            {INSIGHT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`memory.category.${c}` as 'memory.category.project')}
              </option>
            ))}
          </select>
        )}
      </Field>
      <div className="memory-list">
        {factsRead.state === 'failed' && (
          <p className="read-failed" data-testid="facts-failed">
            {t('reads.failed', { why: factsRead.failedWhy ?? '' })}
          </p>
        )}
        {factsRead.state !== 'failed' && facts.length === 0 && (
          /* Null until read (M108), and the read's own state is what says so
             now. The panel said "nothing is remembered here" before it had
             asked — of a store whose entire job is to distinguish what is
             recorded from what is not. */
          <EmptyState read={factsRead.state === 'ready'} waiting={t('memory.reading')}>
            {query ? t('memory.noMatch') : t('memory.empty')}
          </EmptyState>
        )}
        {facts.map((f) => (
          <Row
            key={f.id}
            quiet={f.valid_to !== null}
            // Who recorded it is part of what it is worth: a note the operator
            // wrote and an agent's report about its own work are different
            // evidence, and the projection used to make them identical (M44).
            lead={
              <StateChip tone={f.actor_kind === 'agent' ? 'info' : 'quiet'}>
                {t(
                  f.actor_kind === 'person'
                    ? 'memory.byOperator'
                    : f.actor_kind === 'agent'
                      ? 'memory.byAgent'
                      : f.actor_kind === 'system'
                        ? 'memory.bySystem'
                        : 'memory.byUnknown'
                )}
              </StateChip>
            }
            trail={
              <Toolbar align="end">
                {f.valid_to !== null && (
                  <StateChip tone="warn">{t('memory.supersededMark')}</StateChip>
                )}
                {/* A claim that stands BESIDE an earlier one rather than
                    replacing it. Invisible before this, so two contradicting
                    facts read as two independent observations. */}
                {f.correction_outcome === 'conflict_proposed' && (
                  <StateChip tone="warn">{t('memory.conflictMark')}</StateChip>
                )}
                {f.category !== 'project' && (
                  <StateChip tone="quiet">
                    {t(`memory.category.${f.category}` as 'memory.category.project')}
                  </StateChip>
                )}
                <span className="muted mono">{new Date(f.recorded_at).toLocaleDateString()}</span>
                {f.valid_to === null && (
                  <Button tone="ghost" onClick={() => setCorrecting(f)}>
                    {t('memory.correct')}
                  </Button>
                )}
              </Toolbar>
            }
          >
            {/* A corrected fact is struck through by MEANING, not by a class: it
                is no longer accurate, and `<s>` says exactly that to a reader
                who cannot see the colour. */}
            {f.valid_to !== null ? <s>{f.claim}</s> : f.claim}
          </Row>
        ))}
      </div>
    </Panel>
  )
}
