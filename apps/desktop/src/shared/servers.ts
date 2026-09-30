// Which MCP servers a session may reach, and through what (M127).
//
// Today a session sees Fabric's tools and nothing else: the bundle writes one
// server and launches with `--strict-mcp-config`. That is a good default and a
// dead end — an agent that needs to read Linear or Sentry cannot, and M125's
// created agents will each need something.
//
// THE QUESTION M127 EXISTS TO ANSWER is not "how do we add a server" but through
// WHAT, and the three answers have different blast radii:
//
//   * DIRECT — the upstream server and its key written into the session bundle.
//     Refused here, and not as "unimplemented": `agent-composition.md` §4 states
//     that credentials are scoped per hop and never handed down whole, and a key
//     on disk in a session directory is exactly the superset that rule forbids.
//     A refusal by design says so, so nobody implements it later thinking the
//     gap was an oversight.
//   * FABRIC — proxied through our own surface, so every call is seen, meterable
//     and refusable. It is the right long answer and it is not built; declared
//     and unimplemented REFUSES, the same shape as an unknown surface adapter.
//   * GATEWAY — the machine's agentgateway, which already holds upstream keys at
//     mode 600 and applies a role key per hop. `agent-composition.md` already
//     settled this: "the fabric's mcp transport is a client of it, not a
//     reimplementation of it."
//
// AND A PARTIAL GRANT IS THE DEFECT, not a degradation. A session that starts
// without a server it declared will look for a tool, not find it, and improvise —
// failing mid-run for a reason nobody recorded. So one refusal blocks the launch
// and names what would fix it. This is M61's preflight applied at the one moment
// it costs nothing: before the process exists.

export type ServerSource = 'gateway' | 'fabric' | 'direct'

export interface DeclaredServer {
  /** The name the source knows it by. */
  name: string
  source: ServerSource
}

export interface GatewayFacts {
  /** Origin only — `http://127.0.0.1:4000` — or null when this machine has none. */
  origin: string | null
  /**
   * Server name to the PATH the gateway serves it at, read from the gateway's
   * own configuration rather than reconstructed.
   *
   * This shape exists because the first version of this module guessed the route
   * as `<origin>/<name>` and the real one is `<origin>/mcp/<name>`. Every grant
   * would have pointed at nothing — a session started with a server it could not
   * reach, which is the failure the all-or-nothing rule below exists to prevent,
   * arriving through the door that rule does not watch. A convention Fabric
   * cannot verify is a convention Fabric must not invent.
   */
  routes: Readonly<Record<string, string>>
  /**
   * The role key the gateway authorises a hop with, or null when Fabric has not
   * been given one.
   *
   * FABRIC DOES NOT DISCOVER IT. A key sits in the operator's own agent
   * configuration on this machine, and reading another agent's config to borrow
   * its credential is precisely the move this product refuses elsewhere. It is
   * supplied through the environment and never stored: a key in `projects` is a
   * secret in the database and in every backup of it.
   *
   * Without one a granted server would be written into the bundle and answer 401
   * the first time the agent used it — a failure mid-run, for a reason nobody
   * recorded. Absent, and said so, is the whole of this codebase's answer to
   * that.
   */
  key: string | null
}

export interface Granted {
  name: string
  url: string
  /** The role key for the hop. Written into the session bundle at 0600 and
   *  destroyed with it — never into the journal, and never into a table. */
  key: string
}

export interface Refusal {
  name: string
  /** Said to the operator, so it names the act that would fix it. */
  reason: string
}

export type ServerPlan =
  | { ok: true; grant: Granted[] }
  | { ok: false; refusals: Refusal[]; grant: Granted[] }

export function planServers(declared: readonly DeclaredServer[], gateway: GatewayFacts): ServerPlan {
  const grant: Granted[] = []
  const refusals: Refusal[] = []

  for (const d of declared) {
    switch (d.source) {
      case 'direct':
        refusals.push({
          name: d.name,
          reason:
            'reached directly, which would write an upstream credential into the session ' +
            'directory. Credentials are scoped per hop and never handed down whole — declare ' +
            'it through the gateway instead.'
        })
        break
      case 'fabric':
        refusals.push({
          name: d.name,
          reason:
            'proxied through Fabric, which nobody has built. It is the right answer and it ' +
            'is not here yet; the gateway is what works today.'
        })
        break
      case 'gateway':
        if (!gateway.origin)
          refusals.push({
            name: d.name,
            reason:
              'served by the machine gateway, and this machine has none reachable. Start it, ' +
              'or remove the server from this project.'
          })
        else if (!(d.name in gateway.routes))
          refusals.push({
            name: d.name,
            reason: `not among the ${Object.keys(gateway.routes).length} servers the gateway declares. Add it to the gateway, then re-open the session.`
          })
        else if (!gateway.key)
          refusals.push({
            name: d.name,
            reason:
              'served by the gateway, and Fabric has no role key to reach it with. Set ' +
              'FABRIC_AGW_KEY in the environment Fabric runs in — it is never stored here.'
          })
        else
          grant.push({
            name: d.name,
            url: gateway.origin.replace(/\/+$/, '') + gateway.routes[d.name],
            key: gateway.key
          })
        break
    }
  }

  // The grant is returned even when refused, because the operator's question is
  // "what did it get and what did it not", and an empty list answers neither.
  return refusals.length === 0 ? { ok: true, grant } : { ok: false, refusals, grant }
}

/** One sentence naming every refusal, for the banner and the journal. */
export function describeRefusals(refusals: readonly Refusal[]): string {
  return refusals.map((r) => `${r.name} is ${r.reason}`).join(' ')
}

/**
 * What a gateway configuration says it serves.
 *
 * NOT A YAML PARSER, and the limits are stated so nobody mistakes it for one. It
 * reads exactly two things from `agentgateway`'s generated `config.yaml`:
 *
 *   * the listener port, as the first `port:` indented under `gateways:`. The
 *     file also carries upstream `port: 443` entries nested six levels deeper,
 *     so "the first port in the file" is the wrong rule and this one is measured
 *     against the real shape (`gateways: / default: / port: 4000`).
 *   * every `pathPrefix: /…/<name>` line, which is where the gateway actually
 *     serves each server. The NAME is the last path segment, and the PATH is
 *     kept whole — Fabric does not reconstruct a route it can read.
 *
 * Anything it cannot find is absent rather than defaulted: a gateway whose
 * config this cannot read reports no origin, every declared server is refused,
 * and the operator is told, which beats a session launched against a guess.
 */
export function parseGatewayConfig(yaml: string): GatewayFacts {
  // The key is NOT read from the configuration: it is supplied by whoever runs
  // Fabric. This function reports what the gateway offers, not how to get in.
  const lines = yaml.split('\n')
  let origin: string | null = null

  const at = lines.findIndex((l) => /^gateways:\s*$/.test(l))
  if (at >= 0)
    for (let i = at + 1; i < lines.length; i++) {
      // A line back at column zero has left the gateways block.
      if (/^\S/.test(lines[i])) break
      const m = lines[i].match(/^\s{2,8}port:\s*(\d+)\s*$/)
      if (m) {
        origin = `http://127.0.0.1:${m[1]}`
        break
      }
    }

  const routes: Record<string, string> = {}
  for (const l of lines) {
    const m = l.match(/^\s*pathPrefix:\s*"?(\/[A-Za-z0-9._\/-]+?)"?\s*$/)
    if (!m) continue
    const path = m[1].replace(/\/+$/, '')
    const name = path.slice(path.lastIndexOf('/') + 1)
    if (name && !(name in routes)) routes[name] = path
  }

  return { origin, routes, key: null }
}
