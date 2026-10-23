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

/** A request still waiting for its answer: outside the contract's terminal set (the board's own rule for an open request,
 *  `project_board_thread_aggregates`) and not answered by its target's reply (CO-401, OF-29). */
const SETTLED = new Set(['completed', 'failed_known', 'cancelled', 'expired', 'answered'])
export const waitsForAnswer = (post: Pick<CommsMessage, 'kind' | 'request'>): boolean =>
  post.kind === 'request' && !!post.request && !SETTLED.has(post.request.state)

export function CommsFeed({ mark, nameOf, threadOf, onOpen }: {
  /** Read again when this changes (the screen's «Попробовать снова»); the feed also reads every FEED_POLL_MS. */
  mark: number
  nameOf(projectId: string): string
  /** The thread a post belongs to, by the name the threads tab gives it; null when the screen does not hold it. */
  threadOf?(threadId: string): string | null
  onOpen(post: CommsMessage): void
}): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const [read, setRead] = useState<Read>({ at: 'reading' })
  const [project, setProject] = useState('')
  const [focus, setFocus] = useState<'all' | 'requests' | 'waiting'>('all')
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
    const failed = (): void => { if (mounted.current) setRead((was) => was.at === 'ready' ? { ...was, stale: true } : { at: 'failed' }) }
    // A read that has not settled after FEED_DEADLINE_MS is said as failed, but it still holds the one slot until it
    // settles, so a board that never answers gets one read at a time, never a pile of them (final verification, VF-5).
    const deadline = setTimeout(failed, FEED_DEADLINE_MS)
    void (async () => {
      try {
        const heads = await window.fabric.comms.heads()
        const last = heads.ok ? heads.heads.reduce((m, h) => Math.max(m, h.lastSeq), 0) : null
        const posts = last === null ? null : await newestPosts(window.fabric.comms.list, last, FEED)
        if (!mounted.current) return
        // A refresh that fails keeps what was read and says it is old, rather than emptying the feed.
        if (posts) setRead({ at: 'ready', posts, stale: false, readAt: new Date().toISOString() })
        else failed()
      } catch {
        failed()
      } finally {
        clearTimeout(deadline)
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
  const shown = read.posts.filter((p) => (!scope || p.sender.project === scope) &&
    (focus === 'all' || (focus === 'requests' ? p.kind === 'request' : waitsForAnswer(p))))
  const kindOf = (kind: string): string => {
    const key = `launch.comms.kind.${kind}` as 'launch.comms.kind.message'
    const said = t(key)
    return said === key ? kind : said
  }
  return (
    <section className="lc" aria-labelledby="comms-feed-title">
      <h3 id="comms-feed-title" className="visually-hidden">{t('launch.comms.feed.title')}</h3>
      <div className="lc-filters">
        <button type="button" className="lp-button" aria-pressed={focus === 'all'} onClick={() => setFocus('all')}>{t('launch.comms.feed.all')}</button>
        <button type="button" className="lp-button" aria-pressed={focus === 'requests'} onClick={() => setFocus('requests')}>{t('launch.comms.feed.requests')}</button>
        <button type="button" className="lp-button" aria-pressed={focus === 'waiting'} onClick={() => setFocus('waiting')}>{t('launch.comms.feed.waiting')}</button>
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
          <button type="button" className="lp-button lh-text-link" onClick={() => { setFocus('all'); setProject('') }}>{t('launch.comms.feed.showAll')}</button>
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
                {/* OF-29 (CO-401): the thread the post belongs to, named under it. */}
                {threadOf?.(p.thread) && <small className="lc-thread">{t('launch.comms.feed.inThread', { thread: threadOf(p.thread)! })}</small>}
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
// #endregion comms-feed
