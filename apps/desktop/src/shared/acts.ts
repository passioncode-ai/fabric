// #region acts — docs: docs/adr/0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md#decision
/**
 * An act, its actor and its inverse: ONE shape for every operator act (ADR-0160 §2, 0.3.7 wave 2).
 *
 * WHY A COMPANION EVENT. The acts already have their own events (`task.moved@1`, `work.released@1`,
 * `project.repo.detached@1`, `question.answered@1`, …), three of them written inside SQL commands that know
 * nothing about undo. Putting the inverse into each payload would have changed eight writers and eight
 * projectors; one companion event, `act.recorded@1`, says the same thing for all of them: WHO did it (the
 * journal row's actor), WHAT in words a person reads (`said`, a key and params, worded by the renderer in the
 * person's language), HOW TO TAKE IT BACK (`inverse`, a command and its arguments) or WHY IT CANNOT BE
 * (`why_not`), and, for a reversal, WHICH act it reverses (`undoes`, the journal seq of that act's record).
 *
 * An undo is an act like any other: it has its own record and its own inverse, so an undo can be redone. The
 * only inverse that does not exist is one the world no longer allows (an answer cannot be re-given by Fabric:
 * it is the person's words) — and that says so, with a reason, in the record itself.
 *
 * Pure: nothing here reads a database or the clock.
 */

export const ACT_EVENT = 'act.recorded@1'

export const ACT_KINDS = [
  'task.move', 'claim.release', 'claim.take', 'repo.detach', 'repo.attach', 'project.rename',
  'question.answer', 'question.reopen', 'session.stop', 'session.start', 'draft.discard', 'draft.restore',
  'task.close', 'release.record', 'agent.disconnect', 'agent.let_in', 'run.attest', 'run.unattest'
] as const
export type ActKind = (typeof ACT_KINDS)[number]

export const ACT_CATEGORIES = ['questions', 'tasks', 'agents', 'folders', 'releases', 'projects', 'drafts'] as const
export type ActCategory = (typeof ACT_CATEGORIES)[number]

const CATEGORY: Record<ActKind, ActCategory> = {
  'task.move': 'tasks', 'task.close': 'tasks', 'claim.release': 'tasks', 'claim.take': 'tasks',
  'run.attest': 'tasks', 'run.unattest': 'tasks',
  'repo.detach': 'folders', 'repo.attach': 'folders',
  'project.rename': 'projects',
  'question.answer': 'questions', 'question.reopen': 'questions',
  'session.stop': 'agents', 'session.start': 'agents', 'agent.disconnect': 'agents', 'agent.let_in': 'agents',
  'draft.discard': 'drafts', 'draft.restore': 'drafts',
  'release.record': 'releases'
}
export const categoryOf = (kind: ActKind): ActCategory => CATEGORY[kind]

/** Why an act has no inverse, in a code the renderer words («Выпуск уже опубликован — его можно только заменить новым»). */
export const WHY_NOT = [
  /** a closed task does not reopen (`ladder.ts`: the record of what happened stays whole) */
  'task_closed',
  /** a release is published outward: it can only be replaced by a new one */
  'published',
  /** a message already delivered to another project cannot be called back */
  'delivered',
  /** a revoked credential is gone; the agent asks for access again and gets a new one (a single credential revoked in
   *  Settings → Agent access; «Отключить» on the agent itself has the real inverse «Пустить снова», 0.3.7 wave 3) */
  'credential_gone',
  /** an answer is the person's words: Fabric reopens the question, it does not re-answer it */
  'answer_needs_person'
] as const
export type WhyNot = (typeof WHY_NOT)[number]

export type ActScalar = string | number | boolean | null
export type ActArgs = Record<string, ActScalar>
export interface ActInverse { kind: ActKind; args: ActArgs }
export type ActActor = { kind: 'person' | 'agent' | 'system'; id: string }

export interface ActRecord {
  v: 1
  kind: ActKind
  category: ActCategory
  /** What the act was done to; `label` is the person-readable name (a task's title, a folder's name), never an id. */
  subject: { type: string; id: string; label: string | null }
  /** The act as a sentence: a key (`act.task.move`) and the words that fill it; the renderer words it in the person's language. */
  said: { key: string; params: Record<string, string | number | null> }
  inverse: ActInverse | null
  why_not: WhyNot | null
  /** The `act.recorded@1` seq of the act this one reverses; null for an act that is not a reversal. */
  undoes: number | null
  /** The seq of the event the act itself appended (`task.moved@1`, …), when it appended one. */
  ref_seq: number | null
}

/** What an executor or a caller says about an act; `buildRecord` makes the record of it. */
export interface ActOutcome {
  kind: ActKind
  projectId: string | null
  subject: ActRecord['subject']
  said: ActRecord['said']
  inverse: ActInverse | null
  whyNot?: WhyNot | null
  refSeq?: number | null
}

const LABEL_MAX = 120
const ARG_STRING_MAX = 2000
const ARG_KEYS_MAX = 12
const clip = (s: string, max: number): string => (s.length > max ? s.slice(0, max - 1) + '…' : s)

export function buildRecord(outcome: ActOutcome, undoes: number | null): ActRecord {
  if (!outcome.inverse && !outcome.whyNot) throw new Error(`act ${outcome.kind} has no inverse and says no reason: an act that cannot be undone must say why`)
  if (outcome.inverse && outcome.whyNot) throw new Error(`act ${outcome.kind} has both an inverse and a reason it has none`)
  const params: ActRecord['said']['params'] = {}
  for (const [k, v] of Object.entries(outcome.said.params)) params[k] = typeof v === 'string' ? clip(v, LABEL_MAX) : v
  return {
    v: 1,
    kind: outcome.kind,
    category: categoryOf(outcome.kind),
    subject: { type: outcome.subject.type, id: outcome.subject.id, label: outcome.subject.label === null ? null : clip(outcome.subject.label, LABEL_MAX) },
    said: { key: outcome.said.key, params },
    inverse: outcome.inverse,
    why_not: outcome.inverse ? null : (outcome.whyNot ?? null),
    undoes,
    ref_seq: outcome.refSeq ?? null
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const isScalar = (v: unknown): v is ActScalar => v === null || typeof v === 'boolean' || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v))
const isKind = (v: unknown): v is ActKind => typeof v === 'string' && (ACT_KINDS as readonly string[]).includes(v)
const seqOrNull = (v: unknown): number | null | undefined =>
  v === null ? null : typeof v === 'number' && Number.isSafeInteger(v) && v >= 1 ? v : undefined

function validArgs(v: unknown): ActArgs | null {
  if (!isObj(v)) return null
  const keys = Object.keys(v)
  if (keys.length > ARG_KEYS_MAX) return null
  for (const k of keys) {
    const x = v[k]
    if (!isScalar(x) || (typeof x === 'string' && x.length > ARG_STRING_MAX)) return null
  }
  return v as ActArgs
}

/** A record this module wrote, or null: the read refuses a payload of another shape rather than showing it. */
export function validateActRecord(x: unknown): ActRecord | null {
  if (!isObj(x) || x.v !== 1 || !isKind(x.kind)) return null
  if (x.category !== categoryOf(x.kind)) return null
  const s = x.subject
  if (!isObj(s) || typeof s.type !== 'string' || typeof s.id !== 'string' || !(s.label === null || typeof s.label === 'string')) return null
  const said = x.said
  if (!isObj(said) || typeof said.key !== 'string' || !isObj(said.params)) return null
  for (const v of Object.values(said.params)) if (!(v === null || typeof v === 'string' || typeof v === 'number')) return null
  let inverse: ActInverse | null = null
  if (x.inverse !== null) {
    if (!isObj(x.inverse) || !isKind(x.inverse.kind)) return null
    const args = validArgs(x.inverse.args)
    if (!args) return null
    inverse = { kind: x.inverse.kind, args }
  }
  const whyNot = x.why_not
  if (!(whyNot === null || (typeof whyNot === 'string' && (WHY_NOT as readonly string[]).includes(whyNot)))) return null
  if (inverse === null && whyNot === null) return null
  if (inverse !== null && whyNot !== null) return null
  const undoes = seqOrNull(x.undoes)
  const refSeq = seqOrNull(x.ref_seq)
  if (undoes === undefined || refSeq === undefined) return null
  return {
    v: 1, kind: x.kind, category: x.category as ActCategory,
    subject: { type: s.type, id: s.id, label: s.label as string | null },
    said: { key: said.key, params: said.params as ActRecord['said']['params'] },
    inverse, why_not: whyNot as WhyNot | null, undoes, ref_seq: refSeq
  }
}

/** One act as the journal holds it. */
export interface ActRow {
  /** The seq of the `act.recorded@1` event itself: what an undo's `undoes` names. */
  seq: number
  occurredAt: string
  actor: ActActor
  projectId: string | null
  record: ActRecord
}

/**
 * Which acts are undone NOW, from the rows that matter (the act and every record that reverses it, and every
 * record that reverses one of those, and so on). An act is undone when some reversal of it is itself in force,
 * and a reversal is in force unless a later one undid it: so the answer is read from the newest record down,
 * because a reversal always comes after what it reverses. An act reversed, reversed again, and reversed once more
 * is undone; reversed twice, it is in force.
 */
export function analyseActs(rows: readonly ActRow[]): { undone: Set<number>; undoneBy: Map<number, number> } {
  const reversers = new Map<number, number[]>()
  for (const r of rows) {
    const t = r.record.undoes
    if (t !== null) reversers.set(t, [...(reversers.get(t) ?? []), r.seq])
  }
  const undone = new Set<number>()
  const undoneBy = new Map<number, number>()
  for (const r of [...rows].sort((a, b) => b.seq - a.seq)) {
    const live = (reversers.get(r.seq) ?? []).find((u) => !undone.has(u))
    if (live !== undefined) { undone.add(r.seq); undoneBy.set(r.seq, live) }
  }
  return { undone, undoneBy }
}

export type UndoState =
  | { state: 'available'; inverse: ActInverse }
  | { state: 'undone'; by: number | null }
  | { state: 'cannot'; why: WhyNot | 'no_inverse' }

/** The button's state for one act, before any look at the world (the executor's `check` looks at the world). */
export function undoStateOf(row: ActRow, analysis: { undone: Set<number>; undoneBy: Map<number, number> }): UndoState {
  if (analysis.undone.has(row.seq)) return { state: 'undone', by: analysis.undoneBy.get(row.seq) ?? null }
  if (!row.record.inverse) return { state: 'cannot', why: row.record.why_not ?? 'no_inverse' }
  return { state: 'available', inverse: row.record.inverse }
}

export interface ActHistoryQuery {
  limit?: number
  /** A cursor: only acts older than this seq (the page's `next`). */
  before?: number
  actorKind?: ActActor['kind']
  projectId?: string
  category?: ActCategory
  /** Words in the subject's name. */
  text?: string
}
export type UndoView =
  | { state: 'available'; /** The object's state now, when it is not what the act left (the button says what it would do). */ changedSince?: string }
  | { state: 'undone'; by: number | null }
  | { state: 'cannot'; why: string }
/** One act of История: the record, who and when, and what pressing «Отменить» would be. */
export interface ActView extends ActRow { undo: UndoView }
export interface ActHistoryPage { rows: ActView[]; next: number | null }
/** The answer of an act or an undo to the renderer: refused with a reason code (and the machine's words), or done. */
export type ActAnswer = { ok: true; seq: number | null } | { ok: false; reason: string; says?: string }
// #endregion acts
