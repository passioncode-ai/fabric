// #region continue-session-ask — docs: docs/ux/scenarios.md#scn-142-open-fabric-from-a-products-button-in-that-products-project-and-go-on-in-a-coding-agent
/**
 * The ask a `fabric://session/continue` link raises (DEC-0189 SL-5): the link opens a view, and only the person's press
 * stops the session where it runs and continues it in a Fabric console. The 0.3.26 review (iteration 2, PL-15, UX-20,
 * UX-22) asked that the person can judge what they consent to: the ask names the session by its folder, agent and
 * state and the app the link came from, never by its id; it is one warning, not two errors; Cancel cannot cancel an
 * act already sent; a stopped session that did not reach a console is said as half done, with a retry from history.
 */
import { useEffect, useState } from 'react'
import type { MachineSession } from '../../../main/machineSessions.ts'
import { useT } from '../i18n'
import { Banner } from '../components/Banner'
import { Button } from '../components/Button'
import { folderName } from '../../../shared/railAgents'
import { halfDone, machineWhy } from './MachineSessions'

/** The link's app, said only when it reads as a name (DEC-0189's `AGENT_ID` grammar); anything else is left out. */
const appName = (from: string | undefined): string | null => (from && /^[a-z][a-z0-9-]{0,62}$/.test(from) ? from : null)

export function ContinueSessionAsk({ session, from, onOpened, onDone }: {
  session: string
  from?: string
  /** The console the session continues in. */
  onOpened(consoleId: string): void
  /** The ask is over (continued or cancelled). */
  onDone(): void
}): React.JSX.Element {
  const t = useT()
  // undefined: still reading; null: no running session by this id (its history may still continue it).
  const [about, setAbout] = useState<MachineSession | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    Promise.resolve().then(() => window.fabric.agents.machineSessions())
      .then((rows) => { if (alive) setAbout(rows.find((s) => s.sessionId === session) ?? null) }, () => { if (alive) setAbout(null) })
    return () => { alive = false }
  }, [session])

  const go = (): void => {
    setBusy(true)
    setRefused(null)
    Promise.resolve().then(() => window.fabric.agents.machineContinue(session, from)).then((r) => {
      setBusy(false)
      if (r.ok) { if (r.sessionId) onOpened(r.sessionId); onDone(); return }
      setRefused(r.why)
    }, (e: unknown) => { setBusy(false); setRefused(e instanceof Error ? e.message : String(e)) })
  }

  const app = appName(from)
  const which = about === undefined ? t('links.continue.reading')
    : about === null ? t('links.continue.ended')
    : t('links.continue.which', {
      folder: folderName(about.cwd) ?? about.cwd,
      agent: about.agent ?? 'claude-code',
      state: t(`machineSessions.state.${about.state ?? 'unknown'}` as 'machineSessions.state.unknown')
    })
  const said = refused === null ? null : halfDone(refused) ? machineWhy(t, refused) : `${t('machineSessions.refused')} ${machineWhy(t, refused)}`
  return (
    <Banner tone="warn" actions={
      <>
        <Button tone="primary" disabled={busy || about === undefined} onClick={go}>
          {refused && halfDone(refused) ? t('machineSessions.resumeFromHistory') : t('machineSessions.continue')}
        </Button>
        {/* UX-20: once sent the act is not cancelled by this button, so it waits for the answer. */}
        <Button tone="ghost" disabled={busy} onClick={onDone}>{t('common.cancel')}</Button>
      </>
    }>
      <span data-testid="continue-ask">
        {t('links.continue.ask')} {which}
        {app && ` ${t('links.continue.from', { app })}`}
        {busy && ` ${t('machineSessions.busy')}`}
      </span>
      {said && <span role="status" title={refused ?? undefined} data-testid="continue-refused"> {said}</span>}
    </Banner>
  )
}
// #endregion continue-session-ask
