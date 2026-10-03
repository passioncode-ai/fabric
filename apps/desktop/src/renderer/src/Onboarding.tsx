// A new tab IS the onboarding form. Nothing here touches the journal until the
// operator saves: a draft project lives only in this component, so the register
// never fills with half-projects nobody created.

import { useEffect, useState } from 'react'
import type { Draft } from './App'
import type {
  CreateProjectInput,
  LaunchOption,
  MemoryBackend,
  MemoryBackendOption,
  ProjectRow
} from '../../shared/types'
import { Button, EmptyState, Field, FieldGroup, Row, StateChip, Toolbar } from './components'
import { memoryChoice } from '../../shared/memoryChoice.ts'
import { useT } from './i18n'
import { folderNameProblem, type FolderNameProblem } from '../../shared/startPaths.ts'
import { runnerLabel } from './runnerLabel'
import { errorText, explainError } from './start/StartPaths'

export function Onboarding({
  draft,
  onDraftChange,
  onCreated,
  onCancel,
  onError
}: {
  draft: Draft
  onDraftChange: (next: Draft) => void
  onCreated: (p: ProjectRow) => void
  onCancel: () => void
  onError: (e: string) => void
}): React.JSX.Element {
  const t = useT()
  // The draft is owned by the shell: this form is a view over it, so switching
  // tabs and coming back finds every field as it was left.
  const { name, purpose, repoPaths, memory, agent } = draft
  const patch = (part: Partial<Draft>): void => onDraftChange({ ...draft, ...part })
  const [agents, setAgents] = useState<LaunchOption[]>([])
  /** NULL until read (M108): an empty array would render "no memory backend"
   *  while the answer is still in flight. */
  const [backends, setBackends] = useState<MemoryBackendOption[] | null>(null)
  const choice = memoryChoice(backends)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    window.fabric.terminal.options().then(setAgents).catch((e) => onError(String(e)))
    window.fabric.terminal.memoryBackends().then(setBackends).catch((e) => onError(String(e)))
  }, [])

  const choose = async (): Promise<void> => {
    try {
      const picked = await window.fabric.repos.choose()
      if (picked.length) patch({ repoPaths: [...new Set([...repoPaths, ...picked])] })
    } catch (e) {
      onError(String(e))
    }
  }

  // #region new-project-folder — docs: docs/ux/scenarios.md#scn-129-create-a-new-project-in-a-new-folder-or-as-an-idea
  // SCN-129: a new project in a NEW folder — under a parent the operator chooses, named after the
  // project, optionally a git repository. The folder joins the draft's repositories like a chosen one.
  const [git, setGit] = useState(true)
  const [folderProblem, setFolderProblem] = useState<string | null>(null)
  const [folderBusy, setFolderBusy] = useState(false)
  // Folders this form made on disk: they stay there if the operator removes them or leaves, and the form says so.
  const [made, setMade] = useState<string[]>([])
  const [leftOnDisk, setLeftOnDisk] = useState<string | null>(null)
  const newFolder = async (): Promise<void> => {
    if (folderBusy) return
    setFolderBusy(true)
    try { await makeFolder() } finally { setFolderBusy(false) }
  }
  const makeFolder = async (): Promise<void> => {
    setFolderProblem(null)
    const bad = folderNameProblem(name)
    if (bad) { setFolderProblem(t('onboarding.newFolder.badName', { problem: t(`onboarding.newFolder.problem.${bad}`) })); return }
    try {
      const parent = await window.fabric.start.chooseFolder('parent')
      if (!parent) return
      const made = await window.fabric.start.createFolder({ parent, name: name.trim(), git })
      if (!made.ok) {
        // An invalid name comes back as the same code the form checks with; it is said in this window's language.
        const detail = made.reason === 'invalid-name' && made.detail ? t(`onboarding.newFolder.problem.${made.detail as FolderNameProblem}`) : made.detail ?? ''
        setFolderProblem(t(`start.new.refused.${made.reason}` as 'start.new.refused.exists', { detail }))
        return
      }
      setMade((old) => [...old, made.path])
      setLeftOnDisk(null)
      patch({ repoPaths: [...new Set([...repoPaths, made.path])] })
    } catch (e) {
      setFolderProblem(t('start.new.refused.failed', { detail: errorText(e) }))
    }
  }
  // #endregion new-project-folder

  const save = async (): Promise<void> => {
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      const input: CreateProjectInput = {
        id: draft.projectId,
        name,
        purpose: purpose || undefined,
        repoPaths,
        memoryBackend: memory,
        defaultAgent: agent
      }
      onCreated(await window.fabric.projects.create(input))
    } catch (e) {
      onError(explainError(e, t))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="onboarding">
      <header>
        <h1>{t('onboarding.title')}</h1>
        <p className="muted">{t('onboarding.lede')}</p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Field label={t('onboarding.name')}>
          {(id) => (
            <input
              id={id}
              value={name}
              placeholder={t('onboarding.namePlaceholder')}
              onChange={(e) => patch({ name: e.target.value })}
              autoFocus
            />
          )}
        </Field>

        <Field label={t('onboarding.purpose')}>
          {(id) => (
            <input
              id={id}
              value={purpose}
              placeholder={t('onboarding.purposePlaceholder')}
              onChange={(e) => patch({ purpose: e.target.value })}
            />
          )}
        </Field>

        <FieldGroup role="group" label={t('onboarding.repos')} hint={t('onboarding.reposHint')}>
          <div className="repo-list">
            {/* The operator's own in-progress selection, not a load: read is true. */}
                {repoPaths.length === 0 && <EmptyState read>{t('onboarding.noRepos')}</EmptyState>}
            {repoPaths.map((p, i) => (
              <Row
                key={p}
                trail={
                  <Toolbar>
                    {i === 0 && <StateChip>{t('onboarding.primary')}</StateChip>}
                    {made.includes(p) && <StateChip>{t('onboarding.newFolder.made')}</StateChip>}
                    <Button
                      tone="ghost"
                      onClick={() => {
                        patch({ repoPaths: repoPaths.filter((x) => x !== p) })
                        if (made.includes(p)) setLeftOnDisk(p)
                      }}
                    >
                      {t('onboarding.removeRepo')}
                    </Button>
                  </Toolbar>
                }
              >
                <span className="mono">{p}</span>
              </Row>
            ))}
          </div>
          <div className="field-actions">
            <Button tone="ghost" onClick={() => void choose()}>
              {t('onboarding.addRepo')}
            </Button>
            <Button tone="ghost" disabled={!name.trim() || folderBusy} onClick={() => void newFolder()}>
              {folderBusy ? t('onboarding.newFolder.making') : t('onboarding.newFolder')}
            </Button>
            <label>
              <input type="checkbox" checked={git} onChange={(e) => setGit(e.target.checked)} /> {t('start.new.git')}
            </label>
          </div>
          {folderProblem && <p className="field-problem" role="alert">{folderProblem}</p>}
          {leftOnDisk && <p className="field-hint" role="status">{t('onboarding.newFolder.leftOnDisk', { path: leftOnDisk })}</p>}
        </FieldGroup>

        {/* M99 shipped this as "take it off the screen until it works", and the
            operator overturned it on 2026-09-05: an unavailable backend is shown
            with its reason, because the roadmap it states out loud is worth more
            than the cost of a radio nobody can press. What survives from the
            removal is the more useful half — a single DECLARED backend is a
            statement rather than a radiogroup of one, and both the name and the
            description are keyed by backend id, where the old form chose them
            with ternaries and would have called the first second available
            backend "Cloud". */}
        {choice.kind === 'unread' && null}
        {choice.kind === 'none' && (
          <FieldGroup role="group" label={t('onboarding.memory')}>
            <p className="muted">{t('onboarding.memoryNone')}</p>
          </FieldGroup>
        )}
        {choice.kind === 'statement' && (
          <FieldGroup role="group" label={t('onboarding.memory')}>
            <p className="muted">{t('onboarding.memoryOnly')}</p>
          </FieldGroup>
        )}
        {choice.kind === 'choice' && (
          <FieldGroup role="radiogroup" label={t('onboarding.memory')}>
            <div className="choice-row">
              {choice.shown.map((b) => (
                <label key={b.id} className={`choice ${b.available ? '' : 'disabled'}`}>
                  <input
                    type="radio"
                    name="memory"
                    checked={memory === b.id}
                    disabled={!b.available}
                    onChange={() => patch({ memory: b.id })}
                  />
                  <span>
                    <strong>{t(`onboarding.memoryName.${b.id}` as Parameters<typeof t>[0])}</strong>
                    <span className="muted">
                      {b.available
                        ? t(`onboarding.memoryHint.${b.id}` as Parameters<typeof t>[0])
                        : t(`onboarding.memoryUnavailable.${b.reason}` as Parameters<typeof t>[0])}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </FieldGroup>
        )}

        <Field label={t('onboarding.defaultAgent')} hint={t('onboarding.defaultAgentHint')}>
          {(id) => (
            <select id={id} value={agent} onChange={(e) => patch({ agent: e.target.value })}>
              {agents.filter((o) => o.program !== null).map((o) => (
                <option key={o.id} value={o.id} disabled={!o.available}>
                  {/* Each option by its own name (iteration 1: Codex was shown as "Terminal"); the shell has no program. */}
                  {runnerLabel(o.id, t)}
                  {o.available ? '' : ` — ${t('onboarding.unavailable')}`}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Toolbar>
          <Button type="submit" disabled={!name.trim() || busy}>
            {busy ? t('onboarding.saving') : t('onboarding.save')}
          </Button>
          <Button tone="ghost" onClick={onCancel}>
            {t('onboarding.cancel')}
          </Button>
        </Toolbar>
      </form>
    </div>
  )
}
