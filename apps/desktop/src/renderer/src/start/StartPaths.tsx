// #region start-screens — docs: docs/adr/0129-onboarding-is-four-actions-and-agent-work-runs-in-the-coding-agents-console.md#decision
// The start paths (ADR-0100, amended by ADR-0129; SCN-126…SCN-129, SCN-131, SCN-136; SCR-70…SCR-75): the menu of four
// actions and the project paths; the two agent paths live in `AgentPaths.tsx`. One screen per path, every state of each path drawn — idle, working,
// refused, failed, done — and nothing created without the operator's explicit act. The first run
// (`FirstRun.tsx`) ends on the same menu, so the two never disagree about what the paths are.

import { useEffect, useMemo, useRef, useState } from 'react'
import { groupCandidates, type CandidateView, type FolderView, type ScanView } from '../../../shared/startPaths.ts'
import type { ProjectRow } from '../../../shared/types'
import { useLocale, useT, type Translate } from '../i18n'
import { CopyButton, FolderFactsList, Heading, errorText, explainError, purposeFrom, shortDate } from './startParts'
import { ConvertAgent, CreateAgent } from './AgentPaths'

export { CopyButton, errorText, explainError }

export type StartPath = 'menu' | 'add' | 'scan' | 'new' | 'agent' | 'convert'

export interface StartProps {
  path: StartPath
  projects: ProjectRow[] | null
  onPath(path: StartPath): void
  /** A project now exists: open it. */
  onCreated(projectId: string): void
  onOpenProject(projectId: string, section?: 'team'): void
  /** Open a project with "Set up this project with the agent" already in its task field (plan R3a). */
  onSetUp?(projectId: string): void
  onHome(): void
  /** Projects were created without leaving the screen (a scan import): re-read the list so the sidebar shows them. */
  onProjectsChanged(): void
}


/** A candidate's path as the checklist shows it: relative to the scanned folder, which the summary already names. */
export function shownPath(path: string, root: string): string {
  return path.startsWith(root + '/') ? path.slice(root.length + 1) : path
}
const newId = (): string => crypto.randomUUID()


export function StartScreen(props: StartProps): React.JSX.Element {
  switch (props.path) {
    case 'menu':
      return <StartMenu onPath={props.onPath} onHome={props.onHome} />
    case 'add':
      return <AddProject {...props} />
    case 'scan':
      return <ScanFolder {...props} />
    case 'new':
      // Routed to the draft-backed form by the shell; reaching here means a caller skipped that.
      return <StartMenu onPath={props.onPath} onHome={props.onHome} />
    case 'agent':
      return <CreateAgent onBack={() => props.onPath('menu')} onStarted={props.onCreated} />
    case 'convert':
      return <ConvertAgent onBack={() => props.onPath('menu')} onStarted={props.onCreated} />
  }
}



// ── The menu ────────────────────────────────────────────────────────────────

/** The four actions of the onboarding in two pairs (0.3.3, REQ-01): an agent — create one, or turn one built
 *  elsewhere into an ecosystem agent; a project — open one (a folder, or a folder of repositories), or create one.
 *  Sections with their own buttons rather than card-buttons, because "Open a project" offers two ways in. */
export function StartCards({ onPath, lastScan }: { onPath(path: StartPath): void; lastScan?: ScanView | null }): React.JSX.Element {
  const t = useT()
  // Products not yet added — a worktree or nested repository is a part, not something the menu should keep asking about.
  const pending = lastScan ? lastScan.candidates.filter((c) => c.importedBy.length === 0 && c.path === c.group).length : 0
  const card = (id: string, mark: string, actions: React.ReactNode) => (
    <li>
      <section className="st-card" aria-labelledby={`st-card-${id}`}>
        <span className="st-card-mark" aria-hidden="true">{mark}</span>
        <b id={`st-card-${id}`}>{t(`start.card.${id}.title` as 'start.card.agent.title')}</b>
        <span>{t(`start.card.${id}.body` as 'start.card.agent.body')}</span>
        <div className="lp-actions">{actions}</div>
      </section>
    </li>
  )
  const go = (path: StartPath, label: string, primary = false) => (
    <button type="button" className={primary ? 'lp-button primary' : 'lp-button'} onClick={() => onPath(path)}>{label}</button>
  )
  return (
    <div className="st-pairs">
      <section className="st-pair" aria-labelledby="st-pair-agent">
        <p id="st-pair-agent" className="lp-kicker">{t('start.pair.agent')}</p>
        <p className="lp-meta">{t('start.pair.agentBody')}</p>
        <ul className="st-cards">
          {card('agent', t('start.card.agent.mark'), go('agent', t('start.card.agent.go'), true))}
          {card('convert', t('start.card.convert.mark'), go('convert', t('start.card.convert.go')))}
        </ul>
      </section>
      <section className="st-pair" aria-labelledby="st-pair-project">
        <p id="st-pair-project" className="lp-kicker">{t('start.pair.project')}</p>
        <p className="lp-meta">{t('start.pair.projectBody')}</p>
        <ul className="st-cards">
          {card('open', t('start.card.open.mark'), <>
            {go('add', t('start.card.open.one'), true)}
            {go('scan', pending > 0 ? t('start.card.open.manyPending', { count: pending }) : t('start.card.open.many'))}
          </>)}
          {card('new', t('start.card.new.mark'), go('new', t('start.card.new.go')))}
        </ul>
      </section>
    </div>
  )
}

function StartMenu({ onPath, onHome }: { onPath(path: StartPath): void; onHome(): void }): React.JSX.Element {
  const t = useT()
  const [last, setLast] = useState<ScanView | null>(null)
  useEffect(() => {
    let alive = true
    // The pending count is a hint on a card; a kept list that cannot be read only removes the hint. The scan
    // screen itself says when it cannot read the kept list.
    window.fabric.start.lastScan().then((s) => alive && setLast(s), () => undefined)
    return () => { alive = false }
  }, [])
  return (
    <div className="lp st" data-launch-view="start-menu">
      <Heading kicker={t('start.kicker')} title={t('start.menu.title')} lede={t('start.menu.lede')} back={{ label: t('start.home'), onClick: onHome }} />
      <StartCards onPath={onPath} lastScan={last} />
    </div>
  )
}


// ── Add an existing project (SCN-127) ───────────────────────────────────────

type AddState =
  | { at: 'idle' }
  | { at: 'reading'; folder: string }
  | { at: 'ready'; facts: FolderView; name: string }
  | { at: 'creating'; facts: FolderView; name: string }
  | { at: 'failed'; reason: string; facts?: FolderView; name?: string }

function AddProject({ onPath, onCreated, onOpenProject }: StartProps): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const [s, setS] = useState<AddState>({ at: 'idle' })
  const id = useRef(newId())
  const panel = useRef<HTMLElement>(null)

  const choose = async (): Promise<void> => {
    try {
      const folder = await window.fabric.start.chooseFolder('project')
      if (!folder) return
      setS({ at: 'reading', folder })
      const facts = await window.fabric.start.inspect(folder)
      id.current = newId()
      setS({ at: 'ready', facts, name: facts.name })
      requestAnimationFrame(() => panel.current?.focus()) // focus goes to what arrived, not to the page (0.3.3 UX-10)
    } catch (e) {
      setS({ at: 'failed', reason: explainError(e, t) })
    }
  }
  const create = async (facts: FolderView, name: string): Promise<void> => {
    setS({ at: 'creating', facts, name })
    try {
      const p = await window.fabric.projects.create({ id: id.current, name: name.trim(), purpose: purposeFrom(facts, t), repoPaths: [facts.path] })
      onCreated(p.id)
    } catch (e) {
      setS({ at: 'failed', reason: explainError(e, t), facts, name })
    }
  }

  return (
    <div className="lp st" data-launch-view="start-add">
      <Heading kicker={t('start.kicker')} title={t('start.add.title')} lede={t('start.add.lede')} back={{ label: t('start.back'), onClick: () => onPath('menu') }} />
      {(s.at === 'idle' || (s.at === 'failed' && !s.facts)) && (
        <section className="lp-panel st-step">
          {s.at === 'failed' && <div className="lp-callout" role="alert"><p>{t('start.add.failed', { reason: s.reason })}</p></div>}
          <p>{t('start.add.choose.body')}</p>
          <div className="lp-actions"><button type="button" className="lp-button primary" onClick={() => void choose()}>{t('start.add.choose')}</button></div>
        </section>
      )}
      {s.at === 'reading' && <section className="lp-panel st-step" aria-busy="true"><p>{t('start.add.reading', { folder: s.folder })}</p></section>}
      {(s.at === 'ready' || s.at === 'creating' || (s.at === 'failed' && s.facts)) && (() => {
        const facts = (s as { facts: FolderView }).facts
        const name = (s as { name: string }).name ?? facts.name
        const busy = s.at === 'creating'
        const nameProblem = name.trim() ? null : t('start.name.empty')
        return (
          <section className="lp-panel st-step" ref={panel} tabIndex={-1} aria-label={facts.name}>
            {s.at === 'failed' && <div className="lp-callout" role="alert"><p>{t('start.add.failed', { reason: s.reason })}</p></div>}
            {facts.importedBy.length > 0 && (
              <div className="lp-callout" role="status">
                <p>{t('start.add.already', { names: facts.importedBy.map((p) => p.name).join(', ') })}</p>
                <button type="button" className="lp-button" onClick={() => onOpenProject(facts.importedBy[0].id)}>{t('start.add.openExisting')}</button>
              </div>
            )}
            {!facts.git && <div className="lp-callout" role="status"><p>{t('start.add.notGit')}</p></div>}
            {/* A folder already in a project has nothing to name: the only act is to open that project. */}
            {facts.importedBy.length === 0 && (
              <label className="lp-field">
                {t('start.name.label')}
                <input value={name} maxLength={80} disabled={busy} onChange={(e) => setS({ at: 'ready', facts, name: e.target.value })} aria-invalid={!!nameProblem} aria-describedby={nameProblem ? 'start-add-name-problem' : undefined} />
                {nameProblem && <small className="field-problem" id="start-add-name-problem">{nameProblem}</small>}
              </label>
            )}
            <FolderFactsList f={facts} t={t} locale={locale} />
            <div className="lp-actions">
              {/* A folder already in a project offers that project, never a duplicate (ADR-0100 §2). */}
              {facts.importedBy.length === 0 && (
                <button type="button" className="lp-button primary" disabled={busy || !!nameProblem} onClick={() => void create(facts, name)}>
                  {busy ? t('start.add.creating') : t('start.add.create')}
                </button>
              )}
              <button type="button" className="lp-button" disabled={busy} onClick={() => void choose()}>{t('start.add.other')}</button>
            </div>
            {facts.importedBy.length === 0 && <p className="lp-meta">{t('start.add.nothingWritten')}</p>}
          </section>
        )
      })()}
    </div>
  )
}

// ── Scan a projects folder (SCN-128) ────────────────────────────────────────

type ScanState =
  | { at: 'idle'; stopped?: boolean }
  | { at: 'scanning'; root: string }
  | { at: 'results'; scan: ScanView }
  | { at: 'importing'; scan: ScanView; done: Record<string, 'ok' | string>; queue: string[] }
  | { at: 'imported'; scan: ScanView; done: Record<string, 'ok' | string>; created: { id: string; name: string }[] }
  | { at: 'failed'; reason: string }

/** A part of a product (a worktree, a repository nested in another) — not ticked by "Tick all shown". */
const isPart = (c: CandidateView): boolean => c.path !== c.group

function ScanFolder({ onPath, onCreated, onOpenProject, onProjectsChanged, onSetUp }: StartProps): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const [s, setS] = useState<ScanState>({ at: 'idle' })
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const ids = useRef<Record<string, string>>({})
  const scanning = useRef(false)
  const results = useRef<HTMLElement>(null)
  // Each scan has a number; Stop and a newer scan advance it, so a late answer is ignored (iteration 2:
  // the screen stayed on "scanning" until a stuck call returned).
  const runs = useRef(0)
  const [keptProblem, setKeptProblem] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    // The kept list fills the screen only while nothing else has started (iteration 1: a late read
    // replaced a scan already in flight). A kept list that cannot be read is said, not dropped.
    window.fabric.start.lastScan().then(
      (last) => { if (alive && last && last.candidates.length) setS((cur) => (cur.at === 'idle' && !scanning.current ? { at: 'results', scan: last } : cur)) },
      (e: unknown) => { if (alive) setKeptProblem(explainError(e, t)) }
    )
    return () => {
      alive = false
      // Leaving the screen stops a scan nobody is waiting for.
      if (scanning.current) void window.fabric.start.cancelScan()
    }
  }, [])

  const run = async (defaultPath?: string): Promise<void> => {
    try {
      // Always through the picker: a kept or earlier folder is a suggestion, never a grant (ADR-0100 §7).
      const folder = await window.fabric.start.chooseFolder('scan', defaultPath)
      if (!folder) return
      const n = ++runs.current
      scanning.current = true
      setS({ at: 'scanning', root: folder })
      setPicked(new Set())
      try {
        const scan = await window.fabric.start.scan(folder)
        if (n !== runs.current) return
        setS(scan.cancelled ? { at: 'idle', stopped: true } : { at: 'results', scan })
        if (!scan.cancelled) requestAnimationFrame(() => results.current?.focus()) // UX-10
      } catch (e) {
        if (n === runs.current) setS({ at: 'failed', reason: explainError(e, t) })
      } finally {
        if (n === runs.current) scanning.current = false
      }
    } catch (e) {
      setS({ at: 'failed', reason: explainError(e, t) })
    }
  }
  const stop = (): void => {
    runs.current++
    scanning.current = false
    setS({ at: 'idle', stopped: true })
    void window.fabric.start.cancelScan()
  }

  const importPicked = async (scan: ScanView): Promise<void> => {
    const queue = scan.candidates.filter((c) => picked.has(c.path)).map((c) => c.path)
    const done: Record<string, 'ok' | string> = {}
    const created: { id: string; name: string }[] = []
    setS({ at: 'importing', scan, done: { ...done }, queue })
    for (const p of queue) {
      const c = scan.candidates.find((x) => x.path === p)!
      ids.current[p] ??= newId() // a retry of the same row is the same create, never a sibling (UX-06)
      try {
        // The repository's own description becomes the purpose (R2), marked as the repository's words (ER-5).
        const project = await window.fabric.projects.create({ id: ids.current[p], name: c.name, purpose: purposeFrom(c, t), repoPaths: [c.path] })
        done[p] = 'ok'
        created.push({ id: project.id, name: project.name ?? c.name })
      } catch (e) {
        done[p] = explainError(e, t)
      }
      setS({ at: 'importing', scan, done: { ...done }, queue })
    }
    if (created.length) onProjectsChanged()
    // Re-marked from the kept list only when it IS this scan (same folder, kept); otherwise the screen would
    // switch to another folder's list (iteration 3). A failed re-read keeps this scan; its marks may lag.
    const after = scan.kept ? await window.fabric.start.lastScan().catch(() => null) : null
    setPicked(new Set(queue.filter((p) => done[p] !== 'ok')))
    setS({ at: 'imported', scan: after && after.root === scan.root ? after : scan, done, created })
  }

  const scan = s.at === 'results' || s.at === 'importing' || s.at === 'imported' ? s.scan : null
  const groups = useMemo(() => {
    if (!scan) return []
    const q = query.trim().toLowerCase()
    const shown = q ? scan.candidates.filter((c) => c.name.toLowerCase().includes(q) || c.path.toLowerCase().includes(q)) : scan.candidates
    return groupCandidates(shown)
  }, [scan, query])
  const parts = scan ? scan.candidates.filter(isPart).length : 0
  // "Tick all shown" ticks one Project per product: the head of each group, never its worktrees or nested parts.
  const tickable = groups.flatMap((g) => g.items).filter((c) => c.importedBy.length === 0 && !isPart(c))
  const busy = s.at === 'importing'
  // Ticked rows the search hides are still added; the footer says how many, so the count is not a surprise.
  const shownPaths = new Set(groups.flatMap((g) => g.items.map((c) => c.path)))
  const hiddenTicked = [...picked].filter((p) => !shownPaths.has(p)).length
  const failedCount = s.at === 'imported' ? Object.values(s.done).filter((v) => v !== 'ok').length : 0

  return (
    <div className="lp st" data-launch-view="start-scan">
      {/* Back waits while an import runs: leaving would drop the per-row results (iteration 3). */}
      <Heading kicker={t('start.kicker')} title={t('start.scan.title')} lede={t('start.scan.lede')} back={{ label: t('start.back'), onClick: () => onPath('menu'), disabled: busy }} />
      {(s.at === 'idle' || s.at === 'failed') && (
        <section className="lp-panel st-step">
          {s.at === 'failed' && <div className="lp-callout" role="alert"><p>{t('start.scan.failed', { reason: s.reason })}</p></div>}
          {s.at === 'idle' && s.stopped && <div className="lp-callout" role="status"><p>{t('start.scan.stopped')}</p></div>}
          {s.at === 'idle' && keptProblem && <div className="lp-callout" role="alert"><p>{t('start.scan.keptFailed', { reason: keptProblem })}</p></div>}
          <p>{t('start.scan.choose.body')}</p>
          <div className="lp-actions"><button type="button" className="lp-button primary" onClick={() => void run()}>{t('start.scan.choose')}</button></div>
          <p className="lp-meta">{t('start.scan.readOnly')}</p>
        </section>
      )}
      {s.at === 'scanning' && (
        <section className="lp-panel st-step" aria-busy="true">
          <p role="status">{t('start.scan.scanning', { folder: s.root })}</p>
          <div className="lp-actions"><button type="button" className="lp-button" onClick={stop}>{t('start.scan.stop')}</button></div>
        </section>
      )}
      {scan && (
        <section className="lp-panel st-step st-scan" ref={results} tabIndex={-1} aria-label={t('start.scan.title')}>
          <div className="lp-panel-head">
            <p className="st-summary">
              {parts > 0 ? t('start.scan.summaryParts', { count: scan.candidates.length, parts, folder: scan.root }) : t('start.scan.summary', { count: scan.candidates.length, folder: scan.root })}
              {' · '}{t('start.scan.when', { date: shortDate(scan.scannedAt, locale) })}
            </p>
            <button type="button" className="lp-button" disabled={busy} onClick={() => void run(scan.root)}>{t('start.scan.again')}</button>
          </div>
          {!scan.kept && !busy && <div className="lp-callout" role="status"><p>{t('start.scan.notKept')}</p></div>}
          {scan.truncated && <div className="lp-callout" role="status"><p>{t('start.scan.truncated', { visited: scan.visited })}</p></div>}
          {scan.unreadable > 0 && <div className="lp-callout" role="status"><p>{t('start.scan.unreadable', { count: scan.unreadable })}</p></div>}
          {scan.deep > 0 && <div className="lp-callout" role="status"><p>{t('start.scan.deep', { count: scan.deep })}</p></div>}
          {scan.symlinks > 0 && <div className="lp-callout" role="status"><p>{t('start.scan.symlinks', { count: scan.symlinks })}</p></div>}
          {s.at === 'imported' && (
            <div className="lp-callout" role="status">
              <p>{failedCount === 0 ? t('start.scan.importedAll', { ok: s.created.length }) : t('start.scan.importedSome', { ok: s.created.length, failed: failedCount })}</p>
              {s.created[0] && onSetUp && <button type="button" className="lp-button primary" onClick={() => onSetUp(s.created[0].id)}>{t('start.scan.setUpFirst', { name: s.created[0].name })}</button>}
              {s.created[0] && <button type="button" className="lp-button" onClick={() => onCreated(s.created[0].id)}>{t('start.scan.openFirst', { name: s.created[0].name })}</button>}
            </div>
          )}
          {scan.candidates.length === 0 ? (
            <p className="st-empty">{t('start.scan.none')}</p>
          ) : (
            <>
              <div className="st-toolbar">
                <label className="lp-field st-search">
                  <span className="st-visually-hidden">{t('start.scan.filter')}</span>
                  <input type="search" value={query} placeholder={t('start.scan.filter')} onChange={(e) => setQuery(e.target.value)} />
                </label>
                <button type="button" className="lp-button" disabled={busy || tickable.length === 0} onClick={() => setPicked(new Set([...picked, ...tickable.map((c) => c.path)]))}>{t('start.scan.selectAll')}</button>
                <button type="button" className="lp-button" disabled={busy || picked.size === 0} onClick={() => setPicked(new Set())}>{t('start.scan.clear')}</button>
              </div>
              {groups.length === 0 && <p className="st-empty" role="status">{t('start.scan.noMatch')}</p>}
              <ul className="st-groups">
                {groups.map((g) => (
                  <li key={g.group} className="st-group">
                    {g.items.length > 1 && <p className="st-group-head">{t('start.scan.group', { name: g.items[0].name, count: g.items.length })}</p>}
                    <ul>
                      {g.items.map((c) => {
                        const state = s.at === 'importing' || s.at === 'imported' ? s.done[c.path] : undefined
                        const imported = c.importedBy.length > 0
                        const part = isPart(c)
                        return (
                          <li key={c.path} className={imported ? 'st-candidate imported' : 'st-candidate'}>
                            <label>
                              <input
                                type="checkbox"
                                disabled={busy || imported}
                                checked={imported || picked.has(c.path)}
                                onChange={(e) => {
                                  const next = new Set(picked)
                                  if (e.target.checked) next.add(c.path)
                                  else next.delete(c.path)
                                  setPicked(next)
                                }}
                              />
                              <span className="st-candidate-main">
                                <b>{c.name}</b>
                                {c.summary && <span className="st-candidate-summary">{c.summary}</span>}
                                <small>
                                  {c.kind === 'worktree' ? `${t('start.kind.worktree')} · ` : part ? `${t('start.scan.nested')} · ` : ''}
                                  {c.lastCommit ? `${shortDate(c.lastCommit.at, locale)} · ${c.lastCommit.subject}` : t('start.scan.noCommits')}
                                </small>
                                <code title={c.path}>{shownPath(c.path, scan.root)}</code>
                                {part && !imported && picked.has(c.path) && <small className="st-warn">{t('start.scan.partWarning')}</small>}
                                {state && state !== 'ok' && <small className="st-warn" role="status">{t('start.scan.rowFailed', { reason: state })}</small>}
                              </span>
                            </label>
                            <span className="st-candidate-end">
                              {c.stack.slice(0, 2).map((x) => <span key={x} className="lp-pill">{x}</span>)}
                              {imported && (
                                <button type="button" className="lp-button" onClick={() => onOpenProject(c.importedBy[0].id)}>
                                  {t('start.scan.inProject', { name: c.importedBy[0].name })}
                                </button>
                              )}
                              {state === 'ok' && !imported && <span className="lp-pill">{t('start.scan.added')}</span>}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
              <div className="lp-panel-foot st-foot">
                <span>{t('start.scan.later')}{hiddenTicked > 0 && <> {t('start.scan.hiddenTicked', { count: hiddenTicked })}</>}</span>
                <button type="button" className="lp-button primary" disabled={busy || picked.size === 0} onClick={() => void importPicked(scan)}>
                  {busy
                    ? t('start.scan.importing', { done: Object.keys((s as { done: object }).done).length, count: (s as { queue: string[] }).queue.length })
                    : picked.size === 0 ? t('start.scan.tickToAdd') : t('start.scan.import', { count: picked.size })}
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}

// ── Create a new project (SCN-129) ──────────────────────────────────────────
// Lives in the draft-backed form (`Onboarding.tsx`), so a half-described project survives a restart
// (AD02); App routes the 'new' path there. Its new-folder step is `NewFolder` in that form.

// ── Create an agent (SCN-136) and Adapt an existing agent (SCN-131) ─────────
// Built in `AgentPaths.tsx` (0.3.3). The role agent of a project (SCN-130) is made from the project's Team.

// #endregion start-screens
