// #region ceo-header — docs: docs/evidence/specs/2026-11-20-ceo-persona.md#2-the-persona-on-the-home
/**
 * The home's header (the owner, 2026-11-20, 23:00, point 3): the CEO's face, its line about the owner's projects, and the
 * home's numbers, each with what it means today. Replaces `HomeStats` on the home; the same numbers, the same reading
 * (`useHome`), the same places a number opens. A number not read is «—» with its reason, never 0; an unread reading
 * makes the line say so, never «all calm». The line's character is `shared/ceoPersona.ts` (PERSONA_VERSION).
 */
import { useMemo, useRef } from 'react'
import { pluralForm, useLocale, useT } from '../i18n'
import { FabricAvatar } from './FabricAvatar'
import { usePersona } from './persona'
import type { HomeReading } from './HomeWork'
import { ceoLine, ownerManner, projectHeat, statSentences, stepEpisodes, type Episode } from '../../../shared/ceoPersona'

export function CeoHeader({ home, waiting, toReview, ownerWords, onAgents, onBoard, onWaiting, onReview, onAbandoned, onProject }: {
  home: HomeReading
  waiting: number | null
  toReview?: number | null
  /** The owner's own recent messages to the CEO, newest last: how he talks (never anyone else's words). */
  ownerWords?: readonly string[]
  onAgents(): void
  onBoard(): void
  onWaiting?(): void
  onReview?(): void
  onAbandoned?(): void
  /** Opens a project the line names (a fire). */
  onProject?(projectId: string): void
}): React.JSX.Element {
  const t = useT(), locale = useLocale()
  const { persona } = usePersona()
  const v = home.view && !home.problem ? home.view : null
  // The fire episodes step once per reading (its time), never per render.
  const episodes = useRef<{ at: string | null; map: Map<string, Episode> }>({ at: null, map: new Map() })
  const readAt = home.problem ? null : home.view?.readAt ?? null
  if (readAt !== episodes.current.at) {
    episodes.current = { at: readAt, map: stepEpisodes(episodes.current.map, v ? projectHeat(v, Date.parse(v.readAt) || Date.now()) : null) }
  }
  const manner = useMemo(() => ownerManner(ownerWords ?? []), [ownerWords])
  const now = new Date()
  // The wording turns every ten minutes; the facts follow every reading.
  const seed = Math.floor(now.getTime() / 600_000)
  const line = ceoLine({ view: v, waiting, episodes: episodes.current.map, manner, locale, hour: now.getHours(), seed })
  const names = useMemo(() => {
    const m = new Map<string, string>()
    for (const w of [...(v?.inWork ?? []), ...(v?.abandoned ?? [])]) m.set(w.projectId, w.projectName)
    for (const r of v?.review ?? []) m.set(r.projectId, r.projectName)
    return m
  }, [v])
  const says = v ? statSentences(v, names, locale) : { working: null, review: null, abandoned: null }
  const working = v ? (v.atWork ? v.atWork.agents : v.live.filter((l) => !l.stale).length) : null
  const reviewN = toReview !== undefined ? toReview : v ? v.review.length : null
  const abandoned = v?.abandoned ? v.abandoned.length : null
  const unread = home.problem ? t('launch.home.work.unreadable') : undefined
  const stat = (n: number | null, label: string, sub: string | null, onClick: () => void, tone: string) => (
    <button type="button" className={`ceo-head-stat ${tone}`} onClick={onClick} title={n === null ? unread : sub ?? undefined}>
      <b>{n === null ? '—' : n}</b>
      <span>{label}</span>
      {sub && <small>{sub}</small>}
    </button>
  )
  const name = persona.name || 'Fabric'
  return (
    <section className={`ceo-head mood-${line.mood}`} aria-label={t('launch.ceoHeader.label', { name })}>
      <div className="ceo-head-face">
        <FabricAvatar size="large" label={name} />
        {line.mood === 'alarm' && <span className="ceo-head-pulse" aria-hidden="true" />}
      </div>
      <div className="ceo-head-body">
        <p className="ceo-head-name">{name}</p>
        {line.projectId && onProject
          ? <button type="button" className="ceo-head-line" role="status" onClick={() => onProject(line.projectId!)}>{line.text}</button>
          : <p className="ceo-head-line" role="status">{line.text}</p>}
        <div className="ceo-head-stats" role="group" aria-label={t('launch.home.stats.label')}>
          {stat(working, t(`launch.home.stats.working.${pluralForm(locale, working ?? 5)}` as 'launch.home.stats.working.many'), says.working, onAgents, working ? 'live' : '')}
          {stat(waiting, t('launch.home.stats.waiting'), null, onWaiting ?? onBoard, waiting ? 'attention' : '')}
          {stat(reviewN, t('launch.home.stats.review'), says.review, onReview ?? onBoard, '')}
          {stat(abandoned, t('launch.home.stats.abandoned'), says.abandoned, onAbandoned ?? onBoard, abandoned ? 'warn' : '')}
        </div>
      </div>
    </section>
  )
}
// #endregion ceo-header
