// #region comms-feed — docs: docs/ux/scenarios.md#scn-143-see-what-projects-tell-each-other
// Comms as a feed (the operator's walk of 2026-10-22, OF-29): the newest posts of every thread first, each saying which
// project wrote it, of what kind and what it says; a focus filter narrows to one project or to requests; a post opens
// its thread. Read as the threads are: a board that does not answer is said, never shown as an empty feed.
import { useEffect, useRef, useState } from 'react'
import type { CommsMessage } from '../../../shared/commsRead.ts'
import { useLocale, useT } from '../i18n'
import { newestPosts } from './commsNewest'

/** How many of the newest posts the feed reads. */
const FEED = 100
/** How often the open feed reads again (ER-4: it read once per open and never refreshed). */
export const FEED_POLL_MS = 15000
/** The longest one read may take before it is said as failed. */
export const FEED_DEADLINE_MS = 60000
/** How much of a post the feed shows before «открыть ветку». */
const PREVIEW = 280

type Read = { at: 'reading' } | { at: 'ready'; posts: CommsMessage[]; stale: boolean; readAt: string } | { at: 'failed' }

export function CommsFeed({ mark, nameOf, onOpen }: {
  /** Read again when this changes (the screen's «Попробовать снова»); the feed also reads every FEED_POLL_MS. */
  mark: number
  nameOf(projectId: string): string
  onOpen(post: CommsMessage): void
}): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const [read, setRead] = useState<Read>({ at: 'reading' })
  const [project, setProject] = useState('')
  const [requests, setRequests] = useState(false)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), FEED_POLL_MS)
    return () => clearInterval(timer)
  }, [])
  // One read at a time: a poll that comes while a read is still running waits for the next tick, so a slow board never
  // starts reads on top of each other or leaves the feed reading forever (0.3.11 review, iteration 2, ER-1).
  const mounted = useRef(true)
  const busy = useRef(false)
  // Set again on mount: StrictMode's extra cleanup in a development build must not leave the feed deaf (iteration 3, ER-1).
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  // A press or a tick while a read runs is kept and read right after it, never dropped (iteration 3, ER-2).
  const again = useRef(false)
  useEffect(() => {
    if (busy.current) { again.current = true; return }
    busy.current = true
    void (async () => {
      try {
        // A read that never settles is given up after FEED_DEADLINE_MS and said as a failed one (iteration 3, ER-2).
        const read = (async () => {
          const heads = await window.fabric.comms.heads()
          const last = heads.ok ? heads.heads.reduce((m, h) => Math.max(m, h.lastSeq), 0) : null
          return last === null ? null : await newestPosts(window.fabric.comms.list, last, FEED)
        })()
        const posts = await Promise.race([read, new Promise<null>((r) => setTimeout(() => r(null), FEED_DEADLINE_MS))])
        if (!mounted.current) return
        // A refresh that fails keeps what was read and says it is old, rather than emptying the feed.
        setRead((was) => posts ? { at: 'ready', posts, stale: false, readAt: new Date().toISOString() } : was.at === 'ready' ? { ...was, stale: true } : { at: 'failed' })
      } catch {
        if (mounted.current) setRead((was) => was.at === 'ready' ? { ...was, stale: true } : { at: 'failed' })
      } finally {
        busy.current = false
        if (again.current && mounted.current) { again.current = false; setTick((n) => n + 1) }
      }
    })()
  }, [mark, tick])
  // Dropped, not suspended: a filter whose project left the read does not come back by itself (iteration 3, ER-4).
  useEffect(() => {
    if (read.at === 'ready' && project && !read.posts.some((p) => p.sender.project === project)) setProject('')
  }, [read, project])
  if (read.at === 'reading') return <p className="lp-meta">{t('launch.comms.reading')}</p>
  if (read.at === 'failed') return (
    <div className="lc" role="status">
      <p className="lp-meta">{t('launch.comms.unavailable')}</p>
      <button type="button" className="lp-button" onClick={() => setTick((n) => n + 1)}>{t('launch.comms.tryAgain')}</button>
    </div>
  )
  const projects = [...new Set(read.posts.map((p) => p.sender.project))]
  // A project whose posts left the newest read no longer filters (0.3.11 review, iteration 2, ER-8).
  const scope = projects.includes(project) ? project : ''
  const shown = read.posts.filter((p) => (!scope || p.sender.project === scope) && (!requests || p.kind === 'request'))
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
          <select value={scope} onChange={(e) => setProject(e.target.value)}>
            <option value="">{t('launch.comms.feed.allProjects')}</option>
            {projects.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
          </select>
        </label>
      </div>
      {read.stale && (
        <p className="lp-meta" role="status">
          {t('launch.comms.feed.stale', { time: new Date(read.readAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) })}{' '}
          <button type="button" className="lp-button lh-text-link" onClick={() => setTick((n) => n + 1)}>{t('launch.comms.tryAgain')}</button>
        </p>
      )}
      {shown.length === 0 && read.posts.length === 0 && <p className="lp-meta">{t('launch.comms.feed.empty')}</p>}
      {shown.length === 0 && read.posts.length > 0 && (
        <p className="lp-meta">
          {t('launch.comms.feed.noMatch')}{' '}
          <button type="button" className="lp-button lh-text-link" onClick={() => { setRequests(false); setProject('') }}>{t('launch.comms.feed.showAll')}</button>
        </p>
      )}
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
