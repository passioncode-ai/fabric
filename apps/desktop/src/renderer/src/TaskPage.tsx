// One task, whole (M146 step 5 · SCR-32).
//
// WHAT THIS PAGE REFUSES TO BECOME. The operator's constraint when the intake
// was registered was exact: do not make a second set of documentation — this is
// context for a task, and it may LINK to the docs. So the page holds a brief,
// working notes and receipts, and the one durable act it offers is moving a
// note OUT of the task and into project memory. The note is not copied and not
// deleted; it keeps a pointer to where the knowledge went. That is §1 of
// `operating-surfaces.md` made operable: working context is bounded and
// disposable, knowledge lives in one place and outlives it.
//
// The receipts are rendered by `Feed` rather than by anything written here.
// They are the same journal rows the estate shows, and a second renderer for
// them is a second chance to disagree about what an event means.
//
// SIMPLE (the operator, 2026-11-12: «простота, от пользователя только простой инпут или выбор, и ёмкий лаконичный
// интерфейс»). One column read top down: the title with one line of facts, the brief as text, the notes with one box,
// and what is rarely needed folded below. No machine id reaches the person (a session, a claim, `agent:<uuid>`); a
// brief part becomes a box only when the person asks to change it, one part at a time.

import { useEffect, useRef, useState } from 'react'
import {
  briefKey,
  clearDraft,
  draftFor,
  draftOr,
  fieldSubmission,
  setDraft,
  submission,
  type Drafts
} from '../../shared/drafts.ts'
import type { ProjectRow, TaskDetail, TaskNote } from '../../shared/types'
import { Banner, Button, EmptyState, Row, StateChip, Toolbar } from './components'
import { Feed } from './Feed'
import { useLocale, useT } from './i18n'
import { originDocument } from '../../shared/origin.ts'
import { specGaps, specMissing } from '../../shared/taskSpec.ts'
import { taskMoves } from '../../shared/taskMoves.ts'
import { since } from './duration'
import { ConsoleDetails, ContextTab, RunCallout, runStateWord, useRunStatus } from './launch/AgentWorkspace'
import { runnerLabel } from './runnerLabel'
import { projectDisplayName } from '../../shared/projectDisplayName.ts'
import { useOpenConsole } from './consoles'
import { CrossProjectConsole } from './launch/CrossProjectConsole'
import { ReviewDecision } from './launch/ReviewDecision'
import { reviewAsk } from '../../shared/reviewDecision.ts'

export function TaskPage({
  project,
  taskId,
  onBack,
  backLabel,
  onChanged,
  onError,
  onOpenTask,
}: {
  project: ProjectRow
  taskId: string
  /** Kept for callers; the task page no longer carries the project's strip (2026-11-12, one header). */
  lastEventAt?: string | null
  onPulse?: () => void
  onBack: () => void
  /** Where the way back goes when it is not the project (CO-394), e.g. «← К доске». */
  backLabel?: string
  onChanged: () => Promise<void>
  onError: (message: string) => void
  /** Open another task — the sibling list is navigable or it is a printout. */
  onOpenTask?: (taskId: string) => void
}): React.JSX.Element {
  const t = useT()
  const showConsole = useOpenConsole()
  const locale = useLocale()
  // WHOSE detail this is, carried WITH it (UX28-01). A bare `TaskDetail` cannot
  // answer "is this the task on screen", so a response for A that arrived after
  // the operator moved to B rendered under B's address with total confidence.
  const [shown, setShown] = useState<{ taskId: string; detail: TaskDetail } | null>(null)
  const [loadFailed, setLoadFailed] = useState<string | null>(null)
  const detail = shown && shown.taskId === taskId ? shown.detail : null
  // Keyed to the task (S01). One string plus a prop id let a note typed for A be
  // submitted against B after a switch; the text belonged to A and the row it
  // landed on did not.
  const [drafts, setDrafts] = useState<Drafts>({})
  const note = draftFor(drafts, taskId)
  const setNote = (v: string): void => setDrafts((d) => setDraft(d, taskId, v))
  const [problem, setProblem] = useState<string | null>(null)
  const [researching, setResearching] = useState(false)
  /** The brief parts open for a change, by their draft key: a part is a box only while the person changes it. */
  const [editing, setEditing] = useState<ReadonlySet<string>>(new Set())
  const run = useRunStatus(detail?.task.session_id ?? null)

  // Which task the page is FOR, readable from inside a resolved promise. The
  // prop is captured at call time and cannot answer "is this still wanted".
  const wanted = useRef(taskId)

  const load = async (): Promise<void> => {
    // The id this read was FOR travels with the answer, and a stale answer is
    // DISCARDED rather than stored. Storing it and filtering at render was the
    // first shape of this fix and it was worse than the defect: A's late
    // response replaced the state, so B's page went blank instead of showing A.
    // An answer about the past is not news; it is noise.
    const asked = taskId
    setLoadFailed(null)
    try {
      const got = await window.fabric.tasks.detail(asked)
      if (wanted.current !== asked) return
      setShown({ taskId: asked, detail: got })
    } catch (e) {
      if (wanted.current !== asked) return
      // Local, and only for the task it was asked about: a global banner cannot
      // say WHICH task failed, and leaves this page rendering nothing with no
      // way back.
      setLoadFailed(String(e))
      onError(String(e))
    }
  }
  useEffect(() => {
    wanted.current = taskId
    void load()
  }, [taskId])

  const addNote = async (): Promise<void> => {
    // The key travels WITH the text, so the target cannot come from elsewhere.
    const send = submission(drafts, taskId)
    if (!send) return
    try {
      await window.fabric.tasks.note(send.key, send.text)
      setDrafts((d) => clearDraft(d, send.key))
      await load()
    } catch (e) {
      onError(String(e))
    }
  }

  const promote = async (row: TaskNote): Promise<void> => {
    setProblem(null)
    try {
      await window.fabric.tasks.promote(row.id)
      await load()
      await onChanged()
    } catch (e) {
      // Promoting twice is refused by the handler, and the refusal is shown
      // rather than swallowed: "it is in memory once" is the answer.
      setProblem(String(e))
    }
  }

  // One save per key at a time. `onBlur` fires twice easily — a click that moves
  // focus and then a window blur — and the old guard compared against `detail`,
  // which the reload had not refreshed yet, so both passed and the journal took
  // two `task.brief.edited@1` events for one edit.
  const inFlight = useRef<Set<string>>(new Set())

  const saveBrief = async (section: 'what' | 'why' | 'expected', saved: string): Promise<void> => {
    // The KEY carries the task and the section, and the text is read from that
    // same key. This is the whole fix: the target cannot come from the props
    // while the words come from a DOM node the props never touched.
    const key = briefKey(taskId, section)
    const send = fieldSubmission(drafts, key)
    if (!send) return
    if (send.text === saved) return
    if (inFlight.current.has(key)) return
    inFlight.current.add(key)
    setProblem(null)
    try {
      await window.fabric.tasks.brief(taskId, section, send.text)
      // Only after it landed. Clearing on submit would lose the words to any
      // failure between here and the server.
      setDrafts((d) => clearDraft(d, key))
      setEditing((e) => { const n = new Set(e); n.delete(key); return n })
      await load()
    } catch (e) {
      // The draft STAYS. A failed save that also empties the box is the same
      // data loss the save was supposed to prevent, arriving by another door.
      setProblem(String(e))
    } finally {
      inFlight.current.delete(key)
    }
  }

  // Loading and failed are DIFFERENT, and Back is reachable from both. The page
  // used to render one empty state for either, with no way off it: a task whose
  // detail failed to load was a dead end.
  if (!detail)
    return (
      <div className="lp lp-task">
        <button type="button" className="lp-back" onClick={onBack}>{backLabel ?? t('launch.agent.back')}</button>
        {loadFailed ? <Banner tone="warn">{loadFailed}</Banner> : <p className="lp-meta">{t('task.reading')}</p>}
      </div>
    )

  const task = detail.task
  const sections: { key: 'what' | 'why' | 'expected'; label: string; value: string | null }[] = [
    { key: 'what', label: t('task.what'), value: task.brief_what },
    { key: 'why', label: t('task.why'), value: task.brief_why },
    { key: 'expected', label: t('task.expected'), value: task.brief_expected }
  ]

  const agentLabel = task.option_id ? runnerLabel(task.option_id, t) : t('launch.home.live.agent')
  const agentName = projectDisplayName(project)
  const moves = taskMoves(detail.events)
  // A state in the Board's own column words («Очередь», «В работе», «На проверке», «Готово», «Отменено»), so a move reads
  // as the kanban shows it (0.3.12 review UX-12); an unknown one stays as written.
  const stateWord = (state: string): string =>
    ['backlog', 'running', 'review', 'done', 'cancelled'].includes(state) ? t(`launch.kanban.${state}` as 'launch.kanban.backlog') : state
  // Who, in words (2026-11-12): `agent:<uuid>` is the agent, the operator is «вы»; any other name stays as written.
  const who = (id: string | null): string | null =>
    !id ? null : id.startsWith('agent:') || id === 'agent' ? t('task.who.agent') : ['operator', 'person', 'human'].includes(id) ? t('task.who.you') : id
  const briefEmpty = !task.brief_what?.trim() && !task.brief_why?.trim() && !task.brief_expected?.trim()
  // SCN-179 (CO-521): a task in review asks the person one decision; what does not bear on it (no run yet, a spec still
  // to gather) is not said on it.
  const ask = reviewAsk(task.status, detail.events)
  const toGather = specMissing(task) && task.status !== 'review'
  const runFact = task.session_id
    ? run.view?.data?.ordinal
      ? t('task.fact.run', { n: run.view.data.ordinal, state: runStateWord(run.view.data, t) })
      : run.failed ? t('task.fact.runUnreadable') : null
    : null
  // A claim is said only while it holds, by the agent's name; a lapsed one («до 0 с») says nothing (2026-11-12).
  const leaseLive = detail.lease && Date.parse(detail.lease.expires_at) > Date.now()
  const heldFact = leaseLive
    ? t('task.fact.held', { who: detail.lease!.owner_session === task.session_id ? agentName : t('task.who.otherSession'), until: since(detail.lease!.expires_at, t) })
    : null
  const handoff = task.assigned_by && task.assigned_to ? t('task.handoff', { by: who(task.assigned_by)!, to: who(task.assigned_to)! }) : null
  const facts = [
    `${agentName} · ${agentLabel}`,
    handoff,
    runFact,
    heldFact,
    t('task.fact.created', { date: new Date(task.started_at).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) })
  ].filter((f): f is string => !!f)
  const instruction = task.instruction?.trim() ?? ''
  const showInstruction = !!instruction && instruction !== (task.title ?? '').trim()
  const open = (key: string): boolean => editing.has(key) || draftFor(drafts, key) !== ''
  const startEdit = (key: string): void => setEditing((e) => new Set(e).add(key))
  const stopEdit = (key: string): void => {
    setDrafts((d) => clearDraft(d, key))
    setEditing((e) => { const n = new Set(e); n.delete(key); return n })
  }
  const saveOrClose = async (section: 'what' | 'why' | 'expected', saved: string): Promise<void> => {
    const key = briefKey(taskId, section)
    const send = fieldSubmission(drafts, key)
    if (!send || send.text === saved) { stopEdit(key); return }
    await saveBrief(section, saved)
  }
  return (
    <div className="lp lp-task" data-launch-view="launch-agent">
      {/* OF-22 (the operator's walk, 2026-10-22): the way back sits at the top left, above the title. The open task is the
          project page's own state, so the top bar's «‹» does not close it; this does. */}
      <button type="button" className="lp-back" onClick={onBack}>{backLabel ?? t('launch.agent.back')}</button>
      <header className="lp-task-head">
        <div>
          <h2 tabIndex={-1} title={task.title ?? task.instruction}>{task.title ?? task.instruction}</h2>
          <p className="lp-task-facts">
            <span className={`lp-pill ${task.status === 'review' ? 'attention' : ''}`}>{t(task.status === 'cancelled' ? 'launch.project.cancelled' : (`board.${task.status}` as 'board.backlog'))}</span>
            {facts.map((f) => <span key={f}>{f}</span>)}
          </p>
        </div>
        <div className="lp-actions">
          {task.task_type === 'idea' && task.status === 'backlog' && (
            <Button
              tone="ghost"
              disabled={researching}
              onClick={() => {
                setResearching(true)
                void window.fabric.tasks
                  .research(taskId, project.default_agent)
                  .then(async () => {
                    await onChanged()
                  })
                  .catch((e) => onError(String(e)))
                  .finally(() => setResearching(false))
              }}
            >
              {t('board.research')}
            </Button>
          )}
          {task.session_id && (
            <button type="button" className="lp-button primary" onClick={() => void showConsole(task.session_id!)}>{t('task.openSession')}</button>
          )}
        </div>
      </header>
      {ask && <ReviewDecision historyBelow taskId={taskId} ask={ask} onDecided={() => { void load(); void onChanged() }} />}
      {/* A run is said only once there is one: «no run yet» is already the state above (2026-11-12). */}
      {task.session_id && !ask && <RunCallout sessionId={task.session_id} status={run} />}
      {problem && (
        <Banner tone="warn" actions={<Button tone="ghost" onClick={() => setProblem(null)}>{t('common.keep')}</Button>}>{problem}</Banner>
      )}
      {/* ADR-0176 §1 (SCN-176): a task still to do or in work says when its spec is not gathered, and which parts are
          missing; it clears the moment the brief's three parts are written. */}
      {toGather && (briefEmpty ? <Banner tone="warn">{t('task.specEmpty')}</Banner> : (
        <Banner tone="warn">
          {t('task.specMissing', {
            parts: specGaps(task)
              .map((part) => t('task.specPart', { label: sections.find((s) => s.key === part)?.label ?? part }))
              .join(', ')
          })}
        </Banner>
      ))}
      {/* OF-21: the task reads as a template (what, why, done when); each part is text, and a box only while changed. */}
      <section className="lp-task-brief" aria-label={t('task.brief')}>
        {sections.map((section) => {
          const key = briefKey(taskId, section.key)
          const boxId = `brief-${taskId}-${section.key}`
          return (
            <div key={section.key} className="lp-task-part">
              <label className="lp-decide-label" htmlFor={open(key) ? boxId : undefined}>{section.label}</label>
              {open(key) ? (
                <>
                  <textarea
                    id={boxId}
                    autoFocus={editing.has(key)}
                    // CONTROLLED, and keyed to the task (UX28-01): a part's words belong to the task they were typed for.
                    value={draftOr(drafts, key, section.value ?? '')}
                    rows={3}
                    onChange={(e) => setDrafts((d) => setDraft(d, key, e.target.value))}
                  />
                  <div className="lp-actions">
                    <button type="button" className="lp-button primary" onClick={() => void saveOrClose(section.key, section.value ?? '')}>{t('task.part.save')}</button>
                    <button type="button" className="lp-button" onClick={() => stopEdit(key)}>{t('common.cancel')}</button>
                  </div>
                </>
              ) : (
                <div className="lp-task-text">
                  {section.value?.trim() ? <p>{section.value}</p> : <p className="lp-meta">{t('task.part.empty')}</p>}
                  <button type="button" className="lp-link" aria-label={t('task.part.changeOf', { part: section.label })} onClick={() => startEdit(key)}>
                    {t(section.value?.trim() ? 'task.part.change' : 'task.part.write')}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </section>
      {/* SCN-174 step 2 (CO-401): what holds the task, said only when something does. */}
      {detail.blockedBy && detail.blockedBy.length > 0 && (
        <section className="lp-task-section">
          <h3>{t('task.blockedBy')}</h3>
          <ul className="lp-list">
            {detail.blockedBy.map((b) => (
              <li key={b.id}>
                <button type="button" className="lp-button lh-text-link" onClick={() => onOpenTask?.(b.id)}>{b.title}</button>
                <span className="lp-pill">{stateWord(b.status)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="lp-task-section">
        <h3>{t('task.notes')}</h3>
        {detail.notes.length > 0 && (
          <ul className="lp-task-notes">
            {detail.notes.map((row) => (
              <li key={row.id}>
                <p>{row.body_md}</p>
                {/* WHO and WHEN, not only what KIND (UX28-06), in words: «агент», «вы» (2026-11-12, no ids). */}
                <span className="lp-meta">
                  {t('task.noteBy', { who: who(row.author_kind === 'agent' ? 'agent' : row.author_kind === 'person' ? 'person' : row.author_id) ?? row.author_kind, when: since(row.created_at, t) })}
                  {' · '}
                  {row.promoted_fact_id ? t('task.promoted') : <button type="button" className="lp-link" onClick={() => void promote(row)}>{t('task.promote')}</button>}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="lp-task-note">
          <textarea
            aria-label={t('task.noteAdd')}
            value={note}
            rows={1}
            placeholder={t('task.notePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
          />
          <button type="button" className="lp-button" disabled={!note.trim()} onClick={() => void addNote()}>{t('task.noteAdd')}</button>
        </div>
      </section>
      {/* What is read rarely is folded, one line each (2026-11-12). */}
      {showInstruction && (
        <details className="lp-task-more">
          <summary>{t('launch.agent.original')}</summary>
          <blockquote>{task.instruction}</blockquote>
          {task.origin_kind && <p className="lp-meta">{t('task.origin', { kind: task.origin_kind, ref: task.origin_ref ?? t('task.originNoRef') })}</p>}
        </details>
      )}
      <details className="lp-task-more">
        <summary>{t('task.history')}</summary>
        <h3>{t('task.moves')}</h3>
        {moves.length === 0 ? <p className="lp-meta">{t('task.movesNone')}</p> : (
          <ol className="lp-list" aria-label={t('task.moves')}>
            {moves.map((m) => (
              <li key={m.seq}>
                <time dateTime={m.at}>{new Date(m.at).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</time>{' '}
                {m.from ? t('task.moveFromTo', { from: stateWord(m.from), to: stateWord(m.to) }) : t('task.moveTo', { to: stateWord(m.to) })}{' '}
                <span className="lp-meta">{t(`task.movedBy.${m.by}` as 'task.movedBy.person')}</span>
              </li>
            ))}
          </ol>
        )}
        {detail.siblings.total > 0 && (
          <>
            <h3>{t('task.siblings', { doc: originDocument(task.origin_ref ?? '') })}</h3>
            {detail.siblings.shown.map((s) => (
              <Row key={s.id} lead={<StateChip tone="quiet">{t(`board.${s.status}` as 'board.backlog')}</StateChip>} onClick={() => onOpenTask?.(s.id)}>
                {s.title}
              </Row>
            ))}
            {detail.siblings.total > detail.siblings.shown.length && (
              <p className="lp-meta">{t('task.siblingsMore', { count: detail.siblings.total - detail.siblings.shown.length })}</p>
            )}
          </>
        )}
        {detail.links.length > 0 && (
          <>
            <h3>{t('task.links')}</h3>
            {detail.links.map((link) => (
              <Row key={`${link.rel}:${link.target_id}`} lead={<span className="lp-meta">{t(`task.rel.${link.rel}` as 'task.rel.blocks')}</span>}>
                {link.target_title ?? link.target_id}
              </Row>
            ))}
          </>
        )}
        <h3>{t('task.receipts')}</h3>
        {detail.events.length === 0 ? <EmptyState read>{t('task.receiptsNone')}</EmptyState> : <Feed events={detail.events} projects={[project]} compact />}
      </details>
      <FoldedContext projectId={project.id} sessionId={task.session_id} />
      <ConsoleDetails sessionId={task.session_id} />
      {/* 0.3.14, the simple Fabric §5: a change this work needs in another project, opened as a console there. */}
      <Toolbar align="start">
        <CrossProjectConsole project={project} taskId={taskId} taskTitle={task.title ?? task.instruction} />
      </Toolbar>
    </div>
  )
}

/** What the agent gets, read only once the person opens it: a fold read eagerly costs two reads per task opened. */
function FoldedContext({ projectId, sessionId }: { projectId: string; sessionId: string | null }): React.JSX.Element {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <details className="lp-task-more" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>{t('task.contextMore')}</summary>
      {open && <ContextTab projectId={projectId} sessionId={sessionId} />}
    </details>
  )
}
