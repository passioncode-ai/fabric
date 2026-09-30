/**
 * What a session in this project is given, and what the panel cannot know
 * (M145 · SCR-35, corrected by UX28-05).
 *
 * THE OLD SHAPE PUT THREE CLAIMS IN ONE OBJECT and could express none of their
 * failures. `Harness` was four plain fields, so the handler had nowhere to say
 * that a read had refused — and it duly said nothing: three grant counts came
 * from `{ count: 'exact', head: true }` reads whose `error` was never looked
 * at, and then `live.count ?? 0`. A refused read became "no live authority
 * here". That is the FIFTH appearance of one shape in this repository, and the
 * first where the empty answer is wrong in the REASSURING direction: an
 * auditor reading "0 live grants" concludes nothing is authorised.
 *
 * So every field that comes from a read is a `ReadEnvelope` (S14). That type
 * exists for exactly this and its own words say so — `NoSources` is refused
 * because "an answer carrying no measurement is the confident zero this type
 * exists to prevent". CO-111 records that S14's envelope had few consumers;
 * this is one.
 *
 * THREE THINGS WERE CALLED "AGENTS" and the panel showed one row type for all
 * of them:
 *
 *  * **providers** — what this MACHINE has installed, and whether a session
 *    can actually reach it. Declarative configuration and observed capability
 *    are not the same field, which is why `available` is separate from `id`.
 *  * **projectAgents** — agents created IN this project (M125). A different
 *    list, from a different read, and a project with none of its own must say
 *    so rather than showing the machine's.
 *  * **permissionModes** — what a mode is ALLOWED to do, which is authority
 *    rather than capability. A mode carrying `blockedKey` is configured and
 *    refused.
 *
 * AND THE SCOPE IS DECLARED RATHER THAN IMPLIED. The handler took `projectId`
 * and never used it: every grant figure was estate-wide while the panel was
 * titled with this project's name. `grants` has no `project_id` column — a
 * grant is an estate-level object by its own schema — so the card's first
 * route (filter by project) does not exist and its second is taken: the counts
 * are LABELLED estate-wide. Which fields are estate-wide is data, so the panel
 * cannot forget to say it and a future project-scoped grant simply leaves the
 * list.
 */

import type { ReadEnvelope } from './readEnvelope.ts'
import type { LaunchOption, SurfaceTool } from './types.ts'

/** An MCP server a session can reach. */
export interface HarnessServer {
  name: string
  endpoint: string
  /** `--strict-mcp-config`: whatever else this machine has configured is not
   *  visible from inside a Fabric session. */
  strict: boolean
}

/** An agent created in this project (M125), as this panel needs it. */
export interface HarnessAgent {
  id: string
  name: string
}

export interface HarnessGrants {
  live: number
  spent: number
  expired: number
}

/**
 * Which figures in a snapshot are about the whole estate rather than this
 * project.
 *
 * A list rather than a boolean per field, because the answer is a property of
 * the SCHEMA and will change one table at a time. The panel renders the label
 * from this, so a field that becomes project-scoped stops being labelled by
 * being removed from the list — and a field that is added estate-wide is
 * labelled without anyone remembering to.
 */
export type EstateWideField = 'grants'

export interface Harness {
  scope: {
    /** The project this snapshot was read FOR. Two projects must not render
     *  the same snapshot, and this is what makes that checkable. */
    projectId: string
    estateWide: readonly EstateWideField[]
  }
  /** What this machine has installed, and whether a session can reach it. */
  providers: ReadEnvelope<LaunchOption[]>
  /** Agents created in THIS project. Not the machine's runners. */
  projectAgents: ReadEnvelope<HarnessAgent[]>
  servers: ReadEnvelope<HarnessServer[]>
  /**
   * The tool contract this process registers. NOT an envelope: it is a
   * constant in the same runtime as the surface that registers it, so there is
   * no read to fail. `check-surface-tools.mjs` is what keeps that true — the
   * two lists are kept in step by hand and agreed by luck until something
   * refused on divergence.
   */
  tools: SurfaceTool[]
  grants: ReadEnvelope<HarnessGrants>
}

/** Is this figure about the estate rather than this project? */
export function isEstateWide(harness: Harness, field: EstateWideField): boolean {
  return harness.scope.estateWide.includes(field)
}
