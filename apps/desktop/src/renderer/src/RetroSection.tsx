// The drawer findings have been going into, finally opened (M154 · SCR-33).
//
// MEASURED: `kind: 'finding' | 'trap'` has been written since M149 and by note
// promotion since M52, and nothing reads it. The memory list renders every fact
// identically — no filter, no lineage, no way to ask "has this happened
// before". This is the reading half.
//
// THREE THINGS THE OBVIOUS VERSION WOULD SAY AND MUST NOT.
//
//   "no source"        — for a source nobody has tried to open. The reader is
//                        told nobody looked, and given the act that looks.
//   "happened once"    — for a lesson whose occurrence relation failed to read.
//                        Unknown is the answer; once is a claim our own outage
//                        produced (`retroView.ts`).
//   nothing at all     — for a refused correction. A claim standing beside an
//                        earlier one IS the disagreement, and hiding it leaves
//                        two contradicting facts looking independent.
//
// AND THE SOURCE OPENS. `source_ref: 'task:<uuid>'` has been written for
// months and rendered as a bare uuid at a person; it resolves through S13's
// `destinationOf`, so this screen grew no second resolver.

import { useEffect, useState } from 'react'
import type { ReadEnvelope } from '../../shared/readEnvelope'
import {
  RETRO_KINDS,
  describeRecurrence,
  evidenceOpens,
  isCurrent,
  type RetroItem,
  type RetroKind,
  type RetroPage,
  type RetroState
} from '../../shared/retroView.ts'
import { INSIGHT_CATEGORIES, type InsightCategory } from '../../shared/memoryContract.ts'
import { destinationOf, type EntityRef } from '../../shared/entityRef.ts'
import { Banner, Button, EmptyState, Field, Panel, Row, StateChip, Toolbar } from './components'
import { useT } from './i18n'
import { since } from './duration'

export function RetroSection({
  projectId,
  feedMark,
  onOpen,
  onError
}: {
  projectId: string | null
  feedMark: number
  /** Where a source goes. The resolver decides whether there IS anywhere. */
  onOpen: (projectId: string, ref: EntityRef) => void
  onError: (message: string) => void
}): React.JSX.Element {
  const t = useT()
  /** Null until read (M108): "no findings here" said before asking is a claim
   *  about the project made by a screen that has not looked. */
  const [page, setPage] = useState<ReadEnvelope<RetroPage> | null>(null)
  const [kinds, setKinds] = useState<RetroKind[]>(['finding', 'trap'])
  const [category, setCategory] = useState<InsightCategory | null>(null)
  const [state, setState] = useState<RetroState>('current')
  const [cursor, setCursor] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const got = await window.fabric.memory.retro({
          kinds,
          categories: category ? [category] : [],
          projectId,
          state,
          cursor
        })
        if (alive) setPage(got)
      } catch (e) {
        if (alive) onError(String(e))
      }
    })()
    return () => {
      alive = false
    }
  }, [projectId, kinds, category, state, cursor, feedMark])

  // Changing the question puts the reader back at the top of it. Keeping the
  // cursor would ask the new question from the old question's position, which
  // the reader has no way to notice — the reason `checkCursor` refuses it.
  const ask = (change: () => void): void => {
    setCursor(null)
    change()
  }

  const failed = (page?.sources ?? []).filter((s) => s.status === 'error')
  const items = page?.data?.items ?? []

  return (
    <Panel id="sec-retro" title={t('retro.title')}>
      <p className="muted">{t('retro.lede')}</p>

      {/* Each failed source NAMED. A retro built on a refused read that says
          nothing is the shape this whole card exists to close. */}
      {failed.length > 0 && (
        <Banner tone="warn">
          {t('retro.partial', {
            sources: failed.map((s) => `${s.name} (${s.errorCode ?? 'no reason given'})`).join(', ')
          })}
        </Banner>
      )}

      <Toolbar>
        <Field label={t('retro.kind')}>
          {(id) => (
            <select
              id={id}
              value={kinds.length === 1 ? kinds[0] : kinds.length === 0 ? '' : 'lessons'}
              onChange={(e) =>
                ask(() =>
                  setKinds(
                    e.target.value === ''
                      ? []
                      : e.target.value === 'lessons'
                        ? ['finding', 'trap']
                        : [e.target.value as RetroKind]
                  )
                )
              }
            >
              <option value="lessons">{t('retro.kind.lessons')}</option>
              <option value="">{t('retro.kind.all')}</option>
              {RETRO_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`retro.kind.${k}` as 'retro.kind.finding')}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t('memory.category')}>
          {(id) => (
            <select
              id={id}
              value={category ?? ''}
              onChange={(e) => ask(() => setCategory((e.target.value || null) as InsightCategory | null))}
            >
              <option value="">{t('memory.categoryAll')}</option>
              {INSIGHT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`memory.category.${c}` as 'memory.category.project')}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t('retro.state')}>
          {(id) => (
            <select
              id={id}
              value={state}
              onChange={(e) => ask(() => setState(e.target.value as RetroState))}
            >
              <option value="current">{t('retro.state.current')}</option>
              <option value="history">{t('retro.state.history')}</option>
              <option value="all">{t('retro.state.all')}</option>
            </select>
          )}
        </Field>
      </Toolbar>

      {page !== null && items.length === 0 && (
        // `read` is TRUE either way — we did look. What changes is the
        // sentence: "nothing has been recorded" is a claim about the project
        // and may only be made when every source answered. Passing
        // `read={false}` here would have rendered the `waiting` slot, which is
        // empty, so a failed read showed a blank panel — caught by the test
        // that asserts the sentence rather than the absence of one.
        <EmptyState read>{failed.length === 0 ? t('retro.none') : t('retro.noneUnread')}</EmptyState>
      )}

      {items.map((item) => (
        <RetroRow key={item.factRef} item={item} projectId={projectId} onOpen={onOpen} />
      ))}

      {page?.data?.nextCursor && (
        <Button tone="ghost" onClick={() => setCursor(page.data!.nextCursor)}>
          {t('retro.more')}
        </Button>
      )}
    </Panel>
  )
}

function RetroRow({
  item,
  projectId,
  onOpen
}: {
  item: RetroItem
  /** Where the operator IS — the row's context, and not evidence about the
   *  source's project. The two were one argument until UX28-06. */
  projectId: string | null
  onOpen: (projectId: string, ref: EntityRef) => void
}): React.JSX.Element {
  const t = useT()
  /**
   * TWO PROJECTS, AND THEY ARE DIFFERENT FACTS (UX28-06).
   *
   * `projectId` is where this row is being READ. The source's own project comes
   * from the read, via one bounded lookup. They used to be the same argument,
   * which asserted that a fact's `source_ref` belongs to the project the fact
   * was read in — and a `source_ref` may name a task recorded anywhere, so a
   * source from another project opened inside this one.
   *
   * NO OWNER, NO OFFER. An unknown owner is honest and common — the lookup
   * failed, or the source names something the store cannot place — and this row
   * declines rather than falling back on the page's project, because that
   * fallback IS the defect. The resolver refuses a mismatch as well, which is
   * the second line rather than the only one: passing the owner as BOTH
   * arguments made its check unreachable and would have opened the other
   * project, which is the same defect wearing a fix.
   */
  const where =
    item.evidence.ref && item.evidence.owner !== null
      ? destinationOf({
          ref: item.evidence.ref,
          projectId,
          owner: item.evidence.owner
        })
      : null

  return (
    <div className="widget-list">
      <Row
        lead={
          <StateChip tone={item.kind === 'trap' ? 'danger' : 'warn'}>
            {t(`retro.kind.${item.kind}` as 'retro.kind.finding')}
          </StateChip>
        }
        trail={
          <span className="muted">
            {item.category !== 'project' && (
              <>
                {t(`memory.category.${item.category}` as 'memory.category.project')} ·{' '}
              </>
            )}
            {since(item.recordedAt, t)}
          </span>
        }
        quiet={!isCurrent(item)}
      >
        {/* History is struck through by MEANING: it is no longer what the
            project believes, and `<s>` says that to a reader who cannot see
            the colour. */}
        {isCurrent(item) ? item.claim : <s>{item.claim}</s>}
      </Row>

      {/* HOW OFTEN — and never a number produced by a failed read. */}
      <p className="muted">{describeRecurrence(item.recurrence)}</p>

      {/* THE SOURCE, and what is actually known about it. */}
      <p className="muted">
        {item.evidence.raw === null ? (
          t('retro.noSource')
        ) : (
          <>
            <span className="mono">{item.evidence.raw}</span>
            {item.evidence.says && <> — {item.evidence.says}</>}
            {/* THE ACT THE EVIDENCE NAMES, not a boolean over its status
                (AX-11). `evidenceOf` computes four different answers — open,
                locate, retry, and none — and `action` was read by nothing: the
                screen split on `evidenceOpens` and offered a button in BOTH
                branches, so a source recorded as REMOVED, and one the operator
                may not read, each got a "try to open" beside the module's own
                sentence saying it cannot work. `null` is an answer here, and
                offering an act over it is what teaches a reader to ignore the
                sentence. */}
            {where?.at === 'exact' && item.evidence.action !== null && (
              <Button tone="ghost" onClick={() => onOpen(where.projectId, where.focus)}>
                {item.evidence.action === 'open'
                  ? evidenceOpens(item.evidence)
                    ? t('retro.openSource')
                    : t('retro.tryOpen')
                  : item.evidence.action === 'locate'
                    ? t('retro.locateSource')
                    : t('retro.retrySource')}
              </Button>
            )}
            {where?.at === 'project' && <> — {where.why}</>}
            {/* IN PLACE, with the raw ref above it and the reason beside it:
                not dropped, not a jump to something else. A row that cannot be
                opened is still the only provenance the reader has. */}
            {where?.at === 'unaddressable' && <> — {where.why}</>}
          </>
        )}
      </p>

      {/* A REFUSED correction is the disagreement itself. Without this the two
          claims read as independent observations (M182). */}
      {item.conflict && (
        <p className="muted">
          <StateChip tone="warn">{t('memory.conflictMark')}</StateChip>{' '}
          {item.conflict.reason ?? t('retro.conflictNoReason')}
        </p>
      )}

      {/* Two-way, so a history row is not a dead end. */}
      {item.supersededBy && <p className="muted">{t('retro.correctedBy')}</p>}
      {item.supersedes && isCurrent(item) && <p className="muted">{t('retro.corrects')}</p>}
    </div>
  )
}
