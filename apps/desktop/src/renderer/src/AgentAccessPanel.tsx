// Agent access (SCR-76 · SCN-132, SCN-133 · ADR-0115), opened from Settings: what registered agents on
// this Mac may do through Fabric, what is waiting for an answer, and which products are connected.
// Main owns every decision and every secret; this panel shows the overview it is given and asks for
// one act at a time, then reads the overview again — it never edits the list it shows by itself.
//
// EVERY WORD IS THE OPERATOR'S LANGUAGE (verification iteration 1 for 0.3.1, UX-2): the overview carries
// facts — ids, names, asked capabilities, resources, codes — and each is phrased here through
// `shared/accessWords.ts`, the same words the native prompt and the queue use.

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import type { HubActResult, HubOverview, PendingRequestFacts } from '../../shared/access'
import { sayActRefusal, sayAllow, sayAllowFor, sayAsk, sayConnectDetail, sayConnectProblem, sayFloor, sayIncremental, sayOrigin, shownName, type Say } from '../../shared/accessWords'
import { humaniseError } from '../../shared/errorText'
import { Banner, Button, EmptyState, Panel, Row, Toolbar } from './components'
import { useLocale, useT } from './i18n'

type Act = () => Promise<HubActResult>
type View = { kind: 'loading' } | { kind: 'unreadable'; reason: string } | { kind: 'read'; overview: HubOverview }
/** What the last act left to say: a refusal, or a note that is not a failure (UX-5, UX-10); `detail` is the
 *  machine's words, shown as a line of their own (iteration 2, UX-5). */
type Said = { tone: 'warn' | 'info'; text: string; detail?: string | null } | null
/** The panel's sections; an act names the one it changed, and focus goes there when it is done (UX-7). */
type Section = 'products' | 'pending' | 'agents' | 'denials'
type ActOpts = { product?: string; after?: (r: Extract<HubActResult, { ok: true }>) => Said; section: Section }

/** How often the open panel re-reads: a request waits ten minutes, a connect answer arrives in seconds. */
const REFRESH_MS = 4000

/** "expires in N min", from the request's own expiry (UX-9). */
function expiresIn(t: Say, expiresAt: string, now: number): string {
  const minutes = Math.ceil((Date.parse(expiresAt) - now) / 60_000)
  return minutes <= 1 ? t('access.pending.expiresSoon') : t('access.pending.expires', { minutes })
}

/** A refused act, said from its code; the machine's words only when there is no code. */
function sayRefused(t: Say, r: Extract<HubActResult, { ok: false }>, product: string): Said {
  if (r.code) return { tone: 'warn', text: t('access.notDone', { reason: sayActRefusal(t, r.code) }) }
  if (r.problem) return { tone: 'warn', text: t('access.notDone', { reason: sayConnectProblem(t, r.problem, product) }), detail: sayConnectDetail(t, r.problem) }
  return { tone: 'warn', text: t('access.notDoneGeneric'), detail: t('access.saw', { detail: humaniseError(r.reason).detail }) }
}

/** What a product card says about its last attempt — only what is true at this moment (iteration 2, UX-2):
 *  a Reconnect that waits keeps the current key in use; only a delivered key replaces it; a Deny or a
 *  failure while connected keeps the current connection, unless the failure itself lost it. */
function attemptLines(t: Say, p: HubOverview['products'][number]): { text: string; tone: 'status' | 'note' | 'alert'; detail?: string | null }[] {
  const last = p.lastAttempt
  if (!last) return []
  if (last.outcome === 'waiting') return [{ tone: 'status', text: t(p.connection ? 'access.products.waitingReconnect' : 'access.products.waiting', { name: p.name }) }]
  if (last.outcome === 'connected') return last.reconnect && p.connection ? [{ tone: 'note', text: t('access.products.reconnected', { name: p.name }) }] : []
  const keeps = p.connection !== null && !(last.outcome === 'failed' && (last.problem?.previousLost || last.problem?.code === 'withdraw-failed'))
  const kept = keeps ? [{ tone: 'note' as const, text: t('access.products.keptCurrent') }] : []
  if (last.outcome === 'denied') return [{ tone: 'note', text: t('access.products.denied', { name: p.name }) }, ...kept]
  if (!last.problem) return kept
  return [{ tone: 'alert', text: t('access.products.failed', { reason: sayConnectProblem(t, last.problem, p.name) }), detail: sayConnectDetail(t, last.problem) }, ...kept]
}

export function AgentAccessPanel({ onClose }: { onClose: () => void }): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [busy, setBusy] = useState<string | null>(null)
  const [said, setSaid] = useState<Said>(null)
  /** The section the last act changed; its heading takes focus once the panel has read again (UX-7). */
  const [focusTo, setFocusTo] = useState<Section | null>(null)
  const heads = useRef<Partial<Record<Section, HTMLHeadingElement | null>>>({})
  const date = (iso: string): string => new Date(iso).toLocaleDateString(locale)
  useEffect(() => {
    if (!focusTo) return
    heads.current[focusTo]?.focus()
    setFocusTo(null)
  }, [focusTo, view])

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

  /** One act; `product` names what a connect problem is about; `after` is said when it is done; focus then
   *  goes to the heading of the section the act changed — the pressed button may be gone (UX-7). */
  const act = async (key: string, run: Act, opts: ActOpts): Promise<void> => {
    if (busy !== null) return
    setBusy(key)
    setSaid(null)
    try {
      const r = await run()
      if (!r.ok) setSaid(sayRefused(t, r, opts.product ?? ''))
      else setSaid(opts.after?.(r) ?? null)
    } catch (e) {
      setSaid({ tone: 'warn', text: t('access.notDoneGeneric'), detail: t('access.saw', { detail: humaniseError(e).detail }) })
    } finally {
      setBusy(null)
      await read()
      setFocusTo(opts.section)
    }
  }
  /** While an act runs, the buttons say they are unavailable without being disabled: a disabled button
   *  drops keyboard focus to the document body (UX-7). `act` ignores a second press. */
  const waiting = busy !== null ? { 'aria-disabled': true as const } : {}

  const listening = view.kind === 'read' && view.overview.hub.listening
  const keyStays = (name: string): Said => ({ tone: 'info', text: t('access.products.keyStays', { name }) })
  const head = (section: Section) => (el: HTMLHeadingElement | null) => { heads.current[section] = el }

  return (
    <aside className="ceo-panel" aria-label={t('access.title')}>
      <Panel title={t('access.title')} actions={<Toolbar align="end"><Button tone="ghost" onClick={onClose}>{t('access.close')}</Button></Toolbar>}>
        <p className="muted">{t('access.what')}</p>
        {said && (said.tone === 'warn'
          ? <Banner tone="warn"><span>{said.text}</span>{said.detail && <span className="muted access-detail">{said.detail}</span>}</Banner>
          : <p className="muted" role="status">{said.text}</p>)}
        {view.kind === 'loading' && <p className="muted" role="status">{t('access.loading')}</p>}
        {view.kind === 'unreadable' && (
          <Banner tone="warn" actions={<Button tone="ghost" onClick={() => void read()}>{t('access.retry')}</Button>}>
            <span>{t('access.unreadable')}</span>
            <span className="muted access-detail">{t('access.saw', { detail: view.reason })}</span>
          </Banner>
        )}
        {view.kind === 'read' && (
          <>
            {view.overview.hub.listening
              ? <p className="muted">{t('access.hub.on', { origin: view.overview.hub.origin })}</p>
              : (
                // Said per cause, in the operator's language; the machine's fact is the second line (DO-14, UX-5).
                <Banner tone="warn">
                  <span>{t('access.hub.off')} {t(`access.hub.off.${view.overview.hub.code ?? 'not-started'}`)}</span>
                  <span className="muted access-detail">{t('access.hub.offDetail', { reason: view.overview.hub.fact ?? view.overview.hub.reason })}</span>
                </Banner>
              )}

            <h3 className="task-history-head" tabIndex={-1} ref={head('products')}>{t('access.products.title')}</h3>
            {view.overview.products.map((p) => {
              const last = p.lastAttempt
              // A connect the product is still answering is not offered again (UX-9): a second click would
              // open a second consent there.
              const answering = last?.outcome === 'waiting'
              return (
                <div key={p.product} className="access-card" data-product={p.product}>
                  <p>
                    <strong>{p.name}</strong>{' '}
                    {p.connection
                      ? <span className="muted">{t('access.products.connectedTo')} <span className="access-url">{p.connection.server}</span> {t('access.products.since', { since: date(p.connection.connectedAt) })}</span>
                      : <span className="muted">{t('access.products.notConnected')}</span>}
                  </p>
                  {attemptLines(t, p).map((line, i) => (
                    <Fragment key={i}>
                      <p className={line.tone === 'alert' ? 'access-problem' : 'muted'} role={line.tone === 'alert' ? 'alert' : line.tone === 'status' ? 'status' : undefined}>{line.text}</p>
                      {line.detail && <p className="muted access-detail">{line.detail}</p>}
                    </Fragment>
                  ))}
                  <div className="access-acts"><Toolbar>
                    {p.connection
                      ? <>
                          {/* Reconnect only opens the product: the current key stays in use until a new one is delivered, so nothing is said about the key here (UX-2). */}
                          <Button tone="ghost" {...waiting} disabled={!listening || answering} onClick={() => void act(`reconnect:${p.product}`, () => window.fabric.hub.connect(p.product, { reconnect: true }), { product: p.name, section: 'products' })}>{t('access.products.reconnect')}</Button>
                          <Button tone="ghost" {...waiting} onClick={() => void act(`disconnect:${p.product}`, () => window.fabric.hub.disconnect(p.product), { product: p.name, after: () => keyStays(p.name), section: 'products' })}>{t('access.products.disconnect')}</Button>
                        </>
                      : <Button {...waiting} disabled={!listening || answering} onClick={() => void act(`connect:${p.product}`, () => window.fabric.hub.connect(p.product), { product: p.name, section: 'products' })}>
                          {last?.outcome === 'failed' ? t('access.products.tryAgain') : t('access.products.connect')}
                        </Button>}
                  </Toolbar></div>
                </div>
              )
            })}

            <h3 className="task-history-head" tabIndex={-1} ref={head('pending')}>{t('access.pending.title')}</h3>
            {view.overview.pending.length === 0
              ? <EmptyState read>{t('access.pending.none')}</EmptyState>
              : view.overview.pending.map((r) => <PendingCard key={r.requestId} r={r} t={t} waiting={waiting} act={act} />)}

            <h3 className="task-history-head" tabIndex={-1} ref={head('agents')}>{t('access.agents.title')}</h3>
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
                          <Row key={g.grantId} trail={<Button tone="ghost" aria-label={t('access.revokeFor', { name, line })} {...waiting} onClick={() => void act(`grant:${g.grantId}`, () => window.fabric.hub.revokeGrant(g.grantId), { section: 'agents' })}>{t('access.revoke')}</Button>}>
                            {line} <span className="muted">{t('access.agents.until', { date: date(g.expiresAt) })}</span>
                          </Row>
                        )
                      })}
                    <div className="access-acts"><Toolbar>
                      <Button tone="danger" aria-label={t('access.revokeAllFor', { name })} {...waiting} onClick={() => void act(`agent:${a.bindingId}`, () => window.fabric.hub.revokeAgent(a.bindingId), { section: 'agents' })}>{t('access.agents.revokeAll')}</Button>
                    </Toolbar></div>
                  </div>
                )
              })}

            <h3 className="task-history-head" tabIndex={-1} ref={head('denials')}>{t('access.denials.title')}</h3>
            {view.overview.denials.length === 0
              ? <EmptyState read>{t('access.denials.none')}</EmptyState>
              : view.overview.denials.map((d) => {
                const name = shownName(d.agent)
                return (
                  <Row key={d.requestId} trail={<Button tone="ghost" aria-label={t('access.clearFor', { name })} {...waiting} onClick={() => void act(`clear:${d.requestId}`, () => window.fabric.hub.clearDenial(d.requestId), { section: 'denials' })}>{t('access.denials.clear')}</Button>}>
                    <strong>{name}</strong> {t('access.denials.asked', { asks: d.ask.map((l) => sayAsk(t, l)).join('; ') })}
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
function PendingCard({ r, t, waiting, act }: {
  r: PendingRequestFacts
  t: Say
  waiting: { 'aria-disabled'?: true }
  act: (key: string, run: Act, opts: ActOpts) => Promise<void>
}): React.JSX.Element {
  const name = shownName(r.agent)
  // Allowed, but the product could not be opened: the Allow stands, and the panel says so — pointing to
  // Products in this panel, not to the screen the operator is already on (UX-5; iteration 2, UX-11).
  const afterAllow = (done: Extract<HubActResult, { ok: true }>): Said =>
    done.connect ? { tone: 'warn', text: t('access.allowedConnectHere', { problem: sayConnectProblem(t, done.connect.problem, r.product) }), detail: sayConnectDetail(t, done.connect.problem) } : null
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
        <Button tone="ghost" aria-label={t('access.denyFor', { name })} {...waiting} onClick={() => void act(`deny:${r.requestId}`, () => window.fabric.hub.decide(r.requestId, 'denied'), { product: r.product, section: 'pending' })}>{t('access.deny')}</Button>
        <Button aria-label={sayAllowFor(t, r, name)} {...waiting} onClick={() => void act(`allow:${r.requestId}`, () => window.fabric.hub.decide(r.requestId, 'allowed'), { product: r.product, after: afterAllow, section: 'pending' })}>{sayAllow(t, r)}</Button>
      </Toolbar></div>
    </div>
  )
}
