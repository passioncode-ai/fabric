// #region seed-repair — docs: docs/adr/0131-a-database-only-the-old-seed-has-touched-is-given-to-the-local-operator.md#amendments
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
      p_changed_by: SEED_REPAIR_BY
    })
  }
}
// #endregion seed-repair

// #region seed-retire — docs: docs/adr/0131-a-database-only-the-old-seed-has-touched-is-given-to-the-local-operator.md#decision
/**
 * The second half of the repair (CO-242, Fabric 0.4.0 wave 1, REQ-32). ADR-0131's grant gives the local operator the
 * estate and never revokes, so a repaired database still lists the old seed's `…0002` ("Operator", no sign-in) as an
 * owner beside the operator — an owner nobody runs as, which a member or invitation screen would show as a person.
 * It is retired through the same membership door, as a revoke with its own command and receipt — never a raw delete —
 * and only in the one shape the repair leaves: the default estate, whose local operator is an owner the repair made
 * (`changed_by` = SEED_REPAIR_BY), and whose `…0002` membership is still the seed's own (revision 1, changed by
 * nobody) for a person with no sign-in. Anything else is a decision somebody made, and is left.
 * The revoke is compare-and-set at the revision read, so a membership that moved meanwhile is not removed.
 */
export const SEED_REPAIR_BY = 'desktop-bootstrap:seed-repair'
export const SEED_RETIRE_BY = 'desktop-bootstrap:seed-retire'

export interface MemberDetail { person_id: string; role: string; revision: number; changed_by: string | null; created_at: string }

/** The calls the retirement makes; `seedRetireDb` is the real one. */
export interface SeedRetireDb {
  memberDetails(estateId: string): Read<MemberDetail[]>
  /** The old seed's person row: whether it can sign in. Null data: no such person. */
  legacyPerson(): Read<{ auth_user: string | null } | null>
  revoke(input: { estateId: string; personId: string; commandId: string; expectedRevision: number }): Read<{ status?: string; says?: string }>
}

/**
 * Null when the old seed's membership is to be retired; otherwise why not, marked `left`: the rule leaves this estate
 * as it is (every later start, once retired, answers "not a member"). A read or a door that failed is not `left`.
 */
export function seedRetireProblem(input: { estateId: string; members: MemberDetail[]; operator: string; legacy: { auth_user: string | null } | null }):
  { why: string; left: true } | null {
  const { estateId, members, operator, legacy } = input
  if (estateId !== DEFAULT_ESTATE) return { why: 'it is not the default estate the seed makes', left: true }
  const old = members.find((m) => m.person_id === LEGACY_SEED_PERSON)
  if (!old) return { why: 'the old seed\'s person is not a member', left: true }
  const me = members.find((m) => m.person_id === operator)
  if (!me || me.role !== 'owner') return { why: 'the operator is not an owner of this estate', left: true }
  if (me.changed_by !== SEED_REPAIR_BY) return { why: 'the operator\'s membership was not given by the seed repair', left: true }
  if (old.revision !== 1 || old.changed_by != null) return { why: 'the old seed\'s membership was changed since the seed wrote it: a decision', left: true }
  if (!legacy) return { why: 'the old seed\'s person could not be found', left: true }
  if (legacy.auth_user != null) return { why: 'the old seed\'s person can sign in', left: true }
  return null
}

export async function retireSeedOwner(
  db: SeedRetireDb,
  input: { estateId: string; operator: string; commandId: string }
): Promise<{ retired: true } | { retired: false; why: string; left?: true }> {
  try {
    const members = await db.memberDetails(input.estateId)
    if (members.error || !members.data) return { retired: false, why: `the estate's members could not be read: ${members.error?.message ?? 'no answer'}` }
    const legacy = await db.legacyPerson()
    if (legacy.error) return { retired: false, why: `the old seed's person could not be read: ${legacy.error.message}` }
    const problem = seedRetireProblem({ estateId: input.estateId, members: members.data, operator: input.operator, legacy: legacy.data })
    if (problem) return { retired: false, ...problem }
    const old = members.data.find((m) => m.person_id === LEGACY_SEED_PERSON) as MemberDetail
    const revoked = await db.revoke({ estateId: input.estateId, personId: LEGACY_SEED_PERSON, commandId: input.commandId, expectedRevision: old.revision })
    if (revoked.error || !revoked.data) return { retired: false, why: `the membership could not be revoked: ${revoked.error?.message ?? 'no answer'}` }
    if (revoked.data.status !== 'committed')
      return { retired: false, why: `the membership door said ${revoked.data.status ?? 'nothing'}: ${revoked.data.says ?? ''}`.trimEnd() }
    return { retired: true }
  } catch (e) {
    // Not silence: the caller records it (`identity.seed-retire`); the start goes on, the estate is the operator's.
    return { retired: false, why: `the retirement could not run: ${e instanceof Error ? e.message : String(e)}` }
  }
}

/**
 * When the operator's own tenure began (CO-242): an estate the repair gave them started for them at the repair — the
 * first start that opened it — not at the old seed's creation event, written when the failed install first started.
 * Null for every other estate: its tenure counts from its first event. The marker is the repair's `changed_by`; a
 * later change of the operator's role through the door replaces it, and the tenure then counts from the first event.
 */
export function operatorStartedAt(membership: { created_at?: string | null; changed_by?: string | null } | null): string | null {
  return membership?.changed_by === SEED_REPAIR_BY && membership.created_at ? membership.created_at : null
}

export function seedRetireDb(client: SupabaseClient): SeedRetireDb {
  return {
    memberDetails: async (estateId) => await client.from('memberships').select('person_id, role, revision, changed_by, created_at').eq('estate_id', estateId),
    legacyPerson: async () => await client.from('persons').select('auth_user').eq('id', LEGACY_SEED_PERSON).maybeSingle(),
    revoke: async ({ estateId, personId, commandId, expectedRevision }) => await client.rpc('change_membership', {
      p_command_id: commandId,
      p_estate_id: estateId,
      p_target_person: personId,
      p_role: null,
      p_action: 'revoke',
      p_expected_revision: expectedRevision,
      p_changed_by: SEED_RETIRE_BY
    })
  }
}
// #endregion seed-retire
