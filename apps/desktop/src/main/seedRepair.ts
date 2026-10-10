// #region seed-repair — docs: docs/adr/0131-a-database-only-the-old-seed-has-touched-is-given-to-the-local-operator.md#decision
/**
 * A database a fresh install of 0.2.0 or 0.3.0–0.3.3 made is opened (CO-241, ADR-0131).
 *
 * Until 0.3.4 the seed (`supabase/seed.sql`) made the default estate's owner a person `…0002` the app
 * never runs as, and migration 58 grants the app's own person only to estates that exist when it runs —
 * none, on a new volume. So every fresh install stopped at "identity could not be established", and its
 * database stays that way after the seed is fixed: a seed runs once.
 *
 * The identity boundary refuses to invent an owner, and this does not loosen it. It grants the local
 * operator ONE estate in ONE shape: the default estate, whose journal is the old seed's creation event and
 * nothing else (but a request an agent made through the hub while that start was failing), whose creation named no owner,
 * whose only member (if any) is the old seed's person, and whose memberships nobody has changed through the door.
 * Nothing has happened in that estate, so there is nothing in it to gain; anything else — an event, a
 * named owner, another member, a chosen or restored estate — is somebody's decision and is left alone.
 * The grant goes through the membership door (`change_membership`, compare-and-set at revision 0), so a
 * membership that moved between the reading and the grant is not overwritten.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_ESTATE } from './activeEstate.ts'

/** The person the seed made the owner before 0.3.4. Never a person the app runs as. */
export const LEGACY_SEED_PERSON = '00000000-0000-0000-0000-000000000002'

/**
 * How many journal events in all, the creation included, an untouched estate may hold; one more is read so that a
 * longer journal is seen, and refused rather than called untouched. 999, so that read (1000 rows) stays within the
 * API's `max_rows` (supabase/config.toml), which would otherwise hide the event past the limit (0.3.4 i3 DA-1, ER-1;
 * held by seed-repair.test.mjs). A 0.3.1–0.3.3 error dialog left open with the hub behind it could gather dozens of
 * unanswered agent requests, and the first limit, 50, refused such a database (i2 DA-1).
 */
export const EVENT_READ_LIMIT = 999

/**
 * The one event a failed start could write without anybody acting: 0.3.1–0.3.3 opened the agent hub before
 * identity and kept it open behind the error, so a registered agent's request reached the estate
 * (`accessService.ts`, the hub's own actor). It grants nothing; a decision on it would be somebody's (0.3.4 i1 DA-1).
 */
function unattended(e: SeedEvent): boolean {
  return e.type === 'access.requested@1' && e.actor?.kind === 'system' && e.actor?.id === 'fabric-hub'
}

export interface SeedEvent { type: string; actor: { kind?: string; id?: string } | null; payload: Record<string, unknown> | null }
export interface SeedMember { person_id: string; role: string }
type Read<T> = Promise<{ data: T | null; error: { message: string } | null }>

/** The calls the repair makes; `seedRepairDb` is the real one. */
export interface SeedRepairDb {
  /** The estate's journal, oldest first, at most EVENT_READ_LIMIT + 1 events. */
  events(estateId: string): Read<SeedEvent[]>
  members(estateId: string): Read<SeedMember[]>
  /** How many membership commands are on record for the estate: each one is a decision somebody made. */
  decisions(estateId: string): Read<number>
  grant(input: { estateId: string; personId: string; commandId: string }): Read<{ status?: string; says?: string }>
}

/** Null when the estate is the old seed's and untouched since; otherwise why it is not. */
export function seedOnlyProblem(input: { estateId: string; events: SeedEvent[]; members: SeedMember[]; decisions: number; operator: string }): string | null {
  const { estateId, events, members, decisions, operator } = input
  if (estateId !== DEFAULT_ESTATE) return 'it is not the default estate the seed makes'
  if (events.length === 0) return 'the estate has no creation event'
  if (events.length > EVENT_READ_LIMIT) return 'the estate has more events than the repair reads'
  const [created, ...after] = events
  if (!after.every(unattended)) return 'the estate has history after its creation'
  if (created.type !== 'estate.created@1' || created.actor?.kind !== 'system' || created.actor?.id !== 'seed')
    return 'the estate was not created by the seed'
  if (created.payload && created.payload.owner_person_id != null) return 'the estate\'s creation named its owner'
  if (members.some((m) => m.person_id === operator)) return 'the operator is already a member'
  if (members.some((m) => m.person_id !== LEGACY_SEED_PERSON)) return 'another person is a member'
  // A grant or a revoke through the membership door leaves a command; undoing a revoke is not a repair (0.3.4 i1 DA-2).
  if (decisions > 0) return 'a membership decision is on record for this estate'
  return null
}

export async function repairSeedOnlyEstate(
  db: SeedRepairDb,
  input: { estateId: string; operator: string; commandId: string }
): Promise<{ repaired: true } | { repaired: false; why: string }> {
  try {
    const events = await db.events(input.estateId)
    if (events.error || !events.data) return { repaired: false, why: `the estate's journal could not be read: ${events.error?.message ?? 'no answer'}` }
    const members = await db.members(input.estateId)
    if (members.error || !members.data) return { repaired: false, why: `the estate's members could not be read: ${members.error?.message ?? 'no answer'}` }
    const decisions = await db.decisions(input.estateId)
    if (decisions.error || decisions.data == null) return { repaired: false, why: `the estate's membership decisions could not be read: ${decisions.error?.message ?? 'no answer'}` }
    const problem = seedOnlyProblem({ estateId: input.estateId, events: events.data, members: members.data, decisions: decisions.data, operator: input.operator })
    if (problem) return { repaired: false, why: problem }
    const granted = await db.grant({ estateId: input.estateId, personId: input.operator, commandId: input.commandId })
    if (granted.error || !granted.data) return { repaired: false, why: `the membership could not be granted: ${granted.error?.message ?? 'no answer'}` }
    if (granted.data.status !== 'committed')
      return { repaired: false, why: `the membership door said ${granted.data.status ?? 'nothing'}: ${granted.data.says ?? ''}`.trimEnd() }
    return { repaired: true }
  } catch (e) {
    // Not silence: the reason is returned, and the caller records it (`identity.seed-repair`) before refusing.
    return { repaired: false, why: `the repair could not run: ${e instanceof Error ? e.message : String(e)}` }
  }
}

/** The calls against the stack, with the service role the main process holds. */
export function seedRepairDb(client: SupabaseClient): SeedRepairDb {
  return {
    events: async (estateId) => await client.from('journal').select('type, actor, payload')
      .eq('estate_id', estateId).order('seq', { ascending: true }).limit(EVENT_READ_LIMIT + 1),
    members: async (estateId) => await client.from('memberships').select('person_id, role').eq('estate_id', estateId),
    decisions: async (estateId) => {
      const { count, error } = await client.from('membership_commands').select('command_id', { count: 'exact', head: true }).eq('estate_id', estateId)
      return { data: error ? null : count ?? null, error }
    },
    grant: async ({ estateId, personId, commandId }) => await client.rpc('change_membership', {
      p_command_id: commandId,
      p_estate_id: estateId,
      p_target_person: personId,
      p_role: 'owner',
      p_action: 'grant',
      p_expected_revision: 0,
      p_changed_by: 'desktop-bootstrap:seed-repair'
    })
  }
}
// #endregion seed-repair
