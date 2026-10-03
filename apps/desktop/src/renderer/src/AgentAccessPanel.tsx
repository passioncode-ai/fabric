// Agent access (SCR-76 · SCN-132, SCN-133 · ADR-0115), opened from Settings: what registered agents on
// this Mac may do through Fabric, what is waiting for an answer, and which products are connected.
// Main owns every decision and every secret; this panel shows the overview it is given and asks for
// one act at a time, then reads the overview again — it never edits the list it shows by itself.

import { useCallback, useEffect, useState } from 'react'
import type { HubActResult, HubOverview } from '../../shared/access'
import { Banner, Button, EmptyState, Panel, Row, Toolbar } from './components'
import { useT } from './i18n'

type Act = () => Promise<HubActResult>
type View = { kind: 'loading' } | { kind: 'unreadable'; reason: string } | { kind: 'read'; overview: HubOverview }

/** How often the open panel re-reads: a request waits ten minutes, a connect answer arrives in seconds. */
const REFRESH_MS = 4000

export function AgentAccessPanel({ onClose }: { onClose: () => void }): React.JSX.Element {
  const t = useT()
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [busy, setBusy] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<string | null>(null)

  const read = useCallback(async (): Promise<void> => {
    try {
      setView({ kind: 'read', overview: await window.fabric.hub.overview() })
    } catch (e) {
      // Not silence: an unreadable list says so, and never reads as "no agent has access".
      setView({ kind: 'unreadable', reason: String(e) })
    }
  }, [])
  useEffect(() => {
    void read()
    const timer = setInterval(() => void read(), REFRESH_MS)
    return () => clearInterval(timer)
  }, [read])

  const act = async (key: string, run: Act): Promise<void> => {
    setBusy(key)
    setOutcome(null)
    try {
      const r = await run()
      if (!r.ok) setOutcome(r.reason)
    } catch (e) {
      setOutcome(String(e))
    } finally {
      setBusy(null)
      await read()
    }
  }

  return (
    <aside className="ceo-panel" aria-label={t('access.title')}>
      <Panel title={t('access.title')} actions={<Toolbar align="end"><Button tone="ghost" onClick={onClose}>{t('access.close')}</Button></Toolbar>}>
        <p className="muted">{t('access.what')}</p>
        {outcome && <Banner tone="warn">{t('access.notDone', { reason: outcome })}</Banner>}
        {view.kind === 'loading' && <p className="muted" role="status">{t('access.loading')}</p>}
        {view.kind === 'unreadable' && (
          <Banner tone="warn" actions={<Button tone="ghost" onClick={() => void read()}>{t('access.retry')}</Button>}>
            {t('access.unreadable', { reason: view.reason })}
          </Banner>
        )}
        {view.kind === 'read' && (
          <>
            {view.overview.hub.listening
              ? <p className="muted">{t('access.hub.on', { origin: view.overview.hub.origin })}</p>
              : <Banner tone="warn">{t('access.hub.off', { reason: view.overview.hub.reason })}</Banner>}

            <h3 className="task-history-head">{t('access.products.title')}</h3>
            {view.overview.products.map((p) => (
              <Row
                key={p.product}
                trail={p.connection
                  ? <Button tone="ghost" disabled={busy !== null} onClick={() => void act(`disconnect:${p.product}`, () => window.fabric.hub.disconnect(p.product))}>{t('access.products.disconnect')}</Button>
                  : <Button disabled={busy !== null || !view.overview.hub.listening} onClick={() => void act(`connect:${p.product}`, () => window.fabric.hub.connect(p.product))}>{t('access.products.connect')}</Button>}
              >
                <strong>{p.name}</strong>{' '}
                {p.connection
                  ? <span className="muted">{t('access.products.connected', { server: p.connection.server, since: p.connection.connectedAt.slice(0, 10) })}</span>
                  : <span className="muted">{t('access.products.notConnected')}</span>}
                {p.lastAttempt?.outcome === 'waiting' && !p.connection && <span className="muted" role="status"> {t('access.products.waiting', { name: p.name })}</span>}
                {p.lastAttempt?.outcome === 'denied' && <span className="muted"> {t('access.products.denied', { name: p.name })}</span>}
                {p.lastAttempt?.outcome === 'failed' && <span role="alert"> {t('access.products.failed', { reason: p.lastAttempt.reason ?? '' })}</span>}
              </Row>
            ))}

            <h3 className="task-history-head">{t('access.pending.title')}</h3>
            {view.overview.pending.length === 0
              ? <EmptyState read>{t('access.pending.none')}</EmptyState>
              : view.overview.pending.map((r) => (
                <div key={r.requestId} className="widget-list">
                  <p><strong>{r.name}</strong> <span className="mono">{r.agentId}</span></p>
                  <ul>{r.lines.map((l) => <li key={l}>{l}</li>)}</ul>
                  <p className="muted">{t('access.pending.reason', { reason: r.reason })}</p>
                  <Toolbar>
                    <Button tone="ghost" disabled={busy !== null} onClick={() => void act(`deny:${r.requestId}`, () => window.fabric.hub.decide(r.requestId, 'denied'))}>{t('access.deny')}</Button>
                    <Button disabled={busy !== null} onClick={() => void act(`allow:${r.requestId}`, () => window.fabric.hub.decide(r.requestId, 'allowed'))}>{t('access.allow')}</Button>
                  </Toolbar>
                </div>
              ))}

            <h3 className="task-history-head">{t('access.agents.title')}</h3>
            {view.overview.agents.length === 0
              ? <EmptyState read>{t('access.agents.none')}</EmptyState>
              : view.overview.agents.map((a) => (
                <div key={a.bindingId} className="widget-list">
                  <p>
                    <strong>{a.name}</strong> <span className="mono">{a.agentId}</span>{' '}
                    <Button tone="danger" disabled={busy !== null} onClick={() => void act(`agent:${a.bindingId}`, () => window.fabric.hub.revokeAgent(a.bindingId))}>{t('access.agents.revokeAll')}</Button>
                  </p>
                  {a.grants.length === 0
                    ? <p className="muted">{t('access.agents.noGrants')}</p>
                    : a.grants.map((g) => (
                      <Row key={g.grantId} trail={<Button tone="ghost" disabled={busy !== null} onClick={() => void act(`grant:${g.grantId}`, () => window.fabric.hub.revokeGrant(g.grantId))}>{t('access.revoke')}</Button>}>
                        {g.line} <span className="muted">{t('access.agents.until', { date: g.expiresAt.slice(0, 10) })}</span>
                      </Row>
                    ))}
                </div>
              ))}

            {view.overview.denials.length > 0 && (
              <>
                <h3 className="task-history-head">{t('access.denials.title')}</h3>
                {view.overview.denials.map((d) => (
                  <Row key={d.requestId} trail={<Button tone="ghost" disabled={busy !== null} onClick={() => void act(`clear:${d.requestId}`, () => window.fabric.hub.clearDenial(d.requestId))}>{t('access.denials.clear')}</Button>}>
                    <strong>{d.name}</strong> {d.lines.join('; ')}
                  </Row>
                ))}
              </>
            )}
          </>
        )}
      </Panel>
    </aside>
  )
}
