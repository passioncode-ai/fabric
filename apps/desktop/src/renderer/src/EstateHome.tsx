import { StackExposureNotice } from './StackExposureNotice'
import { UsageCountsNotice } from './UsageCountsNotice'
import type { FeedEvent, ProjectRow, Quota, TerminalSession } from '../../shared/types'
import { markOf, type FeedMarks } from '../../shared/feedMarks.ts'
import { Banner, Button, EmptyState, Panel, Row, StateChip, Toolbar } from './components'
import { Feed } from './Feed'
import { useEffect, useState } from 'react'
import { FAVOURITE_LIMIT, offersFavourites, partitionByFavourite } from '../../shared/favourites.ts'
import { dayPart } from '../../shared/homeView.ts'
import { FabricAvatar } from './launch/FabricAvatar'
import { HomeBoard, HomeRhythm, NEEDS_YOU_FAMILIES, useRhythm } from './launch/HomeParts'
import { HomeStats, useHome, type HomeReading } from './launch/HomeWork'
import { HomeBoardWaiting } from './launch/HomeBoardWaiting'
import { HomeInWork } from './launch/HomeInWork'
import { orderProjects } from '../../shared/homeLive.ts'
import { projectDisplayName } from '../../shared/projectDisplayName.ts'
import { since } from './duration'
import {
  waitingCounts,
  waitingProblem as waitingProblemOf,
  type WaitingReading
} from '../../shared/attention.ts'
import {
  saidOfAdopt,
  saidOfChoose,
  saidOfThrow,
  type WorkspaceSaid
} from '../../shared/workspaceAct.ts'
import { FailureNote, MachineDetail } from './OperatorError'
import { pluralForm, useLocale, useT } from './i18n'
import { en, type StringKey } from './i18n/en'
import { declaredCoverage, restorability } from '../../shared/storageContract.ts'
import { cursorFor } from '../../shared/inbox.ts'
import type { EntityRef } from '../../shared/entityRef'
import { useOpenConsole } from './consoles'
import { useMediaQuery } from './useMediaQuery'

export function EstateHome({
  projects,
  sessions,
  feed,
  marks,
  onOpen,
  onOpenEntity,
  onNew,
  onBoard = () => {},
  onNeeds,
  onAddTopic,
  onPulse,
  onPersona,
  onAgents = () => {},
  onComms,
  waitingForYou,
  waitingProblem = null,
  toReview,
  onReview,
  reading,
  onAgent
}: {
  /** Opens an agent's screen (0.3.14): a row of «В работе». Absent, a row opens the agent's console or project. */
  onAgent?: (sessionId: string) => void
  /** Who works (`work.home`), read once by the shell for the left column and this page (0.3.14); absent, the page reads its own. */
  reading?: HomeReading
  /** Null until it has been read. The empty array is a MEASUREMENT — "this
   *  estate holds no projects" — and saying it before looking is the one lie a
   *  product built on claim-versus-measurement cannot afford on its first
   *  screen (M108). */
  projects: ProjectRow[] | null
  /** Null until read (M108). Filtering a list you have NOT read leaves it
   *  unread — null in, null out — so a panel cannot mistake "no rows for this
   *  project" for "no answer yet". */
  sessions: TerminalSession[] | null
  feed: FeedEvent[] | null
  /**
   * One monotonic mark per event family (FA-08, UX28-02).
   *
   * MEASURED: this panel watched `feed?.length`, and the feed is capped at 500
   * for the display. So after the five-hundredth event the value never changed
   * again and both readers below froze — the estate Board and the attention
   * count — for the rest of the session. `App.tsx` says so in its own comment
   * at the cap, and ProjectHome was moved off `feed.length` for this reason;
   * this panel was left behind.
   */
  marks: FeedMarks
  onOpen: (id: string) => void
  /**
   * Where a journal row opens (UXA-C06). Separate from `onOpen`, which takes a
   * project id and opens a project: a row is about an ENTITY, and one function
   * answering both questions is the shape this cycle has been removing.
   */
  onOpenEntity?: (projectId: string, focus: EntityRef) => void
  onNew: () => void
  /** Where "Work through the board" and a board row go (SCR-41). */
  onBoard?: () => void
  /** The board's «Нужны вы», opened on one row when given (0.3.11 review UX-4); the kanban otherwise. */
  onNeeds?: (item?: string) => void
  /** "+ Add a topic" under the board lane: the board, with its topic form open (launch prototype SCR-30). */
  onAddTopic?: () => void
  /** Where «Вся активность» and the rhythm lead (SCR-42); without it, the folded journal. */
  onPulse?: () => void
  /** «Мой облик» under the identity (SCR-36). */
  onPersona?: () => void
  /** «Все агенты»: the live consoles (SCR-50). */
  onAgents?: () => void
  /** «Нужны вы» counted once (0.3.12 review, iteration 2, UX-1): the shell's reading, the one its rail shows, over the
   *  whole estate and per project; null while unread or unreadable. The greeting, the strip's «ждут вас» and each
   *  project's «Ждут вас» count it. Absent, the home counts its own «Нужны вы» reading and the projects' obligations. */
  waitingForYou?: { total: number; byProject: Record<string, number> } | null
  /** Why the shell's reading above is null after it failed: said in the banner, and every card says it cannot tell
   *  (0.3.12 review, iteration 3, ER-5). */
  waitingProblem?: string | null
  /** What the Board's «На проверке» lists (reviews, proposals, abandoned work), over the estate and per project, from the
   *  shell's same readings; null while unknown. The strip's «на проверке» and each project's pill count it (iteration 3,
   *  UX-2). Absent, they count the tasks in review from `work.home`. */
  toReview?: { total: number; byProject: Record<string, number> } | null
  /** The Board on «На проверке». */
  onReview?: () => void
  /** Comms (SCR-81), from what waits on the project board (0.3.9 BD-2). */
  onComms?: () => void
}): React.JSX.Element {
  const t = useT(), locale = useLocale()
  // CO-476: the narrow layout (below 1100 px) puts the right column in its narrow place in the DOM.
  const narrow = useMediaQuery('(max-width: 1100px)')
  const showConsole = useOpenConsole()
  const [now] = useState(() => new Date())
  const [ownWaiting, setOwnWaiting] = useState<number | null>(null)
  /** One number for "what waits for you" on this screen and on the rail (UX-1). */
  const personWaiting = waitingForYou === undefined ? ownWaiting : (waitingForYou?.total ?? null)
  /** Computed from the DECLARED coverage, so a table that stops being carried
   *  changes this sentence without anyone remembering to. */
  const mirror = restorability(declaredCoverage())
  // #region workspace-absences — docs: docs/ux/flows.md#flw-36-inspect-storage-import-declared-data-and-restore-an-archive
  // The ids are the contract's; the words are the locale's. `says` stays the
  // contract's own English for diagnostics: interpolated on screen it put
  // «project_tasks» into a Russian sentence (0.3.5 first run).
  const absences = new Intl.ListFormat(locale, { type: 'conjunction' }).format(
    mirror.missing.map((id) => {
      const key = `workspace.entity.${id}`
      return key in en ? t(key as StringKey) : id
    })
  )
  // #endregion workspace-absences
  const read = projects !== null
  const rows = projects ?? []
  const empty = read && rows.length === 0
  /**
   * THREE STATES (UXA-C01). This was a bare record, and the effect below was
   * written `.catch(() => setWaiting({}))` — so an outage became "nothing is
   * waiting on any project", on every card at once, with nothing said. There
   * is now no path from a failed read to a count.
   */
  const [waiting, setWaiting] = useState<WaitingReading>({ read: false })
  /** M118 — whether anyone has been asked where the workspace lives. `null`
   *  while it is being read: three states plus "not yet known" is four, and
   *  showing the question before the answer arrives would ask people who
   *  already answered. */
  const [ws, setWs] = useState<{ git: 'yes' | 'declined' | 'unanswered' } | null>(null)
  const [wsBusy, setWsBusy] = useState<string | null>(null)
  /**
   * What the last workspace act DID (UXA-C03).
   *
   * Separate from `ws`, and it has to be: the question disappears the moment it
   * is answered, so an outcome held inside that banner would be shown for the
   * length of one render and then removed with it. A refusal and a folder with
   * no version history both outlive the question.
   */
  const [wsSaid, setWsSaid] = useState<WorkspaceSaid | null>(null)
  /** Who is doing what (operator request 2026-10-14): one reading for the counts, the board's work lanes, the live
   *  agents and each project's «сейчас». It follows the families that change it — claims, tasks, stage reports and
   *  sessions — and its own 15 s tick for silence. */
  const ownHome = useHome(markOf(marks, ['work', 'task', 'agent', 'session']), reading === undefined)
  const home = reading ?? ownHome
  // «Ритм работы» as main counts it (the mockup parity, home gaps D1, D2): per local day over 28 days, read again when the
  // work, a task, an agent or a decision moves; the same definitions of a result and a decision as the strip and Пульс.
  const rhythm = useRhythm(markOf(marks, ['work', 'task', 'agent', 'session', 'question', 'proposal', 'access', 'policy', 'grant']))
  const pulse = new Map((home.view?.projects ?? []).map((p) => [p.projectId, p]))
  useEffect(() => {
    // THE SAME call the CEO panel makes, grouped here rather than counted by a
    // query of its own. Two numbers describing the same thing, on two surfaces,
    // is worse than one surface having none — the operator cannot tell which is
    // wrong, so neither is usable (M147).
    //
    // `alive` because `marks.all` moves on EVERY journal event, so two reads
    // overlap routinely — and without it the slower of the two wins the screen
    // whichever one was asked for last. `BoardPanel`, ten lines below, has kept
    // this flag since it was written; this effect was the one that did not.
    let alive = true
    window.fabric.attention.list().then(
      // The ENVELOPE, not its rows. A source that refused leaves the other four
      // answering, so this promise keeps its word while the queue it carries is
      // missing a whole class of obligation — and only the receipts can say so
      // (UXA-C02).
      (read) => alive && setWaiting({ read: true, envelope: read }),
      (e: unknown) =>
        alive && setWaiting({ read: true, failed: e instanceof Error ? e.message : String(e) })
    )
    // The attention list spans projects, questions and tasks, so it follows
    // `all` rather than a family: a narrower mark here would freeze it for the
    // events it does care about.
    return () => {
      alive = false
    }
  }, [marks.all])
  /** Grouped ONCE rather than per card, and null whenever there is nothing to
   *  count from — a read that did not answer has no number in it. */
  const counts = waitingCounts(waiting)
  /** Why the counts are not totals, or null because they are (UXA-C02). */
  // The shell's reading feeds the cards when it is wired: its failure is the one the banner says (iteration 3, ER-5).
  const waitProblem = waitingForYou !== undefined && waitingForYou === null && waitingProblem !== null
    ? { kind: 'unreadable' as const, why: waitingProblem }
    : waitingProblemOf(waiting)
  useEffect(() => {
    // An unread state is not an answer the person gave: say it and ask nothing, rather than record 'declined' (i2 ER-4).
    window.fabric.workspace.state().then(setWs).catch((e: unknown) => setWsUnread(e instanceof Error ? e.message : String(e)))
  }, [])
  const [wsUnread, setWsUnread] = useState<string | null>(null)
  /** A live agent's console, when Fabric holds it; a failure is said, not swallowed. */
  const [consoleProblem, setConsoleProblem] = useState<string | null>(null)
  const openConsole = (sessionId: string): void => {
    setConsoleProblem(null)
    showConsole(sessionId).catch((e: unknown) => setConsoleProblem(e instanceof Error ? e.message : String(e)))
  }

  /**
   * Run one workspace act and KEEP ITS ANSWER (UXA-C03).
   *
   * It used to take `() => Promise<unknown>`, which erased all three answers by
   * signature before anything could read them. The act now says what it did,
   * and `said` turns that into the one sentence the operator sees — or null,
   * for a dialog they simply closed.
   */
  const answer = <T,>(
    act: () => Promise<T>,
    said: (r: T) => WorkspaceSaid | null,
    id: string
  ) => (): void => {
    setWsBusy(id)
    setWsSaid(null)
    void act()
      .then(async (r) => {
        setWsSaid(said(r))
        setWs(await window.fabric.workspace.state())
      })
      // A throw does not say whether the act landed, so it is reported as
      // itself and the state is re-read — the truth about what happened is
      // there, not in a reason invented here.
      .catch(async (e: unknown) => {
        setWsSaid(saidOfThrow(e))
        await window.fabric.workspace
          .state()
          .then(setWs)
          .catch(() => {})
      })
      .finally(() => setWsBusy(null))
  }

  // The 0.3.14 review, iteration 2, UX-16: each number opens where it is counted. «агентов работает» opens the first
  // agent working now; «работают без задачи» the first of the sessions the sweep counted; with none, Агенты itself.
  // The mockup parity (home gaps D3, D7): the agents AT work, newest work first (the reading's order); «работают без
  // задачи» opens the first of those at work holding no task. An older reading: the agents that signed, and the sweep's.
  const working = home.view?.atWork
    ? home.view.live.filter((a) => a.atWork).map((a) => a.sessionId)
    : (home.view?.live ?? []).filter((a) => !a.stale).map((a) => a.sessionId)
  // Every project name the home prints is `projectDisplayName`'s (the mockup parity, rail gap §2).
  // An id no list knows prints no id (the 0.3.15 review, iteration 1, UX-5): null, and the caller says it its own way.
  const nameOfProject = (id: string): string | null => {
    const p = (projects ?? []).find((x) => x.id === id)
    const names = home.view?.displayNames ?? null
    if (!p && !names?.[id]) return null
    return projectDisplayName(p ?? { id, name: id }, names)
  }
  const noTaskSessions = home.view?.atWork ? home.view.atWork.noTaskSessions : (home.view?.unclaimedSessions ?? [])
  const openFirst = (sessions: readonly string[]): void => {
    const first = sessions.find((id) => home.view?.live.some((a) => a.sessionId === id))
    if (first && onAgent) onAgent(first)
    else onAgents()
  }

  // 0.3.14, the simple Fabric §4: the right column holds only what needs the person: «Нужны вы» and the board's
  // requests no agent has answered. The live feed moved to История («Что делали агенты» shows it). CO-476: below
  // 1100 px it is rendered between the strip and «В работе», where the narrow layout shows it.
  const side = (
    <aside className="lh-side-column" aria-label={t('launch.home.side')}>
      <HomeBoard onTotal={setOwnWaiting} nameOf={nameOfProject} feedMark={markOf(marks, NEEDS_YOU_FAMILIES)} onBoard={(item) => (onNeeds ? onNeeds(item) : onBoard())} onAddTopic={onAddTopic} />
      {/* 0.3.9 BD-2: requests between projects no agent is answering now, outside Comms (no unread figure: review i1 UX-1). */}
      <HomeBoardWaiting mark={markOf(marks, ['comms'])} onComms={onComms} nameOf={nameOfProject} />
    </aside>
  )
  return (
    <div className="estate-home lp" data-launch-view="launch-home">
      {/* A question on Главная (ADR-0160 §5): the local database reachable from the network, with its fix. */}
      <StackExposureNotice />
      {/* A7-012: no usage count leaves until this is answered (or the switch in Settings is), asked here once. */}
      <UsageCountsNotice />
      {/* M118 — the question, asked once. There is no "later": declining IS
          later, it is recorded, and it can be changed. A banner with a dismiss
          would turn "nobody has been asked" into a hidden state, which is the
          thing three states exist to prevent. */}
      {ws?.git === 'unanswered' && (
        <Banner
          actions={
            <>
              <Button
                disabled={wsBusy !== null}
                onClick={answer(() => window.fabric.workspace.choose(), saidOfChoose, 'choose')}
              >
                {t('workspace.choose')}
              </Button>
              <Button
                tone="ghost"
                disabled={wsBusy !== null}
                onClick={answer(() => window.fabric.workspace.adopt(), saidOfAdopt, 'adopt')}
              >
                {t('workspace.adopt')}
              </Button>
              <Button
                tone="ghost"
                disabled={wsBusy !== null}
                onClick={answer(() => window.fabric.workspace.decline(), () => null, 'decline')}
              >
                {t('workspace.decline')}
              </Button>
            </>
          }
        >
          {t('workspace.ask')}
          {/* WHAT IT WILL NOT BRING BACK, composed from the coverage rather
              than written (AX-12). `restorability()` is described in
              `archive.ts` as the function that "refuses the word" backup, and
              until now NOTHING called it: no renderer file imported the
              contract at all, so the same file's claim that "the screen names
              the absences" was true of no screen. Beside the decision it
              informs, and only while that decision is open — a caveat printed
              for ever becomes furniture. */}
          <p className="muted">{t('workspace.absences', { list: absences })}</p>
        </Banner>
      )}
      {/* WHAT IS WAITING IS LESS THAN EVERYTHING (UXA-C01, UXA-C02). Above the
          cards, because it qualifies every one of them at once. Two sentences
          and one decision: unreadable means the chips are missing rather than
          zero, partial means the chips are real and are not totals — a source
          refused, or the refusal window was cut. One sentence in one place
          beats a chip on each card saying nothing. */}
      {/* WHAT THE LAST WORKSPACE ACT DID (UXA-C03). Outside the question's own
          banner, because the question disappears the moment it is answered and
          an outcome held inside it would vanish with it. */}
      {wsSaid && (
        <Banner tone={wsSaid.said === 'adopted' ? 'warn' : 'error'}>
          {wsSaid.said === 'adopted'
            ? t('workspace.adopted', { projects: wsSaid.projects, agents: wsSaid.agents })
            : wsSaid.said === 'refused'
              ? t('workspace.adoptRefused', { reason: wsSaid.why })
              : wsSaid.said === 'unversioned'
                ? t('workspace.unversioned', { reason: wsSaid.why })
                : t('workspace.actFailed', { reason: wsSaid.why })}
        </Banner>
      )}
      {waitProblem && (
        <Banner tone="warn">
          {waitProblem.kind === 'unreadable'
            ? t('estate.waitingUnavailable', { reason: waitProblem.why })
            : t('estate.waitingPartial', { reason: waitProblem.why })}
        </Banner>
      )}
      {wsUnread && (
        <Banner tone="warn">
          {t('workspace.stateUnread')}
          <MachineDetail text={wsUnread} />
        </Banner>
      )}

      {consoleProblem && <FailureNote said={t('launch.home.agents.consoleFailed')} detail={consoleProblem} />}
      {/* The approved mockup (2026-10-26, `.cols`): ONE grid for the whole home. The left column holds the hero, the strip
          and «В работе»; the right column holds «Нужны вы» and the unanswered requests from the very top (gap map A3). */}
      <div className="lh-layout lh-home">
        <div className="lh-main-column">
          {/* The operator's review, 2026-10-26: the CEO's face and greeting, then the activity chart, as one framed card
              laid out face | words | chart (gap map B1, B2). */}
          <header className="lh-hero">
            <FabricAvatar size="small" label={t('launch.avatar.label')} />
            <div className="lh-hero-words">
              {/* SP-1 (2026-11-12): the top bar names the place; the heading stays for focus and a screen reader. */}
              <h2 className="visually-hidden" tabIndex={-1}>{t('launch.brand.product')}</h2>
              {/* SCN-163 step 1 (CO-391): the state in one sentence, counted from what only the person resolves. */}
              <p className="lh-greeting" data-testid="home-greeting">
                {[t(`launch.home.greet.${dayPart(now)}` as 'launch.home.greet.day'),
                  personWaiting === null ? null : personWaiting > 0 ? t(`launch.home.greet.waiting.${pluralForm(locale, personWaiting)}`, { count: personWaiting }) : t('launch.home.greet.clear')].filter(Boolean).join(' ')}
              </p>
            </div>
            <HomeRhythm feed={feed} now={now} onPulse={onPulse} rhythm={rhythm} />
          </header>
          {/* 0.3.14, the simple Fabric §2a: the statistics strip, six numbers, each opening where it is counted. */}
          <HomeStats reading={home} waiting={waitingForYou === undefined ? (counts ? Object.values(counts).reduce((n, c) => n + c.total, 0) : null) : personWaiting}
            toReview={toReview === undefined ? undefined : (toReview?.total ?? null)}
            onAgents={() => openFirst(working)} onBoard={onBoard} onWaiting={() => (onNeeds ?? onBoard)()} onReview={onReview}
            onAbandoned={onBoard} onUnclaimed={() => openFirst(noTaskSessions)} />
          {narrow && side}
          {/* 0.3.14, the simple Fabric §2b: «В работе» by project, its agents with branch, task and last report. It replaces
              «Где остановились», the two lanes and «Агенты в работе»; finished work lives on the agent's and project's pages. */}
          <HomeInWork reading={home} projects={projects} terminals={sessions}
            waitingByProject={waitingForYou === undefined ? (counts ? Object.fromEntries(Object.entries(counts).map(([id, c]) => [id, c.total])) : null) : (waitingForYou?.byProject ?? null)}
            onProject={onOpen}
            onAgent={(sessionId) => {
              if (onAgent) return onAgent(sessionId)
              const a = home.view?.live.find((l) => l.sessionId === sessionId)
              if (a?.console) openConsole(sessionId)
              else if (a?.projectId) onOpen(a.projectId)
            }}
            onTask={(projectId, taskId) => (onOpenEntity ? onOpenEntity(projectId, { kind: 'task', id: taskId }) : onOpen(projectId))} />

        </div>
        {!narrow && side}
      </div>
    </div>
  )
}
