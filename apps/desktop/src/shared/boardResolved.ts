// What the board has already resolved (SCR-41 «Разобрано»).
//
// The board's ranked query is what is WAITING; this is what stopped waiting because it was
// answered. Only authored questions have an answer on record, so only they appear here — a
// derived obligation leaves the board when its state changes and leaves nothing to show.
// Pure, so the screen and the reader cannot disagree about what a row says.

export interface ResolvedEntry {
  ref: string
  questionId: string
  projectId: string | null
  /** Null when the project read did not return it: unnamed, never invented. */
  projectName: string | null
  title: string
  kind: string
  askedAt: string
  answeredAt: string
  answer: string | null
  /** The label of the option chosen; the raw id when no option carries it any more. */
  chosenLabel: string | null
  answeredBy: string | null
}

type Row = Record<string, unknown>

export function resolvedEntries(rows: readonly Row[], projectNames: ReadonlyMap<string, string>): ResolvedEntry[] {
  return rows
    .filter((r) => typeof r.answered_at === 'string')
    .map((r) => {
      const options = Array.isArray(r.options) ? (r.options as { id: string; label: string }[]) : []
      const chosen = typeof r.chosen_option === 'string' ? r.chosen_option : null
      const projectId = typeof r.project_id === 'string' ? r.project_id : null
      return {
        ref: `question:${r.id as string}`,
        questionId: r.id as string,
        projectId,
        projectName: projectId ? (projectNames.get(projectId) ?? null) : null,
        title: r.text as string,
        kind: (r.kind as string) ?? 'decision',
        askedAt: r.asked_at as string,
        answeredAt: r.answered_at as string,
        answer: typeof r.answer === 'string' ? r.answer : null,
        chosenLabel: chosen === null ? null : (options.find((o) => o.id === chosen)?.label ?? chosen),
        answeredBy: typeof r.answered_by_kind === 'string' ? r.answered_by_kind : null
      }
    })
    .sort((a, b) => Date.parse(b.answeredAt) - Date.parse(a.answeredAt))
}

/** What a Board command did (SCR-41, L3b). A domain refusal is named; a lost answer is not guessed. */
export type BoardRefusal = 'invalid_input' | 'already_deferred' | 'not_deferred' | 'settled' | 'no_such' | 'not_person' | 'command_reused'
export type BoardCommandResult =
  | { state: 'committed'; repeated: boolean; seq: number | null; questionId: string }
  | { state: 'refused'; refusal: BoardRefusal }
  | { state: 'unconfirmed' }

/** An open question the owner set aside for next time («На следующий раз»). */
export interface DeferredEntry {
  ref: string
  questionId: string
  projectId: string | null
  projectName: string | null
  title: string
  kind: string
  askedAt: string
  reason: string
  deferredAt: string
}

/** Deferrals joined to their questions, newest deferral first. A deferral whose question the
 *  read did not return (settled since, or another estate's) is dropped, never shown bare. */
export function deferredEntries(
  deferrals: readonly Row[], questions: readonly Row[], projectNames: ReadonlyMap<string, string>
): DeferredEntry[] {
  const byId = new Map(questions.filter((q) => q.status === 'open').map((q) => [q.id as string, q]))
  return deferrals
    .filter((d) => byId.has(d.question_id as string) && typeof d.reason === 'string')
    .map((d) => {
      const q = byId.get(d.question_id as string)!
      const projectId = typeof q.project_id === 'string' ? q.project_id : null
      return {
        ref: `question:${q.id as string}`,
        questionId: q.id as string,
        projectId,
        projectName: projectId ? (projectNames.get(projectId) ?? null) : null,
        title: q.text as string,
        kind: (q.kind as string) ?? 'decision',
        askedAt: q.asked_at as string,
        reason: d.reason as string,
        deferredAt: d.deferred_at as string
      }
    })
    .sort((a, b) => Date.parse(b.deferredAt) - Date.parse(a.deferredAt))
}
