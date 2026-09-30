// Releases with their basis (docs/reports/product.html `renderReleases`, ADR-0084): per project, what
// changed, where it applies, what went in and why, and what confirms it. Every row is a record the
// journal holds — none is invented; a release with no verification is a candidate, and a rollback
// is a new release, so the release it replaced is shown exactly as it was recorded.

import { useEffect, useState } from 'react'
import type { ReadEnvelope } from '../../../shared/readEnvelope'
import type { ReleaseCommandResult, ReleaseEntry, ReleaseRef, ReleaseStatus } from '../../../shared/releases.ts'
import type { ProjectRow } from '../../../shared/types'
import { useLocale, useT } from '../i18n'

type Said = { ok: true } | { ok: false; text: string } | null

export function ReleasesScreen({ projects, projectId = null, releaseId = null, onPulse, onBoard }: {
  projects: ProjectRow[] | null
  /** The project tab to open on; every project when null. */
  projectId?: string | null
  /** The release to open, when the visit names one. */
  releaseId?: string | null
  onPulse: () => void
  onBoard: (projectId: string) => void
}): React.JSX.Element {
  const t = useT(), locale = useLocale()
  const [read, setRead] = useState<ReadEnvelope<ReleaseEntry[]> | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [round, setRound] = useState(0)
  const [tab, setTab] = useState<string>(projectId ?? 'all')
  const [picked, setPicked] = useState<string | null>(releaseId)
  const [form, setForm] = useState<{ rollsBack: ReleaseEntry | null } | null>(null)

  useEffect(() => {
    let alive = true
    window.fabric.releases.list({ limit: 200 }).then(
      (r) => alive && (setRead(r), setFailed(null)),
      (e: unknown) => alive && setFailed(e instanceof Error ? e.message : String(e))
    )
    return () => { alive = false }
  }, [round])

  const live = (projects ?? []).filter((p) => p.status !== 'archived')
  const all = read?.data ?? []
  const rows = tab === 'all' ? all : all.filter((r) => r.projectId === tab)
  const shown = rows.find((r) => r.id === picked) ?? rows[0] ?? null
  const unread = (read?.sources ?? []).filter((s) => s.status !== 'ok').map((s) => s.name)
  const nameOf = (id: string | null) => (id ? all.find((r) => r.id === id)?.name ?? id.slice(0, 8) : '')
  const when = (iso: string) => new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  const status = (s: ReleaseStatus) => t(`launch.releases.status.${s}` as 'launch.releases.status.candidate')
  const formProject = form?.rollsBack?.projectId ?? (tab !== 'all' ? tab : live[0]?.id ?? null)
  const committed = (id: string) => { setForm(null); setPicked(id); setRound((n) => n + 1) }

  return (
    <div className="lp" data-launch-view="launch-releases">
      <header className="lp-heading">
        <div>
          <p className="lp-kicker">{t('launch.releases.kicker')}</p>
          <h2 tabIndex={-1}>{t('launch.releases.title')}</h2>
          <p>{t('launch.releases.lede')}</p>
        </div>
        <div className="lp-actions">
          {live.length > 0 && <button type="button" className="lp-button" onClick={() => setForm(form ? null : { rollsBack: null })}>{t('launch.releases.record')}</button>}
          <button type="button" className="lp-button" onClick={onPulse}>{t('launch.releases.back')}</button>
        </div>
      </header>
      <div className="lp-tabs" role="group" aria-label={t('launch.releases.list')}>
        {[...live.map((p) => [p.id, p.name] as const), ['all', t('launch.releases.all')] as const].map(([id, label]) => (
          <button key={id} type="button" className="lp-tab" aria-pressed={tab === id} onClick={() => { setTab(id); setPicked(null) }}>{label}</button>
        ))}
      </div>
      {failed && <div className="lp-callout" role="alert"><p>{t('launch.releases.unread', { sources: failed })}</p></div>}
      {unread.length > 0 && <div className="lp-callout" role="alert"><p>{t('launch.releases.unread', { sources: unread.join(', ') })}</p></div>}
      {form && formProject && (
        <RecordForm key={(form.rollsBack?.id ?? 'new') + formProject} projects={live} projectId={formProject}
          rollsBack={form.rollsBack} onCancel={() => setForm(null)} onCommitted={committed} />
      )}
      {read === null && !failed && <section className="lp-panel" aria-busy="true"><p>{t('launch.releases.reading')}</p></section>}
      {read !== null && rows.length === 0 && !unread.includes('releases') && (
        <section className="lp-empty">
          <h3>{t('launch.releases.empty.title')}</h3>
          <p>{t('launch.releases.empty.body')}</p>
        </section>
      )}
      {shown && (
        <div className="fp-release-grid">
          <aside className="lp-panel" aria-label={t('launch.releases.list')}>
            {rows.map((x) => (
              <button key={x.id} type="button" className="fp-release-row" aria-pressed={shown.id === x.id} onClick={() => setPicked(x.id)}>
                <small>{when(x.recordedAt)}</small>
                <b>{x.name}</b>
                <span>{status(x.status)}{tab === 'all' && x.projectName ? ` · ${x.projectName}` : ''}</span>
              </button>
            ))}
          </aside>
          <Detail key={shown.id} r={shown} status={status} when={when} nameOf={nameOf}
            onBoard={onBoard} onRollback={() => setForm({ rollsBack: shown })} onVerified={() => setRound((n) => n + 1)} />
        </div>
      )}
    </div>
  )
}

function Detail({ r, status, when, nameOf, onBoard, onRollback, onVerified }: {
  r: ReleaseEntry
  status: (s: ReleaseStatus) => string
  when: (iso: string) => string
  nameOf: (id: string | null) => string
  onBoard: (projectId: string) => void
  onRollback: () => void
  onVerified: () => void
}): React.JSX.Element {
  const t = useT()
  const [verifying, setVerifying] = useState(false)
  const ref = (x: ReleaseRef) => <li key={x.id}>{x.text ?? t('launch.releases.unreadRef', { id: x.id.slice(0, 8) })}</li>
  const verification = r.outcome === null ? t('launch.releases.verify.candidate')
    : t(r.outcome === 'accepted' ? 'launch.releases.verify.accepted' : 'launch.releases.verify.failed', { receipt: r.receipt ?? '' })
  return (
    <section className="lp-panel fp-release-detail" aria-label={r.name}>
      <p className="lp-kicker">{r.environment}</p>
      <h3>{r.name} <span className={`lp-pill${r.status === 'failed' ? ' danger' : ''}`}>{status(r.status)}</span></h3>
      {r.summary && <p>{r.summary}</p>}
      {r.rollsBack && <p className="lp-meta">{t('launch.releases.rollsBack', { name: nameOf(r.rollsBack) })}</p>}
      <h4>{t('launch.releases.went')}</h4>
      {r.tasks.length ? <ul>{r.tasks.map(ref)}</ul> : <p className="lp-meta">{t('launch.releases.noTasks')}</p>}
      <h4>{t('launch.releases.why')}</h4>
      {r.decisions.length ? <ul>{r.decisions.map(ref)}</ul> : <p className="lp-meta">{t('launch.releases.noDecisions')}</p>}
      <h4>{t('launch.releases.check')}</h4>
      <p>{verification}</p>
      {r.rolledBackBy && <p className="lp-meta">{t('launch.releases.rolledBackBy', { name: nameOf(r.rolledBackBy) })}</p>}
      <details>
        <summary>{t('launch.releases.chain')}</summary>
        <dl className="lp-facts">
          <div><dt>{t('launch.releases.chain.record')}</dt><dd>{when(r.recordedAt)} · {r.id.slice(0, 8)}</dd></div>
          <div><dt>{t('launch.releases.chain.env')}</dt><dd>{r.environment}</dd></div>
          <div><dt>{t('launch.releases.chain.receipt')}</dt><dd>{r.receipt ? `${r.receipt}${r.verifiedAt ? ` · ${when(r.verifiedAt)}` : ''}` : t('launch.releases.chain.none')}</dd></div>
        </dl>
        <p>{t('launch.releases.chain.note')}</p>
      </details>
      {verifying && <VerifyForm r={r} onCancel={() => setVerifying(false)} onCommitted={() => { setVerifying(false); onVerified() }} />}
      <div className="lp-callout">
        <b>{t('launch.releases.next')}</b>
        <p>{t(`launch.releases.next.${r.status}` as 'launch.releases.next.candidate')}</p>
        <div className="lp-actions">
          {r.status !== 'rolled_back' && !verifying && <button type="button" className="lp-button" onClick={() => setVerifying(true)}>{t('launch.releases.verifyAct')}</button>}
          {r.status !== 'rolled_back' && <button type="button" className="lp-button" onClick={onRollback}>{t('launch.releases.rollback')}</button>}
          <button type="button" className="lp-button" onClick={() => onBoard(r.projectId)}>{t('launch.releases.toBoard')}</button>
        </div>
      </div>
    </section>
  )
}

/** What a result says, in words: a refusal by its code, a lost answer as uncertainty. */
function sayResult(t: ReturnType<typeof useT>, r: ReleaseCommandResult): Said {
  if (r.state === 'committed') return { ok: true }
  if (r.state === 'refused') return { ok: false, text: t(`launch.releases.refused.${r.refusal}` as 'launch.releases.refused.no_such') }
  return { ok: false, text: t('launch.releases.unconfirmed') }
}

function VerifyForm({ r, onCancel, onCommitted }: { r: ReleaseEntry; onCancel: () => void; onCommitted: () => void }): React.JSX.Element {
  const t = useT()
  // One command id per attempt: a retry after an unconfirmed answer is the same act.
  const [commandId, setCommandId] = useState(() => crypto.randomUUID())
  const [outcome, setOutcome] = useState<'accepted' | 'failed'>('accepted')
  const [receipt, setReceipt] = useState('')
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<Said>(null)
  const save = async (): Promise<void> => {
    setBusy(true)
    setSaid(null)
    try {
      const result = await window.fabric.releases.verify({ commandId, releaseId: r.id, projectId: r.projectId, outcome, receipt })
      setSaid(sayResult(t, result))
      if (result.state === 'committed') onCommitted()
      else if (result.state === 'refused') setCommandId(crypto.randomUUID())
    } catch {
      // A rejected call does not say whether it landed: the same command id is kept for the retry.
      setSaid({ ok: false, text: t('launch.releases.unconfirmed') })
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="lp-detail" aria-label={t('launch.releases.verifyAct')}>
      <fieldset className="lp-field">
        <legend>{t('launch.releases.outcome')}</legend>
        {(['accepted', 'failed'] as const).map((o) => (
          <label key={o}><input type="radio" name={`outcome-${r.id}`} checked={outcome === o} onChange={() => setOutcome(o)} /> {t(`launch.releases.outcome.${o}` as 'launch.releases.outcome.accepted')}</label>
        ))}
      </fieldset>
      <label className="lp-field">
        {t('launch.releases.receipt')}
        <textarea rows={3} value={receipt} onChange={(e) => setReceipt(e.target.value)} />
      </label>
      {said && !said.ok && <div className="lp-callout" role="alert"><p>{said.text}</p></div>}
      <div className="lp-actions">
        <button type="button" className="lp-button primary" disabled={busy || !receipt.trim()} onClick={() => void save()}>{t('launch.releases.save')}</button>
        <button type="button" className="lp-button" onClick={onCancel}>{t('launch.releases.cancel')}</button>
      </div>
    </section>
  )
}

interface Basis { tasks: { id: string; text: string }[]; decisions: { id: string; text: string }[]; unread: string[] }

function RecordForm({ projects, projectId, rollsBack, onCancel, onCommitted }: {
  projects: ProjectRow[]
  projectId: string
  rollsBack: ReleaseEntry | null
  onCancel: () => void
  onCommitted: (releaseId: string) => void
}): React.JSX.Element {
  const t = useT()
  const [project, setProject] = useState(projectId)
  const [attempt, setAttempt] = useState(() => ({ commandId: crypto.randomUUID(), releaseId: crypto.randomUUID() }))
  const [name, setName] = useState('')
  const [environment, setEnvironment] = useState(rollsBack?.environment ?? '')
  const [summary, setSummary] = useState('')
  const [tasks, setTasks] = useState<string[]>([])
  const [decisions, setDecisions] = useState<string[]>([])
  const [basis, setBasis] = useState<Basis | null>(null)
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<Said>(null)

  useEffect(() => {
    let alive = true
    setBasis(null)
    const reason = (e: unknown) => (e instanceof Error ? e.message : String(e))
    Promise.allSettled([window.fabric.tasks.list(project), window.fabric.decisions.list(project)]).then(([tl, dl]) => {
      if (!alive) return
      setBasis({
        tasks: tl.status === 'fulfilled' ? tl.value.tasks.filter((x) => x.status === 'done').map((x) => ({ id: x.id, text: x.title || x.instruction })) : [],
        decisions: dl.status === 'fulfilled' ? dl.value.lineages.map((l) => ({ id: l.current.id, text: l.current.claim })) : [],
        unread: [tl, dl].flatMap((x) => (x.status === 'rejected' ? [reason(x.reason)] : []))
      })
    })
    return () => { alive = false }
  }, [project])

  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  const save = async (): Promise<void> => {
    setBusy(true)
    setSaid(null)
    try {
      const result = await window.fabric.releases.record({ ...attempt, projectId: project, name, environment,
        ...(summary.trim() ? { summary } : {}), taskIds: tasks, decisionIds: decisions, rollsBack: rollsBack?.id ?? null })
      setSaid(sayResult(t, result))
      if (result.state === 'committed') onCommitted(result.releaseId)
      else if (result.state === 'refused') setAttempt({ commandId: crypto.randomUUID(), releaseId: crypto.randomUUID() })
    } catch {
      // A rejected call does not say whether it landed: the same attempt is kept for the retry.
      setSaid({ ok: false, text: t('launch.releases.unconfirmed') })
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="lp-detail" aria-label={rollsBack ? t('launch.releases.form.rollbackTitle', { name: rollsBack.name }) : t('launch.releases.form.title')}>
      <h3 tabIndex={-1}>{rollsBack ? t('launch.releases.form.rollbackTitle', { name: rollsBack.name }) : t('launch.releases.form.title')}</h3>
      {!rollsBack && projects.length > 1 && (
        <label className="lp-field">
          {t('launch.releases.form.project')}
          <select value={project} onChange={(e) => { setProject(e.target.value); setTasks([]); setDecisions([]) }}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      )}
      <label className="lp-field">{t('launch.releases.form.name')}<input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} /></label>
      <label className="lp-field">{t('launch.releases.form.environment')}<input value={environment} maxLength={200} onChange={(e) => setEnvironment(e.target.value)} /></label>
      <label className="lp-field">{t('launch.releases.form.summary')}<textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} /></label>
      {basis === null ? <p className="lp-meta">{t('launch.releases.reading')}</p> : (
        <>
          {basis.unread.map((u) => <div key={u} className="lp-callout" role="alert"><p>{t('launch.releases.form.unread', { reason: u })}</p></div>)}
          <fieldset className="lp-field">
            <legend>{t('launch.releases.form.tasks')}</legend>
            {basis.tasks.length === 0 && <p className="lp-meta">{t('launch.releases.form.noTasks')}</p>}
            {basis.tasks.map((x) => <label key={x.id}><input type="checkbox" checked={tasks.includes(x.id)} onChange={() => toggle(tasks, setTasks, x.id)} /> {x.text}</label>)}
          </fieldset>
          <fieldset className="lp-field">
            <legend>{t('launch.releases.form.decisions')}</legend>
            {basis.decisions.length === 0 && <p className="lp-meta">{t('launch.releases.form.noDecisions')}</p>}
            {basis.decisions.map((x) => <label key={x.id}><input type="checkbox" checked={decisions.includes(x.id)} onChange={() => toggle(decisions, setDecisions, x.id)} /> {x.text}</label>)}
          </fieldset>
        </>
      )}
      {said && !said.ok && <div className="lp-callout" role="alert"><p>{said.text}</p></div>}
      <div className="lp-actions">
        <button type="button" className="lp-button primary" disabled={busy || !name.trim() || !environment.trim()} onClick={() => void save()}>{t('launch.releases.save')}</button>
        <button type="button" className="lp-button" onClick={onCancel}>{t('launch.releases.cancel')}</button>
      </div>
    </section>
  )
}
