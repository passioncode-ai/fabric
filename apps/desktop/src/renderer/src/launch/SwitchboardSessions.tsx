// #region switchboard-sessions-panel — docs: docs/ux/scenarios.md#scn-166-see-every-agent-and-open-its-console-in-one-press
// CO-457: what Switchboard runs and holds on this Mac, the rows Fabric Dashboards shows (the same merge), read-only:
// Dashboards takes hand-overs and continues limit stops; Fabric shows where each session is and how long it waits.
// CO-585: a running session a Switchboard session host holds opens here, in a console of its project, as
// `switchboard attach <launch_id>`; Ctrl-] detaches and leaves it running.
import { useEffect, useState } from 'react'
import { useOpenConsole } from '../consoles'
import { GROUP_ORDER, type SessionRow } from '../../../shared/vendor/dashboardsSessions'
import type { SwitchboardSessions } from '../../../shared/switchboardSessions'
import { useLocale, useT } from '../i18n'

/** How often the panel asks again while it shows: Switchboard's state is not in the journal, so no mark moves it. */
export const SWITCHBOARD_POLL_MS = 30_000

export function SwitchboardSessionsPanel(): React.JSX.Element | null {
  const t = useT(), locale = useLocale()
  const [read, setRead] = useState<SwitchboardSessions | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  // CO-585: the row being opened, and why the last open failed, by row id.
  const [opening, setOpening] = useState<string | null>(null)
  const [attachFailed, setAttachFailed] = useState<Record<string, string>>({})
  const showConsole = useOpenConsole()
  useEffect(() => {
    let alive = true
    let busy = false
    const ask = (): void => {
      if (busy) return
      busy = true
      Promise.resolve().then(() => window.fabric.agents.switchboardSessions()).then(
        (r) => { if (alive) { setRead(r); setProblem(null) } },
        (e: unknown) => { if (alive) setProblem(e instanceof Error ? e.message : String(e)) }
      ).finally(() => { busy = false })
    }
    ask()
    const timer = setInterval(ask, SWITCHBOARD_POLL_MS)
    return () => { alive = false; clearInterval(timer) }
  }, [])
  // No Switchboard on this Mac: nothing to show, and that is not a failure.
  if (read && !read.installed) return null
  const time = (at: number): string => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(at))
  const stateOf = (r: SessionRow): string => {
    if (r.group === 'running') return t(r.actions?.includes('attach') ? 'agentsPlace.switchboard.runningHosted' : 'agentsPlace.switchboard.running')
    if (r.group === 'waiting') return r.expectedAt ? t('agentsPlace.switchboard.waitingUntil', { time: time(r.expectedAt) }) : t('agentsPlace.switchboard.waiting')
    if (r.group === 'needs-you') return t('agentsPlace.switchboard.needsYou')
    return r.endedAt ? t('agentsPlace.switchboard.endedAt', { time: time(r.endedAt) }) : t('agentsPlace.switchboard.ended')
  }
  const attach = async (r: SessionRow): Promise<void> => {
    const launchId = r.launch?.launchId
    if (!launchId || opening) return
    setOpening(r.id)
    setAttachFailed((was) => { const next = { ...was }; delete next[r.id]; return next })
    try {
      const plan = await window.fabric.agents.switchboardAttach(launchId)
      if (!plan.ok) {
        setAttachFailed((was) => ({ ...was, [r.id]: t(`agentsPlace.switchboard.attach.${plan.reason}`) }))
        return
      }
      const session = await window.fabric.terminal.open(plan.projectId, 'shell', plan.command)
      await showConsole(session.sessionId)
    } catch (e) {
      setAttachFailed((was) => ({ ...was, [r.id]: t('agentsPlace.switchboard.attach.failed', { reason: e instanceof Error ? e.message : String(e) }) }))
    } finally {
      setOpening(null)
    }
  }
  const rows = read ? [...read.rows].sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || b.at - a.at) : []
  return (
    <section className="lp-panel" aria-labelledby="ag-switchboard-title">
      <h3 id="ag-switchboard-title">{t('agentsPlace.switchboard.title')}</h3>
      <p className="lp-meta">{t('agentsPlace.switchboard.lede')}</p>
      {problem && <p className="lp-meta" role="status" title={problem}>{t('agentsPlace.switchboard.failed')}</p>}
      {!read && !problem && <p className="lp-meta" role="status">{t('agentsPlace.switchboard.reading')}</p>}
      {read && read.unread.length > 0 && (
        <p className="lp-meta" role="status" title={read.unread.map((u) => `${u.source}: ${u.reason}`).join('; ')}>
          {t('agentsPlace.switchboard.partial', { sources: read.unread.map((u) => u.source).join(', ') })}
        </p>
      )}
      {read && rows.length === 0 && read.unread.length === 0 && <p className="lp-meta">{t('agentsPlace.switchboard.empty')}</p>}
      {rows.length > 0 && (
        <ul>
          {rows.map((r) => (
            <li key={r.id} data-group={r.group}>
              <b title={r.folder}>{r.project}</b> · <span>{r.agent}</span>{r.account && <> · <span className="lp-meta">{r.account}</span></>}
              <br /><span className="lp-meta">{stateOf(r)}</span>
              {r.actions?.includes('attach') && r.launch?.launchId && (
                <> <button type="button" className="lp-button" disabled={opening !== null} title={t('agentsPlace.switchboard.attach.hint')}
                  onClick={() => void attach(r)}>{t('agentsPlace.switchboard.attach')}</button></>
              )}
              {attachFailed[r.id] && <p className="lp-meta" role="alert">{attachFailed[r.id]}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
// #endregion switchboard-sessions-panel
