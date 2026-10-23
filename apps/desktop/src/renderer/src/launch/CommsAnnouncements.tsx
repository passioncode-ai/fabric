// #region comms-announcements — docs: docs/ux/scenarios.md#scn-178-see-which-projects-have-not-answered-an-announcement
// Comms' «Объявления» (CO-377): every announcement on the board with who has answered it and who has not, so the
// operator sees what is still open. Reads the threads holding an announcement, then each thread's messages; a board that
// does not answer is said, never shown as «nobody owes an answer».
import { useEffect, useRef, useState } from 'react'
import type { CommsMessage, CommsThread } from '../../../shared/commsRead.ts'
import { announcementsOf, type AnnouncementStatus, type AnswerType } from '../../../shared/announcements.ts'
import { useLocale, useT } from '../i18n'

/** How many threads with an announcement one reading takes, newest first. */
const THREADS = 50
/** How many pages of 100 messages one thread may take. */
const PAGES = 3
const PREVIEW = 220

type Read = { at: 'reading' } | { at: 'ready'; items: AnnouncementStatus[]; capped: boolean } | { at: 'failed' }

const ANSWER: Record<AnswerType, 'launch.comms.ann.adapted' | 'launch.comms.ann.row' | 'launch.comms.ann.notAffected' | 'launch.comms.ann.replied'> = {
  adapted: 'launch.comms.ann.adapted', row: 'launch.comms.ann.row', 'not-affected': 'launch.comms.ann.notAffected', replied: 'launch.comms.ann.replied'
}

/** One thread's messages, at most PAGES pages; null when the board did not answer. */
async function messagesOf(thread: string): Promise<CommsMessage[] | null> {
  const all: CommsMessage[] = []
  let after = 0
  for (let page = 0; page < PAGES; page++) {
    const reply = await window.fabric.comms.list(thread, after, 100)
    if (!reply.ok) return null
    all.push(...reply.messages)
    if (!reply.more || reply.lastSeq <= after) break
    after = reply.lastSeq
  }
  return all
}

export function CommsAnnouncements({ mark, nameOf, onOpen }: {
  /** Read again when this changes (the screen's «Попробовать снова»). */
  mark: number
  nameOf(projectId: string): string
  onOpen(thread: CommsThread): void
}): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const [read, setRead] = useState<Read>({ at: 'reading' })
  const [openOnly, setOpenOnly] = useState(true)
  const [tick, setTick] = useState(0)
  const threads = useRef<CommsThread[]>([])
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const page = await window.fabric.comms.threadPage({ kind: 'announcement' }, null, THREADS)
        if (!page.ok) { if (alive) setRead({ at: 'failed' }); return }
        threads.current = page.threads
        const items: AnnouncementStatus[] = []
        for (const th of page.threads) {
          const msgs = await messagesOf(th.id)
          if (!msgs) { if (alive) setRead({ at: 'failed' }); return }
          items.push(...announcementsOf(th, msgs))
        }
        items.sort((a, b) => b.at.localeCompare(a.at))
        if (alive) setRead({ at: 'ready', items, capped: page.more })
      } catch {
        if (alive) setRead({ at: 'failed' })
      }
    })()
    return () => { alive = false }
  }, [mark, tick])
  if (read.at === 'reading') return <p className="lp-meta" role="status">{t('launch.comms.reading')}</p>
  if (read.at === 'failed') return (
    <div className="lc" role="status">
      <p className="lp-meta">{t('launch.comms.unavailable')}</p>
      <button type="button" className="lp-button" onClick={() => setTick((n) => n + 1)}>{t('launch.comms.tryAgain')}</button>
    </div>
  )
  const shown = read.items.filter((a) => !openOnly || a.answered < a.participants.length)
  const when = (at: string): string => new Date(at).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
  return (
    <section className="lc" aria-labelledby="comms-ann-title">
      <h3 id="comms-ann-title" className="visually-hidden">{t('launch.comms.ann.title')}</h3>
      <div className="lc-filters">
        <button type="button" className="lp-button" aria-pressed={openOnly} onClick={() => setOpenOnly(true)}>{t('launch.comms.ann.open')}</button>
        <button type="button" className="lp-button" aria-pressed={!openOnly} onClick={() => setOpenOnly(false)}>{t('launch.comms.ann.all')}</button>
      </div>
      {read.items.length === 0 && <p className="lp-meta">{t('launch.comms.ann.none')}</p>}
      {shown.length === 0 && read.items.length > 0 && <p className="lp-meta">{t('launch.comms.ann.allAnswered')}</p>}
      <ol className="lc-posts">
        {shown.map((a) => {
          const waiting = a.participants.filter((p) => !p.answer)
          const text = a.text ?? t('launch.comms.feed.redacted')
          const thread = threads.current.find((x) => x.id === a.thread)
          return (
            <li key={a.messageId} className="lc-ann">
              <button type="button" className="lc-post" onClick={() => thread && onOpen(thread)}>
                <span className="lc-head">
                  <b>{nameOf(a.from)}</b>
                  <span className="lp-pill">{t('launch.comms.ann.count', { answered: a.answered, of: a.participants.length })}</span>
                  <time dateTime={a.at}>{when(a.at)}</time>
                </span>
                <span className="lc-text">{text.length > PREVIEW ? text.slice(0, PREVIEW).trimEnd() + '…' : text}</span>
              </button>
              <ul className="lc-answers">
                {waiting.map((p) => <li key={p.project} className="lc-waiting">{nameOf(p.project)}: {t('launch.comms.ann.waiting')}</li>)}
                {a.participants.filter((p) => p.answer).map((p) => <li key={p.project}>{nameOf(p.project)}: {t(ANSWER[p.answer!.type])}</li>)}
              </ul>
            </li>
          )
        })}
      </ol>
      {read.capped && <p className="lp-meta">{t('launch.comms.ann.capped', { count: THREADS })}</p>}
    </section>
  )
}
// #endregion comms-announcements
