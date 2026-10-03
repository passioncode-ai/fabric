// #region start-screens — docs: docs/adr/0100-first-run-and-start-paths.md#decision
// The start paths (ADR-0100; SCN-127…SCN-131, SCR-70…SCR-75): where a project comes from and where
// an agent comes from. One screen per path, every state of each path drawn — idle, working,
// refused, failed, done — and nothing created without the operator's explicit act. The first run
// (`FirstRun.tsx`) ends on the same menu, so the two never disagree about what the paths are.

import { humaniseError } from '../../../shared/errorText'
import { useEffect, useMemo, useRef, useState } from 'react'
import { groupCandidates, type CandidateView, type FolderView, type ScanView } from '../../../shared/startPaths.ts'
import type { ProjectRow } from '../../../shared/types'
import { useLocale, useT, type Translate } from '../i18n'

export type StartPath = 'menu' | 'add' | 'scan' | 'new' | 'agent' | 'convert'

export interface StartProps {
  path: StartPath
  projects: ProjectRow[] | null
  onPath(path: StartPath): void
  /** A project now exists: open it. */
  onCreated(projectId: string): void
  onOpenProject(projectId: string, section?: 'team'): void
  onHome(): void
  /** Projects were created without leaving the screen (a scan import): re-read the list so the sidebar shows them. */
  onProjectsChanged(): void
}

/**
 * An error as the operator reads it: the transport's wrapping removed by the app's one rule
 * (`shared/errorText.ts`, M106c), so the sentence that remains is the main process's own.
 */
export const errorText = (e: unknown): string => humaniseError(e).detail

/**
 * An error, with the refusals main sends as codes said in this window's language: a repository path the
 * window did not choose (`repo-path-refused:<code>: <path>`, startChoices.ts) reads as a sentence.
 */
export function explainError(e: unknown, t: Translate): string {
  const text = errorText(e)
  const repo = /(?:^|: )repo-path-refused:(not-a-path|missing|not-a-folder|not-chosen|too-broad|held-by-other): ([\s\S]*)$/.exec(text)
  if (repo) return t(`start.repoRefused.${repo[1]}` as 'start.repoRefused.not-chosen', { path: repo[2] })
  const folder = /(?:^|: )folder-refused:(missing|not-a-folder|unreadable|timeout|outside): ([\s\S]*)$/.exec(text)
  if (folder) return t(`start.folderRefused.${folder[1]}` as 'start.folderRefused.missing', { path: folder[2] })
  const name = /(?:^|: )project-name-refused:(not-a-name|empty|text-direction|control)\b/.exec(text)
  if (name) return t(`start.projectNameRefused.${name[1]}` as 'start.projectNameRefused.empty')
  const agent = /(?:^|: )agent-name-refused:taken: ([\s\S]*)$/.exec(text)
  if (agent) return t('agents.nameTaken', { name: agent[1] })
  return text
}

/** A candidate's path as the checklist shows it: relative to the scanned folder, which the summary already names. */
export function shownPath(path: string, root: string): string {
  return path.startsWith(root + '/') ? path.slice(root.length + 1) : path
}
const newId = (): string => crypto.randomUUID()

/** A commit time as the operator reads it: a date in their locale, never a raw ISO string. */
export function shortDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

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
      return <NewAgent {...props} />
    case 'convert':
      return <ConvertAgent onBack={() => props.onPath('menu')} />
  }
}

function Heading({ kicker, title, lede, back }: { kicker: string; title: string; lede: string; back?: { label: string; onClick: () => void; disabled?: boolean } }): React.JSX.Element {
  // Each path mounts its own heading, and focus lands on it: a keyboard or screen-reader user hears
  // where they arrived instead of staying on a button that is gone (iteration 2: focus stayed on BODY).
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  return (
    <header className="lp-heading">
      <div>
        <p className="lp-kicker">{kicker}</p>
        <h2 tabIndex={-1} ref={ref}>{title}</h2>
        <p>{lede}</p>
      </div>
      {back && <div className="lp-actions"><button type="button" className="lp-button" disabled={back.disabled} onClick={back.onClick}>{back.label}</button></div>}
    </header>
  )
}

/** Copy a command; says Copied only when the clipboard took it. */
export function CopyButton({ text }: { text: string }): React.JSX.Element {
  const t = useT()
  // A copy that fails says so: the command stays selectable on screen (iteration 2: a refused clipboard was silent).
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  return (
    <button type="button" className="lp-button" onClick={() => { void navigator.clipboard.writeText(text).then(() => setState('copied'), () => setState('failed')) }}>
      {state === 'copied' ? t('first.exec.copied') : state === 'failed' ? t('first.exec.copyFailed') : t('first.exec.copy')}
    </button>
  )
}

// ── The menu ────────────────────────────────────────────────────────────────

const PATHS: { path: Exclude<StartPath, 'menu'>; planned?: boolean }[] = [
  { path: 'add' },
  { path: 'scan' },
  { path: 'new' },
  { path: 'agent' },
  { path: 'convert', planned: true }
]

export function StartCards({ onPath, lastScan }: { onPath(path: StartPath): void; lastScan?: ScanView | null }): React.JSX.Element {
  const t = useT()
  // Products not yet added — a worktree or nested repository is a part, not something the menu should keep asking about.
  const pending = lastScan ? lastScan.candidates.filter((c) => c.importedBy.length === 0 && c.path === c.group).length : 0
  return (
    <ul className="st-cards">
      {PATHS.map(({ path, planned }) => (
        <li key={path}>
        <button type="button" className={planned ? 'st-card planned' : 'st-card'} onClick={() => onPath(path)}>
          <span className="st-card-mark" aria-hidden="true">{t(`start.card.${path}.mark` as 'start.card.add.mark')}</span>
          <b>{t(`start.card.${path}.title` as 'start.card.add.title')}</b>
          <span>{t(`start.card.${path}.body` as 'start.card.add.body')}</span>
          <small>
            {planned ? <span className="lp-pill">{t('start.planned')}</span> : t(`start.card.${path}.meta` as 'start.card.add.meta')}
            {path === 'scan' && pending > 0 && <> · {t('start.card.scan.pending', { count: pending })}</>}
          </small>
        </button>
        </li>
      ))}
    </ul>
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

// ── Facts about a folder ────────────────────────────────────────────────────

function FolderFactsList({ f, t, locale }: { f: FolderView | CandidateView; t: Translate; locale: string }): React.JSX.Element {
  return (
    <dl className="st-facts">
      <dt>{t('start.facts.path')}</dt>
      <dd><code>{f.path}</code></dd>
      <dt>{t('start.facts.git')}</dt>
      <dd>{t(`start.kind.${f.kind}` as 'start.kind.repository')}{f.branch ? ` · ${f.branch}` : ''}</dd>
      {f.remote && <><dt>{t('start.facts.remote')}</dt><dd><code>{f.remote}</code></dd></>}
      {f.lastCommit && <><dt>{t('start.facts.lastCommit')}</dt><dd>{shortDate(f.lastCommit.at, locale)} · {f.lastCommit.subject}</dd></>}
      {f.stack.length > 0 && <><dt>{t('start.facts.stack')}</dt><dd>{f.stack.join(', ')}</dd></>}
    </dl>
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

  const choose = async (): Promise<void> => {
    try {
      const folder = await window.fabric.start.chooseFolder('project')
      if (!folder) return
      setS({ at: 'reading', folder })
      const facts = await window.fabric.start.inspect(folder)
      id.current = newId()
      setS({ at: 'ready', facts, name: facts.name })
    } catch (e) {
      setS({ at: 'failed', reason: explainError(e, t) })
    }
  }
  const create = async (facts: FolderView, name: string): Promise<void> => {
    setS({ at: 'creating', facts, name })
    try {
      const p = await window.fabric.projects.create({ id: id.current, name: name.trim(), repoPaths: [facts.path] })
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
          <section className="lp-panel st-step">
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
  | { at: 'imported'; scan: ScanView; done: Record<string, 'ok' | string>; created: string[] }
  | { at: 'failed'; reason: string }

/** A part of a product (a worktree, a repository nested in another) — not ticked by "Tick all shown". */
const isPart = (c: CandidateView): boolean => c.path !== c.group

function ScanFolder({ onPath, onCreated, onOpenProject, onProjectsChanged }: StartProps): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const [s, setS] = useState<ScanState>({ at: 'idle' })
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const ids = useRef<Record<string, string>>({})
  const scanning = useRef(false)
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
    const created: string[] = []
    setS({ at: 'importing', scan, done: { ...done }, queue })
    for (const p of queue) {
      const c = scan.candidates.find((x) => x.path === p)!
      ids.current[p] ??= newId() // a retry of the same row is the same create, never a sibling (UX-06)
      try {
        const project = await window.fabric.projects.create({ id: ids.current[p], name: c.name, repoPaths: [c.path] })
        done[p] = 'ok'
        created.push(project.id)
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
        <section className="lp-panel st-step st-scan">
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
              {s.created[0] && <button type="button" className="lp-button" onClick={() => onCreated(s.created[0])}>{t('start.scan.openFirst')}</button>}
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

// ── A new agent (SCN-130) ───────────────────────────────────────────────────

function NewAgent({ projects, onPath, onOpenProject }: StartProps): React.JSX.Element {
  const t = useT()
  return (
    <div className="lp st" data-launch-view="start-agent">
      <Heading kicker={t('start.kicker')} title={t('start.agent.title')} lede={t('start.agent.lede')} back={{ label: t('start.back'), onClick: () => onPath('menu') }} />
      <section className="lp-panel st-step">
        {projects === null ? (
          <p aria-busy="true">{t('start.agent.loading')}</p>
        ) : projects.filter((p) => p.status !== 'archived').length === 0 ? (
          <div className="lp-callout" role="status">
            <p>{t('start.agent.noProject')}</p>
            <div className="lp-actions">
              <button type="button" className="lp-button" onClick={() => onPath('add')}>{t('start.card.add.title')}</button>
              <button type="button" className="lp-button" onClick={() => onPath('new')}>{t('start.card.new.title')}</button>
            </div>
          </div>
        ) : (
          <>
            <p>{t('start.agent.pick')}</p>
            <ul className="st-pick">
              {projects.filter((p) => p.status !== 'archived').map((p) => (
                <li key={p.id}>
                  <button type="button" className="lp-button" onClick={() => onOpenProject(p.id, 'team')}>{p.name}</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}

// ── Convert an agent (SCN-131): designed, not yet built ─────────────────────

function ConvertAgent({ onBack }: { onBack(): void }): React.JSX.Element {
  const t = useT()
  const steps = [1, 2, 3, 4] as const
  return (
    <div className="lp st" data-launch-view="start-convert">
      <Heading kicker={t('start.kicker')} title={t('start.convert.title')} lede={t('start.convert.lede')} back={{ label: t('start.back'), onClick: onBack }} />
      <section className="lp-panel st-step">
        <span className="lp-pill">{t('start.planned')}</span>
        <ol className="st-steps">
          {steps.map((n) => (
            <li key={n}><b>{t(`start.convert.step${n}` as 'start.convert.step1')}</b><span>{t(`start.convert.step${n}.body` as 'start.convert.step1.body')}</span></li>
          ))}
        </ol>
        <div className="lp-callout">
          <p>{t('start.convert.today')}</p>
          <div className="st-install"><code>{t('start.convert.command')}</code><CopyButton text={t('start.convert.command')} /></div>
        </div>
      </section>
    </div>
  )
}
// #endregion start-screens
