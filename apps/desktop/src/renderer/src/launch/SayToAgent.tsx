// #region say-to-agent — docs: docs/evidence/specs/2026-11-06-session-coordination.md#5-waves
/**
 * CO-522 wave C (SCN-180 step 4, in part): «Написать агенту» on an agent's page. The words reach the session with its
 * next fabric_work_list, fabric_heartbeat or turn answer, wherever it was started, and each sent line says whether it was
 * read yet. Nothing is typed into a terminal: a line's Enter could answer a permission prompt the agent is waiting on.
 */
import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { since } from '../duration'

type Sent = { id: string; text: string; at: number; readAt: number | null }

export function SayToAgent({ sessionId, mark = 0 }: { sessionId: string; mark?: number }): React.JSX.Element {
  const t = useT()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [sent, setSent] = useState<Sent[]>([])
  const [unreadable, setUnreadable] = useState(false)
  // CO-544: an answer for a session no longer shown is dropped, so a slow read for the previous agent never replaces
  // this agent's lines. A list that cannot be read keeps the lines it had and says so; sending does not depend on it.
  const current = useRef(sessionId)
  current.current = sessionId
  const reload = (): void => {
    const asked = sessionId
    const settle = (m: unknown): void => {
      if (current.current !== asked) return
      if (Array.isArray(m)) { setSent(m as Sent[]); setUnreadable(false) } else setUnreadable(true)
    }
    const fail = (): void => { if (current.current === asked) setUnreadable(true) }
    try { void Promise.resolve(window.fabric.work.messages(asked)).then(settle, fail) } catch { fail() }
  }
  useEffect(() => { setSent([]); setUnreadable(false) }, [sessionId])
  useEffect(reload, [sessionId, mark])
  const send = async (): Promise<void> => {
    if (!text.trim()) return
    setBusy(true)
    setProblem(null)
    try {
      const r = await window.fabric.work.say({ sessionId, text })
      if (!r.ok) setProblem(t('say.refused', { reason: r.reason }))
      else { setText(''); reload() }
    } catch (e) {
      setProblem(t('say.refused', { reason: e instanceof Error ? e.message : String(e) }))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="as-say" aria-labelledby="say-title">
      <h4 id="say-title">{t('say.title')}</h4>
      <p className="lp-meta">{t('say.lede')}</p>
      <label className="lp-field">
        <span className="visually-hidden">{t('say.title')}</span>
        <textarea rows={2} value={text} placeholder={t('say.hint')} onChange={(e) => setText(e.target.value)} />
      </label>
      <button type="button" className="lp-button" disabled={busy || !text.trim()} onClick={() => void send()}>{t('say.send')}</button>
      {problem && <p className="lp-meta" role="alert">{problem}</p>}
      {unreadable && <p className="lp-meta" role="status">{t('say.unreadable')}</p>}
      {sent.length > 0 && (
        <ul className="lp-list as-said">
          {[...sent].reverse().map((m) => (
            <li key={m.id}>
              <span>{m.text}</span>
              <small className="lp-meta"> · {m.readAt === null ? t('say.waiting') : t('say.read', { when: since(new Date(m.readAt).toISOString(), t) })}</small>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
// #endregion say-to-agent
