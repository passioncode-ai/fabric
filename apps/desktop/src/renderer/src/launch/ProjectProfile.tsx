// #region project-profile-panel — docs: docs/evidence/specs/2026-10-23-0312-w2-project-onboarding.md#slices-in-order
// W2 S4 (OF-24, OF-27, SCN-165 as amended): what the agent onboarding a project recorded (goal, summary, plan,
// relations), the business the person can correct, the people from Git, and «Познакомиться с проектом» for a project
// with no profile yet. Each part reads and fails on its own; nothing here hides a failure as an empty list.
import { useEffect, useState } from 'react'
import type { GitPeopleView, ProjectRelation, ProjectRow } from '../../../shared/types'
import { useLocale, useT } from '../i18n'
import { FailureNote } from '../OperatorError'

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))

export function ProjectProfile({ project, feedMark, onOpenTask }: {
  project: ProjectRow
  feedMark: number
  onOpenTask: (taskId: string) => void
}): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const [relations, setRelations] = useState<ProjectRelation[] | null>(null)
  const [relationsProblem, setRelationsProblem] = useState<string | null>(null)
  const [people, setPeople] = useState<GitPeopleView | null>(null)
  const [peopleProblem, setPeopleProblem] = useState<string | null>(null)
  const [business, setBusiness] = useState(project.business ?? '')
  const [saved, setSaved] = useState(project.business ?? '')
  const [businessProblem, setBusinessProblem] = useState<string | null>(null)
  const [onboarding, setOnboarding] = useState(false)
  const [onboardProblem, setOnboardProblem] = useState<string | null>(null)

  useEffect(() => { setBusiness(project.business ?? ''); setSaved(project.business ?? '') }, [project.id, project.business])
  useEffect(() => {
    let alive = true
    // Through a promise, so an API that throws at once (an older preload) is said in this panel, not a crashed page.
    Promise.resolve().then(() => window.fabric.projects.relations(project.id)).then(
      (r) => { if (alive) { setRelations(r); setRelationsProblem(null) } },
      (e: unknown) => alive && setRelationsProblem(message(e))
    )
    Promise.resolve().then(() => window.fabric.projects.people(project.id)).then(
      (p) => { if (alive) { setPeople(p); setPeopleProblem(null) } },
      (e: unknown) => alive && setPeopleProblem(message(e))
    )
    return () => { alive = false }
  }, [project.id, feedMark])

  const saveBusiness = (): void => {
    const next = business.trim()
    if (next === saved) return
    setBusinessProblem(null)
    Promise.resolve().then(() => window.fabric.projects.setBusiness(project.id, next)).then(
      (row) => { setSaved(row.business ?? ''); setBusiness(row.business ?? '') },
      (e: unknown) => setBusinessProblem(message(e))
    )
  }
  const onboard = (): void => {
    setOnboarding(true)
    setOnboardProblem(null)
    Promise.resolve().then(() => window.fabric.projects.onboard(project.id)).then(
      (r) => { setOnboarding(false); onOpenTask(r.taskId) },
      (e: unknown) => { setOnboarding(false); setOnboardProblem(message(e)) }
    )
  }
  const plan = project.plan ?? null
  // DA-3 / ER-1: onboarded is what an agent recorded (a goal or a summary), not `profiled_at`: the person setting only the
  // business stamps `profiled_at` too, and must not lose «Познакомиться с проектом» or read that an agent recorded no goal.
  const profiled = !!(project.goal?.trim() || project.summary?.trim())

  return (
    <section className="lp-panel" aria-labelledby="project-profile-title">
      <h3 id="project-profile-title">{t('launch.profile.title')}</h3>
      {!profiled && (
        <>
          <p>{t('launch.profile.none')}</p>
          <button type="button" className="lp-button primary" disabled={onboarding} onClick={onboard}>{t('launch.profile.onboard')}</button>
          {onboardProblem && <FailureNote said={t('launch.profile.onboardFailed')} detail={onboardProblem} />}
        </>
      )}
      {profiled && (
        <>
          {project.summary && <p className="lp-meta">{project.summary}</p>}
          <p className="lp-kicker">{t('launch.profile.goal')}</p>
          <p>{project.goal || t('launch.profile.noGoal')}</p>
          {plan && (plan.done.length > 0 || plan.next.length > 0) && (
            <>
              <p className="lp-kicker">{t('launch.profile.plan')}</p>
              {plan.done.length > 0 && (
                <>
                  <h4>{t('launch.profile.done')}</h4>
                  <ul>{plan.done.map((x, i) => <li key={`d${i}`}>{x}</li>)}</ul>
                </>
              )}
              {plan.next.length > 0 && (
                <>
                  <h4>{t('launch.profile.next')}</h4>
                  <ol>{plan.next.map((x, i) => <li key={`n${i}`}>{x}</li>)}</ol>
                </>
              )}
            </>
          )}
        </>
      )}
      <label className="lp-field">
        {t('launch.profile.business')}
        <input
          type="text"
          value={business}
          maxLength={80}
          placeholder={t('launch.profile.businessPlaceholder')}
          aria-describedby="project-business-hint"
          onChange={(e) => setBusiness(e.target.value)}
          onBlur={saveBusiness}
          onKeyDown={(e) => { if (e.key === 'Enter') saveBusiness() }}
        />
      </label>
      <small id="project-business-hint" className="lp-meta">{t('launch.profile.businessHint')}</small>
      {businessProblem && <FailureNote said={t('launch.profile.businessFailed')} detail={businessProblem} />}
      <p className="lp-kicker">{t('launch.profile.relations')}</p>
      {relationsProblem && <FailureNote said={t('launch.profile.relationsUnreadable')} detail={relationsProblem} />}
      {relations === null && !relationsProblem && <p className="lp-meta">{t('estate.reading')}</p>}
      {relations?.length === 0 && <p className="lp-meta">{t('launch.profile.noRelations')}</p>}
      {relations && relations.length > 0 && (
        <ul>{relations.map((r) => <li key={`${r.kind}:${r.target}`}>{t(`launch.profile.relation.${r.kind}` as 'launch.profile.relation.other', { target: r.target })}{r.note && t('launch.profile.relationNote', { note: r.note })}</li>)}</ul>
      )}
      <p className="lp-kicker">{t('launch.profile.people')}</p>
      {peopleProblem && <FailureNote said={t('launch.profile.peopleUnreadable')} detail={peopleProblem} />}
      {people === null && !peopleProblem && <p className="lp-meta">{t('estate.reading')}</p>}
      {people?.people.length === 0 && <p className="lp-meta">{t('launch.profile.noPeople')}</p>}
      {people && people.people.length > 0 && (
        <ul>
          {people.people.slice(0, 12).map((p) => (
            <li key={p.email} title={p.email}>
              {t('launch.profile.person', { name: p.name, commits: p.commits, date: new Date(p.lastAt).toLocaleDateString(locale) })}
            </li>
          ))}
        </ul>
      )}
      {people && people.unread.length > 0 && <p className="lp-meta">{t('launch.profile.peopleSome', { count: people.unread.length })}</p>}
    </section>
  )
}
// #endregion project-profile-panel
