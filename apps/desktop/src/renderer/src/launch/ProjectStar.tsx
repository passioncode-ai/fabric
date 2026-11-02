// #region project-star — docs: docs/ux/scenarios.md#scn-163-see-on-главная-what-needs-me-what-is-being-done-now-and-my-projects
// CO-460: a project is pinned from its own page now that Главная has no projects table (SCN-043). The rail lists the
// projects at work alphabetically with the star as a mark (the simple Fabric, open choice 1), so the favourites' hand
// order has no reader left and no control here. The limit is said and resolved in place: nothing is written until the
// person names the favourite to release (`favourites.replace`, one write).
import { useEffect, useState } from 'react'
import { FAVOURITE_LIMIT } from '../../../shared/favourites'
import { projectDisplayName } from '../../../shared/projectDisplayName'
import type { PinResult, ProjectRow } from '../../../shared/types'
import { useT } from '../i18n'
import { FailureNote } from '../OperatorError'

export function ProjectStar({ project }: { project: ProjectRow }): React.JSX.Element {
  const t = useT()
  /** Null until read; a failed read is said, never an empty set that looks like nothing pinned (0.3.6 review i2 ER-4). */
  const [pins, setPins] = useState<string[] | null>(null)
  const [problem, setProblem] = useState<{ said: string; detail: string | null } | null>(null)
  /** The favourites to choose from when the set is full; null while it is not. */
  const [full, setFull] = useState<ProjectRow[] | null>(null)
  useEffect(() => {
    let alive = true
    // A read that throws before it answers is said the same way as one that fails (a missing bridge, a stale preload).
    Promise.resolve().then(() => window.fabric.favourites.list()).then(
      (p) => { if (alive) setPins(p) },
      (e: unknown) => { if (alive) setProblem({ said: t('estate.pinsUnread'), detail: e instanceof Error ? e.message : String(e) }) }
    )
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once per project
  }, [project.id])
  const name = projectDisplayName(project)
  const pinned = pins?.includes(project.id) ?? false
  const landed = (r: PinResult): void => {
    setPins(r.pins)
    setProblem(r.saved || r.atLimit ? null : { said: t(r.reason ? 'estate.pinFailed' : 'estate.pinNotSaved'), detail: r.reason ?? null })
  }
  const failed = (e: unknown): void => setProblem({ said: t('estate.pinFailed'), detail: e instanceof Error ? e.message : String(e) })
  const toggle = (): void => {
    void window.fabric.favourites.toggle(project.id).then(async (r) => {
      landed(r)
      // At the limit nothing was written and nothing dropped: the person says which favourite to release.
      if (r.atLimit) {
        const all = await window.fabric.projects.list().catch(() => [] as ProjectRow[])
        const byId = new Map(all.map((p) => [p.id, p]))
        setFull(r.pins.map((id) => byId.get(id)).filter((p): p is ProjectRow => p !== undefined))
      }
    }).catch(failed)
  }
  const release = (old: ProjectRow): void => {
    setFull(null)
    void window.fabric.favourites.replace(old.id, project.id).then(landed).catch(failed)
  }
  return (
    <>
      <button type="button" className="lp-button" aria-pressed={pinned} disabled={pins === null}
        aria-label={`${pinned ? t('estate.unpin') : t('estate.pin')}: ${name}`} onClick={toggle}>
        {pinned ? t('glyph.star') : t('glyph.starEmpty')} {pinned ? t('estate.unpin') : t('estate.pin')}
      </button>
      {problem && <FailureNote said={problem.said} detail={problem.detail} />}
      {full && (
        <div className="lp-panel" role="group" aria-label={t('estate.pinFull', { name, limit: FAVOURITE_LIMIT })} data-testid="pin-full">
          <p>{t('estate.pinFull', { name, limit: FAVOURITE_LIMIT })}</p>
          <div className="lp-actions">
            {full.map((p) => (
              <button key={p.id} type="button" className="lp-button" onClick={() => release(p)}>
                {t('estate.pinRelease', { name: projectDisplayName(p) })}
              </button>
            ))}
            <button type="button" className="lp-button" onClick={() => setFull(null)}>{t('common.keep')}</button>
          </div>
        </div>
      )}
    </>
  )
}
// #endregion project-star
