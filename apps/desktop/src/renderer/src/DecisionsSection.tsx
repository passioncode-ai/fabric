// What has been decided here (M144).
//
// A LIST, AND THE PANEL SAYS WHY. The intake asked for a graph of decisions;
// the only edge the data can carry is one decision replacing another, and this
// estate has 44 decisions and none of them superseded. A node-and-edge diagram
// of zero edges is a picture of nothing.
//
// The lineage is rendered anyway, collapsed under whatever replaced it, because
// superseding is something the system can do TODAY and nobody has yet. When the
// first one lands this shows the history instead of quietly flattening it.

import { useEffect, useState } from 'react'
import type { Lineage, ProjectRow } from '../../shared/types'
import { EmptyState, Panel, Row, StateChip } from './components'
import { useT } from './i18n'
import { since } from './duration'
import type { DecisionList } from '../../shared/types'

export function DecisionsSection({
  project,
  feedMark,
  onError
}: {
  project: ProjectRow
  feedMark: number
  onError: (message: string) => void
}): React.JSX.Element {
  const t = useT()
  const [lineages, setLineages] = useState<Lineage[] | null>(null)
  /** Facts whose current version the read did not return. Computed from the
   *  same batch the lineages were built from, so the two cannot disagree. */
  const [orphans, setOrphans] = useState<{ ids: string[]; says: string }>({ ids: [], says: '' })
  /** Whether the batch these were built from was capped (M173). A lineage from
   *  a truncated read has holes it cannot see. */
  const [coverage, setCoverage] = useState<DecisionList['coverage'] | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const read = await window.fabric.decisions.list(project.id)
        if (alive) {
          setLineages(read.lineages)
          setCoverage(read.coverage)
          setOrphans(read.orphans)
        }
      } catch (e) {
        if (alive) onError(String(e))
      }
    })()
    return () => {
      alive = false
    }
  }, [project.id, feedMark])

  // M173 — FOUR ANSWERS, not two. This signed everything that was not a person
  // as an AGENT, so a decision recorded by the system — a projector, a
  // migration, the cycle — appeared on screen as an agent's, which is a false
  // attribution rather than a rounding.
  const who = (kind: string | null): string =>
    kind === 'person'
      ? t('decisions.by.person')
      : kind === 'agent'
        ? t('decisions.by.agent')
        : kind === 'system'
          ? t('decisions.by.system')
          : t('decisions.by.unknown')

  return (
    <Panel id="sec-decisions" title={t('decisions.title')}>
      <p className="muted">{t('decisions.lede')}</p>
      {(coverage?.truncated === true || coverage?.truncated === 'unknown') && (
        <p className="muted">{coverage.says}</p>
      )}
      {/* HISTORIES THAT ARE NOT HERE AT ALL (AX-06). A decision whose current
          version the read did not return forms no lineage, so it vanishes from
          this panel entirely — and a panel that lists nine complete histories
          while three are invisible reads as "these are the decisions". Said
          ONCE, against the batch, because that is the only level at which it is
          detectable: a missing predecessor is a row nobody returned. */}
      {orphans.ids.length > 0 && <p className="muted">{orphans.says}</p>}
      {lineages !== null && lineages.length === 0 && (
        <EmptyState read>{t('decisions.none')}</EmptyState>
      )}
      {(lineages ?? []).map((lineage) => (
        <div key={lineage.current.id} className="widget-list">
          <Row
            trail={
              <span className="muted">
                {who(lineage.current.actor_kind)} · {since(lineage.current.recorded_at, t)}
              </span>
            }
            lead={
              lineage.replaced.length > 0 ? (
                <StateChip tone="quiet">
                  {t('decisions.replaced', { count: lineage.replaced.length })}
                </StateChip>
              ) : undefined
            }
          >
            {lineage.current.claim}
            <span className="muted mono">
              {' '}
              {lineage.current.source_ref ?? t('decisions.noSource')}
            </span>
          </Row>
          {lineage.replaced.map((old) => (
            <Row key={old.id} quiet trail={<span className="muted">{since(old.recorded_at, t)}</span>}>
              {old.claim}
            </Row>
          ))}
          {/* ABOUT THIS CHAIN, and shown only when it has something to say. The
              depth bound is the one thing a lineage can know about its own
              incompleteness; everything else is a fact about the batch and is
              said once, above. */}
          {lineage.completeness.truncatedByDepth && (
            <p className="muted">{lineage.completeness.says}</p>
          )}
        </div>
      ))}
      <p className="muted">{t('decisions.notAGraph')}</p>
    </Panel>
  )
}
