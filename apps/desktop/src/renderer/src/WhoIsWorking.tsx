// #region who-is-working — docs: docs/ux/scenarios.md#scn-140-agents-ask-fabric-who-is-working-on-what-claim-their-task-are-warned-of-related-work-and-release-it
/**
 * SCR-31 «Who is working on what» (SCN-140, REQ-38): one row per live claim — the agent and how it came in, the task
 * with its backlog row, what it touches, since, its last sign of life — «related» where two claims overlap, the
 * session one click away and «Release…» behind the row's … menu with its confirmation; agent-sync's leases beneath,
 * read-only. Silent until it has read (M108): nobody is working here is said from a reading, never before it.
 */
import { useEffect, useState } from 'react'
import type { ProjectWorkView, RelatedWhy, WorkClaimView, CameIn } from '../../shared/workClaims.ts'
import type { Translate } from './i18n'
import { Button, Panel, Row, StateChip, Toolbar } from './components'
import { useT } from './i18n'
import { since } from './duration'
import { runnerLabel } from './runnerLabel'
import { explainError } from './start/startParts'

export function cameInLabel(c: CameIn, t: Translate): string {
  return t(`work.cameIn.${c}`)
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

type Read = { state: 'reading' } | { state: 'read'; view: ProjectWorkView } | { state: 'unreadable'; reason: string }

export function WhoIsWorking({ projectId, feedMark, onError }: { projectId: string; feedMark: number; onError(message: string): void }): React.JSX.Element {
  const t = useT()
  const [read, setRead] = useState<Read>({ state: 'reading' })
  const [menu, setMenu] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<WorkClaimView | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const load = async (): Promise<void> => {
    const at = projectId
    try {
      const view = await window.fabric.work.project(at)
      if (at === projectId) setRead({ state: 'read', view })
    } catch (e) {
      setRead({ state: 'unreadable', reason: explainError(e, t) })
    }
  }
  useEffect(() => {
    setRead({ state: 'reading' })
    setMenu(null)
    setConfirm(null)
  }, [projectId])
  useEffect(() => {
    void load()
  }, [projectId, feedMark])

  const release = async (c: WorkClaimView): Promise<void> => {
    setConfirm(null)
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
  return (
    <Panel id="sec-who" title={t('work.who.title')}>
      {read.state === 'reading' && <p className="muted">{t('work.who.reading')}</p>}
      {read.state === 'unreadable' && (
        <Toolbar>
          <span className="muted">{t('work.who.unreadable', { reason: read.reason })}</span>
          <Button tone="ghost" onClick={() => void load()}>{t('common.retry')}</Button>
        </Toolbar>
      )}
      {read.state === 'read' && (
        <>
          {read.view.claims.length === 0 && read.view.held.length === 0 && <p className="muted">{t('work.who.none')}</p>}
          {read.view.claims.map((c) => (
            <div key={c.claimId}>
              <Row
                lead={<StateChip tone={c.life === 'live' ? 'good' : 'warn'} dot>{lifeLabel(c, t)}</StateChip>}
                trail={
                  <Toolbar>
                    {c.life !== 'lapsed' && (
                      <Button tone="ghost" onClick={() => window.fabric.windows.openSession(c.sessionId).catch((e: unknown) => onError(explainError(e, t)))}>
                        {t('work.who.open')}
                      </Button>
                    )}
                    <Button tone="ghost" aria-label={t('work.who.more')} aria-expanded={menu === c.claimId} onClick={() => setMenu(menu === c.claimId ? null : c.claimId)}>
                      {t('glyph.more')}
                    </Button>
                    {menu === c.claimId && (
                      <Button tone="ghost" onClick={() => { setMenu(null); setConfirm(c) }}>{t('work.who.release')}</Button>
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
              {confirm?.claimId === c.claimId && (
                <Toolbar>
                  <span role="alertdialog" aria-label={t('work.release.title')}>
                    <strong>{t('work.release.title')}</strong>{' '}
                    {t('work.release.body', { agent: runnerLabel(c.agent, t), task: titleOf(c) })}
                  </span>
                  <Button tone="ghost" autoFocus onClick={() => setConfirm(null)}>{t('common.cancel')}</Button>
                  <Button tone="danger" onClick={() => void release(c)}>{t('work.release.confirm')}</Button>
                </Toolbar>
              )}
            </div>
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
                <p className="muted">{t('work.leases.unread', { reason: read.view.leases.reason })}</p>
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
