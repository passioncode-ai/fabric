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

import type { AttentionItem, AttentionKind } from './attention.ts'
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
}

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
  /** Present only on an authored question: what the answer form needs, and the
   *  revision it must be submitted against. */
  question?: { revision: number; options: { id: string; label: string; consequence?: string }[] }
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
      question: { revision: q.revision, options: q.options }
    }
  })

  const fromAttention: BoardEntry[] = input.attention.map((a) => {
    const { priority, components } = obligationPriority(a.kind, input.projectWeightOf(a.projectId))
    return {
      ref: obligationRef(a.kind, a.ref),
      subject: a.ref,
      origin: 'derived',
      kind: a.kind,
      projectId: a.projectId,
      projectName: a.projectName,
      title: a.title,
      detail: a.detail,
      waitingSince: a.since,
      ageDays: ageInDays(a.since, input.now),
      priority,
      components,
      ...(a.grantable ? { grantable: a.grantable } : {}),
      ...(a.proposal ? { proposal: a.proposal } : {}),
      ...(a.access ? { access: a.access } : {})
    }
  })

  // One scale, one sort, deterministic ties — a board that reshuffles between
  // reading and clicking gets the wrong thing answered.
  return rankBoard(
    [...fromQuestions, ...fromAttention].map((e) => ({ ...e, id: e.ref }))
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
