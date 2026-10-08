// #region fabric-strip — docs: docs/ux/screens.md#launch-chrome
// The line under the scope bar that says who is speaking and how fresh the screen is: Fabric's face, its
// name, the last thing recorded in this scope, and the way to Pulse. One component, so the eight screens
// that carry it (board, pulse, releases, plan, project, agent) cannot drift into eight spellings of it.
// The prototype draws it on every launch view but Home and "Your Fabric" (scripts/product/launch.mjs).

import type { FeedEvent } from '../../../shared/types'
import { useLocale, useT } from '../i18n'
import { FabricAvatar } from './FabricAvatar'
import { FabricName } from './persona'

export function FabricStrip({ text, onPulse }: { text: string; onPulse?: () => void }): React.JSX.Element {
  const t = useT()
  return (
    <div className="fp-strip" data-testid="fabric-strip">
      <FabricAvatar size="tiny" label={t('launch.avatar.label')} />
      <div>
        <b><FabricName /></b>
        <span>{text}</span>
      </div>
      {onPulse && <button type="button" className="lp-button" onClick={onPulse}>{t('launch.pulse.open')}</button>}
    </div>
  )
}

/** The newest journal event in a scope, or null when the feed holds none for it. A feed that has not been
 *  read yet is `undefined` upstream and says so with its own sentence; it never reads as "nothing yet". */
export function lastEventAt(feed: readonly FeedEvent[], projectId: string | null): string | null {
  let newest: string | null = null
  for (const e of feed) {
    if (projectId !== null && e.project_id !== projectId) continue
    if (newest === null || e.occurred_at > newest) newest = e.occurred_at
  }
  return newest
}

/** The strip for a screen whose freshness is the journal's: the newest event in the scope, by name. */
export function FeedStrip({ feed, projectId, projectName, onPulse }: {
  feed: readonly FeedEvent[] | null
  projectId: string | null
  projectName: string | null
  onPulse?: () => void
}): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const at = feed ? lastEventAt(feed, projectId) : null
  const when = at ? new Date(at).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : ''
  const text = feed === null
    ? t('launch.strip.reading')
    : projectId !== null
      ? (at ? t('launch.project.observed', { time: when, project: projectName ?? '' }) : t('launch.project.unobserved', { project: projectName ?? '' }))
      : (at ? t('launch.strip.estate', { time: when }) : t('launch.strip.estateNone'))
  return <FabricStrip text={text} onPulse={onPulse} />
}
/** The strip in one project's scope, when the caller already holds that project's newest event. */
export function ProjectStrip({ project, lastEventAt, onPulse }: {
  project: { name: string }
  lastEventAt: string | null
  onPulse?: () => void
}): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const text = lastEventAt
    ? t('launch.project.observed', { time: new Date(lastEventAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }), project: project.name })
    : t('launch.project.unobserved', { project: project.name })
  return <FabricStrip text={text} onPulse={onPulse} />
}
// #endregion fabric-strip
