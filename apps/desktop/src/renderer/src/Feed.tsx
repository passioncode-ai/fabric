import type { FeedEvent, ProjectRow } from '../../shared/types'
import type { EntityRef } from '../../shared/entityRef'
import { destinationOf } from '../../shared/entityRef.ts'
import { subjectOfEvent } from '../../shared/eventSubject.ts'
import { Button, EmptyState, Row } from './components'
import { describeEvent, useT } from './i18n'

export function Feed({
  events,
  projects,
  compact,
  onOpen
}: {
  /** Null until it has been read (M108). An empty array is the ANSWER "nothing
   *  has happened here", and a feed cannot tell the two apart from a prop. */
  events: FeedEvent[] | null
  projects: ProjectRow[]
  compact?: boolean
  /**
   * Where a row opens, when the caller has somewhere to send it (UXA-C06).
   *
   * OPTIONAL on purpose. SCN-026 promises a receipt link on every row, and this
   * component rendered a sentence and a number — no row opened anything. But
   * three of the four places that render a feed have no entity navigator to
   * hand over, and a control that cannot lead anywhere is worse than no
   * control: it teaches the operator that the row is not clickable at exactly
   * the moment it becomes clickable somewhere else.
   */
  onOpen?: (projectId: string, focus: EntityRef) => void
}): React.JSX.Element {
  const t = useT()
  const nameOf = (id: string | null): string =>
    id ? (projects.find((p) => p.id === id)?.name ?? id.slice(0, 8)) : '—'

  /**
   * The act for one row, or null and the reason there is none.
   *
   * TWO REFUSALS, and they are different questions. `subjectOfEvent` says what
   * the row is about — declared per event type from the code that writes it,
   * never guessed from a prefix. `destinationOf` then says whether any screen
   * can focus that ref, and it has four answers of which one is an address. A
   * row passes both or it is not a link.
   */
  const actFor = (e: FeedEvent): { ref: EntityRef; projectId: string } | { why: string } => {
    const subject = subjectOfEvent(e)
    if (!subject.known) return { why: subject.why }
    const to = destinationOf({ ref: subject.ref, projectId: e.project_id })
    return to.at === 'exact'
      ? { ref: to.focus, projectId: to.projectId }
      : { why: to.at === 'here' ? t('journal.subjectHere') : to.why }
  }

  return (
    <div className={`feed ${compact ? 'compact' : ''}`}>
      {(events?.length ?? 0) === 0 && (
        <EmptyState read={events !== null} waiting={t('journal.reading')}>
          {t('journal.empty')}
        </EmptyState>
      )}
      {[...(events ?? [])].reverse().map((e) => {
        const act = actFor(e)
        const openable = 'ref' in act && onOpen !== undefined
        return (
          <Row
            key={`${e.estate_id}:${e.seq}`}
            lead={`#${e.seq}`}
            trail={new Date(e.occurred_at).toLocaleTimeString()}
          >
            {/* The sentence, never the identifier. `title` keeps the raw type
                reachable for anyone debugging, without putting it on screen —
                and when there is no act it carries the REASON, so "this row is
                not a link" is answerable rather than merely observable. */}
            <span title={'why' in act ? `${e.type} — ${act.why}` : e.type}>
              {describeEvent(t, e.type)}
            </span>
            {!compact && <span className="muted"> {nameOf(e.project_id)}</span>}
            {openable && (
              <Button tone="ghost" onClick={() => onOpen(act.projectId, act.ref)}>
                {t('journal.open')}
              </Button>
            )}
          </Row>
        )
      })}
    </div>
  )
}
