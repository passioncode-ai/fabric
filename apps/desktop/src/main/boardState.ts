// #region board-state — docs: docs/evidence/plans/2026-11-17-board-apart-waves.md#3-the-waves
/**
 * The board's memory that the window's doors and the board's own code both read or write (ADR-0195 W2a.2, the plan's
 * §2.2): the sessions the person ended, the branches sessions reported, the dispatcher's wake and its view, the sweep,
 * the stack's health. Until W2a.2 each was a module variable of `main/index.ts`; one object here is what W2c.2's
 * operator door will serve when the board runs in a process of its own. Launches by task (`taskBySession`) are the terminals' and move with them in W3.
 */
import type { AbandonedSweep } from './abandonedSweepRun.ts'
import type { BoardRun } from './agentWork.ts'
import type { InboxGiven, ResumeGiven, ToOperatorWhy } from './boardDispatchRun.ts'
import type { StackHealthView } from '../shared/stackWatch.ts'
import { createReportedBranches } from './agentBranches.ts'

/** A value one side sets once it exists and every reader takes as null until then. */
export interface Slot<T> {
  get(): T | null
  set(value: T | null): void
}

export function slot<T>(): Slot<T> {
  let value: T | null = null
  return { get: () => value, set: (next) => { value = next } }
}

/** The enrolled sessions the person's marks reach (`sessionEnroll.ts#EnrolledSessions`). */
export interface EnrolledForMarks {
  liveOf(bindingId: string): Array<{ sessionId: string }>
  idsForGrant(grantId: string): string[]
}

/** PL-1 (0.3.22 review, iteration 3): sessions the person ended with «Завершить сессию», by session id, until their end
 *  releases their claims as the person's own release, which the board supervisor does not continue. */
export interface PersonEnded {
  mark(sessionId: string): void
  /** A binding the person revokes ends its enrolled sessions (`sessionEnroll.ts#endForBinding`): each is marked first. */
  markBinding(bindingId: string): void
  /** A grant the person revokes ends the sessions minted under it (`sessionEnroll.ts#endForGrant`): each is marked first. */
  markGrant(grantId: string): void
  /** Whether the person ended this session; the mark is taken, so a session's end reads it once. */
  take(sessionId: string): boolean
  /** The enrolled sessions, once the hub has made them; before that a binding or grant marks nobody. */
  attach(enrolled: EnrolledForMarks): void
}

export const PERSON_ENDED_MAX = 200

export function personEnded(max = PERSON_ENDED_MAX): PersonEnded {
  const ended = new Set<string>()
  let enrolled: EnrolledForMarks | null = null
  const mark = (sessionId: string): void => {
    ended.delete(sessionId)
    ended.add(sessionId)
    while (ended.size > max) ended.delete(ended.values().next().value as string)
  }
  return {
    mark,
    markBinding: (bindingId) => { for (const s of enrolled?.liveOf(bindingId) ?? []) mark(s.sessionId) },
    markGrant: (grantId) => { for (const id of enrolled?.idsForGrant(grantId) ?? []) mark(id) },
    take: (sessionId) => ended.delete(sessionId),
    attach: (e) => { enrolled = e }
  }
}

/** What the window's home and the sweep read of the dispatcher (`boardDispatchRun.ts`). */
export interface DispatcherView {
  toOperator(): Map<string, ToOperatorWhy>
  inboxGiven(): InboxGiven[]
  resumeGiven(): ResumeGiven[]
  boardRuns(): BoardRun[]
}

export interface BoardState {
  personEnded: PersonEnded
  /** CO-459 (DEC-0140 PR-3): a turn's reported branch, for this machine's screens only, never journalled or shared. */
  branches: ReturnType<typeof createReportedBranches>
  /** Woken when a session stores a board request, so the dispatcher acts when its grace ends (CO-409 §3.1). */
  dispatchWake: Slot<{ wake(): void; stop(): void }>
  dispatcher: Slot<DispatcherView>
  sweep: Slot<AbandonedSweep>
  stackHealth: Slot<StackHealthView>
}

export function createBoardState(): BoardState {
  return { personEnded: personEnded(), branches: createReportedBranches(), dispatchWake: slot(), dispatcher: slot(), sweep: slot(), stackHealth: slot() }
}
// #endregion board-state
