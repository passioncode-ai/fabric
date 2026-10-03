// #region created-agents — docs: docs/ux/scenarios.md#scn-130-start-a-new-agent-inside-a-project
// Agents created inside a project (M125), reached from the project's team and from the start path
// "New agent" (SCN-130, SCR-74). Every state is its own sentence: the list is READ before it is
// called empty (M108), an unreadable list says so in place, an invalid form names what is missing
// rather than greying a button out silently, a save holds the controls still, a refusal keeps what
// was typed, and a success is confirmed. The limits come from `shared/agentSpec.ts`, the same
// definition the main process enforces (R-005), so the form cannot accept what the handler refuses.
import { useEffect, useRef, useState } from 'react'
import { Banner, Button, EmptyState, Field, Row, StateChip, Toolbar } from './components'
import { useT } from './i18n'
import { errorText } from './start/StartPaths'
import { INSTRUCTIONS_MIN, NAME_MAX, nameTaken } from '../../shared/agentSpec.ts'
import type { CreatedAgent, LaunchOption } from '../../shared/types'

type Read = { state: 'reading' } | { state: 'ready'; agents: CreatedAgent[] } | { state: 'failed'; reason: string }

export function CreatedAgents({
  project,
  options
}: {
  project: { id: string; default_agent: string; mcp_servers: string[] | null }
  /** The launch options the team panel already read; null while they are unknown. */
  options: LaunchOption[] | null
}): React.JSX.Element {
  const t = useT()
  const [read, setRead] = useState<Read>({ state: 'reading' })
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [brief, setBrief] = useState('')
  const [runner, setRunner] = useState(project.default_agent)
  const [wants, setWants] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [created, setCreated] = useState<string | null>(null)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const load = (): void => {
    setRead({ state: 'reading' })
    window.fabric.agents
      .list(project.id)
      .then((agents) => { if (alive.current) setRead({ state: 'ready', agents }) })
      .catch((e) => { if (alive.current) setRead({ state: 'failed', reason: errorText(e) }) })
  }
  useEffect(load, [project.id])

  const available = (options ?? []).filter((o) => o.available)
  // The chosen program must be one that can run here; the project default if it can, else the first.
  useEffect(() => {
    if (options === null) return
    if (!available.some((o) => o.id === runner)) setRunner(available[0]?.id ?? '')
  }, [options])

  const agents = read.state === 'ready' ? read.agents : []
  const trimmed = name.trim()
  const nameProblem =
    trimmed.length > NAME_MAX ? t('agents.nameTooLong', { max: NAME_MAX })
      : nameTaken(trimmed, agents) ? t('agents.nameTaken', { name: trimmed })
        : null
  const briefShort = brief.trim().length < INSTRUCTIONS_MIN
  const noRunner = options !== null && available.length === 0
  const ready = trimmed !== '' && nameProblem === null && !briefShort && runner !== '' && !noRunner && read.state === 'ready'

  const create = async (): Promise<void> => {
    if (!ready || busy) return
    setBusy(true)
    setFailure(null)
    try {
      const made = await window.fabric.agents.create({
        projectId: project.id,
        name: trimmed,
        instructions: brief.trim(),
        runnerId: runner,
        servers: wants
      })
      if (!alive.current) return
      setName('')
      setBrief('')
      setWants([])
      setOpen(false)
      setCreated(made.name)
      load()
    } catch (e) {
      if (alive.current) setFailure(errorText(e))
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const grants = project.mcp_servers ?? []
  const label = (o: LaunchOption): string =>
    o.id === 'claude-code' ? t('agents.claudeCode') : o.program === null ? t('agents.terminal') : o.label

  return (
    <>
      {read.state === 'failed' ? (
        <Banner actions={<Button tone="quiet" onClick={load}>{t('agents.retry')}</Button>}>
          {t('agents.readFailed', { reason: read.reason })}
        </Banner>
      ) : (
        read.state !== 'ready' || read.agents.length === 0 ? (
          !open && <EmptyState read={read.state === 'ready'} waiting={t('agents.madeReading')}>{t('agents.madeNone')}</EmptyState>
        ) : (
          read.agents.map((a) => (
            <Row
              key={a.id}
              lead={<StateChip tone="quiet">{a.runner_id}</StateChip>}
              trail={
                <span className="muted">
                  {a.mcp_servers.length > 0
                    ? t('agents.reaches', { servers: a.mcp_servers.join(', ') })
                    : t('agents.reachesNothing')}
                </span>
              }
            >
              {a.name}
            </Row>
          ))
        )
      )}
      {created !== null && !open && <p className="muted" role="status">{t('agents.createdNotice', { name: created })}</p>}
      {!open ? (
        <Toolbar>
          <Button tone="quiet" onClick={() => { setOpen(true); setCreated(null); setFailure(null) }} disabled={read.state !== 'ready'}>
            {t('agents.newTitle')}
          </Button>
        </Toolbar>
      ) : (
        <form aria-busy={busy} onSubmit={(e) => { e.preventDefault(); void create() }}>
          <p className="muted">{t('agents.newLede')}</p>
          <Field label={t('agents.newName')} hint={nameProblem ?? undefined}>
            {(id) => <input id={id} value={name} disabled={busy} aria-invalid={nameProblem !== null} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label={t('agents.newInstructions')} hint={briefShort ? t('agents.instructionsShort', { min: INSTRUCTIONS_MIN, count: brief.trim().length }) : undefined}>
            {(id) => <textarea id={id} rows={4} value={brief} disabled={busy} onChange={(e) => setBrief(e.target.value)} />}
          </Field>
          <Field label={t('agents.runner')} hint={noRunner ? t('agents.noRunner') : undefined}>
            {(id) => (
              <select id={id} value={runner} disabled={busy || noRunner || options === null} onChange={(e) => setRunner(e.target.value)}>
                {options === null && <option value={runner}>{runner}</option>}
                {(options ?? []).map((o) => (
                  <option key={o.id} value={o.id} disabled={!o.available}>
                    {o.available ? label(o) : `${label(o)} (${t('onboarding.unavailable')})`}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t('agents.newServers')}>
            {(id) =>
              grants.length === 0 ? (
                <span id={id} className="muted">{t('agents.newServersNone')}</span>
              ) : (
                <span id={id}>
                  {grants.map((sv) => (
                    <label key={sv}>
                      <input
                        type="checkbox"
                        disabled={busy}
                        checked={wants.includes(sv)}
                        onChange={(e) => setWants((prev) => (e.target.checked ? [...prev, sv] : prev.filter((x) => x !== sv)))}
                      />
                      <span className="mono">{sv}</span>
                    </label>
                  ))}
                </span>
              )
            }
          </Field>
          {failure !== null && <Banner>{t('agents.createFailed', { reason: failure })}</Banner>}
          <Toolbar align="end">
            <Button type="submit" disabled={busy || !ready}>
              {busy ? t('agents.creating') : t('agents.create')}
            </Button>
            <Button type="button" tone="ghost" disabled={busy} onClick={() => { setOpen(false); setFailure(null) }}>
              {t('project.cancel')}
            </Button>
          </Toolbar>
        </form>
      )}
    </>
  )
}
// #endregion created-agents
