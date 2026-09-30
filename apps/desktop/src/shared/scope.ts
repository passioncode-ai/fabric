// The scope floor: which rows a caller is allowed to reach (S02.a).
//
// MEASURED BEFORE THIS FILE EXISTED. `main/` runs 116 queries against the
// projections and 87 of them carry no estate predicate — while `estate_id` is
// already a column on 23 of the 26 tables. The column was there the whole time;
// the query omitted it. That is not a discipline problem, and "remember the
// predicate" is not its fix: the safe query was LONGER than the unsafe one, so
// the unsafe one is what got written eighty-seven times.
//
// So this module does not add a predicate. It moves the decision out of the call
// site: a table is narrowed by the map below or it is REFUSED. A map that
// silently passes through what it does not recognise is a suggestion rather than
// a floor, and the next table added to the schema is exactly the one nobody
// remembers to scope.
//
// WHAT THIS DOES NOT DO, stated because the difference is the whole security
// claim. Fabric connects with the service role, which bypasses RLS by design, so
// this stops FABRIC'S OWN QUERIES from reaching another estate's rows. It is not
// a sandbox and does not survive a compromised main process (CO-090); the
// database-side half — grants and RLS — is a separate slice (S02.c).

/**
 * What one caller may see. Derived in the trusted process — from the window's
 * project selection or a minted agent credential — and NEVER from a renderer or
 * MCP payload. A caller-supplied estate or project id is a request to look at
 * something, not the authority to look at it.
 */
export type Scope =
  | { kind: 'estate'; estateId: string }
  | { kind: 'project'; estateId: string; projectId: string }

/**
 * How one table narrows to a scope.
 *
 * `estate` names the column holding the estate id — usually `estate_id`, but
 * `estates` itself keys on `id`, and getting that wrong returns zero rows, which
 * is P21's failure mode exactly: a missing grant and a wrong predicate both look
 * like an empty table.
 *
 * `project` names the column holding the project id, or `null` when the table is
 * estate-wide and a project scope should still see all of it.
 *
 * `global` marks a table that genuinely belongs to no estate — and carries the
 * REASON, because an exemption without one is how a floor leaks.
 */
export type TableScope =
  | { estate: string; project: string | null }
  /**
   * Has a project column, and narrowing by it would be WRONG. `grants` is the
   * case: a NULL `project_id` means estate-wide on purpose — a file-overwrite
   * grant is taken outside any project — so a project-scoped read that filtered
   * on the column would hide exactly the grants that apply everywhere. Carries
   * the reason, because an exemption without one is how a floor leaks.
   */
  | { estate: string; project: null; projectMeansEstateWideWhenNull: string }
  | { global: string }
  /** No generic Estate/Project access; use an owner-authorized command/reader. */
  | { private: string }

const ESTATE_AND_PROJECT: TableScope = { estate: 'estate_id', project: 'project_id' }
const ESTATE_ONLY: TableScope = { estate: 'estate_id', project: null }

/**
 * Every table in `supabase/migrations`, and how it narrows. `scope.test.ts`
 * compares this map against the migrations in BOTH directions: a table with no
 * entry fails the suite, and an entry naming a column the table does not have
 * fails it too. That is what keeps the map from drifting into the silent-empty
 * failure it exists to prevent.
 */
export const TABLE_SCOPE: Record<string, TableScope> = {
  estate_restore_boundaries: { private: 'protected restore provenance; dedicated current-membership-authorized reader only' },
  ceo_conversations: { private: 'private Person/subject identity; dedicated CEO authorization only' },
  ceo_private_contents: { private: 'immutable private discussion; dedicated owner-authorized reader only' },
  ceo_messages: { private: 'private ordered message identities; dedicated CEO reader only' },
  ceo_operations: { private: 'private canonical intent and receipt; dedicated CEO commands only' },
  ceo_pending_requests: { private: 'private pending input, not execution authority; dedicated CEO commands only' },
  ceo_receipt_refs: { private: 'opaque replay projection; journal is the permitted public receipt surface' },
  ceo_write_authorizations: { private: 'transaction-only authorization; no generic reader or writer' },
  ceo_private_import_receipts: { private: 'one Person\'s private import receipt; dedicated owner-authorized receipt reader only' },
  ceo_content_provenance: { private: 'where one Person\'s imported text came from; written by the import command, read by the private export only' },
  agent_bindings: ESTATE_AND_PROJECT,
  agent_stages: ESTATE_AND_PROJECT,
  goals: ESTATE_AND_PROJECT,
  grant_reservations: ESTATE_AND_PROJECT,
  journal: ESTATE_AND_PROJECT,
  leases: ESTATE_AND_PROJECT,
  memory_facts: ESTATE_AND_PROJECT,
  memory_occurrences: ESTATE_AND_PROJECT,
  memory_retrievals: ESTATE_AND_PROJECT,
  project_repos: ESTATE_AND_PROJECT,
  project_tasks: ESTATE_AND_PROJECT,
  proposals: ESTATE_AND_PROJECT,
  question_blocks: ESTATE_AND_PROJECT,
  question_deferrals: ESTATE_AND_PROJECT,
  // The receipt of a set-aside or a return: estate-scoped, and read by nothing but its command.
  question_deferral_commands: ESTATE_ONLY,
  question_resolutions: ESTATE_AND_PROJECT,
  questions: ESTATE_AND_PROJECT,
  releases: ESTATE_AND_PROJECT,
  // The receipt of a recorded release or verification: estate-scoped, read by nothing but its command.
  release_commands: ESTATE_ONLY,
  routines: ESTATE_AND_PROJECT,
  session_context_packs: ESTATE_AND_PROJECT,
  deliveries: ESTATE_AND_PROJECT,
  continuation_dispatches: ESTATE_AND_PROJECT,
  transcript_recovery_authorizations: ESTATE_AND_PROJECT,
  run_stop_commands: ESTATE_AND_PROJECT,
  run_launch_compensations: ESTATE_ONLY,
  task_runs: ESTATE_AND_PROJECT,
  session_heartbeats: ESTATE_AND_PROJECT,
  session_transcripts: ESTATE_AND_PROJECT,
  task_handoffs: ESTATE_AND_PROJECT,
  task_links: ESTATE_AND_PROJECT,
  task_notes: ESTATE_AND_PROJECT,

  // ADR-0050 gave the table a project. Before that it was estate-only and the
  // row genuinely had no narrower home; now an agent credential minted for one
  // project must not read — or report against — another project's effect by
  // knowing its id.
  effect_intents: ESTATE_AND_PROJECT,
  effect_attempts: ESTATE_ONLY,
  estate_settings: ESTATE_ONLY,
  grants: {
    estate: 'estate_id',
    project: null,
    projectMeansEstateWideWhenNull:
      'a NULL project_id is an estate-wide grant, so narrowing by project would hide the grants that apply everywhere'
  },
  memberships: ESTATE_ONLY,

  // The estate row keys on `id`. Narrowing it by `estate_id` would compile,
  // return nothing, and read as "no such estate".
  estates: { estate: 'id', project: null },

  // A project row keys on `id` too, so a PROJECT scope selects the row itself
  // while an estate scope lists them all.
  projects: { estate: 'estate_id', project: 'id' },

  persons: {
    global:
      'a person is not owned by an estate — `memberships` is the edge, and scoping this table would hide a person who belongs to two'
  },
  event_types: {
    global: 'the event-type registry is identical for every estate; it is schema, not data'
  },
  // Estate-scoped and deliberately NOT project-scoped: a membership is an
  // estate fact, so the command that changed one has no project to belong to.
  membership_commands: { estate: 'estate_id', project: null }
}

/** A table the map has never heard of. Refused rather than passed through. */
export class UnscopedTable extends Error {
  readonly table: string
  constructor(table: string) {
    super(
      `\`${table}\` has no entry in TABLE_SCOPE, so there is no way to narrow it to one estate. ` +
        `Add it to apps/desktop/src/shared/scope.ts — as scoped columns, or as global with the reason.`
    )
    this.name = 'UnscopedTable'
    this.table = table
  }
}

export function tableScope(table: string): TableScope {
  const policy = TABLE_SCOPE[table]
  if (!policy) throw new UnscopedTable(table)
  return policy
}

/**
 * The predicates that narrow `table` to `scope`, as `[column, value]` pairs —
 * pure, so the decision is testable without a database.
 *
 * Empty means the table is global, which is a decision the map states rather
 * than an accident: `[]` from here and `[]` from a missing entry would be
 * indistinguishable, so a missing entry throws instead.
 */
export function scopeFilters(table: string, scope: Scope): Array<[string, string]> {
  const policy = tableScope(table)
  if ('private' in policy) throw new Error('private_table_requires_authorized_port')
  if ('global' in policy) return []
  const filters: Array<[string, string]> = [[policy.estate, scope.estateId]]
  if (scope.kind === 'project' && policy.project) filters.push([policy.project, scope.projectId])
  return filters
}

/**
 * The scope columns a NEW row must carry — which is not the same list as the
 * one that narrows a read, and conflating them writes a bug that only shows up
 * on insert.
 *
 * `projects` narrows by `id` and `estates` narrows by `id`, because that is
 * where the identifier lives when the row IS the estate or the project. But `id`
 * is the row's own key, not a statement of ownership, and forcing it from a
 * scope would rename the row being inserted. So a narrowing column named `id` is
 * dropped here — true by construction in this schema, and asserted in the test
 * rather than left as a comment.
 */
export function scopeOwnership(table: string, scope: Scope): Array<[string, string]> {
  return scopeFilters(table, scope).filter(([column]) => column !== 'id')
}

/** Is this scope allowed to touch that project? Used where an id arrives from
 *  outside and the answer must be the same as "no such project" (S02 invariant:
 *  an unauthorised object and an absent one look identical from outside). */
export function withinScope(scope: Scope, projectId: string): boolean {
  return scope.kind === 'estate' || scope.projectId === projectId
}
