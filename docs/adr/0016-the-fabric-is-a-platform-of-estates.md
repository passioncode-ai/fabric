# The fabric is a platform of estates

- **Status:** Accepted
- **Supersedes:** ADR-0011's scope decision, by that record's own reversal condition;
  its price list is retained below and paid line-by-line. Its rule against scope
  arriving by accumulation (CO-046) is upheld — this is a decision, not a drift
- **Consequences / affects:** `CONTEXT.md`, `docs/vision.md`,
  `docs/architecture/federation.md` (new), `docs/evidence/backlog.md` (M38–M41),
  future `supabase/migrations/` (tenant = `estate_id` and `actor_id` from migration 1),
  `docs/ux/` (member surface is M39), the derived reading surfaces (dated as
  pre-federation snapshots)
- **Source:** operator vision, 2026-08-27/28, across design passes 4–6, accepted with
  the price list open

ADR-0011 said the fabric is an estate tool — one operator, one tenant — and deferred
the product branch with a price list and a reversal condition: *"a named buyer who is
not the operator, and a costed answer to all four prices. A new ADR that says so
supersedes this one; nothing else does."* This is that ADR.

**The named buyer:** organizations — AI-agent-native companies — and their people.
Owners who co-manage an organization's agents, chains, connections and analytics;
members who participate in its chains and run personal automations of their own. Each
member's default workspace is itself an organization. The operator's own estate is
org #1, and the client people run — `passion-code` — is finally literally what
`README.md:3` always said it was.

**Decided:**

1. **Organization = Estate**, and the estate is the fabric as already designed —
   projects, agents, chains, connections, vault, journal, memory — instantiated per
   organization. **A personal workspace is the same object** seeded from a `personal`
   template: the move ADR-0013 made for projects (templates seed, they do not type),
   one level up. No second ontology.
2. **Person is a global identity; membership is (person, estate, role).** Two roles at
   v1: `owner` — cardinality N, co-equal, holding settings, analytics, accesses and
   agent management; `member` — participating only at the interaction points a chain
   declares. Human owners do not collide with the one-CEO rule: ADR-0010/0012
   cardinalities govern *agents*; owners are people above the agent hierarchy, and one
   CEO agent reports to all of them.
3. **Tenant = `estate_id`, in the schema from migration 1**, with `actor_id` on every
   journal event. One Postgres with row-level security by membership; **two estates in
   one database still speak to each other through the federation seam (ADR-0017),
   never through a join** — so moving an estate out is a deployment, not a rewrite.
   This closes CO-058: the tenancy question is answered, and the README sentence and
   ADR-0011 stop contradicting each other.
4. **The four prices, paid where they stand:**

   | ADR-0011's price | How it is paid |
   |---|---|
   | Tenancy from the first migration | bought now, while zero migrations exist — a column, not a rewrite |
   | Sandbox for third-party code | engaged only on the **hosted** personal-estate path; the hosting model is CO-068, and CO-045's narrowing reverses on that path |
   | Credential custody | per-estate vault with audited access (CO-069, reopening CO-047); softened by the standing invariant that members never hold credentials — they hold decisions |
   | Metering, billing, refunds | per-estate wallets on the family's own billing doctrine — one markup boundary, advisory transaction locks, DB-first with compensation (CO-070, reopening CO-048) |

5. **Sequencing is a rule, not a preference:** org #1 is the operator's own estate
   running the already-filed plan (the observer, M37); the second owner is the
   cofounder; members come third; hosted personal estates and delegation fourth; the
   open platform last. **Nothing platform-wide is built before org #1 lives on it** —
   the anti-pattern the first review named (periphery for an unmet user before the
   core for oneself) does not get a second chance.

**What this does not change:** the floor (per estate, protecting that organization's
money, deletions and name); the one-CEO-agent and one-PM cardinalities; graph
immutability; the journal spine; the production pipeline; the escalation defaults —
ADR-0007's "the fabric answers by default" now simply escalates to role queues before
the owners.
