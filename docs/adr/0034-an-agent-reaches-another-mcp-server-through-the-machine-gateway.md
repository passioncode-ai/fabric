# ADR-0034 — An agent reaches another MCP server through the machine's gateway

**Status:** accepted · 2026-09-05 · supersedes nothing · M127

**Successor note, 2026-10-04:** superseded by [ADR-0105](0105-agent-memory-lives-in-project-observatory.md). The replacement local registered-agent route is specified by [ADR-0115](0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md). The machine-gateway implementation below is historical, not the current route.

## Context

A session sees Fabric's tools and nothing else. The bundle writes one server and
launches with `--strict-mcp-config`, so an agent that needs Linear, Sentry or a
docs index cannot have it. M125 (an agent created from a prompt) cannot land
until this is answered, because the first thing such an agent declares is what it
needs to reach.

The question is not how to add a server but **through what**, and the three
answers have different blast radii.

## Decision

**Through the machine's agentgateway, and nothing else is implemented.**

| Route | Blast radius | Verdict |
|---|---|---|
| Direct — the upstream server and its key in the session bundle | an upstream credential on disk in a session directory, usable for anything that server offers, unmetered and unobserved | **refused by design** |
| Through Fabric — proxied by our own surface | every call seen, meterable and refusable; needs a proxy and tool discovery per server | right long answer, **not built** |
| Through the gateway — `x-agw-key` per hop | the gateway holds upstream keys at mode 600 and applies a role key per hop | **implemented** |

`agent-composition.md` §4 already stated the rule this rests on: credentials are
scoped per hop and never handed down whole, and "the fabric's `mcp` transport is
a client of [the gateway], not a reimplementation of it". This ADR is that
sentence made operable.

Four consequences follow, and each is a refusal rather than a default:

1. **Direct is refused as a decision, not as a gap.** The refusal text says the
   credential rule, so nobody implements it later believing the omission was an
   oversight.
2. **A partial grant is the defect.** One refusal blocks the launch. Started with
   three of its four servers, an agent looks for the fourth tool, does not find
   it, and improvises — failing mid-run for a reason nobody recorded. The check
   runs before the credential is minted and before the directory exists.
3. **The route is read, never composed.** The gateway's own configuration says
   where each server is served. The first draft of this composed
   `<origin>/<name>`; the real shape is `<origin>/mcp/<name>`, so every grant
   would have pointed at nothing. A convention Fabric cannot verify is a
   convention Fabric must not invent.
4. **The role key is given, never discovered.** It comes from `FABRIC_AGW_KEY` in
   the environment Fabric runs in and is stored nowhere: a key in `projects` is a
   key in every backup, and reading one out of another agent's configuration to
   borrow it is the move this product refuses elsewhere. Without a key a served
   server is refused rather than written into the bundle to answer 401 later.

The declaration lives on the **project**, not on the agent descriptor: it is an
authority decision the operator owns, and the same agent is trusted with
different things in different projects. When M125 lands, what an agent ASKS for
is checked against this list rather than replacing it.

## Consequences

- A project with no declared servers behaves exactly as before. The default is
  unchanged and is still `--strict-mcp-config` with Fabric alone.
- Fabric gains a dependency on a component it does not own. When the gateway is
  absent, stopped, or serving something else, sessions in projects that declare
  servers refuse to start, naming what would fix it. That is the intended
  failure: the alternative is a session that starts and discovers the absence
  mid-run.
- The renderer is told what the gateway offers and never the key. A secret that
  crosses a bridge it has no use on is a secret in a devtools console.

## Rejected alternatives

- **Write the upstream key into the bundle** — the superset §4 forbids; see the
  table.
- **Proxy every server through Fabric now** — the right shape and a large build:
  tool discovery, schema pass-through, and a per-server adapter. Declared and
  refused rather than half-built, so the refusal names it.
- **Read the operator's own agent configuration for a key** — it is sitting
  there on this machine and it is not ours to borrow.
- **Store the key in `projects`** — a secret in the database and in every backup
  of it, to save one environment variable.
