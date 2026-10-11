// #region session-products-offer — docs: docs/adr/0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md#decision
// What this Mac's agent registry offers a Fabric-launched session (CO-194, REQ-04): the family products a session may
// carry without any credential in its mcp.json, and those it may not, each with its reason (shared/servers.ts says why
// only those). Read from the registry snapshot — the same files the consent prompt names agents by — never probed.
import type { RegistryEntry } from './agentRegistry.ts'
import { SURFACE_NAME, type ProductOffer } from '../shared/servers.ts'

export function productOffer(entries: readonly RegistryEntry[]): ProductOffer {
  const offer: ProductOffer = { products: [], blocked: [] }
  for (const e of [...entries].sort((a, b) => a.key.localeCompare(b.key))) {
    const label = e.name
    if (e.key === SURFACE_NAME) {
      offer.blocked.push({ name: e.key, label, reason: 'named like Fabric’s own surface, so it cannot be told apart from it.' })
      continue
    }
    if (e.kind === 'service') {
      // A service answers with its descriptor token, and a session may carry no other service's token (SH-9).
      offer.blocked.push({ name: e.key, label, reason: 'a service that needs its own token, and a session may carry no token but its own until Fabric mints delegation tokens (ADR-0144).' })
      continue
    }
    if (e.mcp?.transport === 'stdio') {
      if (e.mcp.secretEnv) {
        offer.blocked.push({ name: e.key, label, reason: 'a provider whose environment names a secret, and Fabric writes no secret into a session.' })
        continue
      }
      const [command, ...args] = e.mcp.command
      offer.products.push({ name: e.key, label, server: { kind: 'stdio', command, args } })
      continue
    }
    if (e.mcp?.transport === 'streamable-http') {
      // The registry admits only http://127.0.0.1:<port>/mcp for a provider: on this machine, with no auth declared.
      offer.products.push({ name: e.key, label, server: { kind: 'http', url: e.mcp.url } })
      continue
    }
    offer.blocked.push({ name: e.key, label, reason: 'an entry that declares no MCP server a session can reach.' })
  }
  return offer
}
// #endregion session-products-offer
