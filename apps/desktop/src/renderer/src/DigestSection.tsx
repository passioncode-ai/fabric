// Where we left off (M133), at the top of the project page.
//
// COMPOSED, NOT GENERATED. Every line is a row that exists, and the chip says
// which store it came from. A summary written by a model would be a claim about
// the project rather than a reading of it — and there is no model here, which
// is the same place the CEO panel arrived at: where one is missing, build the
// half that needs none.
//
// THE MARK ADVANCES WHEN THE OPERATOR LEAVES, not when they arrive. Returning
// shows what they missed; returning twice shows nothing, which is correct —
// they just saw it. The project page is remounted per project (UX-01), so
// unmount IS leaving.
//
// AND IT ADVANCES TO WHAT WAS SHOWN, which is the part that was wrong
// (UX28-03). `digest.seen(projectId)` used to ask the journal for its head at
// the moment of leaving. This panel re-reads whenever the mark moves, so an
// arriving event re-ran the effect and the cleanup of the previous run marked
// the head those very events had just moved: THE REFRESH ACKNOWLEDGED THE NEWS
// IT WAS REFRESHING FOR, the operator was shown "nothing new", and the events
// were gone for good. Every step behaved as designed.
//
// Two things make that unreachable rather than merely fixed:
//
//  * A reading carries the journal head it was TAKEN AT, and that number is
//    what is acknowledged. The renderer no longer has a way to name "now".
//  * The boundary is remembered only for a payload that reached the screen, so
//    a read that failed has nothing to acknowledge and a refresh cannot reach
//    past what it displayed.
//
// OPENING A TASK COUNTS AS LEAVING, and the card asks for that to be decided
// rather than inherited: `ProjectHome` renders this panel only when no task is
// open, so opening one unmounts it. The operator saw the lines that were on
// screen, so acknowledging exactly those is correct — and coming back shows
// what arrived while the task was open, which is the behaviour the panel
// promises.
//
// A FAILED REFRESH KEEPS THE OLD DIGEST, deliberately, and says how old it is.
// This is the opposite of `keyedRead`'s default — which drops the payload so a
// stale answer cannot pose as current — and `keyedRead.ts` says why the two can
// both be right: a surface that wants to keep showing something old must hold
// it on purpose and LABEL it. News nobody has read is worth keeping on screen;
// what would not be worth having is showing it unlabelled.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Digest, DigestBoundary, ProjectRow } from '../../shared/types'
import { Button, EmptyState, Panel, Row, StateChip } from './components'
import { useT } from './i18n'
import { since } from './duration'

/** The last reading that reached the screen, with when it did. */
interface Shown {
  digest: Digest
  at: number
}

export function DigestSection({
  project,
  feedMark,
  onError
}: {
  project: ProjectRow
  /** The journal's high-water mark. Without it this panel reads once and then
   *  disagrees with the board beside it — one screen showing the same estate at
   *  two different times (audit, 2026-09-05). */
  feedMark: number
  onError: (message: string) => void
}): React.JSX.Element {
  const t = useT()
  const [shown, setShown] = useState<Shown | null>(null)
  /** Why the last attempt failed, with the previous reading still on screen. */
  const [staleWhy, setStaleWhy] = useState<string | null>(null)
  /** Nothing has ever been shown AND the read failed. Different from empty. */
  const [failedWhy, setFailedWhy] = useState<string | null>(null)
  /** Bumped by the retry, so it re-reads without touching the feed mark. */
  const [attempt, setAttempt] = useState(0)

  /**
   * The boundary of the payload currently on screen.
   *
   * A ref rather than state because the cleanup must read it at the moment it
   * runs: state captured in the effect's closure would be the value from the
   * render that STARTED the effect, which is exactly the stale-by-one-render
   * mistake this card is about. Written only after `setShown`, so a boundary
   * exists only for a reading that was displayed.
   */
  const displayed = useRef<DigestBoundary>(null)

  const read = useCallback(async (): Promise<void> => {
    const at = project.id
    try {
      const answer = await window.fabric.digest.read(at)
      // The project may have changed while this was in flight; a reading for
      // the project just left must not be displayed OR acknowledged.
      if (at !== project.id) return
      setShown({ digest: answer, at: Date.now() })
      setStaleWhy(null)
      setFailedWhy(null)
      displayed.current = answer.boundary
    } catch (e) {
      if (at !== project.id) return
      // Which of the two failures this is depends on whether anything is on
      // screen to keep, and the panel says a different thing for each.
      if (displayed.current === null && !shown) setFailedWhy(String(e))
      else setStaleWhy(String(e))
      onError(String(e))
    }
  }, [project.id, shown, onError])

  useEffect(() => {
    void read()
    return () => {
      // Leaving. Everything that was SHOWN has now been seen — and nothing
      // else. A boundary the journal could not supply is not a boundary: the
      // old code asked the journal again here, which is how "nothing was
      // readable" became "mark whatever has happened by now".
      const boundary = displayed.current
      if (boundary !== null) void window.fabric.digest.seen(project.id, boundary)
    }
    // `read` is intentionally not a dependency: it changes with `shown`, and
    // depending on it would re-read on every answer — and acknowledge on every
    // answer with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, feedMark, attempt])

  const tone = (kind: string): 'info' | 'warn' | 'quiet' =>
    kind === 'review' ? 'warn' : kind === 'decision' ? 'info' : 'quiet'

  const digest = shown?.digest ?? null
  const retry = (
    <Button tone="ghost" data-testid="digest-retry" onClick={() => setAttempt((n) => n + 1)}>
      {t('digest.retry')}
    </Button>
  )

  return (
    <Panel id="sec-digest" title={t('digest.title')}>
      <p className="muted">{t('digest.lede')}</p>

      {/* A refresh that failed with something worth keeping on screen. The age
          is the point: "four minutes old" and "current" are different claims,
          and a panel that makes the second when the first is true is lying in
          the one way this product cannot afford. */}
      {staleWhy !== null && shown && (
        <p className="read-failed" data-testid="digest-stale">
          {t('digest.stale', { age: since(new Date(shown.at).toISOString()), why: staleWhy })} {retry}
        </p>
      )}

      {/* Nothing has ever been shown and the read was refused. NOT the empty
          state: never having looked and having looked and been refused are two
          different answers about the same panel. */}
      {failedWhy !== null && (
        <p className="read-failed" data-testid="digest-failed">
          {t('reads.failed', { why: failedWhy })} {retry}
        </p>
      )}

      {digest?.state === 'first-visit' && <EmptyState read>{t('digest.firstVisit')}</EmptyState>}
      {digest?.state === 'nothing-new' && <EmptyState read>{t('digest.nothingNew')}</EmptyState>}
      {/* Nothing read YET, and nothing refused. The waiting line matters: with
          no `waiting` prop `EmptyState` renders an empty paragraph, so the
          panel said nothing at all while the first read was in flight and an
          operator could not tell it apart from "nothing has happened here".
          It is also what makes the `failedWhy` guard load-bearing rather than
          cosmetic — without it, "reading…" would sit under a failure line. */}
      {digest === null && failedWhy === null && (
        <EmptyState read={false} waiting={t('digest.reading')}>
          {t('digest.nothingNew')}
        </EmptyState>
      )}
      {digest?.state === 'lines' &&
        digest.lines.map((line) => (
          <Row
            key={`${line.source.store}:${line.source.id}`}
            lead={
              <StateChip tone={tone(line.kind)}>
                {t(`digest.kind.${line.kind}` as 'digest.kind.decision')}
              </StateChip>
            }
            trail={<span className="muted">{line.at && Number.isFinite(Date.parse(line.at)) ? t('digest.ago', { time: since(line.at, t) }) : t('digest.timeUnknown')}</span>}
          >
            {line.text}
          </Row>
        ))}
    </Panel>
  )
}
