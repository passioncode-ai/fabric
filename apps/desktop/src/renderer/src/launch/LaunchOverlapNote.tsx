// #region launch-overlap-note — docs: docs/evidence/specs/2026-11-06-session-coordination.md#5-waves
/**
 * CO-522 wave A (SCN-180 step 2): what a start would run into, said before it starts. Sessions whose work overlaps
 * come first with why (the same task, the same backlog row, linked tasks, files both name); sessions that merely work
 * in the same project follow. The person starts anyway, waits, or opens the other session's console when Fabric holds
 * it. A check that could not be read is said, and starting stays possible.
 */
import { useState } from 'react'
import type { LaunchHit, LaunchOverlap, LaunchWhy } from '../../../shared/launchOverlap.ts'
import { useT } from '../i18n'
import { since } from '../duration'
import { useOpenConsole } from '../consoles'

export type LaunchCheck = { at: 'clear' } | { at: 'found'; found: LaunchOverlap & { console: string[] } } | { at: 'unread'; reason: string }

/** Reads what a start in `projectId` would run into; never throws. */
export async function checkLaunch(projectId: string, text: string, taskId: string | null = null): Promise<LaunchCheck> {
  try {
    const found = await window.fabric.work.launchCheck({ projectId, taskId, text })
    return found.overlaps.length || found.alsoWorking.length ? { at: 'found', found } : { at: 'clear' }
  } catch (e) {
    return { at: 'unread', reason: e instanceof Error ? e.message : String(e) }
  }
}

export function LaunchOverlapNote({ check, onStart, onWait }: {
  check: Exclude<LaunchCheck, { at: 'clear' }>
  onStart: () => void
  onWait: () => void
}): React.JSX.Element {
  const t = useT()
  const openConsole = useOpenConsole()
  const [problem, setProblem] = useState<string | null>(null)
  const why = (w: LaunchWhy): string =>
    w.kind === 'same-task' ? t('launchCheck.why.sameTask')
      : w.kind === 'same-row' ? t('launchCheck.why.sameRow', { row: w.row })
        : w.kind === 'linked' ? t('launchCheck.why.linked', { rel: w.rel })
          : t('launchCheck.why.overlap', { path: w.mine })
  const row = (h: LaunchHit, withWhy: boolean): React.JSX.Element => (
    <li key={h.claimId}>
      {t('launchCheck.hit', { agent: h.agent ?? t('launchCheck.agentUnknown'), task: h.taskTitle, since: since(h.since, t) })}
      {withWhy && <span className="lp-meta"> · {h.why.map(why).join('; ')}</span>}
      {check.at === 'found' && check.found.console.includes(h.heldBy) && (
        <> <button type="button" className="lp-link" onClick={() => void openConsole(h.heldBy).catch((e: unknown) => setProblem(String(e)))}>{t('launchCheck.open')}</button></>
      )}
    </li>
  )
  return (
    <section className="lo" role="alert">
      {check.at === 'unread' ? <p>{t('launchCheck.unread', { reason: check.reason })}</p> : (
        <>
          {check.found.overlaps.length > 0 && (<><h4>{t('launchCheck.title')}</h4><ul className="lp-list">{check.found.overlaps.map((h) => row(h, true))}</ul></>)}
          {check.found.alsoWorking.length > 0 && (<><h4>{t('launchCheck.alsoTitle')}</h4><ul className="lp-list">{check.found.alsoWorking.map((h) => row(h, false))}</ul></>)}
        </>
      )}
      {problem && <p className="lp-meta">{problem}</p>}
      <div className="lo-acts">
        <button type="button" className="lp-button primary" onClick={onStart}>{t('launchCheck.start')}</button>
        <button type="button" className="lp-button" onClick={onWait}>{t('launchCheck.wait')}</button>
      </div>
    </section>
  )
}
// #endregion launch-overlap-note
