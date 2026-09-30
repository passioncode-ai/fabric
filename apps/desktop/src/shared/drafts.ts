// A draft belongs to the thing it was written for (S01).
//
// MEASURED: `TaskPage` held one `note` string and submitted it with whatever
// `taskId` the props carried AT THE MOMENT OF THE CLICK. Type a note about task
// A, follow a link to task B, press the button — the text belonged to A and the
// row it landed on did not. And switching tasks left A's words in B's box,
// which is the same defect read from the other side.
//
// The fix is a key, not a lifecycle: drafts live under the id they were typed
// for, so switching away preserves them and switching back returns them. Pure,
// so the rule is tested without rendering anything.

export type Drafts = Readonly<Record<string, string>>

export function draftFor(drafts: Drafts, key: string): string {
  return drafts[key] ?? ''
}

export function setDraft(drafts: Drafts, key: string, value: string): Drafts {
  return { ...drafts, [key]: value }
}

/** After a successful submit. Only the key that was submitted is cleared —
 *  clearing everything would take the note somebody typed on another task. */
export function clearDraft(drafts: Drafts, key: string): Drafts {
  const next = { ...drafts }
  delete next[key]
  return next
}

/**
 * What to submit, and where.
 *
 * Returns the KEY as well as the text, so a caller cannot read the text from
 * one place and the target from another — which is exactly how the note ended
 * up on the wrong task.
 */
export function submission(drafts: Drafts, key: string): { key: string; text: string } | null {
  const text = draftFor(drafts, key).trim()
  return text ? { key, text } : null
}

/**
 * The key a brief section is drafted under (UX28-01).
 *
 * ONE definition of the composition, because the whole defect was a target read
 * from one place and text read from another. The note drafts above already key
 * by task; the brief fields did not key at all — they were UNCONTROLLED
 * `defaultValue` textareas whose React key was the SECTION, so React reused the
 * same DOM node across a task switch and never updated its value. A's words
 * stayed in the box, `onBlur` fired, and the save carried whatever task id the
 * props held by then.
 *
 * MEASURED at d28c321 by a probe that types into A, switches to B and blurs:
 * tasks.brief was called with B and A's text. A's brief, written into B, with
 * no error and nothing to undo it.
 */
export function briefKey(taskId: string, section: string): string {
  return taskId + ' brief ' + section
}

/** The task and section a brief key was made for. Null if it is not one. */
export function briefTarget(key: string): { taskId: string; section: string } | null {
  const parts = key.split(' ')
  return parts.length === 3 && parts[1] === 'brief'
    ? { taskId: parts[0], section: parts[2] }
    : null
}

/**
 * The draft if one exists, otherwise what was loaded.
 *
 * `draftFor` returns an empty string for a key nobody has typed under, which is
 * right for a note box and wrong for a field that already holds saved text: an
 * absent draft and a draft somebody deliberately emptied are different states,
 * and collapsing them would make clearing a brief section impossible to see.
 */
export function draftOr(drafts: Drafts, key: string, saved: string): string {
  return drafts[key] ?? saved
}

/**
 * What to submit for a FIELD, where empty is a value rather than nothing.
 *
 * `submission` above is for a note box: an empty note is nothing to add, so it
 * returns null and the button does nothing. A brief section is not a note — an
 * operator who deletes a paragraph and leaves the field has made a decision,
 * and reusing the note rule here would make a section impossible to unwrite.
 *
 * So the question is whether a draft EXISTS, not whether it has characters in
 * it. Untouched fields still submit nothing, which is what keeps a blur with no
 * typing from taking authorship of a line somebody else wrote.
 */
export function fieldSubmission(drafts: Drafts, key: string): { key: string; text: string } | null {
  const text = drafts[key]
  return text === undefined ? null : { key, text }
}
