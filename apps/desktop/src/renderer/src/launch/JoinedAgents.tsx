// #region joined-agents — docs: docs/ux/scenarios.md#scn-167-a-coding-agent-opened-outside-fabric-is-let-in-and-the-person-disconnects-it-with-one-press
/**
 * Coding agents that joined on their own (SCN-167, ADR-0160 §3; 0.3.7 wave 3), at the top of Агенты. A coding agent
 * opened in a terminal is let in at once (ADR-0164's admission); here the person sees it, once per agent, with
 * «подключился сам», the projects it may work in, the fact Fabric cannot prove which program it is (ADR-0160
 * consequences: the floor moved from the dialog to this line), and «Отключить». A disconnected agent says «Отключён»
 * with «Пустить снова». Both are acts with their undo on the act line and in История; no dialog.
 *
 * Wave 4 folds this into the agent rows of Агенты (SCR-87); the read is `hub.overview` (the same as Settings → Agent
 * access), the acts are `hub.disconnectAgent` and `hub.letAgentIn`.
 */
import { useCallback, useEffect, useState } from 'react'
import type { ActAnswer } from '../../../shared/acts.ts'
import { FABRIC_SELF, SESSION_ENROLL, type HubOverview } from '../../../shared/access.ts'
import { useLocale, useT } from '../i18n'
import { whyWords } from './actWords'

type Row = { agentId: string; name: string; projects: string[]; since: string }
type Act = () => Promise<ActAnswer>

/** `mark` moves with the journal's act and access events, so an undo pressed on the act line (or anywhere else) is
 *  read back here, as История does (0.3.7 review UX-8). */
export function JoinedAgents({ projects, mark = 0 }: { projects: ReadonlyArray<{ id: string; name: string }> | null; mark?: number }): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const [read, setRead] = useState<{ at: 'reading' } | { at: 'ready'; ov: HubOverview } | { at: 'failed'; says: string }>({ at: 'reading' })
  const [busy, setBusy] = useState<string | null>(null)
  const [refused, setRefused] = useState<{ agentId: string; why: string; says?: string } | null>(null)
  const load = useCallback(async (): Promise<void> => {
    try {
      setRead({ at: 'ready', ov: await window.fabric.hub.overview() })
    } catch (e) {
      setRead({ at: 'failed', says: e instanceof Error ? e.message : String(e) })
    }
  }, [])
  useEffect(() => { void load() }, [load, mark])
  const act = async (agentId: string, run: Act) => {
    if (busy) return
    setBusy(agentId)
    setRefused(null)
    let answer: ActAnswer
    try { answer = await run() } catch (e) { answer = { ok: false, reason: 'failed', says: e instanceof Error ? e.message : String(e) } }
    if (!answer.ok) setRefused({ agentId, why: answer.reason, ...(answer.says ? { says: answer.says } : {}) })
    setBusy(null)
    await load()
  }
  const nameOf = (id: string): string => (projects ?? []).find((p) => p.id === id)?.name ?? t('joined.someProject')
  const rows: Row[] = []
  if (read.at === 'ready') {
    for (const a of read.ov.agents) {
      const enrolled = a.grants.filter((g) => g.callee === FABRIC_SELF && g.capability === SESSION_ENROLL)
      if (!a.agent.codingAgent && enrolled.length === 0) continue
      if (enrolled.length === 0) continue
      const found = rows.find((r) => r.agentId === a.agent.agentId)
      const ids = enrolled.map((g) => (g.resource.startsWith('project:') ? g.resource.slice('project:'.length) : '')).filter(Boolean)
      if (found) { for (const id of ids) if (!found.projects.includes(id)) found.projects.push(id); if (a.since < found.since) found.since = a.since }
      else rows.push({ agentId: a.agent.agentId, name: a.agent.name ?? t('acts.actor.agent'), projects: ids, since: a.since })
    }
  }
  const out = read.at === 'ready' ? read.ov.keptOut?.agents ?? [] : []
  const failedHere = (agentId: string, key: 'joined.disconnectFailed' | 'joined.letInFailed') => refused?.agentId === agentId && (
    <span className="ja-refused">
      <span>{t(key)} {whyWords(t, refused.why)}</span>
      {refused.says && <small className="hx-words">{refused.says}</small>}
    </span>
  )
  return (
    <section className="ja" aria-labelledby="ja-title">
      <h3 id="ja-title" className="ja-title">{t('joined.title')}</h3>
      {read.at === 'reading' && <p className="hx-muted" role="status">{t('joined.reading')}</p>}
      {read.at === 'failed' && (
        <div className="hx-problem" role="alert">
          <p>{t('joined.failed')}</p>
          <p className="hx-words">{read.says}</p>
          <button type="button" className="hx-button" onClick={() => void load()}>{t('acts.retry')}</button>
        </div>
      )}
      {read.at === 'ready' && read.ov.keptOut && !read.ov.keptOut.readable && <p className="hx-muted" role="status">{t('joined.outUnreadable')}</p>}
      {read.at === 'ready' && rows.length === 0 && out.length === 0 && <p className="hx-muted">{t('joined.none')}</p>}
      {(rows.length > 0 || out.length > 0) && (
        <ul className="ja-list">
          {rows.map((r) => (
            <li key={r.agentId} aria-label={r.name} className="ja-row">
              <span className="ja-name"><b>{r.name}</b> <span className="ja-tag">{t('joined.self')}</span></span>
              <span className="ja-where">{r.projects.map(nameOf).join(', ')} · {new Date(r.since).toLocaleDateString(locale, { day: 'numeric', month: 'long' })}</span>
              <small className="ja-proof">{t('joined.proof', { name: r.name })}</small>
              <button type="button" className="hx-button" disabled={busy === r.agentId} aria-busy={busy === r.agentId}
                onClick={() => void act(r.agentId, () => window.fabric.hub.disconnectAgent(r.agentId))}>{t('joined.disconnect')}</button>
              {failedHere(r.agentId, 'joined.disconnectFailed')}
            </li>
          ))}
          {out.map((o) => (
            <li key={o.agentId} aria-label={o.name ?? t('acts.actor.agent')} className="ja-row">
              <span className="ja-name"><b>{o.name ?? t('acts.actor.agent')}</b> <span className="ja-tag">{t('joined.out')}</span></span>
              <span className="ja-where">{t('joined.outSince', { time: new Date(o.at).toLocaleDateString(locale, { day: 'numeric', month: 'long' }) })}</span>
              <button type="button" className="hx-button" disabled={busy === o.agentId} aria-busy={busy === o.agentId}
                onClick={() => void act(o.agentId, () => window.fabric.hub.letAgentIn(o.agentId))}>{t('joined.letIn')}</button>
              {failedHere(o.agentId, 'joined.letInFailed')}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
// #endregion joined-agents
