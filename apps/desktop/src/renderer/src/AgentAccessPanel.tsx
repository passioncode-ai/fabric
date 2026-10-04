// Agent access (SCR-76 · SCN-132, SCN-133 · ADR-0115), opened from Settings: what registered agents on
// this Mac may do through Fabric, what is waiting for an answer, and which products are connected.
// Main owns every decision and every secret; this panel shows the overview it is given and asks for
// one act at a time, then reads the overview again — it never edits the list it shows by itself.
//
// EVERY WORD IS THE OPERATOR'S LANGUAGE (verification iteration 1 for 0.3.1, UX-2): the overview carries
// facts — ids, names, asked capabilities, resources, codes — and each is phrased here through
// `shared/accessWords.ts`, the same words the native prompt and the queue use.

import { useCallback, useEffect, useState } from 'react'
import type { HubActResult, HubOverview, PendingRequestFacts } from '../../shared/access'
import { sayActRefusal, sayAllow, sayAsk, sayConnectProblem, sayFloor, sayIncremental, sayOrigin, shownName, type Say } from '../../shared/accessWords'
import { humaniseError } from '../../shared/errorText'
import { Banner, Button, EmptyState, Panel, Row, Toolbar } from './components'
import { useLocale, useT } from './i18n'

type Act = () => Promise<HubActResult>
type View = { kind: 'loading' } | { kind: 'unreadable'; reason: string } | { kind: 'read'; overview: HubOverview }
/** What the last act left to say: a refusal, or a note that is not a failure (UX-5, UX-10). */
type Said = { tone: 'warn' | 'info'; text: string } | null

/** How often the open panel re-reads: a request waits ten minutes, a connect answer arrives in seconds. */
const REFRESH_MS = 4000

/** "expires in N min", from the request's own expiry (UX-9). */
function expiresIn(t: Say, expiresAt: string, now: number): string {
  const minutes = Math.ceil((Date.parse(expiresAt) - now) / 60_000)
  return minutes <= 1 ? t('access.pending.expiresSoon') : t('access.pending.expires', { minutes })
}

/** A refused act, said from its code; the machine's words only when there is no code. */
function sayRefused(t: Say, r: Extract<HubActResult, { ok: false }>, product: string): string {
  if (r.code) return sayActRefusal(t, r.code)
  if (r.problem) return sayConnectProblem(t, r.problem, product)
  return humaniseError(r.reason).detail
}

export function AgentAccessPanel({ onClose }: { onClose: () => void }): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [busy, setBusy] = useState<string | null>(null)
  const [said, setSaid] = useState<Said>(null)
  const date = (iso: string): string => new Date(iso).toLocaleDateString(locale)

  const read = useCallback(async (): Promise<void> => {
    try {
      setView({ kind: 'read', overview: await window.fabric.hub.overview() })
    } catch (e) {
      // Not silence: an unreadable list says so, and never reads as "no agent has access". The transport's
      // wrapper is removed — the operator reads what went wrong, not which IPC channel carried it (UX-7).
      setView({ kind: 'unreadable', reason: humaniseError(e).detail })
    }
  }, [])
  useEffect(() => {
    void read()
    const timer = setInterval(() => void read(), REFRESH_MS)
    return () => clearInterval(timer)
  }, [read])

  /** One act; `product` names what a connect problem is about; `after` is said when it is done. */
  const act = async (key: string, run: Act, opts: { product?: string; after?: (r: Extract<HubActResult, { ok: true }>) => Said } = {}): Promise<void> => {
    setBusy(key)
    setSaid(null)
    try {
      const r = await run()
      if (!r.ok) setSaid({ tone: 'warn', text: t('access.notDone', { reason: sayRefused(t, r, opts.product ?? '') }) })
      else setSaid(opts.after?.(r) ?? null)
    } catch (e) {
      setSaid({ tone: 'warn', text: t('access.notDone', { reason: humaniseError(e).detail }) })
    } finally {
      setBusy(null)
      await read()
    }
  }

  const listening = view.kind === 'read' && view.overview.hub.listening
  const keyStays = (name: string): Said => ({ tone: 'info', text: t('access.products.keyStays', { name }) })

  return (
    <aside className="ceo-panel" aria-label={t('access.title')}>
      <Panel title={t('access.title')} actions={<Toolbar align="end"><Button tone="ghost" onClick={onClose}>{t('access.close')}</Button></Toolbar>}>
        <p className="muted">{t('access.what')}</p>
        {said && (said.tone === 'warn' ? <Banner tone="warn">{said.text}</Banner> : <p className="muted" role="status">{said.text}</p>)}
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
              : (
                <Banner tone="warn">
                  <span>{t('access.hub.off')}</span>
                  <span className="muted access-detail">{t('access.hub.offDetail', { reason: view.overview.hub.reason })}</span>
                </Banner>
              )}

            <h3 className="task-history-head">{t('access.products.title')}</h3>
            {view.overview.products.map((p) => {
              const last = p.lastAttempt
              return (
                <div key={p.product} className="access-card" data-product={p.product}>
                  <p>
                    <strong>{p.name}</strong>{' '}
                    {p.connection
                      ? <span className="muted">{t('access.products.connectedTo')} <span className="access-url">{p.connection.server}</span> {t('access.products.since', { since: date(p.connection.connectedAt) })}</span>
                      : <span className="muted">{t('access.products.notConnected')}</span>}
                  </p>
                  {last?.outcome === 'waiting' && !p.connection && <p className="muted" role="status">{t('access.products.waiting', { name: p.name })}</p>}
                  {last?.outcome === 'denied' && <p className="muted">{t('access.products.denied', { name: p.name })}</p>}
                  {last?.outcome === 'failed' && last.problem && (
                    <p role="alert" className="access-problem">{t('access.products.failed', { reason: sayConnectProblem(t, last.problem, p.name) })}</p>
                  )}
                  <div className="access-acts"><Toolbar>
                    {p.connection
                      ? <>
                          <Button tone="ghost" disabled={busy !== null || !listening} onClick={() => void act(`reconnect:${p.product}`, () => window.fabric.hub.connect(p.product, { reconnect: true }), { product: p.name, after: () => keyStays(p.name) })}>{t('access.products.reconnect')}</Button>
                          <Button tone="ghost" disabled={busy !== null} onClick={() => void act(`disconnect:${p.product}`, () => window.fabric.hub.disconnect(p.product), { product: p.name, after: () => keyStays(p.name) })}>{t('access.products.disconnect')}</Button>
                        </>
                      : <Button disabled={busy !== null || !listening} onClick={() => void act(`connect:${p.product}`, () => window.fabric.hub.connect(p.product), { product: p.name })}>
                          {last?.outcome === 'failed' ? t('access.products.tryAgain') : t('access.products.connect')}
                        </Button>}
                  </Toolbar></div>
                </div>
              )
            })}

            <h3 className="task-history-head">{t('access.pending.title')}</h3>
            {view.overview.pending.length === 0
              ? <EmptyState read>{t('access.pending.none')}</EmptyState>
              : view.overview.pending.map((r) => <PendingCard key={r.requestId} r={r} t={t} busy={busy} act={act} />)}

            <h3 className="task-history-head">{t('access.agents.title')}</h3>
            {view.overview.agents.length === 0
              ? <EmptyState read>{t('access.agents.none')}</EmptyState>
              : view.overview.agents.map((a) => {
                const name = shownName(a.agent)
                return (
                  <div key={a.bindingId} className="access-card">
                    <h4 className="access-name">{name}</h4>
                    {a.agent.name && <p className="mono muted">{a.agent.agentId}</p>}
                    {a.grants.length === 0
                      ? <p className="muted">{t('access.agents.noGrants')}</p>
                      : a.grants.map((g) => {
                        const line = sayAsk(t, g.line)
                        return (
                          <Row key={g.grantId} trail={<Button tone="ghost" aria-label={t('access.revokeFor', { name, line })} disabled={busy !== null} onClick={() => void act(`grant:${g.grantId}`, () => window.fabric.hub.revokeGrant(g.grantId))}>{t('access.revoke')}</Button>}>
                            {line} <span className="muted">{t('access.agents.until', { date: date(g.expiresAt) })}</span>
                          </Row>
                        )
                      })}
                    <div className="access-acts"><Toolbar>
                      <Button tone="danger" aria-label={t('access.revokeAllFor', { name })} disabled={busy !== null} onClick={() => void act(`agent:${a.bindingId}`, () => window.fabric.hub.revokeAgent(a.bindingId))}>{t('access.agents.revokeAll')}</Button>
                    </Toolbar></div>
                  </div>
                )
              })}

            <h3 className="task-history-head">{t('access.denials.title')}</h3>
            {view.overview.denials.length === 0
              ? <EmptyState read>{t('access.denials.none')}</EmptyState>
              : view.overview.denials.map((d) => {
                const name = shownName(d.agent)
                return (
                  <Row key={d.requestId} trail={<Button tone="ghost" aria-label={t('access.clearFor', { name })} disabled={busy !== null} onClick={() => void act(`clear:${d.requestId}`, () => window.fabric.hub.clearDenial(d.requestId))}>{t('access.denials.clear')}</Button>}>
                    <strong>{name}</strong> {d.ask.map((l) => sayAsk(t, l)).join('; ')}
                  </Row>
                )
              })}
          </>
        )}
      </Panel>
    </aside>
  )
}

/** One waiting request, as a card of its own: the native prompt's facts, then Deny and Allow (UX-9). */
function PendingCard({ r, t, busy, act }: {
  r: PendingRequestFacts
  t: Say
  busy: string | null
  act: (key: string, run: Act, opts?: { product?: string; after?: (r: Extract<HubActResult, { ok: true }>) => Said }) => Promise<void>
}): React.JSX.Element {
  const name = shownName(r.agent)
  // Allowed, but the product could not be opened: the Allow stands, and the panel says so (UX-5).
  const afterAllow = (done: Extract<HubActResult, { ok: true }>): Said =>
    done.connect ? { tone: 'warn', text: t('access.allowedConnect', { problem: sayConnectProblem(t, done.connect.problem, r.product) }) } : null
  return (
    <div className="access-card">
      <h4 className="access-name">{name}</h4>
      <p className="muted">{sayOrigin(t, r.agent)}</p>
      <ul className="access-asks">{r.ask.map((l, i) => <li key={i}>{sayAsk(t, l)}</li>)}</ul>
      <p className="muted">{t('access.pending.reason', { reason: r.reason })}</p>
      <p className="muted">{sayFloor(t)}</p>
      {r.incremental && <p className="muted">{sayIncremental(t)}</p>}
      <p className="muted">{t('access.lasts')}</p>
      <p className="muted">{expiresIn(t, r.expiresAt, Date.now())}</p>
      <div className="access-acts"><Toolbar>
        <Button tone="ghost" aria-label={t('access.denyFor', { name })} disabled={busy !== null} onClick={() => void act(`deny:${r.requestId}`, () => window.fabric.hub.decide(r.requestId, 'denied'), { product: r.product })}>{t('access.deny')}</Button>
        <Button aria-label={t('access.allowFor', { name })} disabled={busy !== null} onClick={() => void act(`allow:${r.requestId}`, () => window.fabric.hub.decide(r.requestId, 'allowed'), { product: r.product, after: afterAllow })}>{sayAllow(t, r)}</Button>
      </Toolbar></div>
    </div>
  )
}
