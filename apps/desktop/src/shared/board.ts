// The Board: one ranked list of the two things that end differently (M151).
//
// ADR-0035's distinction, made into a type. Two things arrive here and they must
// never be merged into one record, because they END differently:
//
//   a DERIVED obligation — "this task is in review", "this effect was refused".
//   Nobody wrote it down; it is computed from state and it leaves when the state
//   changes. `attention.ts` holds the rule: a queue you can mark as read is a
//   queue that lies, and the lie is worst exactly when the list is long.
//
//   an AUTHORED question — an agent reached a decision it is not entitled to
//   make. It does not resolve when the world changes. It resolves when an ANSWER
//   is recorded, and the answer has to reach whoever continues the work.
//
// Conflating them produces one of two failures, both fatal to trust: treat
// questions as derived and they can never be answered, only worked around; treat
// obligations as authored and they can be dismissed, and the queue lies.
//
// THE BOARD IS A QUERY, NOT A TABLE. A board stored as a table is a second copy
// of the truth, and the copy that drifts is the one the operator is looking at.
// Everything here is computed at read time from `questions` and `attention.ts`.
//
// AND THERE IS NO `seen`. Not on the type, not in the cut, nowhere. The absence
// is the design.

import { attentionKey, type AttentionItem, type AttentionKind } from './attention.ts'
import { obligationRef, type EntityRef } from './entityRef.ts'
import {
  obligationPriority,
  questionPriority,
  rankBoard,
  type Priority,
  type QuestionKind
} from './boardRank.ts'

/** One open question, as the board needs it. Narrower than the row on purpose:
 *  a board that carries the whole record invites rendering the record. */
export interface BoardQuestion {
  id: string
  projectId: string | null
  projectName: string | null
  text: string
  kind: QuestionKind
  askedAt: string
  /** How many tasks it blocks. The single largest term in the rank. */
  blocks: number
  servesActiveGoal: boolean
  /** The revision the surface DISPLAYED. Submitted back with the answer, so a
   *  question revised while somebody was reading it is refused rather than
   *  answered from a stale screen. */
  revision: number
  options: { id: string; label: string; consequence?: string }[]
  /** CO-391 (OF-14): who asked. An agent is named by its runner (`work_claims.agent`) when Fabric knows it, else null. */
  askedBy?: { kind: 'agent' | 'person'; agent: string | null }
  /** Why it is asked, in the asker's own words (`questions.why_blocked`, «what cannot proceed»); null or absent when it
   *  wrote none. The mockup parity: the card's muted line under the question. */
  why?: string | null
}

/** CO-391 (OF-14): the kinds only a person can resolve; what an agent can settle stays on the Board, off the home. */
export const PERSON_KINDS: ReadonlySet<BoardEntry['kind']> = new Set(['question', 'access', 'refused'])

// #region overdue-review — docs: docs/ux/scenarios.md#scn-163-see-on-главная-what-needs-me-what-is-being-done-now-and-my-projects
/** CO-456: a task in review longer than this is the person's to accept or send back. */
export const OVERDUE_REVIEW_MS = 3 * 24 * 3600_000
/** CO-456's pacing: at most this many overdue reviews wait for the person at once, the oldest first; the next takes the
 *  place of one accepted or sent back. 71 at once (the live audit of 2026-10-26) is a queue nobody reads. */
export const OVERDUE_REVIEW_AT_ONCE = 5

/** What waits for the person alone (the home's «Нужны вы», the rail's count): `PERSON_KINDS`, and the overdue reviews
 *  `boardEntries` marked (CO-456). Every reader of the person's part filters with this one test. */
export function forPerson(e: Pick<BoardEntry, 'kind' | 'overdue'>): boolean {
  return PERSON_KINDS.has(e.kind) || e.overdue === true
}

/** The refs of the oldest `OVERDUE_REVIEW_AT_ONCE` reviews put there more than `OVERDUE_REVIEW_MS` before `now`; a review
 *  whose move time is unknown is never overdue (its age is not measured). Ties go by ref, so a reading is stable. */
export function overdueReviews(entries: readonly Pick<BoardEntry, 'kind' | 'ref' | 'reviewSince'>[], now: Date): Set<string> {
  const before = now.getTime() - OVERDUE_REVIEW_MS
  const old = entries
    .filter((e) => e.kind === 'review' && e.reviewSince !== undefined && Date.parse(e.reviewSince) < before)
    .sort((a, b) => Date.parse(a.reviewSince!) - Date.parse(b.reviewSince!) || (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0))
  return new Set(old.slice(0, OVERDUE_REVIEW_AT_ONCE).map((e) => e.ref))
}
// #endregion overdue-review

export interface BoardEntry {
  /**
   * One string that addresses exactly one thing, so a deep link survives a
   * re-rank — `entityRef.ts` owns the vocabulary and both sides compose it.
   *
   * IT USED TO BE WRONG FOR FOUR OF FIVE KINDS. This computed
   * `${item.kind}:${item.id}` over items whose ids were ALREADY prefixed by
   * `attentionOf`, so the Board's refs read `review:review:t1` and
   * `refused:refusal:7` while the comment here documented `review:<task>`. The
   * test agreed with the comment because its fixture hand-wrote an unprefixed
   * id, which `attentionOf` cannot emit — so the fixtures below are built by
   * the producer now.
   *
   * THE ROW'S ADDRESS IS NOT ITS SUBJECT'S. `<obligation-kind>/<subject-ref>`,
   * because a task in review whose lease has also expired is TWO obligations
   * about one task — they end at different moments and each needs its own row
   * key. The subject alone would collide, which is the mirror of the defect
   * above and just as quiet: React would drop one of the two rows.
   */
  ref: string
  /** The same thing, unparsed. Carried so a surface never has to slice the
   *  string it was given. */
  subject: EntityRef
  /** Authored resolves by an ANSWER; derived leaves when the state changes.
   *  The field exists so a surface cannot offer "dismiss" on the first. */
  origin: 'authored' | 'derived'
  kind: 'question' | AttentionKind
  projectId: string | null
  projectName: string | null
  title: string
  detail: string | null
  waitingSince: string
  ageDays: number
  priority: number
  components: Priority['components']
  /** Carried through from the obligation so the surface can offer the ACT that
   *  resolves it — a queue that names a problem and offers no act is a list of
   *  complaints. */
  grantable?: AttentionItem['grantable']
  proposal?: AttentionItem['proposal']
  access?: AttentionItem['access']
  /** Abandoned work the sweep found (SW-9): its kind, said by `detailOf` in the operator's language. */
  swept?: AttentionItem['swept']
  /** A review: when the task was put in review, when known (CO-456). */
  reviewSince?: string
  /** A review: what its agent handed in, so the person decides in the row (SCN-179, CO-521). */
  handedIn?: { said: string | null; by: 'person' | 'agent' | 'system'; at: string }
  /** One of the oldest reviews past three days, brought to the person (`overdueReviews`, CO-456). */
  overdue?: true
  /** Present only on an authored question: what the answer form needs, and the
   *  revision it must be submitted against. */
  question?: { revision: number; options: { id: string; label: string; consequence?: string }[] }
  /** Present on a question when Fabric knows who asked (CO-391). */
  askedBy?: { kind: 'agent' | 'person'; agent: string | null }
  /** A question's own explanation, the asker's words (`BoardQuestion.why`); `detail` stays the board's count of the
   *  tasks it blocks. */
  why?: string | null
}

const ageInDays = (since: string, now: Date): number =>
  Math.max(0, (now.getTime() - new Date(since).getTime()) / 86_400_000)

export function boardEntries(input: {
  questions: readonly BoardQuestion[]
  attention: readonly AttentionItem[]
  projectWeightOf: (projectId: string | null) => number
  now: Date
}): BoardEntry[] {
  const fromQuestions: BoardEntry[] = input.questions.map((q) => {
    const ageDays = ageInDays(q.askedAt, input.now)
    const { priority, components } = questionPriority({
      blocks: q.blocks,
      ageDays,
      kind: q.kind,
      servesActiveGoal: q.servesActiveGoal,
      projectWeight: input.projectWeightOf(q.projectId)
    })
    return {
      ref: obligationRef('question', { kind: 'question', id: q.id }),
      subject: { kind: 'question', id: q.id },
      origin: 'authored',
      kind: 'question',
      projectId: q.projectId,
      projectName: q.projectName,
      title: q.text,
      detail: q.blocks > 0 ? `blocking ${q.blocks} task${q.blocks === 1 ? '' : 's'}` : null,
      waitingSince: q.askedAt,
      ageDays,
      priority,
      components,
      question: { revision: q.revision, options: q.options },
      ...(q.askedBy ? { askedBy: q.askedBy } : {}),
      ...(q.why && q.why.trim() ? { why: q.why.trim() } : {})
    }
  })

  const fromAttention: BoardEntry[] = input.attention.map((a) => {
    const { priority, components } = obligationPriority(a.kind, input.projectWeightOf(a.projectId))
    return {
      // The queue's own key (`attentionKey`): a sweep's finding is addressed by its finding key (SW-9).
      ref: attentionKey(a),
      subject: a.ref,
      origin: 'derived',
      kind: a.kind,
      projectId: a.projectId,
      projectName: a.projectName,
      title: a.title,
      detail: a.detail,
      // A review waits from when it was put in review, when that is known (CO-456), not from when its work began.
      waitingSince: a.reviewSince ?? a.since,
      ageDays: ageInDays(a.reviewSince ?? a.since, input.now),
      priority,
      components,
      ...(a.grantable ? { grantable: a.grantable } : {}),
      ...(a.proposal ? { proposal: a.proposal } : {}),
      ...(a.access ? { access: a.access } : {}),
      ...(a.swept ? { swept: a.swept } : {}),
      ...(a.reviewSince ? { reviewSince: a.reviewSince } : {}),
      ...(a.handedIn ? { handedIn: a.handedIn } : {})
    }
  })
  const overdue = overdueReviews(fromAttention, input.now)

  // One scale, one sort, deterministic ties — a board that reshuffles between
  // reading and clicking gets the wrong thing answered.
  return rankBoard(
    [...fromQuestions, ...fromAttention].map((e) => ({ ...e, ...(overdue.has(e.ref) ? { overdue: true as const } : {}), id: e.ref }))
  ).map(({ id: _id, ...e }) => e as BoardEntry)
}

export interface BoardCut {
  items: BoardEntry[]
  /** Everything waiting, not everything shown. */
  total: number
  hidden: number
  /** Over the WHOLE board. A badge built from five visible rows would say five
   *  however many are actually waiting. */
  countsByProject: Record<string, number>
}

export function cutBoard(items: readonly BoardEntry[], limit: number): BoardCut {
  const countsByProject: Record<string, number> = {}
  for (const i of items) if (i.projectId) countsByProject[i.projectId] = (countsByProject[i.projectId] ?? 0) + 1
  return {
    items: items.slice(0, limit),
    total: items.length,
    hidden: Math.max(0, items.length - limit),
    countsByProject
  }
}

/** One project's obligations. An estate-level one — a refusal with no project —
 *  is deliberately excluded: showing it inside a project makes it that
 *  project's problem, and it is not. */
export function scopeBoard(items: readonly BoardEntry[], projectId: string): BoardEntry[] {
  return items.filter((i) => i.projectId === projectId)
}

/**
 * What the Board's «На проверке» lists (reviews, proposals and abandoned work: the open board less the person's part, `forPerson`), counted
 * from the two readings the renderer already makes: the whole board and the person's part (`personOnly`). While the whole
 * cut shows every row the count is its rows'; past the cut it is the two totals' difference, never less than the rows
 * listed (0.3.12 review, iteration 3, UX-1, UX-2). Per project the same, from `countsByProject`.
 */
export function reviewCounts(whole: BoardCut, mine: BoardCut): { total: number; byProject: Record<string, number> } {
  const rows = whole.items.filter((e) => !forPerson(e))
  if (whole.hidden === 0) {
    const byProject: Record<string, number> = {}
    for (const e of rows) if (e.projectId) byProject[e.projectId] = (byProject[e.projectId] ?? 0) + 1
    return { total: rows.length, byProject }
  }
  const byProject: Record<string, number> = {}
  for (const [p, n] of Object.entries(whole.countsByProject)) {
    const rest = n - (mine.countsByProject[p] ?? 0)
    if (rest > 0) byProject[p] = rest
  }
  return { total: Math.max(rows.length, whole.total - mine.total), byProject }
}
