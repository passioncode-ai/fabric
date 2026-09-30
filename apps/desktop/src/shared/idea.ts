// An idea is a card a person put on the board before it was work (M134).
//
// Until now `task.created@1` was appended by ONE writer — the agent surface —
// and the operator's only door started a session immediately. The backlog was a
// place only agents could write to, and the operator could not think out loud in
// their own product without spawning something.
//
// THE RULE THIS COLLIDES WITH, AND HOW IT SURVIVES. `fabric_task_create` refuses
// a card with no origin: evidence is what makes a card actionable, and without
// that rule an agent fills the board with hunches. An idea HAS no evidence — that
// is what makes it an idea. It is not an exception to the rule but an instance of
// it: the origin is the PERSON who had it, which is a real answer at the
// operator's door and unverifiable at an agent's. The card still names what it
// came out of.
//
// AND RESEARCHING AN IDEA IS NOT DOING IT. If a research session attached to the
// idea's own card, the agent would claim it and move it, and the board would then
// say "this idea is done" when what is done is the reading. So research SPAWNS a
// task linked to the idea; the idea stays in the backlog until a person decides
// its fate. The link vocabulary already carries `spawned`.

export interface IdeaDraft {
  /** What the operator typed. May be several lines. */
  text: string
}

export interface Idea {
  title: string
  /** Everything after the first line, or null. */
  note: string | null
}

export type IdeaVerdict = { ok: true; idea: Idea } | { ok: false; reason: string }

/** A title longer than this is a paragraph, and a board of paragraphs is a
 *  board nobody scans. The remainder becomes the note rather than being cut. */
export const TITLE_MAX = 120

export function readIdea(draft: IdeaDraft): IdeaVerdict {
  const text = draft.text.replace(/\r\n/g, '\n').trim()
  if (!text) return { ok: false, reason: 'an idea needs something in it' }

  const [first, ...rest] = text.split('\n')
  let title = first.trim()
  let carried = rest.join('\n').trim()

  // A long first line is split at the last word boundary that fits, and what is
  // cut goes into the note. Truncating it away would lose the operator's words
  // in the one place the product asked them to think freely.
  if (title.length > TITLE_MAX) {
    const cut = title.lastIndexOf(' ', TITLE_MAX)
    const at = cut > TITLE_MAX / 2 ? cut : TITLE_MAX
    carried = (title.slice(at).trim() + (carried ? '\n' + carried : '')).trim()
    title = title.slice(0, at).trim()
  }

  return { ok: true, idea: { title, note: carried || null } }
}

/**
 * What an agent is told when asked to look into an idea.
 *
 * It says three things and the third is the one with teeth: this came from a
 * person and carries NO evidence yet, so the agent does not go looking for a
 * source it will not find and does not assume one was withheld. And it asks for
 * a report rather than a change — an agent that implements an idea nobody
 * decided on has turned a thought into work on its own authority.
 */
export function researchBrief(idea: Idea): string {
  return [
    `Look into this idea and report back. Do NOT implement it: nobody has decided to do it yet, and deciding is the operator's move.`,
    ``,
    `The idea: ${idea.title}`,
    ...(idea.note ? [``, idea.note] : []),
    ``,
    `It came from a person and carries no evidence yet — that is what makes it an idea rather than a task, so there is no source to go and find. Your job is to produce the evidence somebody would need to decide: what already exists here that bears on it, what it would touch, what it would cost, and what would make it a bad idea.`,
    ``,
    `Write what you find as notes on this task and record anything durable with fabric_memory_remember. Leave the idea itself where it is.`
  ].join('\n')
}
