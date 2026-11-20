// #region continue-session-ask — docs: docs/ux/scenarios.md#scn-142-open-fabric-from-a-products-button-in-that-products-project-and-go-on-in-a-coding-agent
/**
 * The ask a `fabric://session/continue` link raises (DEC-0189 SL-5): the link opens a view, and only the person's press
 * stops the session where it runs and continues it in a Fabric console. The 0.3.26 review asked that the person can
 * judge what they consent to: the ask names a running session by its folder, agent and state and an ended one as ended,
 * says the app as the link's own claim, never shows an id; it is one warning, not two errors; Cancel cannot cancel an act
 * already sent; a stopped session that did not reach a console is said as half done, always with a retry from history;
 * a running session only Switchboard names is read-only here.
 */
import { useEffect, useRef, useState } from 'react'
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

export function ContinueSessionAsk(props: {
  session: string
  from?: string
  /** Another continue link arrived while this ask's press was answered; it is shown after this one (UX-34). */
  waiting?: boolean
  /** A press is being answered (true) or was answered (false): App keeps this ask while it is (ER-18). */
  onBusy?(busy: boolean): void
  /** The console the session continues in. */
  onOpened(consoleId: string): void
  /** The ask is over (continued or cancelled). */
  onDone(): void
}): React.JSX.Element {
  const { session, from, waiting = false } = props
  // ER-26: an answer calls the callbacks of the newest render, never those of the render the press began in.
  const latest = useRef(props)
  latest.current = props
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
    latest.current.onBusy?.(true)
    // DA-20: the link itself is the origin, with or without `from`.
    Promise.resolve().then(() => window.fabric.agents.machineContinue(session, from ? { from } : {})).then((r) => {
      setBusy(false)
      latest.current.onBusy?.(false)
      if (r.ok) { if (r.sessionId) latest.current.onOpened(r.sessionId); latest.current.onDone(); return }
      setRefused(r.why)
      setReads((x) => x + 1)
    }, (e: unknown) => { setBusy(false); latest.current.onBusy?.(false); setRefused(e instanceof Error ? e.message : String(e)) })
  }

  const app = appName(from)
  // UX-30, UX-33: a session only Switchboard names whose process RUNS is not acted on from here (Fabric does not know that
  // process); one no process runs is an ended session, continued from its history like any other.
  const shown = typeof about === 'object' && about !== null ? about : null
  // UX-37: once a press stopped the session, the retry from its history is offered whatever a stale read says of it.
  const half = refused !== null && halfDone(refused)
  const elsewhere = !half && !!shown && shown.source === 'switchboard' && shown.live
  const ended = about === null || (!!shown && shown.source === 'switchboard' && !shown.live)
  const which = half ? '' : about === undefined ? t('links.continue.reading')
    : about === 'unread' ? t('links.continue.unread')
    : ended && shown ? t('links.continue.whichEnded', { folder: folderName(shown.cwd) ?? shown.cwd, agent: runnerLabel(shown.agent ?? 'claude-code', t) })
    : ended || !shown ? t('links.continue.ended')
    : t('links.continue.which', {
      folder: folderName(shown.cwd) ?? shown.cwd,
      agent: runnerLabel(shown.agent ?? 'claude-code', t),
      state: t(`machineSessions.state.${shown.state ?? 'unknown'}` as 'machineSessions.state.unknown')
    })
  // DO-22: a link's id found nowhere is said as not on this computer, not as a session that ended.
  // ER-27: a session Switchboard lists whose history is not in a Claude home Fabric reads is not «not on this computer».
  const why = (w: string): string => (w === 'gone' ? t(shown?.source === 'switchboard' ? 'links.continue.goneHome' : 'links.continue.gone') : machineWhy(t, w))
  const said = refused === null ? null : halfDone(refused) ? why(refused) : `${t('machineSessions.refused')} ${why(refused)}`
  return (
    <Banner tone="warn" actions={
      <>
        {/* UX-36: a session not acted on from here offers no press, only the way out. */}
        {!elsewhere && <Button tone="primary" disabled={busy || about === undefined} onClick={go}>
          {refused && halfDone(refused) ? t('machineSessions.resumeFromHistory') : t('machineSessions.continue')}
        </Button>}
        {/* UX-20: once sent the act is not cancelled by this button, so it waits for the answer. */}
        <Button tone="ghost" disabled={busy} onClick={() => latest.current.onDone()}>{elsewhere ? t('links.continue.close') : t('common.cancel')}</Button>
      </>
    }>
      <span data-testid="continue-ask">
        {elsewhere && shown ? t('links.continue.viaSwitchboard', { folder: folderName(shown.cwd) ?? shown.cwd }) : `${t('links.continue.ask')} ${which}`}
        {app && ` ${t('links.continue.from', { app })}`}
        {waiting && ` ${t('links.continue.queued')}`}
        {busy && ` ${t('machineSessions.busy')}`}
      </span>
      {said && <span role="status" title={refused ?? undefined} data-testid="continue-refused"> {said}</span>}
    </Banner>
  )
}
// #endregion continue-session-ask
