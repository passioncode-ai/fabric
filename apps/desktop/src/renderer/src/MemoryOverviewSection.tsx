// What this project remembers (M135 · SCR-34).
//
// The stores have existed since M44–M49 and nothing ever showed what was in
// them: an operator could not answer "does memory work here" except by asking
// an agent and believing the answer.
//
// THE MISSES ARE THE POINT, and they are given their own panel rather than a
// number in a corner. A memory screen that shows only what it HOLDS is exactly
// the screen that cannot answer the question, and the queries that came back
// empty are a list of things nobody has written down yet.
//
// Every count says whether it could be READ. A store that failed shows its
// problem rather than a zero — the rule IMP-04 put on the agent surface, and it
// matters more here, because a confident zero in front of a person is more
// convincing than one in front of an agent.

import { useEffect, useState } from 'react'
import type { MemoryMiss, MemoryOverview, ProjectRow } from '../../shared/types'
import { fullyRead, missRate, type StoreCount } from '../../shared/memoryOverview.ts'
import { Banner, Button, EmptyState, Panel, Row, Stat, StatStrip } from './components'
import { useT } from './i18n'
import { go } from './evidence'
import { since } from './duration'

/** Loading, loaded, or failed — per source, so one failure cannot erase the
 *  other's answer. */
type Loaded<T> = { state: 'loading' } | { state: 'ok'; value: T } | { state: 'error'; message: string }

/** The database's own words where there are any. Never a stack. */
function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/**
 * One source, resolved into its own state.
 *
 * A module-level `function` rather than a generic arrow inside the component:
 * in a `.tsx` file `<T,>(…)` is ambiguous with JSX, and the interface-string
 * gate reads the parameter list as literal text on the screen.
 */
function load<T>(
  work: Promise<T>,
  set: (next: Loaded<T>) => void,
  alive: () => boolean
): void {
  set({ state: 'loading' })
  void work.then(
    (value) => alive() && set({ state: 'ok', value }),
    (e: unknown) => alive() && set({ state: 'error', message: message(e) })
  )
}

export function MemoryOverviewSection({
  project,
  feedMark,
}: {
  project: ProjectRow
  /** The journal's high-water mark. Without it this panel reads once and then
   *  disagrees with the board beside it — one screen showing the same estate at
   *  two different times (audit, 2026-09-05). */
  feedMark: number
}): React.JSX.Element {
  const t = useT()
  // ONE STATE PER SOURCE (S14). Both used to arrive through a single
  // `Promise.all`, so a `misses` query that threw discarded an `overview` that
  // had already come back — five counted facts taken off the screen by a
  // failure in the query beside them.
  const [overview, setOverview] = useState<Loaded<MemoryOverview>>({ state: 'loading' })
  const [misses, setMisses] = useState<Loaded<MemoryMiss[]>>({ state: 'loading' })
  /** Bumped by a retry, so the effect re-runs without touching the feed mark. */
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    // `alive` still guards the project switch: the cleanup runs before the next
    // effect, so a late response for the previous project is dropped.
    load(window.fabric.memory.overview(project.id), setOverview, () => alive)
    load(window.fabric.memory.misses(project.id), setMisses, () => alive)
    return () => {
      alive = false
    }
  }, [project.id, feedMark, attempt])

  /**
   * THREE ANSWERS, not two (UX28-07).
   *
   * A number is a measurement. `rows: null` WITH a problem is a refusal, and it
   * names the reason. `rows: null` with NO problem is a store nobody has asked
   * about — and it used to render identically to a refusal with an empty
   * reason, which read as a broken store rather than an unasked one. An
   * operator asking "does memory work here" needs the three apart.
   */
  const value = (store: StoreCount): string => {
    if (store.rows !== null) return String(store.rows)
    return store.problem === null
      ? t('memory.notRead')
      : t('memory.unreadable', { reason: store.problem })
  }

  /**
   * WHEN the counts were taken.
   *
   * A count with no age is as old as whenever it was read and reads as now —
   * the card's own negative acceptance: a stale source cannot present a current
   * count. Taken from the freshest store that answered, because a strip of six
   * figures read in one pass has one age.
   */
  const takenAt = (o: MemoryOverview): string | null =>
    Object.values(o)
      .map((s: StoreCount) => s.asOf)
      .filter((a): a is string => a !== null)
      .sort()
      .at(-1) ?? null

  const counts = overview.state === 'ok' ? overview.value : null
  const rate = counts ? missRate(counts.retrievals, counts.misses) : null
  const retry = (
    <Button tone="ghost" onClick={() => setAttempt((a) => a + 1)}>
      {t('common.retry')}
    </Button>
  )

  return (
    <>
      <Panel id="sec-memory-overview" title={t('memory.overview')}>
        <p className="muted">{t('memory.overviewLede')}</p>
        {counts && !fullyRead(counts) && <Banner tone="warn">{t('memory.partial')}</Banner>}
        {counts && takenAt(counts) !== null && (
          <p className="muted" data-testid="memory-counts-age">
            {t('memory.countsAge', { age: since(takenAt(counts) as string, t) })}
          </p>
        )}
        {counts ? (
          <>
            <StatStrip>
              {/* M142 — a figure opens the register it was counted from. THREE
                  of these six can: the three that cannot are left UNPRESSABLE
                  and name nothing, because a number promising a screen that
                  does not exist is the defect this rule is about, relocated.
                  It said four, and the fourth was wrong rather than missing
                  (S13) — see the corrected count below. */}
              <Stat
                label={t('memory.store.facts')}
                value={value(counts.facts)}
                onClick={go('sec-memory')}
              />
              {/* MEASURED, and it did not reach what it counted. This opened
                  `sec-decisions`, on the reasoning that a corrected fact is a
                  decision — most are not, and the decisions register does not
                  contain them. `sec-memory` does hold them, struck through and
                  marked "corrected since" — but only when its own
                  `showSuperseded` toggle is on, and it defaults to off
                  (`ProjectHome.tsx#sec-memory`). So both candidate anchors
                  scroll to a screen that does not show this number, which is
                  precisely the defect the rule above names. Unpressable until
                  there is somewhere to land. */}
              <Stat label={t('memory.store.superseded')} value={value(counts.superseded)} />
              {/* No surface lists retrievals — only the MISSES among them. */}
              <Stat label={t('memory.store.retrievals')} value={value(counts.retrievals)} />
              <Stat
                label={t('memory.store.misses')}
                value={value(counts.misses)}
                onClick={go('sec-memory-misses')}
              />
              <Stat
                label={t('memory.store.transcripts')}
                value={value(counts.transcripts)}
                onClick={go('sec-transcripts')}
              />
              {/* Context packs are compiled per session and have no screen. */}
              <Stat label={t('memory.store.packs')} value={value(counts.packs)} />
            </StatStrip>
            <p className="muted">
              {rate?.known
                ? t('memory.rate', { percent: rate.percent, of: rate.of })
                : rate?.because === 'never-asked'
                  ? t('memory.rateNeverAsked')
                  : t('memory.rateUnreadable')}
            </p>
          </>
        ) : overview.state === 'error' ? (
          // NOT an empty state. "The counts are zero" and "the counts could not
          // be read" are different facts, and the panel used to render the
          // second as the first.
          <Banner tone="error" actions={retry}>
            {t('memory.overviewUnreadable', { reason: overview.message })}
          </Banner>
        ) : (
          <EmptyState read={false}>{t('memory.loading')}</EmptyState>
        )}
      </Panel>

      <Panel id="sec-memory-misses" title={t('memory.missesTitle')}>
        <p className="muted">{t('memory.missesLede')}</p>
        {misses.state === 'error' && (
          <Banner tone="error" actions={retry}>
            {t('memory.missesUnreadable', { reason: misses.message })}
          </Banner>
        )}
        {misses.state === 'loading' && <EmptyState read={false}>{t('memory.loading')}</EmptyState>}
        {misses.state === 'ok' && misses.value.length === 0 && (
          <EmptyState read>{t('memory.noMisses')}</EmptyState>
        )}
        {(misses.state === 'ok' ? misses.value : []).map((miss) => (
          <Row
            key={`${miss.store}:${miss.askedAt}:${miss.query}`}
            lead={<span className="mono">{miss.store}</span>}
            trail={
              <span className="muted">
                {t('memory.missAsked', { time: since(miss.askedAt, t) })} ·{' '}
                {miss.bySession ? t('memory.askedByAgent') : t('memory.askedByOperator')}
              </span>
            }
          >
            {miss.query}
          </Row>
        ))}
      </Panel>
    </>
  )
}
