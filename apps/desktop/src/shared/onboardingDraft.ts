/**
 * A half-described project survives quitting (AX-05).
 *
 * MEASURED 2026-09-10. The onboarding draft lived in `useState` in `App.tsx`:
 * an operator part-way through describing a new project — its name, its
 * purpose, the repositories they had picked — lost all of it when the app
 * closed. And `shared/tabs.ts` knew, which is the part worth reading twice. Its
 * own header says why draft tabs are not restored:
 *
 *   "A DRAFT tab holds unsaved onboarding work that lives in renderer memory:
 *    quitting takes its content whatever this file does. Restoring the tab
 *    without it would show an empty form claiming to be the operator's draft."
 *
 * So the product had reasoned correctly about a loss it could not prevent, and
 * chosen the honest half of a bad pair: hide the tab rather than lie about it.
 * This module removes the loss, which is what makes the other half — restoring
 * the tab — honest rather than a claim over nothing.
 *
 * IT BELONGS IN THE OPERATOR'S OWN STORE, not in the journal. `localStore`'s
 * header draws that boundary: facts about the PERSON at the desk rather than
 * about the estate, because "the record has to stay smaller than what it
 * describes". A form somebody is typing into is the clearest case of that —
 * journalling every keystroke would make the log grow faster than the work.
 *
 * AND A DRAFT IS NOT A PROJECT. `projectId` travels with it so that pressing
 * create twice is the same create (UX-06), and the acceptance this module
 * answers is explicit that restoring must not "invent a committed object": a
 * restored draft is a form with words in it, and nothing anywhere may read it
 * as a project that exists.
 */

/** The onboarding form's contents. One declaration, shared by the renderer that
 *  edits it and the main process that validates it on the way to disk. */
export interface Draft {
  /** The project this draft will become, decided when the tab opened (UX-06).
   *  It travels with the draft, so pressing create twice — or retrying after a
   *  slow answer — is the same create rather than a second project. */
  projectId: string
  name: string
  purpose: string
  repoPaths: string[]
  memory: 'local' | 'cloud'
  agent: string
}

export const EMPTY_DRAFT: Draft = {
  projectId: '',
  name: '',
  purpose: '',
  repoPaths: [],
  memory: 'local',
  agent: 'claude-code'
}

/** Every open draft, by the tab id it is being typed in. */
export type DraftFile = Record<string, Draft>

/**
 * Is there anything here worth keeping?
 *
 * An untouched form is not work, and persisting one would restore a tab the
 * operator never typed into — which is the same false claim from the other
 * direction. `projectId` alone does not count: it is minted when the tab opens,
 * before a single keystroke.
 */
export function isStarted(draft: Draft): boolean {
  return (
    draft.name.trim() !== '' ||
    draft.purpose.trim() !== '' ||
    draft.repoPaths.length > 0
  )
}

/** Only the drafts worth restoring, so an untouched tab leaves no trace. */
export function worthKeeping(file: DraftFile): DraftFile {
  return Object.fromEntries(Object.entries(file).filter(([, d]) => isStarted(d)))
}

/**
 * A file this product wrote, or null.
 *
 * STRICT, because `localStore` demands it in its own words: "'it parsed' is not
 * 'it is what we asked for', and a hand-edited list turned into an object used
 * to reach the renderer and break the estate home". Every field is checked and
 * a single bad draft rejects the WHOLE file rather than being dropped quietly —
 * a half-restored set of drafts is a set the operator cannot reason about.
 */
export function validateDraftFile(parsed: unknown): DraftFile | null {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const out: DraftFile = {}
  for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof id !== 'string' || id === '') return null
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
    const d = value as Record<string, unknown>
    if (typeof d.projectId !== 'string') return null
    if (typeof d.name !== 'string' || typeof d.purpose !== 'string') return null
    if (!Array.isArray(d.repoPaths) || d.repoPaths.some((p) => typeof p !== 'string')) return null
    if (d.memory !== 'local' && d.memory !== 'cloud') return null
    if (typeof d.agent !== 'string') return null
    out[id] = {
      projectId: d.projectId,
      name: d.name,
      purpose: d.purpose,
      repoPaths: d.repoPaths as string[],
      memory: d.memory,
      agent: d.agent
    }
  }
  return out
}

/**
 * How the read went, and whether the value may be written back.
 *
 * `ready` — the file as this product wrote it.
 * `recovered` — it would not parse and an earlier good copy was used. The value
 *   is real, and writing it back REPAIRS the file.
 * `unreadable` — the value is a default standing in for something nobody could
 *   read. Writing over it destroys whatever is there.
 */
export type DraftReadStatus = 'ready' | 'recovered' | 'unreadable'

/** May a reader persist what it was given? Only the two answers that mean the
 *  value is the operator's own. */
export function mayPersist(status: DraftReadStatus): boolean {
  return status === 'ready' || status === 'recovered'
}
