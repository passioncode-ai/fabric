# The fabric is an estate tool, and the product branch is a named seam

- **Status:** Accepted
- **Consequences / affects:** `docs/vision.md`, `docs/architecture/agent-family.md`, `docs/architecture/agent-composition.md` §8 and §13, `docs/evidence/backlog.md`, `docs/evidence/specs/…-carryover.md` (CO-028, CO-045, CO-046, CO-047, CO-048)
- **Source:** operator decision, 2026-08-26, resolving CO-028

`docs/vision.md` said this is **not a hosted product** and **not a general-purpose agent
framework** — it exists to run *this* estate. The agent-family proposal of 2026-08-24 said
each agent "generates revenue and is an onboarding entry point for a new user", and the
marketplace proposal of 2026-08-25 added author payouts. An agent with revenue has customers
who are not the operator, so both statements could not be true at once.

**The fabric is an estate tool.** One operator, one tenant. The floor protects one person's
money, deletions and name. Terminals run the operator's own code on the operator's own
machine (ADR-0008). There is no support role, because there is nobody to support.

## Why this and not the other branch

Not because the product branch is worse. Because **it was arriving without being chosen.**
CO-046 recorded the mechanism: three proposals in a row assumed users who are not the
operator while the row deciding that was still marked STOP AND ASK. A scope that arrives by
accumulation is a scope nobody costed, and the cost is not small — the branches differ at
the schema, not at the edges:

| | Estate tool — chosen | Product family — deferred |
|---|---|---|
| Tenancy | single, and the schema may assume it | multi-tenant and isolated, from the first migration |
| The floor | protects one person | becomes a compliance surface with an audit obligation |
| Third-party code | the operator chooses to run it, on their own machine | runs on infrastructure we are responsible for |
| Credentials | ours, scoped per hop | a customer's, held in custody — a breach is their loss |
| Failure cost | a bad afternoon | a refund, a dispute, a reputation |

The estate is the problem that was actually measured: 40 domains, of which 7 answer an error
to 16 075 recorded visits and 8 are zones with no DNS at all. Nothing about serving other
people's estates is measured, and building for it first would be building for a user nobody
has met.

## The seam, named — because "deferred" is not "impossible"

The product branch is not deleted. It is recorded here with its price, so a later decision
reverses this one deliberately instead of drifting back:

1. **Tenancy in the schema.** Every row that today may assume one operator gains a tenant,
   and the migration that adds it is the expensive one. Deciding *later* costs a rewrite of
   the registry, the graph and the run log; deciding *never* costs nothing.
2. **A sandbox, not a trust tier** (CO-045). Tiers describe a provider the operator chose to
   run. Someone else's agent on our infrastructure is an isolation problem with a machine
   boundary, and Cursor's shipped answer — one isolated machine per subagent — is cheap only
   at their scale.
3. **Credential custody** (CO-047). Spending a customer's key is a different obligation from
   spending our own, and per-hop scoping does not address it.
4. **Metering, payouts, tax residency and refunds** (CO-048), plus metering that survives a
   disputed invoice.

**What must be true to reverse this decision:** a named buyer who is not the operator, and a
costed answer to all four. A new ADR that says so supersedes this one; nothing else does.

## What this decision does NOT close

Stated because an ADR is read as closing more than it says, and four of these are the ones
the agent layer still has to answer:

- **CO-035** — whether `seo-advisor`, `ops-watch` and `support-manager` file goals or nodes.
  Untouched: it is a question about *our own* decomposition authority.
- **CO-036** — a standing channel grant, or no reply agents. Untouched: the floor is the
  operator's own name either way.
- **CO-038** — whether the outbound agents speak as the operator or as product identities,
  and the fact that no account is a registered asset.
- **CO-040** — lead collection is personal data. This decision makes the exposure the
  operator's own rather than a customer's; it does not make it disappear.

## Consequences

- `agent-composition.md` **§13 (a marketplace where users deploy agents) is out of scope by
  this decision** and stays as a recorded proposal, marked, rather than a live design.
- `agent-family.md`'s framing of each agent as revenue-generating and as an onboarding entry
  point is **not** the design; the roles remain, the revenue premise does not.
- `agent-composition.md` §8's trust tiers stay — the operator adding an agent they chose is
  exactly the case they were written for.
- CO-046, CO-047 and CO-048 close. CO-045 narrows to "the operator runs someone else's agent
  on their own machine", which is the same ground CO-019 already holds.
