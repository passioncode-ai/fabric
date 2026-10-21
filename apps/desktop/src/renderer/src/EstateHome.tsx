import { StackExposureNotice } from './StackExposureNotice'
import { UsageCountsNotice } from './UsageCountsNotice'
import type { FeedEvent, ProjectRow, Quota, TerminalSession } from '../../shared/types'
import { markOf, type FeedMarks } from '../../shared/feedMarks.ts'
import { Banner, Button, EmptyState, Panel, Row, StateChip, Toolbar } from './components'
import { Feed } from './Feed'
import { useEffect, useState } from 'react'
import { FAVOURITE_LIMIT, offersFavourites, partitionByFavourite } from '../../shared/favourites.ts'
import { resumePoint } from '../../shared/homeView.ts'
import { FabricAvatar } from './launch/FabricAvatar'
import { HomeBoard, HomeLive, HomeRhythm } from './launch/HomeParts'
import { HomeAgents, HomeStats, HomeWorkLanes, useHome } from './launch/HomeWork'
import { HomeBoardWaiting } from './launch/HomeBoardWaiting'
import { orderProjects } from '../../shared/homeLive.ts'
import { since } from './duration'
import {
  waitingCounts,
  waitingProblem,
  type WaitingReading
} from '../../shared/attention.ts'
import {
  saidOfAdopt,
  saidOfChoose,
  saidOfThrow,
  type WorkspaceSaid
} from '../../shared/workspaceAct.ts'
import { ProfileSection } from './ProfileSection'
import { FailureNote, MachineDetail } from './OperatorError'
import { describeEvent, useLocale, useT } from './i18n'
import { en, type StringKey } from './i18n/en'
import { declaredCoverage, restorability } from '../../shared/storageContract.ts'
import { cursorFor } from '../../shared/inbox.ts'
import type { EntityRef } from '../../shared/entityRef'
import { useOpenConsole } from './consoles'

export function EstateHome({
  projects,
  sessions,
  feed,
  marks,
  readThroughSeq,
  onRead,
  onOpen,
  onOpenEntity,
  onNew,
  onBoard = () => {},
  onAddTopic,
  onPulse,
  onPersona,
  onAgents = () => {},
  onComms
}: {
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
  /** How far this operator has read the estate's history (AX-07). */
  readThroughSeq: number
  /** Move the read position. Called from an ACT and nowhere else — a cursor
   *  advanced by arrival marks read what nobody looked at, and the unread count
   *  then measures polling rather than attention. */
  onRead: (throughSeq: number) => Promise<void>
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
  /** "+ Add a topic" under the board lane: the board, with its topic form open (launch prototype SCR-30). */
  onAddTopic?: () => void
  /** Where «Вся активность» and the rhythm lead (SCR-42); without it, the folded journal. */
  onPulse?: () => void
  /** «Мой облик» under the identity (SCR-36). */
  onPersona?: () => void
  /** «Все агенты»: the live consoles (SCR-50). */
  onAgents?: () => void
  /** Comms (SCR-81), from what waits on the project board (0.3.9 BD-2). */
  onComms?: () => void
}): React.JSX.Element {
  const t = useT(), locale = useLocale()
  const showConsole = useOpenConsole()
  const [now] = useState(() => new Date())
  const [moreOpen, setMoreOpen] = useState(false)
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
  /**
   * The read position this build may actually use (AX-07).
   *
   * A cursor is a position in ONE journal, and a restore mints a new generation
   * whose sequence starts again — so a saved position past everything the
   * estate holds would mark the whole history read and show an empty feed to
   * someone who has never looked at it.
   */
  const highestSeq = (feed ?? []).reduce((top, e) => (e.seq > top ? e.seq : top), 0)
  const cursorReading = cursorFor({ saved: { throughSeq: readThroughSeq }, highestSeq })
  const cursor = cursorReading.cursor
  /** What is ON SCREEN, which is what an act may mark read. */
  const visibleThroughSeq = highestSeq
  const unread = (feed ?? []).filter((e) => e.seq > cursor.throughSeq).length
  const read = projects !== null
  const rows = projects ?? []
  const empty = read && rows.length === 0
  const [pins, setPins] = useState<string[]>([])
  /** A pin that did not reach the disk. `toggle` used to return the value it
   *  HOPED had been written, so a full disk lost the pins silently (S14). */
  /** A pin or order that did not save: our sentence, and the machine's reason apart from it (UX-5). */
  const [pinProblem, setPinProblem] = useState<{ said: string; detail: string | null } | null>(null)
  /** The project the operator tried to pin as the sixth. Held until they say
   *  which to release — SCN-043 step 2 — because a silent drop undoes the
   *  decision they made with a click (UX28-10). */
  const [pinFull, setPinFull] = useState<ProjectRow | null>(null)
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
  useEffect(() => {
    // A failed read is said, never an empty set of pins that looks like none were chosen (0.3.6 review i2 ER-4).
    window.fabric.favourites.list().then(setPins).catch((e: unknown) =>
      setPinProblem({ said: t('estate.pinsUnread'), detail: e instanceof Error ? e.message : String(e) }))
  }, [])
  /** Who is doing what (operator request 2026-10-14): one reading for the counts, the board's work lanes, the live
   *  agents and each project's «сейчас». It follows the families that change it — claims, tasks, stage reports and
   *  sessions — and its own 15 s tick for silence. */
  const home = useHome(markOf(marks, ['work', 'task', 'agent', 'session']))
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
  const waitProblem = waitingProblem(waiting)
  // PARTITION, not overlay: a pinned project shown here AND in the list below
  // is the same card twice, and the operator can act on the wrong one.
  const { pinned, rest, missing } = partitionByFavourite(rows, pins)
  /** Below the threshold the whole step is ceremony (SCN-043 step 3): ranking
   *  five of six saves nobody a scroll, and a control that appears before it is
   *  useful teaches an operator to ignore it. */
  const pinning = offersFavourites(rows.length)
  const resume = resumePoint(feed, cursor.throughSeq)
  const resumeProject = resume ? (rows.find((p) => p.id === resume.projectId) ?? null) : null

  /** Favourites first in the operator's own order (↑ ↓ move them); then the rest by their latest activity, newest
   *  first (operator request 2026-10-14) — the project worked on last is the one looked for first. */
  const shown = [...pinned, ...orderProjects(rest, [], (id) => pulse.get(id)?.lastActivityAt ?? null)]
  const move = (p: ProjectRow, dir: 'up' | 'down'): void => {
    void window.fabric.favourites
      .move(p.id, dir, [])
      .then((r) => {
        setPins(r.pins)
        setPinProblem(r.saved ? null : { said: t('launch.home.projects.moveFailed'), detail: r.reason ?? null })
      })
      .catch((e: unknown) => setPinProblem({ said: t('launch.home.projects.moveFailed'), detail: e instanceof Error ? e.message : String(e) }))
  }

  const row = (p: ProjectRow): React.JSX.Element => {
    const live = (sessions ?? []).filter((s) => s.projectId === p.id && s.running).length
    /** Null when nothing waits here AND when the estate cannot say — the two are
     *  told apart by the banner above the list, not by a chip on every row. */
    const waits = counts?.[p.id] ?? null
    const isPinned = pins.includes(p.id)
    // Only favourites move by hand; the rest are ordered by activity.
    const at = pinned.findIndex((g) => g.id === p.id)
    const pp = pulse.get(p.id)
    return (
      <article key={p.id} className="lp-project-row">
        <span className="lp-project-icon" aria-hidden="true">{(p.name.trim()[0] ?? '·').toUpperCase()}</span>
        <div>
          {/* A link-looking control that opens the project; the row's tools are
              SIBLINGS, never nested inside it (a button inside a button). */}
          <button type="button" className="lp-project-name" onClick={() => onOpen(p.id)}>{p.name}</button>
          <p className="lp-meta">{p.purpose || t('project.noPurpose')}</p>
          {/* What the agents are doing here now, in their own words — or when it last moved. */}
          {pp?.now ? (
            <p className="lh-project-now"><span className="lh-live-indicator" aria-hidden="true" />{t('launch.home.projects.now', { text: pp.now.text })}</p>
          ) : pp?.lastActivityAt ? (
            <p className="lp-meta lh-project-quiet">{t('launch.home.projects.quietSince', { when: since(pp.lastActivityAt, t) })}</p>
          ) : null}
        </div>
        <div className="lp-project-tools">
          {waits && <span className={`lp-pill ${waits.refused > 0 ? 'danger' : 'attention'}`}>{t('estate.waiting', { count: waits.total })}</span>}
          {(pp?.live ?? live) > 0 && <span className="lp-pill live">{t('launch.home.projects.live', { count: pp?.live ?? live })}</span>}
          {(pp?.review ?? 0) > 0 && <span className="lp-pill">{t('launch.home.projects.review', { count: pp!.review })}</span>}
          {/* «idle» only from a home reading that happened: before it, or after it failed, nothing is known (i2 ER-2). */}
          {home.view && !home.problem && !waits && !(pp?.live ?? live) && !(pp?.review ?? 0) && <span className="lp-pill">{t('estate.idle')}</span>}
          {pinning && (
            <>
              <button type="button" className="lp-button" aria-pressed={isPinned}
                aria-label={`${isPinned ? t('estate.unpin') : t('estate.pin')}: ${p.name}`}
                onClick={() =>
                  void window.fabric.favourites.toggle(p.id).then((r) => {
                    setPins(r.pins)
                    setPinProblem(r.saved ? null : { said: t(r.reason ? 'estate.pinFailed' : 'estate.pinNotSaved'), detail: r.reason ?? null })
                    // AT THE LIMIT IS NEITHER a failure nor a success: nothing was
                    // written and nothing was dropped. The operator says which to
                    // release, and until they do the set on screen is the set on disk.
                    setPinFull(r.atLimit ? p : null)
                  }).catch((e: unknown) => setPinProblem({ said: t('estate.pinFailed'), detail: e instanceof Error ? e.message : String(e) }))
                }>
                {isPinned ? t('glyph.star') : t('glyph.starEmpty')}
              </button>
              {isPinned && (
                <>
                  <button type="button" className="lp-button" aria-label={t('launch.home.projects.up', { name: p.name })}
                    disabled={at <= 0} onClick={() => move(p, 'up')}>{t('glyph.up')}</button>
                  <button type="button" className="lp-button" aria-label={t('launch.home.projects.down', { name: p.name })}
                    disabled={at < 0 || at >= pinned.length - 1} onClick={() => move(p, 'down')}>{t('glyph.down')}</button>
                </>
              )}
            </>
          )}
        </div>
      </article>
    )
  }

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
      {pinProblem && (
        <Banner tone="warn" actions={<Button tone="ghost" onClick={() => setPinProblem(null)}>{t('common.dismiss')}</Button>}>
          {pinProblem.said}
          <MachineDetail text={pinProblem.detail} />
        </Banner>
      )}

      {/* WHICH TO RELEASE (SCN-043 step 2). The set is full, nothing has been
          written, and the operator chooses — one release per pinned project,
          because "pick one" with no list is a question nobody can answer. The
          swap is ONE write: two would leave a window with four pinned and lose
          the released one if the second failed. */}
      {pinFull && (
        <Banner
          tone="warn"
          actions={
            <Button tone="ghost" onClick={() => setPinFull(null)}>
              {t('common.keep')}
            </Button>
          }
        >
          <span data-testid="pin-full">
            {t('estate.pinFull', { name: pinFull.name, limit: FAVOURITE_LIMIT })}
          </span>
          <Toolbar>
            {pinned.map((p) => (
              <Button
                key={p.id}
                tone="quiet"
                onClick={() => {
                  const add = pinFull
                  setPinFull(null)
                  void window.fabric.favourites.replace(p.id, add.id).then((r) => {
                    setPins(r.pins)
                    setPinProblem(r.saved ? null : { said: t(r.reason ? 'estate.pinFailed' : 'estate.pinNotSaved'), detail: r.reason ?? null })
                  }).catch((e: unknown) => setPinProblem({ said: t('estate.pinFailed'), detail: e instanceof Error ? e.message : String(e) }))
                }}
              >
                {t('estate.pinRelease', { name: p.name })}
              </Button>
            ))}
          </Toolbar>
        </Banner>
      )}

      {/* A FAVOURITE WHOSE PROJECT IS NOT HERE (SCN-043 alt path). It is skipped
          rather than unpinned — deleting the id on a read would mean a transient
          failure to load a project quietly unpins it — and that is exactly why
          it has to be SAID: otherwise a pinned project is simply absent, which
          is a dead card's silent cousin. */}
      {missing.length > 0 && (
        <p className="muted" data-testid="pin-missing">
          {t('estate.pinMissing', { count: missing.length })}
        </p>
      )}

      <div className="lh-top">
        <header className="lh-overview">
          <div className="lh-identity">
            <FabricAvatar size="small" label={t('launch.avatar.label')} />
            <div>
              <p className="lp-kicker">{t('launch.home.kicker')}</p>
              <h2 tabIndex={-1}>{t('launch.brand.product')}</h2>
              {onPersona && <button type="button" className="lp-button lh-text-link" onClick={onPersona}>{t('launch.home.persona')}</button>}
            </div>
          </div>
          <HomeRhythm feed={feed} now={now} onPulse={onPulse} />
          <HomeStats reading={home} waiting={counts ? Object.values(counts).reduce((n, c) => n + c.total, 0) : null}
            onAgents={onAgents} onBoard={onBoard} />
        </header>
        <section className="lp-panel lh-resume" aria-labelledby="home-resume-title">
          <p className="lp-kicker">{t('launch.home.resume.kicker')}</p>
          {resume && resumeProject ? (
            <>
              <h3 id="home-resume-title">{resumeProject.name}</h3>
              <p>{describeEvent(t, resume.type)}</p>
              <div className="lp-panel-head">
                <span className="lp-meta">
                  {resume.unread > 0 ? t('launch.home.resume.unread', { count: resume.unread }) : t('launch.home.resume.read')}
                </span>
                <button type="button" className="lp-button lh-text-link" onClick={() => onOpen(resumeProject.id)}>
                  {t('launch.home.resume.continue')}
                </button>
              </div>
              <details>
                <summary>{t('launch.home.resume.last')}</summary>
                <p>{t('launch.home.resume.lastAt', { when: new Date(resume.occurredAt).toLocaleString(locale), project: resumeProject.name })}</p>
              </details>
            </>
          ) : (
            <>
              <h3 id="home-resume-title">{rows.length ? rows[0].name : t('launch.home.resume.first')}</h3>
              <p>{feed === null ? t('journal.reading') : t('launch.home.resume.none')}</p>
              {rows.length ? (
                <button type="button" className="lp-button lh-text-link" onClick={() => onOpen(rows[0].id)}>{t('launch.home.resume.continue')}</button>
              ) : (
                read && <button type="button" className="lp-button" onClick={onNew}>{t('estate.createFirst')}</button>
              )}
            </>
          )}
        </section>
      </div>

      {consoleProblem && <FailureNote said={t('launch.home.agents.consoleFailed')} detail={consoleProblem} />}
      <div className="lh-layout">
        <div className="lh-main-column">
          <HomeBoard feedMark={markOf(marks, ['task', 'work', 'question', 'goal'])} onBoard={onBoard} onAddTopic={onAddTopic} />
          {/* 0.3.9 BD-2: requests between projects no agent is answering now, outside Comms (no unread figure: review i1 UX-1). */}
          <HomeBoardWaiting mark={markOf(marks, ['comms'])} onComms={onComms} />
          <HomeWorkLanes reading={home} onOpen={onOpen} onSession={openConsole} onBoard={onBoard} />

          <section className="lp-projects lh-projects" id="sec-estate-projects" aria-labelledby="home-projects-title">
            <div className="lp-panel-head">
              <div>
                <p className="lp-kicker">{t('launch.home.projects.kicker')}</p>
                <h3 id="home-projects-title">{t('launch.home.projects.title')}</h3>
              </div>
              <button type="button" className="lp-button" onClick={onNew}>{t('launch.home.projects.new')}</button>
            </div>
            {/* ONE element, not a branch: `read` is what the component exists to decide. */}
            {empty || !read ? (
              <EmptyState read={read} loud waiting={t('estate.reading')}>
                {t('estate.empty')} <Button onClick={onNew}>{t('estate.createFirst')}</Button>
              </EmptyState>
            ) : (
              <>
                {shown.map(row)}
                {pinning && <p className="lp-meta">{t('launch.home.projects.note')}</p>}
              </>
            )}
          </section>

          {/* Not on the launch home of the design: quotas live under Manage, the
              journal under Pulse and the profile behind Profile. Until those
              screens exist they stay here, folded, rather than disappear. */}
          <details className="lp-panel" id="sec-estate-more" open={moreOpen} onToggle={(e) => setMoreOpen((e.currentTarget as HTMLDetailsElement).open)}>
            <summary>{t('launch.home.more')}</summary>
            <ProfileSection onError={() => {}} />

      <Panel
        id="sec-estate-journal"
        title={t('estate.journal')}
        actions={
          // Only when there IS something unread, and only over what is on
          // screen: `visibleThroughSeq` is the highest seq RENDERED, not the
          // highest known, so marking read cannot swallow rows the operator
          // never saw (AX-07).
          unread > 0 ? (
            <Button
              tone="ghost"
              onClick={() => void onRead(visibleThroughSeq)}
              disabled={visibleThroughSeq <= cursor.throughSeq}
            >
              {t('journal.markRead', { count: unread })}
            </Button>
          ) : undefined
        }
      >
        {!cursorReading.usable && <p className="muted">{cursorReading.says}</p>}
        <Feed events={feed} projects={rows} onOpen={onOpenEntity} />
      </Panel>
          </details>
        </div>
        <aside className="lh-side-column">
          <HomeAgents reading={home} onOpen={onOpen} onSession={openConsole} onAll={onAgents} />
          <HomeLive feed={feed} projects={rows} sessions={sessions} now={now} onOpen={onOpen}
            onAll={() => {
              if (onPulse) return onPulse()
              setMoreOpen(true)
              setTimeout(() => document.getElementById('sec-estate-journal')?.scrollIntoView({ block: 'start' }), 0)
            }} />
        </aside>
      </div>
    </div>
  )
}
