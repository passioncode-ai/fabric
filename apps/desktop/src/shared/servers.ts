// #region session-products — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#decision
// Which MCP servers a session may reach besides Fabric's own, and in what form (M127, CO-194, REQ-04 of 0.4.0).
//
// A session's mcp.json carries Fabric's surface FIRST, and after it only the family products the PROJECT GRANTS: the
// names in the project's `mcp_servers` setting (written by the operator in the project's settings, journalled with
// its config revision) — for a created agent, the subset it asked for, checked against that ceiling again at launch.
// A grant withdrawn there is gone from the next session.
//
// ONLY A SERVER THAT NEEDS NO CREDENTIAL IN THE FILE. The session-handoff contract (DEC-0042, SH-9) lets a session's
// mcp.json carry, on any server other than the first, only a delegation token minted for that session; Fabric mints
// none yet (ADR-0144 §1, wave 4). ADR-0144 amendment 4 sets where proof starts: on this machine a product whose own
// registry entry declares no credential — a provider run over stdio with no secret in its environment, or a provider
// on a loopback URL with no auth — is added as it is; a product that needs a key (a service with its descriptor token,
// a provider whose stdio environment names a secret) is REFUSED with that reason, never handed another service's
// token, never its key. The machine gateway route (role key `x-agw-key`, FABRIC_AGW_KEY), off since 2026-09-14, is
// removed: it was the one place a credential other than the session's own was written into the bundle.
//
// AND A PARTIAL GRANT IS THE DEFECT, not a degradation. A session that starts without a server its project grants
// looks for a tool, does not find it, and improvises — so one refusal blocks the launch and names what would fix it,
// before the process exists (M61's preflight).

/** The server name Fabric's surface goes under; no product may take it. */
export const SURFACE_NAME = 'fabric'

/** A product as a session reaches it: the registry key it is granted by, and the transport its entry declares. */
export interface SessionProduct {
  /** The registry key (`id`, or `id.instance` for a service) — what the project's setting names. */
  name: string
  label: string
  server: { kind: 'stdio'; command: string; args: string[] } | { kind: 'http'; url: string }
}

/** What this machine's registry offers a session: the products it may carry, and the ones it may not, with why. */
export interface ProductOffer {
  products: SessionProduct[]
  blocked: Array<{ name: string; label: string; reason: string }>
}

export interface Refusal {
  name: string
  /** Said to the operator, so it names the act that would fix it. */
  reason: string
}

export type ServerPlan =
  | { ok: true; grant: SessionProduct[] }
  | { ok: false; refusals: Refusal[]; grant: SessionProduct[] }

/** The products a project's granted names resolve to, all of them or a refusal for each that does not. */
export function planServers(granted: readonly string[], offer: ProductOffer): ServerPlan {
  const grant: SessionProduct[] = []
  const refusals: Refusal[] = []
  for (const name of [...new Set(granted)]) {
    if (name === SURFACE_NAME) {
      refusals.push({ name, reason: 'the name of Fabric’s own surface; a product cannot take it. Remove it from the project’s servers.' })
      continue
    }
    const product = offer.products.find((p) => p.name === name)
    if (product) { grant.push(product); continue }
    const blocked = offer.blocked.find((b) => b.name === name)
    refusals.push({
      name,
      reason: blocked
        ? `${blocked.reason} Remove it from the project’s servers, or reach it through Fabric’s hub.`
        : 'not a product registered on this Mac. Install it, or remove it from the project’s servers, then open the session again.'
    })
  }
  // The grant is returned even when refused: the operator's question is "what did it get and what did it not".
  return refusals.length === 0 ? { ok: true, grant } : { ok: false, refusals, grant }
}

/** One sentence naming every refusal, for the banner and the journal. */
export function describeRefusals(refusals: readonly Refusal[]): string {
  return refusals.map((r) => `${r.name} is ${r.reason}`).join(' ')
}
// #endregion session-products
