// The instruction being typed, and who owns it (UX-01).
//
// It lives ABOVE the project page, keyed by project, for two reasons that pull
// in opposite directions and are both the same finding. The page is remounted
// per project so a late IPC answer cannot land in the wrong one — which would
// throw the draft away on every switch. And a draft kept INSIDE the page would
// follow the operator into the next project and be run there.
//
// So: above the remount, and per project.
//
// THE MERGE IS A FUNCTION BECAUSE I GOT IT WRONG. The first version handed the
// owner a whole draft built from the current render, so three setters in one
// event handler each wrote their own field beside the others AS THEY WERE
// BEFORE the sequence — and the last one won, silently reverting the first two.

export interface TaskDraft {
  instruction: string
  preset: string | null
  presetText: string | null
}

export const EMPTY_TASK_DRAFT: TaskDraft = {
  instruction: '',
  preset: null,
  presetText: null
}

/** Apply one patch to whatever the draft is NOW. Composing is the whole point:
 *  consecutive writes in one handler must build on each other. */
export function mergeDraft(current: TaskDraft | undefined, patch: Partial<TaskDraft>): TaskDraft {
  return { ...EMPTY_TASK_DRAFT, ...current, ...patch }
}

/** Something the operator asked to load into the field: a preset, or a past
 *  task to run again. `presetId` is null for a reuse — see `loadInto`. */
export interface Incoming {
  text: string
  presetId: string | null
}

export type Load =
  | { kind: 'apply'; draft: TaskDraft }
  | { kind: 'ask'; pending: Incoming }

/**
 * What to do when something is loaded into the instruction field (UX-14).
 *
 * TWO RULES, and they were two separate near-misses.
 *
 * IT ASKS BEFORE REPLACING WHAT SOMEONE TYPED. Silently overwriting is the same
 * loss whether the replacement came from a preset or from the operator's own
 * past task, and "use again" originally did it without a word.
 *
 * AND BORROWED TEXT DOES NOT CARRY BORROWED PROVENANCE. A past task's
 * instruction loaded into the field is not the operator picking that preset
 * again; recording it as one would make the next reader believe a preset was
 * chosen when it was not. So a reuse arrives with `presetId: null` and clears
 * the preset it lands on, while a preset keeps its own identity — and the text
 * is remembered as inserted, so a later edit reads as an edit rather than
 * erasing which preset the work started from.
 */
export function loadInto(draft: TaskDraft | undefined, incoming: Incoming): Load {
  const typed = draft?.instruction ?? ''
  // It asks before replacing WORK, and an unedited preset is not work. Text
  // that is still exactly what a preset inserted belongs to the preset, so
  // swapping one for another loses nothing and asking would be noise.
  //
  // This nuance existed in the preset button and NOT in the reuse path, which
  // is what extraction is for: two call sites held two rules, one of them
  // better, and neither could be checked.
  const untouchedPreset = draft?.presetText !== null && typed === draft?.presetText
  if (typed.trim().length > 0 && !untouchedPreset) return { kind: 'ask', pending: incoming }
  return { kind: 'apply', draft: applied(incoming) }
}

/** The draft that `incoming` becomes once it is allowed in. */
export function applied(incoming: Incoming): TaskDraft {
  return {
    instruction: incoming.text,
    preset: incoming.presetId,
    presetText: incoming.presetId === null ? null : incoming.text
  }
}
