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
import { runnerLabel } from '../runnerLabel'
import { AGENT_ID } from '../../../shared/contract/fabricLinks.ts'

/** Our products' names for the ids their links carry; any other id in the contract's grammar is said as it is. */
const APP_NAMES: Readonly<Record<string, string>> = {
  'fabric-dashboards': 'Fabric Dashboards', 'fabric-switchboard': 'Switchboard', switchboard: 'Switchboard',
  'fabric-inbox': 'Fabric Inbox', observatory: 'Observatory', 'project-observatory': 'Observatory', fabric: 'Fabric'
}
/** The link's app (DEC-0189 SL-1, `name` or `name.instance`), said by its product's name when it is one of ours (UX-27,
 *  DA-19); a value outside the contract's grammar is left out. */
export function appName(from: string | undefined): string | null {
  if (!from || !AGENT_ID.test(from)) return null
  const name = from.split('.')[0]
  return APP_NAMES[name] ?? name
}

export function ContinueSessionAsk({ session, from, onOpened, onDone, onBusy }: {
  session: string
  from?: string
  /** A press is being answered (true) or was answered (false): App keeps this ask while it is (ER-18). */
  onBusy?(busy: boolean): void
  /** The console the session continues in. */
  onOpened(consoleId: string): void
  /** The ask is over (continued or cancelled). */
  onDone(): void
}): React.JSX.Element {
  const t = useT()
  // undefined: still reading; null: no running session by this id (its history may still continue it); 'unread': the
  // list could not be read, said as such, never as «not running» (ER-22, UX-29).
  const [about, setAbout] = useState<MachineSession | null | 'unread' | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)
  // UX-29: read again after every answer, so the line never says «идёт» beside «остановлена».
  const [reads, setReads] = useState(0)
  useEffect(() => {
    let alive = true
    Promise.resolve().then(() => window.fabric.agents.machineSessions())
      .then((rows) => { if (alive) setAbout(rows.find((s) => s.sessionId === session) ?? null) }, () => { if (alive) setAbout('unread') })
    return () => { alive = false }
  }, [session, reads])

  const go = (): void => {
    setBusy(true)
    setRefused(null)
    onBusy?.(true)
    // DA-20: the link itself is the origin, with or without `from`.
    Promise.resolve().then(() => window.fabric.agents.machineContinue(session, from ? { from } : {})).then((r) => {
      setBusy(false)
      onBusy?.(false)
      if (r.ok) { if (r.sessionId) onOpened(r.sessionId); onDone(); return }
      setRefused(r.why)
      setReads((x) => x + 1)
    }, (e: unknown) => { setBusy(false); onBusy?.(false); setRefused(e instanceof Error ? e.message : String(e)) })
  }

  const app = appName(from)
  // UX-30: a session only Switchboard names has no process Fabric knows; it is not acted on from here.
  const elsewhere = typeof about === 'object' && about !== null && about.source === 'switchboard'
  const which = about === undefined ? t('links.continue.reading')
    : about === 'unread' ? t('links.continue.unread')
    : about === null ? t('links.continue.ended')
    : t('links.continue.which', {
      folder: folderName(about.cwd) ?? about.cwd,
      agent: runnerLabel(about.agent ?? 'claude-code', t),
      state: t(`machineSessions.state.${about.state ?? 'unknown'}` as 'machineSessions.state.unknown')
    })
  // DO-22: a link's id found nowhere is said as not on this computer, not as a session that ended.
  const why = (w: string): string => (w === 'gone' ? t('links.continue.gone') : machineWhy(t, w))
  const said = refused === null ? null : halfDone(refused) ? why(refused) : `${t('machineSessions.refused')} ${why(refused)}`
  return (
    <Banner tone="warn" actions={
      <>
        <Button tone="primary" disabled={busy || about === undefined || elsewhere} onClick={go}>
          {refused && halfDone(refused) ? t('machineSessions.resumeFromHistory') : t('machineSessions.continue')}
        </Button>
        {/* UX-20: once sent the act is not cancelled by this button, so it waits for the answer. */}
        <Button tone="ghost" disabled={busy} onClick={onDone}>{t('common.cancel')}</Button>
      </>
    }>
      <span data-testid="continue-ask">
        {t('links.continue.ask')} {which}
        {app && ` ${t('links.continue.from', { app })}`}
        {elsewhere && ` ${t('links.continue.viaSwitchboard')}`}
        {busy && ` ${t('machineSessions.busy')}`}
      </span>
      {said && <span role="status" title={refused ?? undefined} data-testid="continue-refused"> {said}</span>}
    </Banner>
  )
}
// #endregion continue-session-ask
