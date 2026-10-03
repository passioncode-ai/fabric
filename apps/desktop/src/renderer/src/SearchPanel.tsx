// One field across every project (M141 · SCR-37).
//
// GROUPED, NEVER MERGED. Facts, decisions and transcripts carry a tsvector and are matched by
// words; projects and tasks have no index and are matched by substring. Each store returns its
// newest matches. A single list would imply one ordering across different matchers, and the reader
// would take its top as the best answer. Each group says how it was searched instead.
//
// AND "NOTHING MATCHES" IS A CLAIM. It is only made when every store answered.
// Where one stayed silent the panel says the question is not settled, which is
// the difference between looking everywhere and looking in two of three places.

import { useEffect, useState } from 'react'
import type { SearchGroup } from '../../shared/types'
import { SEARCH_SUBJECT, outcomeOf } from '../../shared/search.ts'
import { destinationOf, type EntityRef } from '../../shared/entityRef.ts'
import { Banner, Button, EmptyState, Field, Panel, Row, Toolbar } from './components'
import { useT } from './i18n'

export function SearchPanel({
  onClose,
  onOpen,
  onError
}: {
  onClose: () => void
  /** The EXACT thing that was clicked. This used to be `onOpenProject`, and a
   *  hit that knew its own id navigated to the project the id lived in and
   *  left the operator to find the row again. */
  onOpen: (projectId: string, ref: EntityRef) => void
  onError: (message: string) => void
}): React.JSX.Element {
  const t = useT()
  const [query, setQuery] = useState('')
  const [groups, setGroups] = useState<SearchGroup[] | null>(null)

  useEffect(() => {
    const text = query.trim()
    if (!text) {
      setGroups(null)
      return
    }
    let alive = true
    // Debounced, because every keystroke would otherwise run three queries
    // across the estate — and a search that fights the typist is worse than one
    // that waits a moment.
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const found = await window.fabric.search.run(text)
          if (alive) setGroups(found)
        } catch (e) {
          if (alive) onError(String(e))
        }
      })()
    }, 250)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [query])

  const outcome = groups ? outcomeOf(groups) : null

  return (
    <aside className="ceo-panel">
      <Panel
        title={t('search.title')}
        actions={
          <Toolbar align="end">
            <Button tone="ghost" onClick={onClose}>
              {t('search.close')}
            </Button>
          </Toolbar>
        }
      >
        <Field label={t('search.title')}>
          {(id) => (
            <input
              id={id}
              value={query}
              placeholder={t('search.placeholder')}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
        </Field>

        {outcome === null && <p className="muted">{t('search.idle')}</p>}
        {outcome?.state === 'found' && (
          <p className="muted">{t('search.found', { total: outcome.total })}</p>
        )}
        {outcome?.state === 'found' && outcome.partial && (
          <Banner tone="warn">{t('search.partial')}</Banner>
        )}
        {outcome?.state === 'nothing' && (
          <EmptyState read>
            {/* NAMED, not "in any store" (UX28-09). SCN-048 step 4 asks for
                the searched stores by name so that "nobody wrote it down"
                stays distinguishable from "not searched" — and the vaguer the
                sentence, the more it sounds like the first while meaning
                neither. Taken from the groups that ANSWERED, so a store that
                refused is never listed among the places we looked. */}
            {t('search.nothingIn', {
              // NO `problem === null` FILTER, and it was tried. `outcomeOf`
              // returns `'nothing'` only when no store is silent — "nothing
              // matches" needs every store to have answered — so by the time
              // this branch renders, every group has already answered. The
              // filter could not fire, and a guard that cannot fire reads as
              // the thing protecting you. The invariant lives in
              // `search.ts#outcomeOf` and its test.
              stores: (groups ?? [])
                .map((g) => t(`search.store.${g.store}` as 'search.store.facts'))
                .join(', ')
            })}
          </EmptyState>
        )}
        {outcome?.state === 'inconclusive' && (
          <Banner tone="warn">
            {t('search.inconclusive', { silent: outcome.silent.join(', ') })}
          </Banner>
        )}
        {/* Once, not once per group: it is one failure, and it is about the
            labels rather than about any store's answer. */}
        {(groups ?? []).find((g) => g.labelProblem) && (
          <Banner tone="warn">
            {t('search.noLabels', {
              reason: (groups ?? []).find((g) => g.labelProblem)!.labelProblem!
            })}
          </Banner>
        )}

        {(groups ?? []).map((group) => (
          <div key={group.store} className="widget-list">
            <h3 className="task-history-head">
              {t(`search.store.${group.store}` as 'search.store.facts')}
            </h3>
            {group.problem ? (
              <p className="muted">{t('search.unsearchable', { reason: group.problem })}</p>
            ) : (
              <>
                {group.method === 'substring' && (
                  <p className="muted">{t('search.method.substring')}</p>
                )}
                {group.hits.map((hit) => {
                  const ref: EntityRef = { kind: SEARCH_SUBJECT[group.store], id: hit.id }
                  const where = destinationOf({
                    ref,
                    projectId: hit.projectId,
                    // The hit carries its OWN project, so this call has always
                    // been right — and saying so makes the resolver's
                    // cross-project refusal active here rather than dormant
                    // (UX28-06).
                    owner: hit.projectId
                  })
                  return (
                    <Row
                      key={`${group.store}:${hit.id}`}
                      lead={<span className="muted">{hit.projectName ?? ''}</span>}
                      // Only the destinations that GO somewhere are clickable,
                      // and the ones that cannot say why beside the row rather
                      // than pretending with a click that lands on a project.
                      onClick={
                        where.at === 'exact'
                          ? () => onOpen(where.projectId, where.focus)
                          : where.at === 'project'
                            ? () => onOpen(where.projectId, ref)
                            : undefined
                      }
                      trail={
                        where.at === 'project' ? (
                          <span className="muted">{where.why}</span>
                        ) : undefined
                      }
                    >
                      {hit.text}
                    </Row>
                  )
                })}
                {/* The cut is named where the list is, not in a summary line
                    somebody has to go and find. */}
                {group.coverage.truncated !== false && (
                  <p className="muted">{group.coverage.says}</p>
                )}
              </>
            )}
          </div>
        ))}
      </Panel>
    </aside>
  )
}
