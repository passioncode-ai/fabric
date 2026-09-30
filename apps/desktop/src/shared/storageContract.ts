// What the declared mirror actually holds, said out loud (S12).
//
// MEASURED BEFORE THIS: the workspace mirror covers TWO of the estate's
// twenty-nine tables — `projects` and `agent_bindings` — and nothing anywhere
// says so. The screen offers "import a workspace" and the operator reads that
// as "restore my estate": their goals, tasks, decisions and memory are not in
// those two files and never were. A backup that silently holds a fraction is
// worse than no backup, because it is the one nobody checks.
//
// SO COVERAGE IS DERIVED, NOT RESTATED. The set of things an estate holds is
// `TABLE_SCOPE` — the same map the scope boundary is built from — and anything
// in it the mirror does not carry must name WHY. A table added tomorrow makes
// `declaredCoverage()` throw until somebody decides what the mirror does with
// it, which is the difference between a coverage list and a coverage list that
// is true. Same shape as `UnscopedTable`: the exemption carries its reason or
// it is not one.

import { TABLE_SCOPE } from './scope.ts'
import { AGENT_FIELDS, PROJECT_FIELDS } from './mirror.ts'

export type CoverageMode = 'complete' | 'partial' | 'excluded'

export interface EntityCoverage {
  entityType: string
  mode: CoverageMode
  /** The fields carried, for anything not excluded. Named so a widened select
   *  cannot quietly become a widened mirror without the manifest saying so. */
  fields?: readonly string[]
  /** Required for `partial` and `excluded`. */
  reason?: string
}

/** Thrown when the estate grows a table the mirror has not been told about. */
export class UndeclaredEntity extends Error {
  constructor(table: string) {
    super(
      `the mirror does not say what it does with "${table}". Add it to MIRRORED or give it a reason ` +
        `in NOT_MIRRORED — a coverage list that silently omits a table is how a partial backup ` +
        `gets read as a whole one.`
    )
    this.name = 'UndeclaredEntity'
  }
}

/**
 * What the mirror carries, and the fields it carries.
 *
 * TAKEN FROM THE WRITER, not written beside it. `PROJECT_FIELDS` and
 * `AGENT_FIELDS` are what `mirrorEstate` actually renders; a copy here would
 * agree with them today and disagree the first time somebody widens one — and
 * a manifest that names a field the file does not hold is the same lie as a
 * coverage list that omits a table.
 *
 * `mcp_servers` is appended because the writer emits it outside the field loop,
 * as a nested list. That is the one place this must know something the constant
 * does not say, and it is named rather than absorbed.
 */
export const MIRRORED: Readonly<Record<string, readonly string[]>> = {
  projects: [...PROJECT_FIELDS, 'mcp_servers'],
  agent_bindings: [...AGENT_FIELDS, 'mcp_servers']
}

/**
 * Everything else, and WHY.
 *
 * These are not apologies. Most of this is derived state that a rebuild
 * reproduces from the journal, and mirroring a projection into a file the
 * operator can edit would create a second source of truth for something that
 * already has one (ADR-0014). The ones that matter are the ones a rebuild
 * CANNOT reproduce, and those are named as such.
 */
export const NOT_MIRRORED: Readonly<Record<string, string>> = {
  estate_restore_boundaries: 'locally created restore authority boundary, retained across replay; never imported from archive or editable workspace content',
  ceo_conversations: 'private Person/subject ownership, not Estate mirror content; dedicated owner backup required',
  ceo_private_contents: 'immutable private primary text, never reproducible from the public journal or workspace mirror',
  ceo_messages: 'private message order and content references; dedicated owner archive rather than Estate mirror',
  ceo_operations: 'private canonical intent and acceptance receipts, not editable workspace data',
  ceo_pending_requests: 'private pending input; mirror/replay cannot create permission to dispatch',
  ceo_receipt_refs: 'opaque receipt projection rebuilt from the journal, never private text or dispatch authority',
  ceo_write_authorizations: 'private transaction authorization, never mirrored or restored',
  ceo_private_import_receipts: 'a local private import receipt; mirroring it would let a copy claim an import it never ran',
  ceo_content_provenance: 'private origin of imported text, bound to one Person and target Estate; never workspace content',

  journal:
    'the spine itself. It is the source every projection is rebuilt from, and a YAML rendering of it that somebody could edit would be a second spine',
  event_types: 'the vocabulary ships with the migrations, not with an estate',
  estates: 'the estate is the thing being mirrored; a file naming it is the manifest, not a row',
  persons: 'identity belongs to the auth plane and is not the estate to give away',
  memberships: 'who may enter an estate is an authority fact, and importing it would import access',
  grants: 'a live permission. Carrying one into a file makes it quotable, and carrying it back makes it forgeable',
  grant_reservations: 'the live half of an authority decision; meaningless outside the run that took it',
  effect_intents: 'receipts for acts already performed. Re-importing them would claim the acts again',
  effect_attempts: 'the same, one layer down',
  leases: 'who holds a file right now. True for minutes, and false the moment it is written down',
  estate_settings: 'machine-local preference, not estate content',
  agent_stages: 'progress reports rebuilt from the journal',
  goals: 'NOT REBUILDABLE from the two mirrored files, and not carried — this is the largest gap in the mirror and the reason it may not be called a backup',
  project_tasks: 'NOT REBUILDABLE from the mirror. Rebuilt from the journal when the journal is present; absent from a workspace-only import',
  task_links: 'the same as the tasks they join',
  task_notes: 'notes hang off a task; a note whose task is absent is a sentence with no subject',
  task_handoffs: 'a handoff names two sessions of a run that is over; outside it, it points at nothing',
  questions: 'NOT REBUILDABLE from the mirror. A question an operator answered is a decision the estate would lose',
  question_blocks: 'derived from the questions and recomputed from the link, never carried separately',
  question_resolutions: 'the answers, and they go with the questions',
  question_deferrals: 'rebuilt from the journal: each is a question.deferred@1 not yet undone by a return, an answer or a withdrawal',
  question_deferral_commands: 'the receipt of a set-aside or a return, keyed by the command that made it; carrying it would let a replayed command id stand for an act nobody took here',
  proposals: 'derived work state, rebuilt from the journal',
  releases: 'rebuilt from the journal: each is a release.recorded@1 with its latest release.verified@1',
  release_commands: 'the receipt of a recorded release or verification, keyed by the command that made it; carrying it would let a replayed command id stand for an act nobody took here',
  routines: 'NOT REBUILDABLE from the mirror; a schedule the operator set is lost with it',
  project_repos: 'paths on one machine. They are evidence, not content, and they rebind per machine',
  memory_facts: 'rebuilt from the journal; a file copy would be a second memory that drifts',
  memory_retrievals: 'the record of what was asked; volume, and rebuilt',
  membership_commands: 'the receipt of an authority change, keyed by the command that made it. Carrying receipts into a file and back would let a revoked membership be re-granted by replaying somebody else\'s command id',
  memory_occurrences: 'the identity of an incident, allocated by the projector from the capture episode. Carrying it into a file and back would let an episode be re-declared distinct on somebody else\'s say-so, which is the number a recurrence threshold fires on',
  session_transcripts: 'what was said in a session. Large, and full of whatever the session touched',
  session_context_packs: 'derived from memory at a moment; regenerated rather than restored',
  task_runs: 'one invocation of one task, with its runtime outcome; it describes a run that has ended by the time anyone imports the folder',
  continuation_dispatches: 'operational write fences, not editable workspace content; retained on projection replay. After journal-only restore, a queued delivery without a fence stays unknown and is never replayed automatically',
  transcript_recovery_authorizations: 'private transaction authorization, never persistent history or restorable execution authority',
  run_stop_commands: 'trusted operational stop receipts; never reconstructed from raw journal claims or imported workspace content. Missing receipts keep execution ownership unresolved',
  run_launch_compensations: 'trusted no-process launch compensation receipts, retained through projection replay. A journal launch_failure flag cannot reconstruct this authority',
  deliveries: 'the record of one instruction reaching one session; it describes a run that is over by the time anyone imports the folder',
  session_heartbeats: 'what an agent said it was doing while it ran. True for a minute, and about a session that has ended by the time anyone imports the folder'
}

/**
 * The coverage this mirror declares, computed against the estate's own tables.
 *
 * @throws {UndeclaredEntity} when a table is neither mirrored nor excused.
 */
export function declaredCoverage(): EntityCoverage[] {
  return Object.keys(TABLE_SCOPE)
    .sort()
    .map((table) => {
      if (table in MIRRORED) return { entityType: table, mode: 'complete' as const, fields: MIRRORED[table] }
      const reason = NOT_MIRRORED[table]
      if (!reason) throw new UndeclaredEntity(table)
      return { entityType: table, mode: 'excluded' as const, reason }
    })
}

/**
 * May what this mirror holds be called a restoration of the estate?
 *
 * No, and it says which absences decide it. The answer is a sentence rather
 * than a boolean because "restorable: false" on a screen is read as a warning
 * and dismissed; "your goals, tasks and questions are not in this folder" is
 * read as information.
 */
export function restorability(coverage: readonly EntityCoverage[]): {
  restorable: boolean
  missing: string[]
  says: string
} {
  const missing = coverage
    .filter((c) => c.mode !== 'complete' && (c.reason ?? '').startsWith('NOT REBUILDABLE'))
    .map((c) => c.entityType)
  if (missing.length === 0)
    return { restorable: true, missing, says: 'everything this estate holds is in these files' }
  return {
    restorable: false,
    missing,
    says:
      `these files hold your projects and agents. They do not hold ${missing.join(', ')}, ` +
      `and importing them elsewhere will not bring those back.`
  }
}

// ————————————————————————————————————————————————————————— the generation

/**
 * What Fabric last wrote, and what it declared while writing it.
 *
 * THE MANIFEST IS THE COMMIT MARKER. It is written LAST, atomically, after every
 * file it names is on the device — so a manifest whose hashes all match is proof
 * that one generation completed. Before this, a crash between the two YAML files
 * left `projects.yaml` from the new generation beside `agents.yaml` from the old
 * one, and nothing in the product could tell that apart from an operator editing
 * a file by hand.
 */
/**
 * The manifest schema this build writes and will accept.
 *
 * Named rather than inlined because a version declared in one place and checked
 * in none is the shape AX-04 is about: `readManifest` compared `format` and not
 * this, so a manifest from a build that changed what the files MEAN was taken
 * as a generation marker of this one.
 */
export const MIRROR_SCHEMA_VERSION = 2

export interface MirrorManifest {
  format: 'fabric-declared-mirror'
  schemaVersion: typeof MIRROR_SCHEMA_VERSION
  estateId: string
  generatedAt: string
  coverage: EntityCoverage[]
  files: { path: string; sha256: string; bytes: number }[]
  counts: Record<string, number>
  /** Over the file digests, so one comparison answers "same generation?". */
  contentDigest: string
}

export type GenerationStatus =
  /** Every named file matches: one generation, complete, untouched since. */
  | 'current'
  /** Files differ from the manifest — the operator edited them, which is the
   *  supported case, or a write was interrupted. Both need a look; neither is
   *  a silent success. */
  | 'diverged'
  /** A file the manifest names is gone. */
  | 'incomplete'
  /** No manifest: either never written, or written by a version before this. */
  | 'unknown'

export interface GenerationCheck {
  status: GenerationStatus
  drifted: string[]
  missing: string[]
}

/** Compare what is on disk against what the manifest says was written. */
export function checkGeneration(
  manifest: MirrorManifest | null,
  onDisk: Record<string, { sha256: string } | undefined>
): GenerationCheck {
  if (!manifest) return { status: 'unknown', drifted: [], missing: [] }
  const drifted: string[] = []
  const missing: string[] = []
  for (const f of manifest.files) {
    const found = onDisk[f.path]
    if (!found) missing.push(f.path)
    else if (found.sha256 !== f.sha256) drifted.push(f.path)
  }
  if (missing.length) return { status: 'incomplete', drifted, missing }
  if (drifted.length) return { status: 'diverged', drifted, missing }
  return { status: 'current', drifted, missing }
}

// ————————————————————————————————————————————————————————— the import plan

/**
 * Bytes an import may carry before it is refused outright.
 *
 * A BOUND WITH A REFUSAL, not a bound with a chunked mode. Silently switching
 * to batches for a large file means a crash lands mid-estate — which is the one
 * outcome the whole atomic path exists to prevent — and the operator would have
 * no way to know which mode ran. Ten megabytes of declared YAML is far past any
 * real workspace; past it, something is wrong with the file rather than with
 * the limit.
 */
export const IMPORT_MAX_BYTES = 10 * 1024 * 1024

export interface ImportProblem {
  /** Machine-stable, so a surface can act on the class rather than the prose. */
  code: 'IMPORT_TOO_LARGE' | 'UNPARSEABLE' | 'DUPLICATE_ID' | 'DANGLING_REFERENCE' | 'MISSING_FILE' | 'MISSING_FIELD'
  says: string
}

export interface ImportPlan {
  ok: boolean
  problems: ImportProblem[]
  counts: Record<string, number>
  coverage: EntityCoverage[]
  /** What this import will NOT bring back, in the operator's words. Present on
   *  a valid plan too — it is the thing they most need to read. */
  says: string
  /** Over the input, so a commit can prove it is committing what was previewed
   *  rather than a file that changed while somebody was reading the plan. */
  inputDigest: string
}

/**
 * Validate an import COMPLETELY before anything is written.
 *
 * The old path appended events in a loop as it parsed. A file that went wrong
 * on its last row left an estate holding every project before it — and the
 * refusal the operator saw named a problem in a file that had already been
 * half-applied.
 */
export function planImport(input: {
  projects: readonly Record<string, unknown>[] | null
  agents: readonly Record<string, unknown>[] | null
  /** Total bytes of the files read, for the bound. */
  bytes: number
  /** Digest of the input, computed by the caller which has the bytes. */
  inputDigest: string
  /** Parse failures the caller already hit, passed in rather than re-derived. */
  parseErrors?: readonly { file: string; reason: string }[]
}): ImportPlan {
  const problems: ImportProblem[] = []
  const coverage = declaredCoverage()

  if (input.bytes > IMPORT_MAX_BYTES)
    problems.push({
      code: 'IMPORT_TOO_LARGE',
      says: `that folder holds ${Math.round(input.bytes / 1024)} KB of declared files, past the ${IMPORT_MAX_BYTES / 1024 / 1024} MB an import accepts. Nothing was written. A workspace this size is a sign something else is in the folder.`
    })

  for (const e of input.parseErrors ?? [])
    problems.push({ code: 'UNPARSEABLE', says: `${e.file} — ${e.reason}` })

  if (input.projects === null) problems.push({ code: 'MISSING_FILE', says: 'workspace/projects.yaml is not in that folder, so it is not a Fabric workspace' })
  if (input.agents === null) problems.push({ code: 'MISSING_FILE', says: 'workspace/agents.yaml is not in that folder, so it is not a Fabric workspace' })

  const projects = input.projects ?? []
  const agents = input.agents ?? []

  const seenProjects = new Set<string>()
  for (const p of projects) {
    const id = typeof p.id === 'string' ? p.id : ''
    if (!id) {
      problems.push({ code: 'MISSING_FIELD', says: 'a project in projects.yaml has no id, and an import preserves ids — there is nothing to preserve' })
      continue
    }
    if (seenProjects.has(id))
      problems.push({
        code: 'DUPLICATE_ID',
        says: `two projects share the id ${id}. Importing both would make the second silently win, and everything pointing at that id would follow it.`
      })
    seenProjects.add(id)
  }

  const seenAgents = new Set<string>()
  for (const a of agents) {
    const id = typeof a.id === 'string' ? a.id : ''
    const projectId = typeof a.project_id === 'string' ? a.project_id : ''
    if (!id) {
      problems.push({ code: 'MISSING_FIELD', says: 'an agent in agents.yaml has no id' })
      continue
    }
    if (seenAgents.has(id)) problems.push({ code: 'DUPLICATE_ID', says: `two agents share the id ${id}` })
    seenAgents.add(id)
    // CROSS-REFERENCE, checked before the write rather than discovered by a
    // foreign key halfway through it. An agent whose project is absent is a
    // binding to nothing, and the old path appended it anyway.
    if (projectId && !seenProjects.has(projectId))
      problems.push({
        code: 'DANGLING_REFERENCE',
        says: `the agent ${String(a.name ?? id)} belongs to project ${projectId}, which is not in projects.yaml. Importing it would leave a binding to nothing.`
      })
  }

  const { says } = restorability(coverage)
  return {
    ok: problems.length === 0,
    problems,
    counts: { projects: projects.length, agent_bindings: agents.length },
    coverage,
    says,
    inputDigest: input.inputDigest
  }
}
