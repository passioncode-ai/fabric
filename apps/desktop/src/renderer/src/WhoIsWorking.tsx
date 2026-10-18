// #region who-is-working — docs: docs/ux/scenarios.md#scn-140-agents-ask-fabric-who-is-working-on-what-claim-their-task-are-warned-of-related-work-and-release-it
/**
 * SCR-31 «Who is working on what» (SCN-140, REQ-38): one row per live claim — the agent and how it came in, the task
 * with its backlog row, what it touches, since, its last sign of life — «related» where two claims overlap, the
 * session one click away and «Release» behind the row's … menu, at once (ADR-0160 §1); agent-sync's leases beneath,
 * read-only. Silent until it has read (M108): nobody is working here is said from a reading, never before it — and
 * only when the reading holds no claim, no held task and no session working here (0.3.5 review UX-4).
 *
 * «Open session» is offered only for a session Fabric holds a console for; an agent enrolled from its own terminal or
 * reaching Fabric through the hub has none, and the row says where it runs instead (0.3.5 review UX-3).
 */
import { useEffect, useRef, useState } from 'react'
import type { LeaseReadCode, ProjectWorkView, RelatedWhy, WorkClaimView, CameIn } from '../../shared/workClaims.ts'
import type { Translate } from './i18n'
import { Button, Panel, Row, StateChip, Toolbar } from './components'
import { useT } from './i18n'
import { since } from './duration'
import { runnerLabel } from './runnerLabel'
import { explainError } from './start/startParts'
import { MachineDetail } from './OperatorError'

export function cameInLabel(c: CameIn, t: Translate): string {
  return t(`work.cameIn.${c}`)
}

/** Where a session without a console in Fabric runs, in words: a terminal for an enrolled agent, else "outside Fabric". */
export function outsideLabel(c: CameIn, t: Translate): string {
  return t(c === 'enrolled' ? 'work.who.outside.enrolled' : 'work.who.outside.other')
}

/** Why agent-sync's leases were not read, in this window's language (0.3.5 review UX-5). */
export function leaseReason(code: Exclude<LeaseReadCode, 'not-used' | 'no-origin'>, t: Translate): string {
  return t(`work.leases.why.${code}`)
}

const RELS = new Set(['blocks', 'follows', 'spawned'])
/** A task link's relation in words, read from this task's side; one the app does not know reads as "linked". */
export function relLabel(rel: string, direction: 'from' | 'to', t: Translate): string {
  return RELS.has(rel) ? t(`work.rel.${rel}.${direction}` as 'work.rel.blocks.from') : t('work.rel.other')
}

/** A task with no title is "untitled task" in words, never a slice of its id. */
export function taskLabel(title: string | null | undefined, t: Translate): string {
  return title?.trim() ? title : t('work.task.untitled')
}

export function whyLabel(w: RelatedWhy, t: Translate): string {
  if (w.kind === 'same-row') return t('work.why.sameRow', { row: w.row })
  if (w.kind === 'linked') return t('work.why.linked', { rel: relLabel(w.rel, w.direction, t) })
  return t('work.why.overlap', { mine: w.mine, theirs: w.theirs })
}

/** How a claim's life reads; never "working" past its expiry or after its session ended. */
export function lifeLabel(c: Pick<WorkClaimView, 'life' | 'lastSignAt'>, t: Translate): string {
  if (c.life === 'lapsed') return t('work.who.lapsed')
  if (c.life === 'silent') return t('work.who.silent', { at: new Date(c.lastSignAt).toLocaleTimeString() })
  return t('work.who.lastSign', { ago: since(c.lastSignAt, t) })
}

type Read = { state: 'reading' } | { state: 'read'; view: ProjectWorkView } | { state: 'unreadable'; detail: string }

export function WhoIsWorking({ projectId, feedMark, onError }: { projectId: string; feedMark: number; onError(message: string): void }): React.JSX.Element {
  const t = useT()
  const [read, setRead] = useState<Read>({ state: 'reading' })
  const [menu, setMenu] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  // The project now on screen: a reading that comes back for another project is dropped (0.3.5 i2 UX-10 — the old
  // guard compared the closure's projectId with itself).
  const current = useRef(projectId)
  current.current = projectId
  const load = async (): Promise<void> => {
    const at = projectId
    try {
      const view = await window.fabric.work.project(at)
      if (at === current.current) setRead({ state: 'read', view })
    } catch (e) {
      if (at === current.current) setRead({ state: 'unreadable', detail: explainError(e, t) })
    }
  }
  useEffect(() => {
    setRead({ state: 'reading' })
    setMenu(null)
  }, [projectId])
  useEffect(() => {
    void load()
  }, [projectId, feedMark])
  // A session starting or ending, and a sign of life ageing, journal nothing this view listens to: the reading is taken
  // again each minute, as «Where work is» does (0.3.5 i2 UX-1).
  useEffect(() => {
    const every = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, 60_000)
    return () => clearInterval(every)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // One press in the … menu, no question (ADR-0160 §1): the release is recorded with «take it again» as its undo.
  const release = async (c: WorkClaimView): Promise<void> => {
    setFailure(null)
    try {
      const r = await window.fabric.work.release(c.claimId)
      if (!r.released) setFailure(t(`work.release.failed.${r.reason}`))
    } catch (e) {
      onError(explainError(e, t))
    }
    await load()
  }

  const titleOf = (c: Pick<WorkClaimView, 'title' | 'taskId'>): string => taskLabel(c.title, t)
  const open = (sessionId: string): void => {
    window.fabric.windows.openSession(sessionId).catch((e: unknown) => onError(explainError(e, t)))
  }
  // Sessions working here that hold no claim (an enrolled agent before it claims, a plain terminal): shown, so the
  // page never reads "nobody" over them (UX-4). A session that holds a claim is its claim's row.
  const unclaimed = read.state === 'read'
    ? (read.view.sessions ?? []).filter((s) => !read.view.claims.some((c) => c.sessionId === s.sessionId) && !read.view.held.some((h) => h.sessionId === s.sessionId))
    : []
  return (
    <Panel id="sec-who" title={t('work.who.title')}>
      {read.state === 'reading' && <p className="muted">{t('work.who.reading')}</p>}
      {read.state === 'unreadable' && (
        <>
          <Toolbar>
            <span className="muted">{t('work.who.unreadable')}</span>
            <Button tone="ghost" onClick={() => void load()}>{t('common.retry')}</Button>
          </Toolbar>
          <MachineDetail text={read.detail} />
        </>
      )}
      {read.state === 'read' && (
        <>
          {read.view.claims.length === 0 && read.view.held.length === 0 && unclaimed.length === 0 && <p className="muted">{t('work.who.none')}</p>}
          {read.view.claims.map((c) => (
            <div key={c.claimId}>
              <Row
                lead={<StateChip tone={c.life === 'live' ? 'good' : 'warn'} dot>{lifeLabel(c, t)}</StateChip>}
                trail={
                  <Toolbar>
                    {c.life !== 'lapsed' && (c.console
                      ? <Button tone="ghost" onClick={() => open(c.sessionId)}>{t('work.who.open')}</Button>
                      : <span className="muted">{outsideLabel(c.cameIn, t)}</span>)}
                    <Button tone="ghost" aria-label={t('work.who.more')} aria-expanded={menu === c.claimId} onClick={() => setMenu(menu === c.claimId ? null : c.claimId)}>
                      {t('glyph.more')}
                    </Button>
                    {menu === c.claimId && (
                      <Button tone="ghost" onClick={() => { setMenu(null); void release(c) }}>{t('work.who.release')}</Button>
                    )}
                  </Toolbar>
                }
              >
                <strong>{titleOf(c)}</strong>
                {' · '}
                {t('work.who.by', { agent: runnerLabel(c.agent, t), how: cameInLabel(c.cameIn, t) })}
                {' · '}
                {t('work.who.since', { ago: since(c.since, t) })}
                {c.source && <span className="muted">{' · '}{t('work.who.source', { id: c.source.id, path: c.source.path })}</span>}
                {c.touches.length > 0 && <span className="muted">{' · '}{t('work.who.touches', { list: c.touches.join(', ') })}</span>}
              </Row>
              {c.related.map((r) => (
                <Row key={r.claimId} quiet lead={<StateChip tone="warn">{t('work.who.related')}</StateChip>}>
                  {t('work.who.relatedTo', { task: taskLabel(r.title, t), why: r.why.map((w) => whyLabel(w, t)).join('; ') })}
                </Row>
              ))}
            </div>
          ))}
          {unclaimed.map((s) => (
            <Row key={s.sessionId} quiet
              lead={<StateChip tone={s.stale ? 'warn' : 'good'} dot>{s.stale ? t('work.where.quiet') : t('work.where.active')}</StateChip>}
              trail={s.console
                ? <Button tone="ghost" onClick={() => open(s.sessionId)}>{t('work.who.open')}</Button>
                : <span className="muted">{outsideLabel(s.cameIn, t)}</span>}>
              {t('work.who.by', { agent: runnerLabel(s.agent, t), how: cameInLabel(s.cameIn, t) })}
              {' · '}
              {t('work.who.since', { ago: since(s.startedAt, t) })}
              {' · '}
              {t('work.who.unclaimed')}
            </Row>
          ))}
          {read.view.held.map((h) => (
            <Row key={h.taskId} quiet lead={<StateChip tone="info">{t('work.who.heldChip')}</StateChip>}>
              {t('work.who.held', { task: taskLabel(h.title, t) })}
            </Row>
          ))}
          {failure && <p role="status" className="muted">{failure}</p>}
          {read.view.leases && (
            <>
              <p className="lp-kicker">{t('work.leases.title')}</p>
              {!read.view.leases.read ? (
                <p className="muted">{read.view.leases.code === 'no-origin' ? t('work.leases.noOrigin') : t('work.leases.unread', { reason: leaseReason(read.view.leases.code, t) })}</p>
              ) : read.view.leases.leases.length === 0 ? (
                <p className="muted">{t('work.leases.none')}</p>
              ) : (
                <>
                  {read.view.leases.leases.map((l) => <Row key={l.key} quiet>{l.key}</Row>)}
                  {read.view.leases.truncated && <p className="muted">{t('work.leases.more')}</p>}
                </>
              )}
            </>
          )}
        </>
      )}
    </Panel>
  )
}
// #endregion who-is-working
