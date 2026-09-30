// Every agent in the estate (SCR-39).
//
// Asked for directly: one place to see every session in every project and
// switch between them quickly. Left is the list, centre is what the selected
// one printed, right is where it is working and what it did.
//
// THE CENTRE IS NOT A LIVE CONSOLE, and says so. A second terminal renderer
// beside `SessionWindow`'s would be two things drawing the same bytes, and they
// would eventually disagree about what an agent printed — the rule that made
// the digest reuse `Feed` and the transcript store share its decoder. Working
// in a session opens the window that already does it properly.

import { useEffect, useRef, useState } from 'react'
import type { FeedEvent, ProjectRow, RepoState, TerminalSession } from '../../shared/types'
import {
  failed,
  forSubject,
  pending,
  settled,
  type KeyedRead
} from '../../shared/keyedRead'
import { affects, POLL_MS } from '../../shared/repoWatch'
import { decodePty } from '../../shared/pty-decode.ts'
import { Button, EmptyState, Panel, Row, StateChip, Toolbar } from './components'
import { sessionTone } from './sessionTone'
import { useT } from './i18n'
import { since } from './duration'
import { inAttentionOrder } from '../../shared/sessionOrder.ts'
import { TerminalView } from './TerminalView'
import type { RunStatusView } from '../../shared/runStatus.ts'
import type { EntityRef } from '../../shared/entityRef.ts'
import type { ReadEnvelope } from '../../shared/readEnvelope.ts'

export function EstateAgents({
  sessions,
  projects,
  onOpen,
  onError
}: {
  /** Null until read (M108, UXA-C05). `App.tsx` used to collapse this with
   *  `?? []` at the call site, so the empty state below — marked `read`, this
   *  codebase's marker for a MEASUREMENT — claimed the whole estate was idle
   *  before anyone had looked. */
  sessions: TerminalSession[] | null
  projects: ProjectRow[] | null
  /** SCN-049 step 4 — the task in the header opens the task page with this
   *  session already named. The same navigator every other surface takes, so
   *  the destination is resolved once (`destinationOf`, UX28-06). */
  onOpen: (projectId: string, focus: EntityRef) => void
  onError: (message: string) => void
}): React.JSX.Element {
  const t = useT()
  const [selected, setSelected] = useState<string | null>(null)
  // KEYED, AND SETTLED SEPARATELY (UX28-02). These were two `useState`s filled
  // from one `Promise.all`, and that coupled three defects into four lines:
  //
  //   * a rejected `repoStates` discarded a `history` that had come back fine,
  //     because one catch covered both — the shape `MemoryOverviewSection` has
  //     a test about, in another file;
  //   * selecting agent B rendered A's history and A's repositories until the
  //     new read resolved, because `alive` stops a LATE write and says nothing
  //     about a stale one that was written on time, for somebody else;
  //   * and a failed refresh left the previous payload on screen as current.
  //
  // A keyed read carries whose it is, so `forSubject` cannot hand over another
  // agent's payload — there is no branch to forget.
  const [history, setHistory] = useState<KeyedRead<FeedEvent[]> | null>(null)
  const [repos, setRepos] = useState<KeyedRead<RepoState[]> | null>(null)
  /**
   * WHICH TASK this session holds (SCN-049 step 4, UX28-13).
   *
   * Keyed like the other two, and for the same reason read from the write side:
   * the card's acceptance is that the "task route" is stable, so a stale answer
   * arriving for the agent the operator has left must not put another agent's
   * task in the header — which is the one place a wrong link sends work to the
   * wrong row.
   */
  const [run, setRun] = useState<KeyedRead<ReadEnvelope<RunStatusView>> | null>(null)

  /** Read ONCE, here, so every use below is about the same two lists and the
   *  null does not have to be remembered at each of them (UXA-C05). Filtering a
   *  list nobody has read yet still finds nothing — which is correct, and it is
   *  correct for a different reason than "nothing is there". The distinction is
   *  made where it is rendered, not where it is searched. */
  const known = sessions ?? []
  const inEstate = projects ?? []
  const agent = known.find((s) => s.sessionId === selected) ?? null
  const project = inEstate.find((p) => p.id === agent?.projectId) ?? null
  const subject = agent?.sessionId ?? ''
  const historyRead = forSubject(history, subject)
  const reposRead = forSubject(repos, subject)
  const runRead = forSubject(run, subject)
  const repoRows = reposRead.value ?? []

  useEffect(() => {
    if (!agent) return
    const at = agent.sessionId
    // INDEPENDENTLY. Two reads, two settlements, two failures — so one source
    // rejecting cannot throw away the other's answer.
    void window.fabric.terminal
      .history(at)
      .then((value) => setHistory((cur) => settled(cur, { subject: at, value, at: Date.now() })))
      .catch((e) => {
        setHistory((cur) => failed(cur, { subject: at, why: String(e) }))
        // BOTH. The read carries the failure so the payload is dropped rather
        // than shown as current, and the operator still gets the banner they
        // had before — a per-source line says WHICH failed, a banner says that
        // something did, and removing the second would be a regression dressed
        // as a refactor.
        onError(String(e))
      })
    void window.fabric.projects
      .repoStates(agent.projectId)
      .then((value) => setRepos((cur) => settled(cur, { subject: at, value, at: Date.now() })))
      .catch((e) => {
        setRepos((cur) => failed(cur, { subject: at, why: String(e) }))
        onError(String(e))
      })
    // A THIRD independent read, and it arrives inside a `ReadEnvelope` (S14):
    // the run status already says whether the answer is complete, partial or
    // unavailable and what it was measured from. So there are TWO layers here
    // and both are needed — the KeyedRead says whose answer this is, the
    // envelope says how much of an answer it is. A session with no admitted run
    // is a real thing (an operator's bare terminal), and that is `data: null`
    // inside a complete envelope rather than a failure.
    void window.fabric.runs
      .status(at)
      .then((value) => setRun((cur) => settled(cur, { subject: at, value, at: Date.now() })))
      .catch((e) => setRun((cur) => failed(cur, { subject: at, why: String(e) })))
  }, [agent?.sessionId, agent?.projectId])

  // The subject changes FIRST, so nothing old is on screen while the new read
  // is in flight. `forSubject` would refuse the old payload anyway; this makes
  // the intent visible rather than relying on a reader noticing the guard.
  useEffect(() => {
    setHistory((cur) => (cur && cur.subject !== subject ? pending<FeedEvent[]>(subject) : cur))
    setRepos((cur) => (cur && cur.subject !== subject ? pending<RepoState[]>(subject) : cur))
    setRun((cur) => (cur && cur.subject !== subject ? pending<ReadEnvelope<RunStatusView>>(subject) : cur))
  }, [subject])

  /** M107 — the same live channel the project page listens on. Without it this
   *  panel read git ONCE per agent selected and never again: an agent could
   *  work for an hour and the branch beside it stayed whatever it was when the
   *  operator clicked. */
  const held = useRef<string[] | null>(null)
  // Not written during render — see ProjectHome for why. Null until the first
  // reading lands, so the very first broadcast is answered rather than filtered
  // against a list this panel does not have yet.
  useEffect(() => {
    held.current = repoRows.length > 0 ? repoRows.map((r) => r.path) : null
  }, [repoRows])

  useEffect(() => {
    if (!agent) return
    const reread = (): void => {
      const at = agent.sessionId
      window.fabric.projects
        .repoStates(agent.projectId)
        .then((value) => setRepos((cur) => settled(cur, { subject: at, value, at: Date.now() })))
        // A refresh that fails leaves the last good reading on screen rather
        // than raising a banner every ten seconds for a repository that has
        // gone away; the reading itself carries `error` when git could not be
        // read, which is the honest place for it.
        .catch(() => {})
    }
    /**
     * History follows the same clock, and the reason it is a CLOCK is worth
     * stating (UX28-13).
     *
     * The card asks for events to update the history, and there is no journal
     * push channel to subscribe to: the renderer's live channels are
     * `onRepoChanged`, `onData`, `onExit` and `onCloseActive`, and that is the
     * whole list. `AttentionPanel` reached the same wall and wrote down the
     * house answer — "derived state has no push channel of its own yet, so it
     * is re-read on a slow timer" — so this re-reads on the timer the
     * repository state already uses rather than inventing a channel inside a
     * panel. A session ENDING is pushed, though, so that one is immediate:
     * `terminal.closed@1` is exactly the event a reader is waiting to see.
     *
     * Named rather than implied: this is polling, not push, and a history is
     * therefore up to one interval stale.
     */
    const rereadHistory = (): void => {
      const at = agent.sessionId
      window.fabric.terminal
        .history(at)
        .then((value) => setHistory((cur) => settled(cur, { subject: at, value, at: Date.now() })))
        // Same rule as the repository refresh: a failed REFRESH keeps the last
        // good reading and raises nothing, because the first read already told
        // the operator if history was unreadable.
        .catch(() => {})
    }
    const off = window.fabric.projects.onRepoChanged((repoPath) => {
      if (affects(repoPath, held.current)) reread()
    })
    const offExit = window.fabric.terminal.onExit((sessionId) => {
      if (sessionId === agent.sessionId) rereadHistory()
    })
    const every = setInterval(() => {
      if (document.visibilityState === 'visible') {
        reread()
        rereadHistory()
      }
    }, POLL_MS)
    return () => {
      off()
      offExit()
      clearInterval(every)
    }
  }, [agent?.projectId, agent?.sessionId])

  return (
    <div className="project-columns project-columns-3">
      <div className="col-side">
        <Panel title={t('agents.estateTitle')}>
          <p className="muted">{t('agents.estateLede')}</p>
          {known.length === 0 && (
            <EmptyState read={sessions !== null} waiting={t('agents.reading')}>
              {t('agents.none')}
            </EmptyState>
          )}
          {/* WAITING FIRST, ended last (UX28-13). The selection is a session
              id rather than an index, so a reorder cannot move it — which is
              the card's "selected agent remains stable during reorder", held
              by construction rather than by care. */}
          {inAttentionOrder(known).map((s) => (
            <Row
              key={s.sessionId}
              lead={<StateChip tone={sessionTone(s.state)}>{s.state}</StateChip>}
              trail={<span className="muted">{since(s.lastActivityAt, t)}</span>}
              onClick={() => setSelected(s.sessionId)}
            >
              {inEstate.find((p) => p.id === s.projectId)?.name ?? s.projectId.slice(0, 8)}
              <span className="muted mono"> {s.optionId}</span>
            </Row>
          ))}
        </Panel>
      </div>

      <div className="col-main">
        <Panel
          title={t('agents.output')}
          actions={
            agent && (
              <Toolbar align="end">
                {/* THE TASK IN THE HEADER (SCN-049 step 4). Rendered only for
                    the subject in front of the operator: `forSubject` refuses
                    another agent's answer, so the route cannot point at the
                    task of the agent they just left. A session with no admitted
                    run shows nothing rather than an empty link — a bare
                    terminal is not a broken run. */}
                {runRead.state === 'ready' && runRead.value?.data?.taskId && (
                  <Button
                    tone="ghost"
                    onClick={() =>
                      onOpen(agent.projectId, { kind: 'task', id: runRead.value!.data!.taskId! })
                    }
                  >
                    {t('agents.openTask', {
                      title: runRead.value.data.taskTitle ?? runRead.value.data.taskId
                    })}
                  </Button>
                )}
                <Button
                  tone="ghost"
                  onClick={() => void window.fabric.windows.openSession(agent.sessionId)}
                >
                  {t('agents.openSession')}
                </Button>
              </Toolbar>
            )
          }
        >
          {/* THE SESSION, not a snapshot of it — and only while there is one.
              This column held `decodePty(agent.excerpt)`: the tail carried in
              every listing, captured by whichever poll last ran. Honestly
              labelled stale, which is why it was never a lie; it simply was not
              the session, so there was nothing here to type into.

              `TerminalView` is the one that already exists and that
              `SessionWindow` already uses — the card's exclusion forbids a
              second decoder, and a second attach lifecycle would be the same
              mistake wearing a different name. Keyed by `sessionId`, so
              switching agents tears one down and builds the next; its cleanup
              disposes a renderer object and NEVER ends the session, which lives
              in main.

              An ENDED session keeps the snapshot, because there is nothing to
              attach to and its last words are the only thing left — with the
              exit code beside them, which is the fact that explains them. */}
          {!agent ? (
            <EmptyState read>{t('agents.pick')}</EmptyState>
          ) : agent.running ? (
            <TerminalView session={agent} focusOnMount={false} />
          ) : (
            <>
              <p className="muted">
                {t('agents.outputEnded', {
                  code: agent.exitCode === null ? t('agents.exitUnknown') : String(agent.exitCode)
                })}
              </p>
              <pre className="excerpt">{decodePty(agent.excerpt).slice(-4000)}</pre>
            </>
          )}
        </Panel>

        <Panel title={t('agents.history')}>
          {!agent && <EmptyState read>{t('agents.pick')}</EmptyState>}
          {historyRead.state === 'failed' && (
            <p className="read-failed" data-testid="history-failed">
              {t('reads.failed', { why: historyRead.failedWhy ?? '' })}
            </p>
          )}
          {agent && historyRead.state === 'ready' && (historyRead.value ?? []).length === 0 && (
            <EmptyState read>{t('agents.noHistory')}</EmptyState>
          )}
          {(historyRead.value ?? []).map((e) => (
            <Row
              key={e.seq}
              lead={<span className="mono">{e.type}</span>}
              trail={<span className="muted">{since(e.occurred_at, t)}</span>}
            >
              <span className="muted">
                {e.actor.kind}:{String(e.actor.id).slice(0, 8)}
              </span>
            </Row>
          ))}
        </Panel>
      </div>

      <div className="col-side">
        <Panel title={t('agents.where')}>
          {!agent ? (
            <EmptyState read>{t('agents.pick')}</EmptyState>
          ) : (
            <>
              <Row lead={<span className="muted">{t('agents.repo')}</span>}>
                <span className="mono">{project?.repo_path ?? t('agents.noRepo')}</span>
              </Row>
              <Row lead={<span className="muted">{t('agents.mode')}</span>}>
                {agent.permissionMode ?? t('agents.noMode')}
              </Row>
              {reposRead.state === 'failed' && (
                <p className="read-failed" data-testid="repos-failed">
                  {t('reads.failed', { why: reposRead.failedWhy ?? '' })}
                </p>
              )}
              {repoRows.map((r) => (
                <Row key={r.path} lead={<span className="mono">{t('agents.branch')}</span>}>
                  {r.error ? t('status.repoUnreadable') : (r.branch ?? '—')}
                  {!r.error && (
                    <span className="muted"> {t('agents.changed', { count: r.changed })}</span>
                  )}
                </Row>
              ))}
            </>
          )}
        </Panel>
      </div>
    </div>
  )
}
