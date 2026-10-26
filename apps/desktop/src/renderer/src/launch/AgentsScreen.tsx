// #region agents-screen — docs: docs/ux/scenarios.md#scn-166-see-every-agent-and-open-its-console-in-one-press
/**
 * Агенты as an agents screen (CO-419, the operator 2026-10-24; SCN-166, SCN-167): the list of every agent on the right,
 * grouped by state («Работают сейчас», «Ждут вас», «Простаивают», «Отключены»), the chosen agent in the centre with two
 * tabs, «Работа» (its task and project, what it does now, its results, what it did by day; «Отключить» or «Пустить
 * снова» for a coding agent that joined from a terminal) and «Консоль» (its live console, the same `SessionWindow` a
 * console tab along the top draws). It replaces the three lists stacked on the place before (SX-3): «Агенты в работе»,
 * «Подключились сами» and the legacy «Все агенты».
 *
 * ONE HOME PER TERMINAL (SX item 6). The «Консоль» tab draws the session where the person is; it opens no tab along the
 * top. «Открыть вкладкой» moves it to a console tab (SCN-172), which leaves Агенты: Fabric shows one place at a time,
 * so one session is never drawn twice with two states.
 *
 * Every read is the one the screens already make; a read that fails is said in its place, never an empty group.
 *
 * 0.3.14, the simple Fabric (docs/ux/2026-10-26-simple-fabric.md §3, open choice 4): Агенты is no longer a place with a
 * roster. The left column's toggle lists the agents at work; this screen draws the one chosen, its body and its session
 * card (`AgentPage`), with no «Работа» / «Консоль» tabs: the console opens as a tab along the top only when «Открыть
 * сессию» is pressed. The roster grouped by state is kept as `AgentRoster`, which Настройки shows for the agents that
 * are idle, installed or disconnected; picking one there opens its screen here.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActAnswer } from '../../../shared/acts.ts'
import type { HubOverview } from '../../../shared/access.ts'
import type { SwitchboardCatalog } from '../../../shared/agentCatalog'
import type { LiveAgent } from '../../../shared/homeLive'
import type { ExecutorRow } from '../../../shared/startPaths'
import type { TerminalSession } from '../../../shared/types'
import { useLocale, useT, type Translate } from '../i18n'
import { since } from '../duration'
import { runnerLabel } from '../runnerLabel'
import { FailureNote } from '../OperatorError'
import { useOpenConsole } from '../consoles'
import { AgentPage } from './AgentPage'
import { CappedNote, KeptNote, useHome } from './HomeWork'
import { useRead } from './useRead'
import { whyWords } from './actWords'
import { AGENT_GROUPS, composeRoster, rosterRows, type AgentGroup, type RosterRow } from './agentRoster'

/** Where a read stands: still out, failed, or answered. */
type ReadState = 'reading' | 'failed' | 'read'
/** Several reads as one: out while any is out, failed while any failed, read once every one answered. */
function together(states: readonly ReadState[]): ReadState {
  return states.includes('reading') ? 'reading' : states.includes('failed') ? 'failed' : 'read'
}

type HubRead = { at: 'reading' } | { at: 'ready'; ov: HubOverview } | { at: 'failed'; says: string }
type Refusal = { agentId: string; act: 'disconnect' | 'letIn'; why: string; says?: string }

/** The joined and disconnected coding agents (`hub.overview`, as Settings → Agent access reads it) and the two acts on
 *  them; read again when the journal's act and access events move (`mark`), so an undo pressed elsewhere is seen. */
function useHub(mark: number) {
  const [read, setRead] = useState<HubRead>({ at: 'reading' })
  const [busy, setBusy] = useState<string | null>(null)
  const [refused, setRefused] = useState<Refusal | null>(null)
  const load = useCallback(async (): Promise<void> => {
    try {
      setRead({ at: 'ready', ov: await window.fabric.hub.overview() })
    } catch (e) {
      setRead({ at: 'failed', says: e instanceof Error ? e.message : String(e) })
    }
  }, [])
  useEffect(() => { void load() }, [load, mark])
  const act = async (agentId: string, which: Refusal['act']): Promise<void> => {
    if (busy) return
    setBusy(agentId)
    setRefused(null)
    let answer: ActAnswer
    try {
      answer = await (which === 'disconnect' ? window.fabric.hub.disconnectAgent(agentId) : window.fabric.hub.letAgentIn(agentId))
    } catch (e) {
      answer = { ok: false, reason: 'failed', says: e instanceof Error ? e.message : String(e) }
    }
    if (!answer.ok) setRefused({ agentId, act: which, why: answer.reason, ...(answer.says ? { says: answer.says } : {}) })
    setBusy(null)
    await load()
  }
  return { read, busy, refused, act, reload: load }
}

/** The row's name: the runner's own («Claude Code»), else the name its source gave, never a raw id. */
export function agentName(r: RosterRow, t: Translate): string {
  const known = runnerLabel(r.runner, t)
  return known === r.runner && r.name ? r.name : r.runner ? known : (r.name ?? t('acts.actor.agent'))
}

/** The row's state in words, never `running` / `idle` / `ended` (SX-3). */
export function stateWords(r: RosterRow, t: Translate): string {
  return t(`agentsPlace.state.${r.state}` as 'agentsPlace.state.working')
}

/** A console that has printed nothing for a while, said as what is observed: how long it has been quiet, and that the
 *  agent may be waiting for the person. No runner reports that it waits, so this never says it does (0.3.13 review,
 *  iteration 1, UX-3). */
function silentLine(r: RosterRow, t: Translate): string {
  return t('agentsPlace.line.silent', { time: r.heardAt ? since(r.heardAt, t) : '?' })
}

/** One line of what it does: its task, else what it said it is doing, else what the state means for it. When who
 *  works was not read, a working console's line says so instead of «has not said» (0.3.13 review, iteration 3, UX-2). */
function lineOf(r: RosterRow, t: Translate, locale: string, workUnread = false): string {
  if (r.task) return t('launch.home.agents.workingOn', { task: r.task.summary || t('launch.home.work.untitled') })
  if (r.doing) return r.doing.text
  if (workUnread && !r.live && (r.state === 'working' || r.state === 'quiet')) return t('agentPage.doingUnread')
  switch (r.state) {
    case 'waiting': return silentLine(r, t)
    case 'working': case 'quiet': return t('launch.home.agents.silent')
    case 'ended': return t('agentsPlace.line.ended')
    case 'free': return r.version ? t('agentsPlace.line.free', { version: r.version }) : t('agentsPlace.line.freeNoVersion')
    case 'joined': return r.projectNames.length ? t('agentsPlace.line.joined', { projects: r.projectNames.join(', ') }) : t('agentsPlace.line.joinedNowhere')
    case 'out': return r.outSince ? t('joined.outSince', { time: new Date(r.outSince).toLocaleDateString(locale, { day: 'numeric', month: 'long' }) }) : t('agentsPlace.state.out')
    case 'signin': return t('agentsPlace.line.signin')
    case 'missing': return t('agentsPlace.line.missing')
    case 'unresponsive': return t('agentsPlace.line.unresponsive')
  }
}

/** A row read as an agent at work, for the agent page: `work.home`'s own, else the console Fabric holds. */
function asLive(r: RosterRow): LiveAgent | null {
  if (r.live) return r.live
  if (!r.sessionId) return null
  return {
    sessionId: r.sessionId, projectId: r.projectId, projectName: r.projectName, agent: r.runner, console: r.console,
    startedAt: r.heardAt ?? new Date(0).toISOString(), lastSignAt: r.heardAt, stale: false, doing: null, task: null
  }
}

/** Every read the roster takes, as one: who works, the consoles, the joined agents, the installed ones, Switchboard's
 *  catalogue; and where each read stands, so a group is called empty only once its reads answered. */
function useRoster(mark: number, hubMark: number, sessions: TerminalSession[] | null, projects: ReadonlyArray<{ id: string; name: string }> | null) {
  const home = useHome(mark)
  const hub = useHub(hubMark)
  // «Повторить» reads the installed agents again (0.3.13 review, iteration 1, UX-1).
  const [executorsAttempt, setExecutorsAttempt] = useState(0)
  const executors = useRead<ExecutorRow[]>(() => window.fabric.start.executors(), executorsAttempt)
  const catalog = useRead<SwitchboardCatalog>(() => window.fabric.settings.agentCatalog())
  const roster = composeRoster({
    live: home.view?.live ?? null,
    sessions,
    projects,
    executors: executors && 'value' in executors ? executors.value : null,
    catalog: catalog && 'value' in catalog && catalog.value.source === 'switchboard' ? catalog.value.agents : null,
    hub: hub.read.at === 'ready' ? hub.read.ov : null
  })
  const rows = rosterRows(roster)
  const executorsFailed = executors && 'failed' in executors ? executors.failed : null
  const reads = {
    home: home.problem ? 'failed' : home.view ? 'read' : 'reading',
    sessions: sessions === null ? 'reading' : 'read',
    hub: hub.read.at === 'ready' ? 'read' : hub.read.at,
    executors: executors === null ? 'reading' : executorsFailed !== null ? 'failed' : 'read',
    catalog: catalog === null ? 'reading' : 'failed' in catalog ? 'failed' : 'read'
  } satisfies Record<string, ReadState>
  // Which reads fill which group (`agentRoster.ts#composeRoster`): who works and whose console is quiet come from
  // `work.home` and the consoles; the idle and the off also from the joined agents and the installed ones.
  const groupRead: Record<AgentGroup, ReadState> = {
    working: together([reads.home, reads.sessions]),
    waiting: together([reads.home, reads.sessions]),
    idle: together([reads.home, reads.sessions, reads.hub, reads.executors, reads.catalog]),
    off: together([reads.hub, reads.executors, reads.catalog])
  }
  return { home, hub, roster, rows, reads, groupRead, everyRead: together(Object.values(reads)), executorsFailed, retryExecutors: () => setExecutorsAttempt((n) => n + 1) }
}

/**
 * The roster by state (CO-419), kept for Настройки (0.3.14): the agents that are idle, installed or disconnected, each
 * with its name, project, one line and when it was last heard from. A row opens the agent's screen (`onSelect`).
 */
export function AgentRoster({ mark, hubMark, sessions, projects, groups = AGENT_GROUPS, onSelect, selected = null }: {
  mark: number
  hubMark: number
  sessions: TerminalSession[] | null
  projects: ReadonlyArray<{ id: string; name: string }> | null
  /** Which groups to list; all four when absent. */
  groups?: readonly AgentGroup[]
  onSelect(key: string): void
  selected?: string | null
}): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const r = useRoster(mark, hubMark, sessions, projects)
  const { home, hub } = r
  const nothingRead = home.view === null && home.problem === null && r.rows.length === 0
  return (
    <section className="ag-list" aria-labelledby="ag-list-title">
      <h3 id="ag-list-title" className="visually-hidden">{t('agentsPlace.list')}</h3>
      {home.problem && (
        <div className="ag-note">
          <FailureNote said={t('agentsPlace.workUnread')} detail={home.problem} />
          {home.retry && <button type="button" className="lp-button" onClick={home.retry}>{t('common.retry')}</button>}
        </div>
      )}
      <KeptNote reading={home} />
      <CappedNote reading={home} />
      {r.executorsFailed && (
        <div className="ag-note">
          <FailureNote said={t('agentsPlace.installedUnread')} detail={r.executorsFailed} role="status" />
          <button type="button" className="lp-button" onClick={r.retryExecutors}>{t('common.retry')}</button>
        </div>
      )}
      {hub.read.at === 'failed' && (
        <div className="ag-note">
          <FailureNote said={t('joined.failed')} detail={hub.read.says} role="status" />
          <button type="button" className="lp-button" onClick={() => void hub.reload()}>{t('common.retry')}</button>
        </div>
      )}
      {hub.read.at === 'ready' && hub.read.ov.keptOut && !hub.read.ov.keptOut.readable && <p className="lp-meta" role="status">{t('joined.outUnreadable')}</p>}
      {r.everyRead === 'reading' && <p className="lp-meta" role="status">{t('agentsPlace.reading')}</p>}
      {nothingRead ? null : groups.map((g) => (
        <Group key={g} group={g} rows={r.roster[g]} read={r.groupRead[g]} workUnread={home.view === null && home.problem !== null} selected={selected} onSelect={onSelect} locale={locale} />
      ))}
    </section>
  )
}

export function AgentsScreen({ mark, hubMark, sessions, projects, onOpenProject, onOpenTask, onCreate, initialSession = null, initialAgent = null, onPick }: {
  /** The session to open on arrival (a row of the left column's «Агенты», a «В работе» row, a board card's
   *  «Сессия …»), as if the person had picked it. */
  initialSession?: string | null
  /** The roster row picked last (Настройки' list, or the way back from a task), kept in the route (the 0.3.14 review,
   *  iteration 1, UX-2). */
  initialAgent?: string | null
  /** Tells the shell which row the person picked, so it keeps it in the route. */
  onPick?(key: string): void
  /** Moves with the journal's work, task, agent and session events. */
  mark: number
  /** Moves with the journal's act and access events: «Отключить» or its undo, anywhere. */
  hubMark: number
  /** The consoles Fabric holds; null while unread. */
  sessions: TerminalSession[] | null
  projects: ReadonlyArray<{ id: string; name: string }> | null
  onOpenProject(projectId: string): void
  onOpenTask(projectId: string, taskId: string): void
  /** «Создать агента»: «Создать» on its agent path (SCN-166 step 4). */
  onCreate(): void
}): React.JSX.Element {
  const t = useT()
  const r = useRoster(mark, hubMark, sessions, projects)
  const { home, hub, rows } = r
  const showConsole = useOpenConsole()
  const [consoleProblem, setConsoleProblem] = useState<string | null>(null)
  const arrivedFor = initialAgent ?? (initialSession ? `session:${initialSession}` : null)
  const [selected, setSelected] = useState<string | null>(arrivedFor)
  // An agent that has left the list leaves no page under its name (SX item 3).
  const chosen = rows.find((x) => x.key === selected) ?? null

  // Focus moves to the chosen agent only on arrival for it, never on a read (0.3.12 review, iteration 2, UX-3).
  const picked = useRef<string | null>(null)
  const focusPage = (): void => {
    const h = document.getElementById('agent-page-title')
    h?.focus({ preventScroll: true })
    h?.scrollIntoView?.({ block: 'nearest' })
  }
  // Arriving for an agent picks it, and the page takes focus as on the person's own pick. The 0.3.14 review, iteration 1,
  // UX-7: the mark is kept until the agent's row is read and its page drawn, so an arrival before the roster is read
  // still moves focus to the page.
  useEffect(() => {
    if (!arrivedFor || arrivedFor === selected) {
      if (arrivedFor && picked.current === null && !chosen) picked.current = arrivedFor
      return
    }
    picked.current = arrivedFor
    setSelected(arrivedFor)
    // `selected` and `chosen` are read, not followed: only a new arrival picks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrivedFor])
  useEffect(() => {
    if (picked.current === null || !chosen || picked.current !== chosen.key) return
    picked.current = null
    focusPage()
  }, [chosen?.key])
  // The pick is the route's: told to the shell once it is known, so the way back from a task reopens this agent.
  useEffect(() => { if (chosen && chosen.key !== initialAgent) onPick?.(chosen.key) }, [chosen?.key])

  const openAsTab = (sessionId: string): void => {
    setConsoleProblem(null)
    showConsole(sessionId).catch((e: unknown) => setConsoleProblem(e instanceof Error ? e.message : String(e)))
  }

  return (
    <div className="ag ag-screen" data-launch-view="agents">
      {/* The place's own name, so a screen reader and the rail's focus move land on it (0.3.11 review, iteration 2, UX-10). */}
      <h2 className="visually-hidden" tabIndex={-1}>{t('agents.title')}</h2>
      {consoleProblem && <FailureNote said={t('launch.home.agents.consoleFailed')} detail={consoleProblem} />}
      {chosen ? (
        <Centre row={chosen} mark={mark} hub={hub} homeUnread={home.view === null && home.problem !== null} onOpenProject={onOpenProject} onOpenTask={onOpenTask} onAsTab={openAsTab} />
      ) : home.view === null && home.problem && rows.length === 0 ? (
        <div className="lp-meta ag-pick" role="status">
          <p>{t('agentPage.unread')}</p>
          {home.retry && <button type="button" className="lp-button" onClick={home.retry}>{t('common.retry')}</button>}
        </div>
      ) : arrivedFor && r.everyRead === 'reading' ? (
        <p className="lp-meta ag-pick" role="status">{t('agentsPlace.reading')}</p>
      ) : (
        <div className="ag-pick">
          <p className="lp-meta">{t('agentScreen.pick')}</p>
          <button type="button" className="lp-button" onClick={onCreate}>{t('agentsPlace.create')}</button>
        </div>
      )}
    </div>
  )
}

function Group({ group, rows, read, workUnread, selected, onSelect, locale }: {
  group: AgentGroup
  rows: RosterRow[]
  /** The read of who works failed: a console's line says what was not read. */
  workUnread: boolean
  /** Where the reads that fill this group stand: empty is said only once they answered. */
  read: ReadState
  selected: string | null
  onSelect(key: string): void
  locale: string
}): React.JSX.Element {
  const t = useT()
  const id = `ag-group-${group}`
  return (
    <div className={`ag-group ag-group-${group}`}>
      <h4 id={id}>{t(`agentsPlace.group.${group}` as 'agentsPlace.group.working')}{(read === 'read' || rows.length > 0) && <> <span className="lp-count">{rows.length}</span></>}</h4>
      {rows.length === 0 ? (
        <p className="lp-meta" role={read === 'reading' ? 'status' : undefined}>
          {read === 'reading' ? t('agentsPlace.groupReading') : read === 'failed' ? t('agentsPlace.groupUnread') : t(`agentsPlace.groupEmpty.${group}` as 'agentsPlace.groupEmpty.working')}
        </p>
      ) : (
        <ol className="ag-rows" aria-labelledby={id}>
          {rows.map((r) => (
            <li key={r.key}>
              <button type="button" className={`lp-button ag-row ${selected === r.key ? 'is-selected' : ''}`} aria-pressed={selected === r.key} onClick={() => onSelect(r.key)}>
                <span className="ag-row-head">
                  <b>{agentName(r, t)}</b>
                  <span className="lp-pill">{stateWords(r, t)}</span>
                  {r.heardAt && r.state !== 'free' && <small className="ag-heard">{since(r.heardAt, t)}</small>}
                </span>
                <span className="lp-meta ag-row-project">{r.projectName ?? (r.sessionId ? t('launch.home.agents.noProject') : '')}</span>
                <span className="ag-row-line">{lineOf(r, t, locale, workUnread)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function Centre({ row, mark, hub, homeUnread, onOpenProject, onOpenTask, onAsTab }: {
  row: RosterRow
  mark: number
  hub: ReturnType<typeof useHub>
  /** Who works was not read (`work.home` failed first): a console's task and action are unknown, not none (UX-3). */
  homeUnread: boolean
  onOpenProject(projectId: string): void
  onOpenTask(projectId: string, taskId: string): void
  onAsTab(sessionId: string): void
}): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const name = agentName(row, t)
  const live = asLive(row)
  const agentId = row.joinedAgentId
  const busy = agentId !== null && hub.busy === agentId
  // SX-26: the joined agent's own page carries «Отключить» (and, once out, «Пустить снова»), the act done here.
  const act = agentId === null ? null : row.state === 'out'
    ? <button type="button" className="lp-button" disabled={busy} aria-busy={busy} onClick={() => void hub.act(agentId, 'letIn')}>{t('joined.letIn')}</button>
    : <button type="button" className="lp-button" disabled={busy} aria-busy={busy} onClick={() => void hub.act(agentId, 'disconnect')}>{t('joined.disconnect')}</button>
  const refusal = agentId !== null && hub.refused?.agentId === agentId ? hub.refused : null
  const note = agentId === null ? null : (
    <div className="ag-joined">
      <p className="lp-meta">{row.state === 'out' ? stateWords(row, t) : t('joined.self')}</p>
      <p className="lp-meta ag-proof">{t('joined.proof', { name })}</p>
      {refusal && (
        <FailureNote said={`${t(refusal.act === 'disconnect' ? 'joined.disconnectFailed' : 'joined.letInFailed')} ${whyWords(t, refusal.why)}`} detail={refusal.says ?? null} />
      )}
    </div>
  )
  const waitingState = row.state === 'waiting' ? silentLine(row, t) : row.state === 'ended' ? stateWords(row, t) : undefined
  // Where its session runs: a console Fabric holds; with the joined agents unread, not known; otherwise a terminal.
  const where = row.console && row.sessionId ? 'fabric' : hub.read.at === 'failed' ? 'unknown' : 'terminal'
  return live ? (
    <AgentPage key={live.sessionId} agent={live} mark={mark} title={name} state={waitingState} actions={act} note={note}
      where={where} onConsole={row.console && row.sessionId ? onAsTab : undefined}
      workUnread={homeUnread && !row.live} onOpenProject={onOpenProject} onOpenTask={onOpenTask} />
  ) : (
    <section className="lp-panel lh-agent-page" aria-labelledby="agent-page-title" data-testid="agent-card">
      <div className="lp-panel-head">
        <div>
          {row.projectName && <p className="lp-kicker">{row.projectName}</p>}
          <h3 id="agent-page-title" tabIndex={-1}>{name}</h3>
          <p className="lp-meta">{stateWords(row, t)}</p>
        </div>
        <span className="lh-agents-actions">
          {row.projectId && <button type="button" className="lp-button" onClick={() => onOpenProject(row.projectId!)}>{t('launch.home.agents.openProject')}</button>}
          {act}
        </span>
      </div>
      {note}
      <p>{lineOf(row, t, locale, homeUnread)}</p>
      {row.install && <p className="lp-meta">{t('settings.agents.install')} <code>{row.install}</code></p>}
      {row.state === 'signin' && <p className="lp-meta">{t('agentsPlace.signinHow', { name })}</p>}
      <p className="lp-meta">{row.joinedAgentId !== null && row.state !== 'out' ? t('agentsPlace.console.terminal')
        : row.state === 'missing' ? t('agentsPlace.line.missing')
        : t('agentsPlace.console.none')}</p>
    </section>
  )
}
// #endregion agents-screen
