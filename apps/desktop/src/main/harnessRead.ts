/**
 * Reading the harness snapshot, per source and per scope (UX28-05).
 *
 * Extracted from the IPC handler for the same reason `digestRead.ts` was: the
 * interesting part is a set of decisions about what is and is not known, and a
 * decision inside a handler can only be tested by standing up an Electron
 * process.
 *
 * WHAT WAS WRONG. Three grant figures came from `{ count: 'exact', head: true }`
 * reads whose `error` was never looked at, followed by `live.count ?? 0`. A
 * refused read became "no live authority in this project" — the reassuring
 * answer, and the one the panel had no evidence for. Fifth appearance of that
 * shape here; the first where the empty answer flatters the system.
 *
 * And the handler took `projectId` and never used it. Every figure was
 * estate-wide while the panel carried the project's name.
 */

import { envelope, type ReadEnvelope, type SourceReceipt } from '../shared/readEnvelope.ts'
import type {
  EstateWideField,
  Harness,
  HarnessAgent,
  HarnessGrants,
  HarnessServer
} from '../shared/harness.ts'
import type { LaunchOption, SurfaceTool } from '../shared/types.ts'
import type { ScopedStore } from './scopedStore.ts'

/**
 * `grants` has NO `project_id` column — a grant is an estate-level object by
 * its own schema (`migration_one.sql`: estate_id, floor_class, target,
 * precondition, expires_at, issued_by, consumed_at). The card offers two
 * routes, filter by project or label the estate-only counts, and only the
 * second exists without a schema change nobody has decided.
 *
 * Declared as data so the panel cannot forget to say it, and so a grant that
 * one day carries a project simply leaves this list.
 */
export const ESTATE_WIDE: readonly EstateWideField[] = ['grants']

/** A count read, with its refusal kept rather than defaulted to zero. */
interface Counted {
  count: number | null
  error: { message: string } | null
}

const receipt = (name: string, r: Counted, at: string): SourceReceipt =>
  r.error
    ? { name, status: 'error', asOf: null, errorCode: r.error.message }
    : { name, status: 'ok', asOf: at }

/**
 * The three grant figures, or the fact that they could not be read.
 *
 * One envelope rather than three, because they are three counts of one table:
 * a `live` that answered beside a `spent` that refused is a partial reading of
 * the same thing, and `envelope` derives exactly that from the receipts. When
 * nothing answered it forces `data` to null itself — the caller cannot hand
 * back a zero it did not measure.
 */
export async function grantsOf(
  store: ScopedStore,
  estateId: string,
  now: string
): Promise<ReadEnvelope<HarnessGrants>> {
  const [live, spent, expired] = (await Promise.all([
    store
      .select('grants', 'id', { count: 'exact', head: true })
      .eq('estate_id', estateId)
      .is('consumed_at', null)
      .gt('expires_at', now),
    store
      .select('grants', 'id', { count: 'exact', head: true })
      .eq('estate_id', estateId)
      .not('consumed_at', 'is', null),
    store
      .select('grants', 'id', { count: 'exact', head: true })
      .eq('estate_id', estateId)
      .is('consumed_at', null)
      .lte('expires_at', now)
  ])) as unknown as [Counted, Counted, Counted]

  const sources = [
    receipt('grants.live', live, now),
    receipt('grants.spent', spent, now),
    receipt('grants.expired', expired, now)
  ]
  return envelope<HarnessGrants>({
    // Read straight through. `envelope` nulls this when nothing answered, and a
    // number here that one of the three refused is what `availability:
    // 'partial'` is for — the surface says which.
    data: {
      live: live.count ?? 0,
      spent: spent.count ?? 0,
      expired: expired.count ?? 0
    },
    sources,
    asOf: now,
    freshness: 'fresh'
  })
}

/**
 * Agents created in THIS project (M125) — not the machine's runners.
 *
 * The same query the `agents:list` handler uses, INCLUDING the filter: a
 * created agent is a binding that carries instructions, and a binding without
 * them is a project's declared reach rather than an agent. Two readers with two
 * definitions of what a created agent is would disagree the day somebody
 * changes one, and this panel exists to be audited against that handler.
 */
export async function projectAgentsOf(
  store: ScopedStore,
  projectId: string,
  now: string
): Promise<ReadEnvelope<HarnessAgent[]>> {
  const read = (await store
    .select('agent_bindings', 'id,role')
    .eq('project_id', projectId)
    .not('instructions', 'is', null)) as unknown as {
    data: { id: string; role: string }[] | null
    error: { message: string } | null
  }
  return envelope<HarnessAgent[]>({
    // `role` is the column; `name` is what the operator calls it. The mapping
    // is `toCreatedAgent`'s, said once here rather than guessed.
    data: (read.data ?? []).map((a) => ({ id: a.id, name: a.role })),
    sources: [
      read.error
        ? { name: 'agent_bindings', status: 'error', asOf: null, errorCode: read.error.message }
        : { name: 'agent_bindings', status: 'ok', asOf: now }
    ],
    asOf: now,
    freshness: 'fresh'
  })
}

/**
 * The whole snapshot.
 *
 * `providers` and `servers` are read from this process rather than from the
 * database, so their receipts say `ok` with this instant — they cannot refuse,
 * and pretending they might would be inventing a failure mode. What they CAN
 * be is empty, which is a measurement and reads as one.
 */
export async function harnessFor(input: {
  store: ScopedStore
  estateId: string
  projectId: string
  now: string
  providers: () => LaunchOption[]
  endpoint: string | null
  tools: readonly SurfaceTool[]
}): Promise<Harness> {
  const { store, estateId, projectId, now } = input
  const [grants, projectAgents] = await Promise.all([
    grantsOf(store, estateId, now),
    projectAgentsOf(store, projectId, now)
  ])

  const servers: HarnessServer[] = input.endpoint
    ? [{ name: 'fabric', endpoint: input.endpoint, strict: true }]
    : []

  return {
    scope: { projectId, estateWide: ESTATE_WIDE },
    providers: envelope<LaunchOption[]>({
      data: input.providers(),
      sources: [{ name: 'launch-options', status: 'ok', asOf: now }],
      asOf: now,
      freshness: 'fresh'
    }),
    projectAgents,
    servers: envelope<HarnessServer[]>({
      data: servers,
      sources: [
        // NOT `ok` with an empty list when the surface never started: "no
        // server is configured" and "the surface is not listening" are
        // different facts, and the panel must not read the second as the
        // first.
        input.endpoint
          ? { name: 'agent-surface', status: 'ok', asOf: now }
          : { name: 'agent-surface', status: 'not_configured', asOf: null }
      ],
      asOf: now,
      freshness: 'fresh'
    }),
    tools: [...input.tools],
    grants
  }
}
