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
import { Banner, Button, EmptyState, Field, Panel, Row, StateChip, Toolbar } from './components'
import { Feed } from './Feed'
import { useLocale, useT } from './i18n'
import { originDocument } from '../../shared/origin.ts'
import { specGaps, specMissing } from '../../shared/taskSpec.ts'
import { taskMoves } from '../../shared/taskMoves.ts'
import { since } from './duration'
import { DecisionsSection } from './DecisionsSection'
import { ConsoleDetails, ContextTab, RunCallout, runStateWord, useRunStatus } from './launch/AgentWorkspace'
import { ProjectStrip } from './launch/FabricStrip'
import { runnerLabel } from './runnerLabel'
import { useOpenConsole } from './consoles'

export function TaskPage({
  project,
  taskId,
  onBack,
  backLabel,
  onChanged,
  onError,
  onOpenTask,
  lastEventAt = null,
  onPulse
}: {
  project: ProjectRow
  taskId: string
  /** The project's newest journal event, for the Fabric strip (SCR-39 carries the project-scope strip). */
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
  /** Which part of the workspace is shown (SCR-39 tabs). */
  const [tab, setTab] = useState<'now' | 'context' | 'decisions' | 'history' | 'next'>('now')
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
      <Panel
        title={t('task.brief')}
        actions={
          <Toolbar align="end">
            <Button tone="ghost" onClick={onBack}>
              {backLabel ?? t('launch.agent.back')}
            </Button>
          </Toolbar>
        }
      >
        {loadFailed ? (
          <Banner tone="warn">{loadFailed}</Banner>
        ) : (
          <EmptyState read={false}>{t('task.noNotes')}</EmptyState>
        )}
      </Panel>
    )

  const task = detail.task
  const sections: { key: 'what' | 'why' | 'expected'; label: string; value: string | null }[] = [
    { key: 'what', label: t('task.what'), value: task.brief_what },
    { key: 'why', label: t('task.why'), value: task.brief_why },
    { key: 'expected', label: t('task.expected'), value: task.brief_expected }
  ]

  const agentLabel = task.option_id ? runnerLabel(task.option_id, t) : t('launch.home.live.agent')
  const moves = taskMoves(detail.events)
  // A state in words; «cancelled» has no reason here, so it is the kanban's column word, and an unknown one stays as written.
  const stateWord = (state: string): string =>
    state === 'cancelled' ? t('launch.kanban.cancelled')
      : ['backlog', 'running', 'review', 'done'].includes(state) ? t(`board.${state}` as 'board.backlog') : state
  return (
    <div className="lp" data-launch-view="launch-agent">
      <ProjectStrip project={project} lastEventAt={lastEventAt} onPulse={onPulse} />
      {/* OF-22 (the operator's walk, 2026-10-22): the way back sits at the top left, above the title, as on any page. */}
      <button type="button" className="lp-back" onClick={onBack}>{backLabel ?? t('launch.agent.back')}</button>
      <header className="lp-heading">
        <div>
          <p className="lp-kicker">{[project.name, t('launch.project.team'), agentLabel].join(' / ')}</p>
          <h2 tabIndex={-1}>{task.title ?? task.instruction}</h2>
          <p>{t('launch.agent.subtitle', { agent: agentLabel, date: new Date(task.started_at).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) })}</p>
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
            <button type="button" className="lp-button" onClick={() => void showConsole(task.session_id!)}>{t('task.openSession')}</button>
          )}
        </div>
      </header>
      <div className="lp-ide">
        <aside className="lp-run-rail">
          <span className="lp-agent-icon large" aria-hidden="true">{(agentLabel.trim()[0] ?? 'A').toUpperCase()}</span>
          <h3>{agentLabel}</h3>
          {task.assigned_to && <p>{t('task.handoff', { by: task.assigned_by ?? '—', to: task.assigned_to })}</p>}
          <span className={`lp-pill ${task.status === 'review' ? 'attention' : ''}`}>{t(task.status === 'cancelled' ? 'launch.project.cancelled' : (`board.${task.status}` as 'board.backlog'))}</span>
          <div className="lp-divider" />
          <small>{t('launch.agent.rail.task')}</small><b>{task.id.slice(0, 8)}</b>
          <small>{t('launch.agent.rail.run')}</small>
          <b>{run.view?.data?.ordinal ? t('launch.agent.rail.runOf', { n: run.view.data.ordinal, state: runStateWord(run.view.data, t) }) : task.session_id ? (run.failed ? t('launch.agent.rail.runUnreadable') : t('estate.reading')) : '—'}</b>
          <small>{t('launch.agent.rail.session')}</small><b className="mono">{task.session_id ? task.session_id.slice(0, 12) : '—'}</b>
          <small>{t('launch.agent.rail.held')}</small>
          <b>{detail.lease ? t('task.held', { who: detail.lease.owner_session.slice(0, 8), until: since(detail.lease.expires_at, t) }) : t('task.free')}</b>
          <div className="lp-divider" />
          <button type="button" className="lp-button" onClick={() => setTab('history')}>{t('launch.agent.pastTasks')}</button>
        </aside>
        <div className="lp-agent-content">
          <div className="lp-tabs" role="group" aria-label={t('launch.agent.tabs')}>
            {(['now', 'context', 'decisions', 'history', 'next'] as const).map((k) => (
              <button key={k} type="button" className="lp-tab" aria-pressed={tab === k} onClick={() => setTab(k)}>{t(`launch.agent.tab.${k}` as 'launch.agent.tab.now')}</button>
            ))}
          </div>
          <section className="lp-agent-body">
          {tab === 'now' && (
            <>
              <RunCallout sessionId={task.session_id} status={run} />
              {/* OF-21: the task reads as a template first (what, why, what will be ready), the instruction after it. */}
              <h3>{t('task.brief')}</h3>
              {/* CO-394 (0.3.11 review, iteration 3, UX-7): how the brief is written is said above it, and an empty brief says
                  what fills it, rather than three blank boxes. */}
              <p className="lp-meta">{t('task.briefLede')}</p>
              {!task.brief_what?.trim() && !task.brief_why?.trim() && !task.brief_expected?.trim() && <p>{t('task.briefEmpty')}</p>}
              {/* ADR-0176 §1 (SCN-176): a task still to do or in work says when its spec is not gathered, and which
                  parts are missing; it clears the moment the brief's three parts are written. */}
              {specMissing(task) && (
                <Banner tone="warn">
                  {t('task.specMissing', {
                    parts: specGaps(task)
                      .map((part) => t('task.specPart', { label: sections.find((s) => s.key === part)?.label ?? part }))
                      .join(', ')
                  })}
                </Banner>
              )}
        {sections.map((section) => (
          <Field
            key={section.key}
            label={section.label}
            hint={task.brief_author ? t('task.draftBy', { who: task.brief_author }) : undefined}
          >
            {(id) => (
              <textarea
                id={id}
                // CONTROLLED, and keyed to the task. `defaultValue` is applied
                // once at mount, and the React key on this Field is the SECTION,
                // so across a task switch React reused the same node and left
                // A's words in B's box.
                value={draftOr(drafts, briefKey(taskId, section.key), section.value ?? '')}
                rows={2}
                onChange={(e) =>
                  setDrafts((d) => setDraft(d, briefKey(taskId, section.key), e.target.value))
                }
                onBlur={() => void saveBrief(section.key, section.value ?? '')}
              />
            )}
          </Field>
        ))}
              <h3>{t('launch.agent.original')}</h3>
              <blockquote>{task.instruction}</blockquote>
              <p className="lp-meta">
                {task.origin_kind ? t('task.origin', { kind: task.origin_kind, ref: task.origin_ref ?? t('task.originNoRef') }) : null}
              </p>
              {/* SCN-174 step 2 (CO-401): what holds the task, then how it moved along the ladder. */}
              {detail.blockedBy && (
                <>
                  <h3>{t('task.blockedBy')}</h3>
                  {detail.blockedBy.length === 0 ? <p className="lp-meta">{t('task.blockedByNone')}</p> : (
                    <ul className="lp-list">
                      {detail.blockedBy.map((b) => (
                        <li key={b.id}>
                          <button type="button" className="lp-button lh-text-link" onClick={() => onOpenTask?.(b.id)}>{b.title}</button>
                          <span className="lp-pill">{stateWord(b.status)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
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
              <button type="button" className="lp-button" onClick={() => setTab('context')}>{t('launch.agent.whatWasGiven')}</button>
            </>
          )}
          {tab === 'context' && <ContextTab projectId={project.id} sessionId={task.session_id} />}
          {tab === 'decisions' && <DecisionsSection project={project} feedMark={0} onError={onError} />}
          {tab === 'history' && (
            <>
      {detail.siblings.total > 0 && (
        <Panel title={t('task.siblings', { doc: originDocument(task.origin_ref ?? '') })}>
          <p className="muted">{t('task.siblingsLede', { count: detail.siblings.total })}</p>
          {detail.siblings.shown.map((s) => (
            <Row
              key={s.id}
              lead={<StateChip tone="quiet">{t(`board.${s.status}` as 'board.backlog')}</StateChip>}
              onClick={() => onOpenTask?.(s.id)}
            >
              {s.title}
            </Row>
          ))}
          {detail.siblings.total > detail.siblings.shown.length && (
            <p className="muted">
              {t('task.siblingsMore', {
                count: detail.siblings.total - detail.siblings.shown.length
              })}
            </p>
          )}
        </Panel>
      )}

      <Panel title={t('task.links')}>
        {detail.links.length === 0 ? (
          <EmptyState read>{t('task.noLinks')}</EmptyState>
        ) : (
          detail.links.map((link) => (
            <Row
              key={`${link.rel}:${link.target_id}`}
              lead={<span className="mono">{t(`task.rel.${link.rel}` as 'task.rel.blocks')}</span>}
            >
              {link.target_title ?? link.target_id}
            </Row>
          ))
        )}
      </Panel>

      <Panel title={t('task.receipts')}>
        <Feed events={detail.events} projects={[project]} compact />
      </Panel>
            </>
          )}
          {tab === 'next' && (
            <Panel title={t('task.notes')}>
        <p className="muted">{t('task.notesLede')}</p>
        {problem && (
          <Banner
            tone="warn"
            actions={
              <Button tone="ghost" onClick={() => setProblem(null)}>
                {t('common.keep')}
              </Button>
            }
          >
            {problem}
          </Banner>
        )}
        {detail.notes.length === 0 && <EmptyState read>{t('task.noNotes')}</EmptyState>}
        {detail.notes.map((row) => (
          <Row
            key={row.id}
            lead={
              /* WHO and WHEN, not only what KIND (UX28-06). `author_id` and
                 `created_at` have both been carried on the row since the note
                 store existed and neither reached the screen: "agent" is a
                 category, and a note nobody can attribute is a note nobody can
                 follow up. The id is shortened for the line and the full one
                 stays in the title, because a truncated id is a label and a
                 label is not a key. */
              <span className="mono" title={row.author_id}>
                {t('task.noteBy', {
                  kind: row.author_kind,
                  who: row.author_id.slice(0, 8),
                  when: since(row.created_at, t)
                })}
              </span>
            }
            trail={
              row.promoted_fact_id ? (
                <StateChip tone="good">{t('task.promoted')}</StateChip>
              ) : (
                <Button tone="ghost" onClick={() => void promote(row)}>
                  {t('task.promote')}
                </Button>
              )
            }
          >
            {row.body_md}
          </Row>
        ))}
        <Field label={t('task.noteAdd')}>
          {(id) => (
            <textarea
              id={id}
              value={note}
              rows={2}
              placeholder={t('task.notePlaceholder')}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>
        <Toolbar align="end">
          <Button onClick={() => void addNote()}>{t('task.noteAdd')}</Button>
        </Toolbar>
            </Panel>
          )}
          </section>
        </div>
      </div>
      <ConsoleDetails sessionId={task.session_id} />
    </div>
  )
}
