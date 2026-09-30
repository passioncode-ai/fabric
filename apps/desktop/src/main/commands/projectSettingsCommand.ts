/**
 * One append for everything the settings panel owns (UX28-11).
 *
 * The guard sits HERE, before the append, and that placement is the whole
 * design. A journal never refuses a fact it has already recorded, so a
 * compare-and-set cannot live in the projector: by the time an arm runs, the
 * event is history and dropping it would make the projection disagree with the
 * log it is built from. Admission is the only place a command may say no.
 *
 * `shared/projectSettings.ts` carries the measurement and the reasoning. This
 * module is the four decisions in order:
 *
 *   read the row through the scoped store — which applies `estate_id` itself,
 *   so this module names it nowhere (the lesson `searchRead.ts` planted for);
 *   refuse a moved base, returning WHAT it moved to so the surface can show the
 *   diff without a second read that could move again;
 *   refuse an invalid draft by the shared rule, so the panel's `disabled` and
 *   the command cannot disagree about what a project needs;
 *   append ONCE, and take the revision from the append itself — `e.seq` is what
 *   the projector will write into `config_revision`, so the number handed back
 *   is the number the row will hold rather than a guess to be re-read.
 *
 * Fifth extraction of this shape after `digestRead.ts`, `harnessRead.ts`,
 * `memoryOverviewRead.ts` and `searchRead.ts`, and the first on the write side.
 */

import {
  changedFields,
  draftOf,
  validateSettings,
  type SaveSettingsInput,
  type SettingsField,
  type ProjectSettingsWrite
} from '../../shared/projectSettings.ts'
import type { ProjectRow } from '../../shared/types.ts'
import type { ScopedStore } from '../scopedStore.ts'

/** The event this command records. One type, one revision, every edited field. */
export const CONFIGURED = 'project.configured@1'

/** Only what changed reaches the payload, so the event says what it did rather
 *  than restating the row. The projector reads presence, not truthiness — an
 *  empty purpose and an empty server list are decisions. */
function payloadOf(input: SaveSettingsInput, fields: readonly SettingsField[]): Record<string, unknown> {
  const payload: Record<string, unknown> = { id: input.id, base_revision: input.baseRevision }
  if (fields.includes('name')) payload.name = input.name
  if (fields.includes('purpose')) payload.purpose = input.purpose || null
  if (fields.includes('defaultAgent')) payload.default_agent = input.defaultAgent
  if (fields.includes('mcpServers')) payload.mcp_servers = input.mcpServers
  return payload
}

export async function saveProjectSettings(
  deps: {
    store: ScopedStore
    append: (payload: Record<string, unknown>, projectId: string) => Promise<{ seq: number }>
  },
  input: SaveSettingsInput
): Promise<ProjectSettingsWrite> {
  const read = (await deps.store
    .select('projects', '*')
    .eq('id', input.id)
    .maybeSingle()) as { data: ProjectRow | null; error: { message: string } | null }

  // NOTHING WAS APPENDED, and that is why this is `failed` rather than
  // `written`: the banner may say the save did not happen, truthfully.
  if (read.error) return { status: 'failed', reason: `project read failed: ${read.error.message}` }
  if (!read.data)
    return { status: 'failed', reason: 'that project is not in this estate, so nothing was recorded' }

  const current = read.data
  if (current.config_revision !== input.baseRevision)
    return { status: 'conflict', currentRevision: current.config_revision, currentValue: current }

  const draft = {
    name: input.name,
    purpose: input.purpose,
    defaultAgent: input.defaultAgent,
    mcpServers: input.mcpServers
  }
  const checked = validateSettings(draft, current)
  if (!checked.ok) return { status: 'refused', reason: checked.reason, fields: checked.fields }

  let seq: number
  try {
    const event = await deps.append(payloadOf(input, checked.fields), input.id)
    seq = event.seq
  } catch (e) {
    return { status: 'failed', reason: String(e) }
  }

  // PAST THIS LINE THE CHANGE IS RECORDED. A read-back that fails is a display
  // problem, and reporting it as a failure would be a committed fact shown as
  // nothing at all — the refused-read-becomes-a-confident-answer defect of this
  // cycle, read from the write side.
  const after = (await deps.store
    .select('projects', '*')
    .eq('id', input.id)
    .maybeSingle()) as { data: ProjectRow | null; error: { message: string } | null }

  if (after.error || !after.data)
    return {
      status: 'written',
      revision: seq,
      fields: checked.fields,
      reason: after.error?.message ?? 'the project could not be read back'
    }

  return { status: 'committed', value: after.data, revision: seq, fields: checked.fields }
}

/** Re-exported so a caller comparing fields uses the same computation the
 *  command validated with. */
export { changedFields, draftOf }
