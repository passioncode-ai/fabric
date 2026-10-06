// #region digest-read — docs: docs/ux/screens.md#scr-31-project-page
/**
 * Reading the digest, and the boundary that reading may acknowledge (UX28-03).
 *
 * Extracted from the IPC handler for the reason the projector is a thin
 * dispatcher: the interesting part is a decision, and a decision inside a
 * handler can only be tested by standing up an Electron process. The handler is
 * now three lines and this function is drivable with a store.
 *
 * THE DEFECT THIS SHAPE REMOVES. The digest used to be read here and
 * acknowledged somewhere else — the renderer called `digest.seen(projectId)`
 * and the main process asked the journal for its CURRENT head. But the panel
 * re-reads whenever the journal mark moves, so an arriving event re-ran the
 * effect and the cleanup of the previous run acknowledged the head those very
 * events had just moved. The refresh acknowledged the news it was refreshing
 * for; the operator was shown "nothing new"; the events were gone.
 *
 * So the boundary travels WITH the payload. There is no longer a place in the
 * system where "now" can be substituted for "what was read".
 */

import { digestOf, type Digest, type DigestBoundary, type DigestInput } from '../shared/digest.ts'
import type { ScopedStore } from './scopedStore.ts'

/**
 * The real store's type, as `chainAdvance` takes it.
 *
 * A hand-written narrower interface was tried first and cost a `TS2589` at the
 * call site — but the reason to drop it is better than the error: a second
 * description of the store is a second thing to keep in step, and the probe
 * fakes the `db` underneath a REAL `createScopedStore` rather than faking the
 * store itself (R-007), so no narrower type is needed to test this.
 */
export type DigestStore = ScopedStore

/**
 * The journal head this reading is taken at, or null.
 *
 * NULL IS NOT ZERO. Zero would say "the operator has seen nothing", which is a
 * claim about a person; null is the absence of one, and nothing is
 * acknowledged for it. The alternative — asking again later and marking
 * whatever the answer is then — is the substitution this whole change removes.
 */
export async function boundaryOf(
  store: DigestStore,
  estateId: string
): Promise<{ boundary: DigestBoundary; problem: string | null }> {
  const head = await store
    .select('journal', 'seq')
    .eq('estate_id', estateId)
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (head.error) return { boundary: null, problem: String(head.error.message ?? head.error) }
  const seq = head.data?.seq
  return { boundary: typeof seq === 'number' ? seq : null, problem: null }
}

/**
 * Compose the digest for one project, with the boundary it may acknowledge.
 *
 * A failure in any of the four content reads THROWS: a digest assembled from
 * three of four stores would be a claim that nothing happened in the fourth,
 * which is the empty-answer-as-fact shape this repository has closed four times
 * elsewhere. A failure to read the HEAD does not throw — the digest is still
 * true, it simply cannot be acknowledged.
 */
export async function digestFor(
  store: DigestStore,
  estateId: string,
  projectId: string,
  since: number | null
): Promise<Digest> {
  const { boundary } = await boundaryOf(store, estateId)
  if (since === null) return { state: 'first-visit', boundary }

  // Every matching row, paged over a stable order (audit 2026-10-05 A4-003). One request each used
  // to be capped silently at the gateway's 1000 rows, and the boundary then acknowledged what was cut,
  // so news past the cap was lost for good. A read that cannot finish throws, as before.
  const after = [['seq', since]] as const
  const [decisions, corrections, reviews, sessions] = await Promise.all([
    store.selectAll('memory_facts', 'id,claim,recorded_at,seq', {
      eq: [['project_id', projectId], ['kind', 'decision']], gt: after, orderBy: ['seq', 'id']
    }),
    // A CORRECTION THAT LANDED. There is no `supersedes` column, and this read
    // selected one until the release review of 2026-10-03 found it as the
    // banner on the operator's first project: migration 50 keeps what was
    // ASKED (`supersedes_requested`) apart from what HAPPENED
    // (`correction_outcome`), and only `superseded` means the earlier fact was
    // closed. A refused burial is a conflict standing beside the fact, not a
    // correction of it. `read-schema-db.test.mjs` runs this query against the
    // migrated schema so the column list cannot drift from it again.
    store.selectAll('memory_facts', 'id,claim,recorded_at,seq,supersedes:supersedes_requested', {
      eq: [['project_id', projectId], ['correction_outcome', 'superseded']], gt: after, orderBy: ['seq', 'id']
    }),
    store.selectAll('project_tasks', 'id,title,instruction,started_at,seq', {
      eq: [['project_id', projectId], ['status', 'review']], gt: after, orderBy: ['seq', 'id']
    }),
    store.selectAll('session_transcripts', 'session_id,annotation,ended_at,captured_at,ending_provenance,seq', {
      eq: [['project_id', projectId]], gt: after, orderBy: ['seq', 'session_id']
    })
  ])
  for (const r of [decisions, corrections, reviews, sessions])
    if (r.failed) throw new Error(`the digest could not be read: ${r.failed}`)

  return digestOf(
    {
      decisions: decisions.rows as DigestInput['decisions'],
      corrections: corrections.rows as DigestInput['corrections'],
      reviews: reviews.rows.map((t: Record<string, unknown>) => ({
        id: t.id as string,
        title: t.title as string | null,
        instruction: t.instruction as string,
        at: t.started_at as string,
        seq: t.seq as number
      })),
      sessions: sessions.rows as DigestInput['sessions']
    },
    since,
    boundary
  )
}
// #endregion digest-read
