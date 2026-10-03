// #region created-agents — docs: docs/ux/scenarios.md#scn-130-start-a-new-agent-inside-a-project
// Agents created inside a project (M125), reached from the project's team and from the start path
// "New agent" (SCN-130, SCR-74). Every state is its own sentence: the list is READ before it is
// called empty (M108), an unreadable list says so in place, an invalid form names what is missing
// rather than greying a button out silently, a save holds the controls still, a refusal keeps what
// was typed, and a success is confirmed. The limits come from `shared/agentSpec.ts`, the same
// definition the main process enforces (R-005), so the form cannot accept what the handler refuses.
import { useEffect, useRef, useState } from 'react'
import { Banner, Button, EmptyState, Field, FieldGroup, Row, StateChip, Toolbar } from './components'
import { useT } from './i18n'
import { runnerLabel } from './runnerLabel'
import { errorText } from './start/StartPaths'
import { INSTRUCTIONS_MIN, NAME_MAX } from '../../shared/agentSpec.ts'
import type { CreatedAgent, LaunchOption } from '../../shared/types'

type Read = { state: 'reading' } | { state: 'ready'; agents: CreatedAgent[] } | { state: 'failed'; reason: string }

/** The existing agent a name collides with (trimmed, case-insensitive) — the same rule as `nameTaken`. */
function holderOf(name: string, agents: readonly CreatedAgent[]): CreatedAgent | undefined {
  const n = name.trim().toLowerCase()
  return n ? agents.find((a) => a.name.trim().toLowerCase() === n) : undefined
}

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
  const [nameTouched, setNameTouched] = useState(false)
  const [brief, setBrief] = useState('')
  const [runner, setRunner] = useState(project.default_agent)
  const [wants, setWants] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [created, setCreated] = useState<string | null>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const notice = useRef<HTMLParagraphElement>(null)
  // Set in the effect body, not only cleared in its cleanup: StrictMode mounts, cleans up and mounts
  // again, and a ref that is only ever cleared left the list "reading" for good (iteration 2).
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const reread = (): (() => void) => {
    let current = true
    setRead({ state: 'reading' })
    window.fabric.agents
      .list(project.id)
      .then((agents) => { if (current && mounted.current) setRead({ state: 'ready', agents }) })
      .catch((e) => { if (current && mounted.current) setRead({ state: 'failed', reason: errorText(e) }) })
    return () => { current = false }
  }
  useEffect(reread, [project.id])

  // Only coding agents: the login shell is "no agent" and nothing would run a created agent in it.
  const coding = (options ?? []).filter((o) => o.program !== null)
  const available = coding.filter((o) => o.available)
  // The chosen program must be one that can run here; the project default if it can, else the first.
  useEffect(() => {
    if (options === null) return
    if (!available.some((o) => o.id === runner)) setRunner(available[0]?.id ?? '')
  }, [options])
  useEffect(() => { if (open) nameInput.current?.focus() }, [open])
  useEffect(() => { if (created !== null) notice.current?.focus() }, [created])

  const agents = read.state === 'ready' ? read.agents : []
  const trimmed = name.trim()
  const holder = holderOf(trimmed, agents)
  const nameProblem =
    trimmed.length > NAME_MAX ? t('agents.nameTooLong', { max: NAME_MAX })
      : holder ? t('agents.nameTaken', { name: holder.name })
        : nameTouched && trimmed === '' ? t('agents.nameEmpty')
          : null
  const briefLength = brief.trim().length
  const briefShort = briefLength < INSTRUCTIONS_MIN
  const noRunner = options !== null && available.length === 0
  const ready = trimmed !== '' && nameProblem === null && !briefShort && runner !== '' && options !== null && !noRunner && read.state === 'ready'
  const missing = [
    trimmed === '' ? t('agents.missing.name') : null,
    briefShort ? t('agents.missing.brief') : null,
    runner === '' || options === null || noRunner ? t('agents.missing.runner') : null
  ].filter((x): x is string => x !== null)

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
      if (!mounted.current) return
      setName('')
      setNameTouched(false)
      setBrief('')
      setWants([])
      setOpen(false)
      setCreated(made.name)
      reread()
    } catch (e) {
      if (mounted.current) setFailure(errorText(e))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  const grants = project.mcp_servers ?? []

  return (
    <>
      {read.state === 'failed' ? (
        <Banner actions={<Button tone="quiet" onClick={() => { reread() }}>{t('agents.retry')}</Button>}>
          {t('agents.readFailed', { reason: read.reason })}
        </Banner>
      ) : (
        read.state !== 'ready' || read.agents.length === 0 ? (
          !open && <EmptyState read={read.state === 'ready'} waiting={t('agents.madeReading')}>{t('agents.madeNone')}</EmptyState>
        ) : (
          read.agents.map((a) => (
            <Row
              key={a.id}
              lead={<StateChip tone="quiet">{runnerLabel(a.runner_id, t)}</StateChip>}
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
      {created !== null && !open && <p className="muted" role="status" tabIndex={-1} ref={notice}>{t('agents.createdNotice', { name: created })}</p>}
      {!open ? (
        <Toolbar>
          <Button onClick={() => { setOpen(true); setCreated(null); setFailure(null) }} disabled={read.state !== 'ready'}>
            {t('agents.newTitle')}
          </Button>
        </Toolbar>
      ) : (
        <form aria-busy={busy} onSubmit={(e) => { e.preventDefault(); void create() }}>
          <p className="muted">{t('agents.newLede')}</p>
          <Field label={t('agents.newName')} problem={nameProblem}>
            {(id, describedBy) => (
              <input id={id} ref={nameInput} value={name} disabled={busy} aria-invalid={nameProblem !== null} aria-describedby={describedBy}
                onChange={(e) => { setName(e.target.value); setNameTouched(true) }} />
            )}
          </Field>
          <Field
            label={t('agents.newInstructions')}
            hint={briefLength === 0 ? t('agents.instructionsMin', { min: INSTRUCTIONS_MIN }) : undefined}
            problem={briefLength > 0 && briefShort ? t('agents.instructionsShort', { min: INSTRUCTIONS_MIN, count: briefLength }) : null}
          >
            {(id, describedBy) => (
              <textarea id={id} rows={4} value={brief} disabled={busy} aria-invalid={briefLength > 0 && briefShort} aria-describedby={describedBy}
                onChange={(e) => setBrief(e.target.value)} />
            )}
          </Field>
          <Field label={t('agents.runner')} problem={noRunner ? t('agents.noRunner') : null}>
            {(id, describedBy) => (
              <select id={id} value={runner} disabled={busy || noRunner || options === null} aria-describedby={describedBy} onChange={(e) => setRunner(e.target.value)}>
                {options === null && <option value={runner}>{t('agents.runnersReading')}</option>}
                {coding.map((o) => (
                  <option key={o.id} value={o.id} disabled={!o.available}>
                    {o.available ? runnerLabel(o.id, t) : `${runnerLabel(o.id, t)} (${t('onboarding.unavailable')})`}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {grants.length === 0 ? (
            <Field label={t('agents.newServers')}>
              {(id) => <span id={id} className="muted">{t('agents.newServersNone')}</span>}
            </Field>
          ) : (
            <FieldGroup label={t('agents.newServers')} role="group">
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
            </FieldGroup>
          )}
          {failure !== null && <Banner>{t('agents.createFailed', { reason: failure })}</Banner>}
          {!ready && !busy && missing.length > 0 && <p className="muted">{t('agents.missing', { items: missing.join(', ') })}</p>}
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
