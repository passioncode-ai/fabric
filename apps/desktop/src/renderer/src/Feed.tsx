import type { FeedEvent, ProjectRow } from '../../shared/types'
import type { DestinationReason, EntityRef } from '../../shared/entityRef'
import { destinationOf } from '../../shared/entityRef.ts'
import { subjectOfEvent } from '../../shared/eventSubject.ts'
import { Button, EmptyState, Row } from './components'
import { describeEvent, useLocale, useT, type Translate } from './i18n'

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
  const locale = useLocale()
  const nameOf = (id: string | null): string =>
    // No dash on screen for an event with no project (0.3.11 review, iteration 2, UX-7): the place says so in words.
    id ? (projects.find((p) => p.id === id)?.name ?? id.slice(0, 8)) : t('launch.home.agents.noProject')

  const actFor = (e: FeedEvent) => feedAct(e, t)

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
            // The Open action sits with the time at the row's end, not glued to the sentence it opens.
            trail={
              <span className="row-trail-acts">
                {openable && (
                  <Button tone="ghost" onClick={() => onOpen(act.projectId, act.ref)}>
                    {t('journal.open')}
                  </Button>
                )}
                {new Date(e.occurred_at).toLocaleTimeString(locale)}
              </span>
            }
          >
            {/* The sentence, never the identifier: the raw type stays in a data
                attribute for anyone debugging, never in what a person reads. When
                there is no act and the feed opens things, the row says WHY it is not
                a link as text, so a keyboard or a screen reader reaches it too, not
                only a pointer hovering a tooltip (0.3.13 review, iteration 1, UX-10). */}
            <span data-event-type={e.type} title={'why' in act ? act.why : undefined}>
              {describeEvent(t, e.type)}
            </span>
            {'why' in act && onOpen !== undefined && (
              <small className={compact ? 'feed-why visually-hidden' : 'feed-why muted'}> {act.why}</small>
            )}
            {!compact && <span className="muted"> {nameOf(e.project_id)}</span>}
          </Row>
        )
      })}
    </div>
  )
}

/**
 * The act for one feed row, or the reason there is none. Shared by the journal feed and История's «Что делали агенты»
 * (CO-395), so a row opens the same place wherever it is read.
 *
 * TWO REFUSALS, and they are different questions. `subjectOfEvent` says what the row is about — declared per event
 * type from the code that writes it, never guessed from a prefix. `destinationOf` then says whether any screen can
 * focus that ref, and it has four answers of which one is an address. A row passes both or it is not a link.
 */
const SUBJECT_WHY = {
  undeclared: 'journal.whyUndeclared',
  'missing-key': 'journal.whyMissingKey'
} as const satisfies Record<'undeclared' | 'missing-key', string>

const DESTINATION_WHY = {
  'other-project': 'journal.whyOtherProject',
  'task-no-project': 'journal.whyTaskNoProject',
  'work-not-task': 'journal.whyWorkNotTask',
  'fact-no-page': 'journal.whyFactNoPage',
  'transcript-from-session': 'journal.whyTranscriptFromSession'
} as const satisfies Record<DestinationReason, string>

export function feedAct(e: FeedEvent, t: Translate): { ref: EntityRef; projectId: string } | { why: string } {
  // The reason is said in the interface's language (CO-225 (5)); the English `why` stays for logs.
  const subject = subjectOfEvent(e)
  if (!subject.known) return { why: t(SUBJECT_WHY[subject.reason]) }
  const to = destinationOf({ ref: subject.ref, projectId: e.project_id })
  return to.at === 'exact'
    ? { ref: to.focus, projectId: to.projectId }
    : { why: to.at === 'here' ? t('journal.subjectHere') : t(DESTINATION_WHY[to.reason]) }
}
