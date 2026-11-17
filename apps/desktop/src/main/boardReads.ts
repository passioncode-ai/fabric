// #region board-reads — docs: docs/evidence/plans/2026-11-16-screens-waves.md#s2--the-boards-protocol-code-next
/**
 * The Board's three reads (SCR-41): what waits on the person, what was answered and what was set aside for next time.
 * Moved out of index.ts on 2026-11-16 (the screens waves, S2) with an explicit deps object; behaviour unchanged. Every
 * read answers an envelope with one receipt per source, so a failed read is said rather than shown as an empty board.
 */
import type { createScopedStore } from './scopedStore.ts'
import { boardEntries, cutBoard, forPerson, scopeBoard, type BoardCut, type BoardQuestion } from '../shared/board.ts'
import { deferredEntries, resolvedEntries, type DeferredEntry, type ResolvedEntry } from '../shared/boardResolved.ts'
import { envelope, type Omission, type ReadEnvelope, type SourceReceipt } from '../shared/readEnvelope.ts'
import { projectWeight, type ProjectSignals } from '../shared/projectWeight.ts'
import type { AttentionItem } from '../shared/types.ts'

type Store = ReturnType<typeof createScopedStore>

export interface BoardReadDeps {
  store: Store
  estateId: string
  /** The obligations beside the questions (reviews, proposals, access), each source with its own receipt. */
  attention(stamp: string): Promise<{ items: AttentionItem[]; sources: SourceReceipt[]; omitted?: Omission[] }>
  now?: () => Date
  /** A part of the read that failed without failing the board (the askers' names, DA-1), for the operations log. */
  failed?: (op: string, error: unknown) => void
}

/** `work_claims.owner_session` is a uuid: an asker id of another shape (a remote run's question, `dispatch-run:<launch>`)
 *  names no session there, and one such id in the list would make the database refuse the whole read (0.3.22, DA-1). */
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function createBoardReads(deps: BoardReadDeps): {
  board(projectId: string | null, limit: number, personOnly?: boolean): Promise<ReadEnvelope<BoardCut>>
  resolved(projectId: string | null, limit: number): Promise<ReadEnvelope<ResolvedEntry[]>>
  deferred(projectId: string | null, limit: number): Promise<ReadEnvelope<DeferredEntry[]>>
} {
  const readBoard = async (
    projectId: string | null,
    limit: number,
    /** CO-391: only what a person can resolve (`forPerson`: `PERSON_KINDS` and, since CO-456, the oldest overdue reviews), as the home's «Нужны вы» shows. */
    personOnly = false
  ): Promise<ReadEnvelope<BoardCut>> => {
    const now = (deps.now ?? (() => new Date()))()
    const stamp = now.toISOString()
    const [obligations, questionRead, blockRead, projectRead, deferralRead] = await Promise.all([
      deps.attention(stamp),
      deps.store
        .select('questions', 'id,project_id,text,why_blocked,kind,asked_at,status,revision,options,asked_by_kind,asked_by_id')
        .eq('estate_id', deps.estateId)
        .eq('status', 'open'),
      deps.store.select('question_blocks', 'question_id').eq('estate_id', deps.estateId),
      deps.store.select('projects', 'id,name,priority_tier').eq('estate_id', deps.estateId),
      // SCR-41 L3b: set aside for next time is not waiting on you now. Its own receipt, so a
      // failed read of the deferrals is said rather than silently showing them as current.
      deps.store.select('question_deferrals', 'question_id').eq('estate_id', deps.estateId)
    ])
    const setAside = new Set((deferralRead.data ?? []).map((d) => d.question_id as string))

    const blocksOf = new Map<string, number>()
    for (const b of blockRead.data ?? [])
      blocksOf.set(b.question_id as string, (blocksOf.get(b.question_id as string) ?? 0) + 1)
    const projects = new Map(
      (projectRead.data ?? []).map((r) => [r.id as string, r as { name: string; priority_tier: string | null }])
    )

    // CO-391: an asking agent named by the runner its session claimed work as; a read that fails names no agent.
    const askerSessions = [...new Set((questionRead.data ?? []).filter((q) => q.asked_by_kind === 'agent').map((q) => q.asked_by_id as string)
      .filter((id) => typeof id === 'string' && SESSION_ID.test(id)))]
    const askerRead = askerSessions.length ? await deps.store.selectIn('work_claims', 'owner_session,agent', 'owner_session', askerSessions) : { rows: [], failed: null }
    // The askers' names are a nicety beside the questions: a failed read leaves them unnamed, said in the operations log.
    if (askerRead.failed) deps.failed?.('board.read-askers', new Error(String(askerRead.failed)))
    const agentOf = new Map<string, string>()
    for (const r of (askerRead.rows ?? []) as Array<{ owner_session: string; agent: string | null }>) if (r.agent) agentOf.set(r.owner_session, r.agent)
    const questions: BoardQuestion[] = (questionRead.data ?? []).filter((q) => !setAside.has(q.id as string)).map((q) => ({
      askedBy: q.asked_by_kind === 'person' ? { kind: 'person' as const, agent: null } : { kind: 'agent' as const, agent: agentOf.get(q.asked_by_id as string) ?? null },
      id: q.id as string,
      projectId: (q.project_id as string | null) ?? null,
      projectName: projects.get(q.project_id as string)?.name ?? null,
      text: q.text as string,
      // The mockup parity: the asker's own «why», the card's muted line (never the board's «blocks N tasks» count).
      why: typeof q.why_blocked === 'string' ? q.why_blocked : null,
      kind: (q.kind as BoardQuestion['kind']) ?? 'decision',
      askedAt: q.asked_at as string,
      blocks: blocksOf.get(q.id as string) ?? 0,
      revision: (q.revision as number | null) ?? 1,
      options: (q.options as BoardQuestion['options'] | null) ?? [],
      // Goals are M?-scoped; claiming a question serves an active goal without
      // reading one would be an invented component in a ranked list.
      servesActiveGoal: false
    }))

    const all = boardEntries({
      questions,
      attention: obligations.items,
      // The TIER only. Pressure is computed from a project's own blocked tasks
      // and open questions, and feeding the board's own inputs back into the
      // weight that ranks it would let one loud project outrank a paying one by
      // being loud. The tier is the operator's claim and it is enough here.
      projectWeightOf: (id) =>
        projectWeight({
          tier: (projects.get(id ?? '')?.priority_tier as ProjectSignals['tier']) ?? 'normal',
          blockedTasks: 0,
          daysSinceOldestOpenQuestion: 0,
          goalDueWithinWeek: false,
          ranInLast24h: false
        }).weight,
      now
    })
    const kinds = personOnly ? all.filter(forPerson) : all
    const scoped = projectId ? scopeBoard(kinds, projectId) : kinds

    const receipt = (name: string, r: { error: { message?: string } | null }): SourceReceipt =>
      r.error ? { name, status: 'error', asOf: null, errorCode: r.error.message ?? 'unknown' } : { name, status: 'ok', asOf: stamp }

    return envelope<BoardCut>({
      data: cutBoard(scoped, limit),
      sources: [
        // MEASURED. This was the literal `{ status: 'ok' }` — six reads under
        // it, none of them checked, in the one receipt that claimed to be fine.
        // Then it was a list of FAILURES, which could not say that five of six
        // answered: the derivation compares what answered against what was
        // consulted, and a source it never hears about is a source that did not
        // answer. The obligation read now names all six either way (UXA-C02).
        ...obligations.sources,
        receipt('questions', questionRead),
        receipt('blocks', blockRead),
        receipt('projects', projectRead),
        receipt('deferrals', deferralRead)
      ],
      // A cut refusal window is an OMISSION, not an error and not an ok: the
      // read succeeded and does not contain everything, which is what `omitted`
      // is for — and it makes the envelope `partial`, so `whole()` refuses to
      // hand this out as a total. Derived where the cap is, so the board and
      // the panel cannot disagree about whether the window was cut.
      omitted: obligations.omitted,
      asOf: stamp,
      freshness: 'fresh'
    })
  }


  /** SCR-41 «Разобрано»: answered questions, newest first, bounded. Two reads, each with its
   *  own receipt, so a failed project read leaves the rows unnamed rather than the list empty. */
  const readResolved = async (projectId: string | null, limit: number): Promise<ReadEnvelope<ResolvedEntry[]>> => {
    const stamp = (deps.now ?? (() => new Date()))().toISOString()
    const bounded = Math.max(1, Math.min(200, Math.floor(Number.isFinite(limit) ? limit : 50)))
    let questions = deps.store
      .select('questions', 'id,project_id,text,kind,asked_at,answered_at,answer,chosen_option,answered_by_kind,options')
      .eq('estate_id', deps.estateId)
      .eq('status', 'answered')
    if (projectId) questions = questions.eq('project_id', projectId)
    const [questionRead, projectRead] = await Promise.all([
      questions.order('answered_at', { ascending: false }).limit(bounded),
      deps.store.select('projects', 'id,name').eq('estate_id', deps.estateId)
    ])
    const names = new Map((projectRead.data ?? []).map((r) => [r.id as string, r.name as string]))
    const receipt = (name: string, r: { error: { message?: string } | null }): SourceReceipt =>
      r.error ? { name, status: 'error', asOf: null, errorCode: r.error.message ?? 'unknown' } : { name, status: 'ok', asOf: stamp }
    return envelope<ResolvedEntry[]>({
      data: resolvedEntries((questionRead.data ?? []) as Record<string, unknown>[], names),
      sources: [receipt('questions', questionRead), receipt('projects', projectRead)],
      asOf: stamp,
      freshness: 'fresh'
    })
  }

  /** SCR-41 «На следующий раз»: the deferrals and the open questions they belong to. */
  const readDeferred = async (projectId: string | null, limit: number): Promise<ReadEnvelope<DeferredEntry[]>> => {
    const stamp = (deps.now ?? (() => new Date()))().toISOString()
    const bounded = Math.max(1, Math.min(200, Math.floor(Number.isFinite(limit) ? limit : 50)))
    let deferrals = deps.store.select('question_deferrals', 'question_id,reason,deferred_at').eq('estate_id', deps.estateId)
    if (projectId) deferrals = deferrals.eq('project_id', projectId)
    const deferralRead = await deferrals.order('deferred_at', { ascending: false }).limit(bounded)
    const ids = (deferralRead.data ?? []).map((d) => d.question_id as string)
    const [questionRead, projectRead] = await Promise.all([
      deps.store.selectIn('questions', 'id,project_id,text,kind,asked_at,status', 'id', ids),
      deps.store.select('projects', 'id,name').eq('estate_id', deps.estateId)
    ])
    const names = new Map((projectRead.data ?? []).map((r) => [r.id as string, r.name as string]))
    const receipt = (name: string, r: { error: { message?: string } | null }): SourceReceipt =>
      r.error ? { name, status: 'error', asOf: null, errorCode: r.error.message ?? 'unknown' } : { name, status: 'ok', asOf: stamp }
    return envelope<DeferredEntry[]>({
      data: deferredEntries((deferralRead.data ?? []) as Record<string, unknown>[], questionRead.rows, names),
      sources: [
        receipt('deferrals', deferralRead),
        // `selectIn` reports its own failure as `failed`, not as `error`.
        questionRead.failed ? { name: 'questions', status: 'error', asOf: null, errorCode: questionRead.failed } : { name: 'questions', status: 'ok', asOf: stamp },
        receipt('projects', projectRead)
      ],
      asOf: stamp,
      freshness: 'fresh'
    })
  }

  return { board: readBoard, resolved: readResolved, deferred: readDeferred }
}
// #endregion board-reads
