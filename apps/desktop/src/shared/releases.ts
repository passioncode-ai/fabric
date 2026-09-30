// Releases with their basis (ADR-0084, the launch design's `launch-releases`). A release's state is
// DERIVED from the records, never stored: a later release naming it rolls it back; otherwise its
// latest verification says accepted or failed; with none it is a candidate — the plan is never the
// result. What went in and why are references; a reference this read could not resolve stays in
// the list with no text, so an unread task is never presented as a release that took nothing.

export type ReleaseStatus = 'candidate' | 'verified' | 'failed' | 'rolled_back'

export interface ReleaseRef { id: string; text: string | null }

export interface ReleaseEntry {
  id: string
  projectId: string
  projectName: string | null
  name: string
  environment: string
  summary: string | null
  recordedAt: string
  seq: number
  tasks: ReleaseRef[]
  decisions: ReleaseRef[]
  rollsBack: string | null
  /** The later release that rolled this one back, when there is one. */
  rolledBackBy: string | null
  outcome: 'accepted' | 'failed' | null
  receipt: string | null
  verifiedAt: string | null
  status: ReleaseStatus
}

export type ReleaseRefusal = 'invalid_input' | 'no_such' | 'not_person' | 'command_reused' | 'not_in_project' | 'already_recorded'
export type ReleaseCommandResult =
  | { state: 'committed'; repeated: boolean; seq: number | null; releaseId: string }
  | { state: 'refused'; refusal: ReleaseRefusal }
  | { state: 'unconfirmed' }

const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)

/** Rows of `releases`, newest first, with their state derived from the whole set. */
export function releaseEntries(
  rows: readonly Record<string, unknown>[],
  names: ReadonlyMap<string, string>,
  taskTitles: ReadonlyMap<string, string> = new Map(),
  decisionClaims: ReadonlyMap<string, string> = new Map()
): ReleaseEntry[] {
  // The LATEST release naming a row is the one that rolled it back.
  const rolledBy = new Map<string, { id: string; seq: number }>()
  for (const r of rows) {
    const back = text(r.rolls_back), seq = Number(r.recorded_seq)
    if (back && (!rolledBy.has(back) || rolledBy.get(back)!.seq < seq)) rolledBy.set(back, { id: r.id as string, seq })
  }
  return rows
    .map((r): ReleaseEntry => {
      const id = r.id as string
      const outcome = r.verified_outcome === 'accepted' || r.verified_outcome === 'failed' ? r.verified_outcome : null
      const rolledBackBy = rolledBy.get(id)?.id ?? null
      return {
        id,
        projectId: r.project_id as string,
        projectName: names.get(r.project_id as string) ?? null,
        name: r.name as string,
        environment: r.environment as string,
        summary: text(r.summary),
        recordedAt: r.recorded_at as string,
        seq: Number(r.recorded_seq),
        tasks: ids(r.task_ids).map((t) => ({ id: t, text: taskTitles.get(t) ?? null })),
        decisions: ids(r.decision_ids).map((d) => ({ id: d, text: decisionClaims.get(d) ?? null })),
        rollsBack: text(r.rolls_back),
        rolledBackBy,
        outcome,
        receipt: text(r.verification_receipt),
        verifiedAt: text(r.verified_at),
        status: rolledBackBy ? 'rolled_back' : outcome === 'accepted' ? 'verified' : outcome === 'failed' ? 'failed' : 'candidate'
      }
    })
    .sort((a, b) => b.seq - a.seq)
}

/** The latest release that stands verified — the Pulse's «Последний проверенный результат». */
export function latestVerified(entries: readonly ReleaseEntry[]): ReleaseEntry | null {
  return entries.find((e) => e.status === 'verified') ?? null
}
