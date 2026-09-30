/**
 * One save, one revision, and a draft nobody may overwrite (UX28-11).
 *
 * WHAT THE SETTINGS PANEL DID. Two commands: `projects.update` for name and
 * purpose, then `projects.updateSettings` for the agent and the server list,
 * conditionally, afterwards — both inside one `try` with one `catch`. Three
 * consequences, and each is a different way of telling the operator something
 * untrue.
 *
 *   TWO REVISIONS for one press of one button. `config_revision` is the
 *   sequence of the event that set it, so two appends mean two revisions and
 *   the header's number belongs to whichever landed last.
 *
 *   A HALF-SAVED PROJECT REPORTED AS UNTOUCHED. When the second command failed
 *   the first had already been journalled and projected: the name had changed,
 *   and the banner said the save had not worked. SCN-028's own Errors &
 *   recovery promises the opposite — "a failed append surfaces the error banner
 *   and leaves the header unchanged".
 *
 *   NO BASE REVISION ANYWHERE. Neither command carried the revision the
 *   operator was looking at when they typed, so a concurrent write could not be
 *   refused. Last writer wins, silently.
 *
 * AND THE DATA LOSS, which is the one the operator's priority names first. The
 * panel reset its fields from props on `[project.id, project.config_revision]`
 * — so a background agent changing this project's configuration replaced an
 * operator's half-typed purpose with the stored one. No banner, no undo,
 * nothing to say it happened. Measured by a probe that types half a sentence
 * and moves the revision underneath: `Unable to find an element with the
 * display value: half a sentence I am still`.
 *
 * SCN-004 step 3 already names the rule — "the project draft remains intact" —
 * and SCN-003 says what to do instead: "revision conflict shows the newer diff
 * and asks the operator to reapply the draft". Ninth card of this cycle where a
 * scenario had said it first.
 *
 * FIVE OUTCOMES, NOT TWO, and the fifth is the one this codebase keeps
 * relearning. A single append is atomic, so "part of it committed" cannot
 * happen any more — that failure mode is removed rather than reported better.
 * What remains possible is the append landing and the read-back failing, and
 * calling that `failed` would be a recorded fact reported as nothing at all:
 * the same shape as a refused read becoming a confident zero, read from the
 * write side. It is `written` — the change IS in the journal at this revision,
 * and we could not show you the row.
 */

import type { CasConflict } from './casWrite.ts'
import type { ProjectRow } from './types.ts'

/** Every field this panel owns, declared as data so a fifth one cannot be
 *  added to the form and forgotten by the comparison. */
export const SETTINGS_FIELDS = ['name', 'purpose', 'defaultAgent', 'mcpServers'] as const

export type SettingsField = (typeof SETTINGS_FIELDS)[number]

/** What the operator has typed. Not `Partial<ProjectRow>`: a draft is a
 *  complete set of intended values, and an absent key would be the third
 *  meaning ("unchanged") that the comparison below exists to compute. */
export interface SettingsDraft {
  name: string
  purpose: string
  defaultAgent: string
  mcpServers: string[]
}

/**
 * The draft a stored project starts as.
 *
 * ONE definition, used by the initial state and by every deliberate reset, so
 * the two cannot disagree about what "unedited" means — which is how a panel
 * ends up dirty the moment it opens.
 */
export function draftOf(project: ProjectRow): SettingsDraft {
  return {
    name: project.name,
    purpose: project.purpose ?? '',
    defaultAgent: project.default_agent,
    mcpServers: [...(project.mcp_servers ?? [])]
  }
}

/** A server list is a SET: order is not a change. The panel's checkboxes append
 *  in click order, and comparing them positionally reported an edit whenever
 *  somebody unticked and reticked. */
const sameServers = (a: readonly string[], b: readonly string[]): boolean =>
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())

/** Which fields this save actually carries. Empty means nothing was edited. */
export function changedFields(draft: SettingsDraft, project: ProjectRow): SettingsField[] {
  const stored = draftOf(project)
  return SETTINGS_FIELDS.filter((field) =>
    field === 'mcpServers'
      ? !sameServers(draft.mcpServers, stored.mcpServers)
      : draft[field].trim() !== stored[field].trim()
  )
}

/** Whether the operator has words that are not yet in the journal. The reason
 *  a background revision may not reset the form. */
export function isDirty(draft: SettingsDraft, project: ProjectRow): boolean {
  return changedFields(draft, project).length > 0
}

export type SettingsValidation =
  | { ok: true; value: SettingsDraft; fields: SettingsField[] }
  | { ok: false; reason: string; fields: SettingsField[] }

/**
 * What may be sent, checked before anything is attempted.
 *
 * In the SHARED half deliberately, so the surface and the command apply one
 * rule. The panel already disabled its button on an empty name — a guard that
 * lives only in a `disabled` attribute is one caller away from absent, and the
 * command is reachable over IPC by everything else in this process.
 */
export function validateSettings(draft: SettingsDraft, project: ProjectRow): SettingsValidation {
  const name = draft.name.trim()
  // SCN-028: "an empty name blocks the save with the draft preserved". The
  // refusal names the field so the surface can point at it rather than
  // reporting a save that generally did not work.
  if (!name) return { ok: false, reason: 'a project needs a name', fields: ['name'] }

  const fields = changedFields(draft, project)
  if (fields.length === 0)
    return { ok: false, reason: 'nothing has changed, so there is no revision to record', fields: [] }

  return {
    ok: true,
    fields,
    value: {
      name,
      purpose: draft.purpose.trim(),
      defaultAgent: draft.defaultAgent,
      mcpServers: [...draft.mcpServers]
    }
  }
}

/** One field where the operator's words and the stored row disagree. */
export interface FieldDiff {
  field: SettingsField
  yours: string
  theirs: string
}

/**
 * The newer diff SCN-003 asks a conflict to show.
 *
 * Yours against THEIRS-AS-IT-IS-NOW, not against the base the draft started
 * from: the operator is deciding what to do next, and what they need is the
 * ground they would be writing over.
 */
export function conflictOf(draft: SettingsDraft, current: ProjectRow): FieldDiff[] {
  const stored = draftOf(current)
  const shown = (value: string | string[]): string =>
    Array.isArray(value) ? (value.length ? value.join(', ') : '(none)') : value || '(empty)'
  return changedFields(draft, current).map((field) => ({
    field,
    yours: shown(draft[field]),
    theirs: shown(stored[field])
  }))
}

/** What the command was asked to do, with the base it was typed against. */
export interface SaveSettingsInput {
  id: string
  baseRevision: number
  name: string
  purpose: string
  defaultAgent: string
  mcpServers: string[]
}

/**
 * The outcome of one settings save.
 *
 * `failed` means NOTHING was recorded and is provable now that there is one
 * append — which is what makes the banner's "nothing was saved" true rather
 * than hopeful. `written` is the recorded change we could not read back.
 */
export type ProjectSettingsWrite =
  | { status: 'committed'; value: ProjectRow; revision: number; fields: SettingsField[] }
  | { status: 'written'; revision: number; fields: SettingsField[]; reason: string }
  | CasConflict<ProjectRow, number>
  | { status: 'refused'; reason: string; fields: SettingsField[] }
  | { status: 'failed'; reason: string }

/**
 * True when the change is in the journal, however the read-back went.
 *
 * A TYPE PREDICATE, not a boolean. As a plain boolean it read the revision off
 * a union that has none on its conflict arm, and the caller had to re-test the
 * status to get at the number it had just been told existed — which is how a
 * check and the branch it guards drift apart.
 *
 * The distinction the surface must not collapse: a save that landed and could
 * not be displayed is not a save that did not happen.
 */
export function landed(
  write: ProjectSettingsWrite
): write is Extract<ProjectSettingsWrite, { status: 'committed' | 'written' }> {
  return write.status === 'committed' || write.status === 'written'
}

// NOTE — `SettingsWrite` in `shared/types.ts` is a DIFFERENT subject: the local
// application settings file (`{ settings, saved, reason? }`). The name was taken
// and the concepts do not meet, so this one is `ProjectSettingsWrite` rather
// than an extension of it. Worth saying out loud, because the two would
// otherwise look like one type somebody forgot to reconcile.
