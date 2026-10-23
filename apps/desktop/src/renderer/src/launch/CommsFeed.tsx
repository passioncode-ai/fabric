// #region comms-feed — docs: docs/ux/scenarios.md#scn-143-see-what-projects-tell-each-other
// Comms as a feed (the operator's walk of 2026-10-22, OF-29): the newest posts of every thread first, each saying which
// project wrote it, of what kind and what it says; a focus filter narrows to one project or to requests; a post opens
// its thread. Read as the threads are: a board that does not answer is said, never shown as an empty feed.
import { useEffect, useState } from 'react'
import type { CommsMessage } from '../../../shared/commsRead.ts'
import { useLocale, useT } from '../i18n'

/** How many of the newest posts the feed reads. */
const FEED = 100
/** How much of a post the feed shows before «открыть ветку». */
const PREVIEW = 280

type Read = { at: 'reading' } | { at: 'ready'; posts: CommsMessage[] } | { at: 'failed' }

export function CommsFeed({ mark, nameOf, onOpen }: {
  /** Re-read on the board's clock. */
  mark: number
  nameOf(projectId: string): string
  onOpen(post: CommsMessage): void
}): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const [read, setRead] = useState<Read>({ at: 'reading' })
  const [project, setProject] = useState('')
  const [requests, setRequests] = useState(false)
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const heads = await window.fabric.comms.heads()
        if (!heads.ok) { if (alive) setRead({ at: 'failed' }); return }
        const last = heads.heads.reduce((m, h) => Math.max(m, h.lastSeq), 0)
        const page = await window.fabric.comms.list(null, Math.max(0, last - FEED), FEED)
        if (!alive) return
        setRead(page.ok ? { at: 'ready', posts: [...page.messages].sort((a, b) => b.at.localeCompare(a.at)) } : { at: 'failed' })
      } catch {
        if (alive) setRead({ at: 'failed' })
      }
    })()
    return () => { alive = false }
  }, [mark])
  if (read.at === 'reading') return <p className="lp-meta">{t('launch.comms.reading')}</p>
  if (read.at === 'failed') return <p className="lp-meta" role="status">{t('launch.comms.unavailable')}</p>
  const projects = [...new Set(read.posts.map((p) => p.sender.project))]
  const shown = read.posts.filter((p) => (!project || p.sender.project === project) && (!requests || p.kind === 'request'))
  const kindOf = (kind: string): string => {
    const key = `launch.comms.kind.${kind}` as 'launch.comms.kind.message'
    const said = t(key)
    return said === key ? kind : said
  }
  return (
    <section className="lc" aria-labelledby="comms-feed-title">
      <h3 id="comms-feed-title" className="visually-hidden">{t('launch.comms.feed.title')}</h3>
      <div className="lc-filters">
        <button type="button" className="lp-button" aria-pressed={!requests} onClick={() => setRequests(false)}>{t('launch.comms.feed.all')}</button>
        <button type="button" className="lp-button" aria-pressed={requests} onClick={() => setRequests(true)}>{t('launch.comms.feed.requests')}</button>
        <label className="lp-field lc-project">
          {t('launch.comms.feed.project')}
          <select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">{t('launch.comms.feed.allProjects')}</option>
            {projects.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
          </select>
        </label>
      </div>
      {shown.length === 0 && <p className="lp-meta">{t('launch.comms.feed.empty')}</p>}
      <ol className="lc-posts">
        {shown.map((p) => {
          const text = p.body?.text ?? t('launch.comms.feed.redacted')
          return (
            <li key={p.id}>
              <button type="button" className="lc-post" onClick={() => onOpen(p)}>
                <span className="lc-head">
                  <b>{nameOf(p.sender.project)}</b>
                  <span className="lp-pill">{kindOf(p.kind)}</span>
                  <time dateTime={p.at}>{new Date(p.at).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</time>
                </span>
                <span className="lc-text">{text.length > PREVIEW ? text.slice(0, PREVIEW).trimEnd() + '…' : text}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
// #endregion comms-feed
