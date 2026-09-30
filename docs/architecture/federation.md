# Federation — organizations, members, and the seams between estates

**Status: DESIGN, amended 2026-08-29**, canonical under
[ADR-0016](../adr/0016-the-fabric-is-a-platform-of-estates.md) and
[ADR-0017](../adr/0017-the-federation-seam-slots-delegation-and-the-artifact-aperture.md),
with execution placement amended by
[ADR-0021](../adr/0021-execution-placement-is-declared-per-provider-binding.md) and
policy evaluation by
[ADR-0023](../adr/0023-policy-is-an-embedded-decision-port-that-never-grants-on-uncertainty.md).
Distilled from design passes 4–6 of 2026-08-27/28. Doctrine sources are named per
section; the pinned revisions are A2A v1.0, the `agent-stack` 0.16.0 references, the
Supabase skill's security checklist (read 2026-08-28), and Fabric Agent Contract 0.1.0.

The governing principle for every section: **logical federation even where the
database is physically shared.** Two estates in one Postgres speak through the
protocol seam, never through a join — so moving an estate out is a deployment, not a
rewrite. The same rule the original brief set for control-plane ↔ runner.

---

> **Vocabulary note, 2026-09-08 (S10 · [ADR-0045](../adr/0045-workflow-runs-task-runs-and-explicit-iterations.md)):**
> where this document says **run** it means a **WorkflowRun** — one execution of one
> pinned graph version, the wire's `run_id`. A **TaskRun** is a different identity: one
> admitted attempt at one Task. The bare word is no longer used alone, and
> [`CONTEXT.md`](../../CONTEXT.md) defines both. This note clarifies the reading; the
> text below is unchanged and remains the record of its own decision.


## 1. The planes

| Plane | Holds | v1 placement |
|---|---|---|
| **Identity** | persons, memberships (person × estate × role), org switching | Supabase Auth; role in `app_metadata` — never `user_metadata` |
| **Estate × N** | the fabric as designed: projects, agents, chains, connections, vault, journal, memory | one Postgres, RLS by (estate_id × membership); journal ordered per estate, partitioning deferred to a measured threshold (ADR-0027); per-estate vault keys |
| **Runner** | terminals, connectors | per binding: local harness, provider-managed, estate-managed or platform-managed; org #1 starts local |
| **Federation** | estate catalog, A2A inbox, artifact exchange | REST binding + push; inbox = task table + edge-function endpoint; gateway duties per ADR-0017 §5 |
| **Billing** | per-estate wallets | the family's billing doctrine: tiers, one markup boundary, advisory xact locks, DB-first + compensation |
| **Surfaces** | owner dashboard, member queue, personal workbench | projections of the journal over Realtime, monotonic event ids, replay-from-id |

## 2. The member model

- **Interaction point** — where a chain holds a human:
  `{kind: respond | initiate | approve, role, delegable, sla, escalation,
  payload-schema, resolution-schema}`. `initiate` is an entry trigger with role
  permission; `respond`/`approve` suspend the node (the pause frees the worker) and
  enqueue a typed task.
- **The member surface is one screen**: the queue of interrupts addressed to my
  roles, ordered by priority and SLA, each opening into context (a trace excerpt, a
  draft, links) and typed resolutions. Not an admin panel — the job is exception
  handling.
- **A member never sees a credential.** An approval is a decision event; the effect
  runs through the organization's connection binding under a grant whose
  precondition names the role. Secrets stay in the vault; people hold decisions.
- **Resolution order for any capability call:** local agent binding → interaction
  point (role queue) → member's registered delegation (A2A to their estate) →
  external estate under grant. Points 2–4 are one suspend mechanism at increasing
  distance.

## 3. Data transfer

- Inside an estate: journal events; edges above the size threshold carry
  content-addressed artifact refs (CO-054); idempotency keys on every effect.
- Live views: Realtime over the journal as a wake-up signal only; **every event carries
  a per-estate gapless id, and a reconnecting client replays from the journal table
  from the last id it saw** (ADR-0027 — Realtime itself is at-most-once and can never
  be the catch-up path). The feed is a view over the durable trace, never the record.
- Across estates: A2A tasks. `INPUT_REQUIRED` is a question, not a failure; terminal
  states never restart — continuation is a new task under the same `contextId`,
  which is the interaction point's thread. Push notifications make multi-day slots
  real; polling by task id is the floor when streams and push both fail.
- **One cargo format at every distance:** the internal artifact model is
  A2A-Part-compatible (`text | raw | url | data` + mediaType), so the boundary is a
  projection, not a translation.

## 4. Automations

Chains are the estate's static, versioned graphs (ADR-0005/0009) with checkers
before every convergence; a member's "custom automation" is an ordinary chain of
their personal estate — same pipeline-as-data, same vocabulary machinery. Vocabulary
across estates federates like tools behind a gateway: a slot names a capability in
the *organization's* vocabulary; a delegated provider claims compatibility and passes
admission **on the organization's side**; namespacing at the federation point is
consistent always, because names that change between sessions invalidate prompts,
caches and fixtures.

## 5. Memory: storage

| Layer | Store | Life |
|---|---|---|
| run working | runner workspace; run events in the journal | one run |
| session transcript | captured whole into Storage (content-addressed), `transcript.captured@1` in the journal | **durable, project-scoped** — the primary memory, not run scratch (ADR-0032) |
| project memory | journal `memory.project.*` + projections (FTS; pgvector with embedding-model version when FTS measurably stops finding) | append-only; a contradiction closes the earlier record's validity window rather than deleting it (ADR-0032) |
| estate knowledge | journal `memory.estate.*` + projection table | provenance, confidence, contradiction, **expiry mandatory** |
| doctrine | git (or the built-in docs store for non-git orgs), indexed into project memory at run start | append-only |

Nothing is summarised, extracted or judged on the way IN (ADR-0032): a record enters
because someone recorded it or because a transcript was captured. Consolidation — dedup,
decay, promotion candidates — is **sleep-time work**: a scheduled estate routine between
conversations, not the hot path, and re-runnable precisely because the verbatim source
it derives from is still there. Memory reaches a
model only through the compiled bundle (MemoryPack: bounded, cited), so one entrance
carries one supply-chain gate and the lockfile pins what the agent knew. **Built
2026-09-01** as `context.compiled@1` → `session_context_packs`: the lockfile names every
fact by id and journal seq, every session included, and everything the budget left out. A lesson is
written from a contrast — the failed attempt beside the fixed one — never from a
single success.

## 6. Memory: sharing — the matrix and the aperture

**Between any two contexts, memory crosses only as an artifact through a declared
point** (ADR-0017 §3). The matrix:

| From → to | Vehicle | Default |
|---|---|---|
| run → project | the node's typed result (DONE/PROOF/SCOPE/NOT VERIFIED) | yes — the only way up |
| project → project (one estate) | Proposal to the target PM; knowledge pack | nothing without acceptance |
| project → estate knowledge | promotion, reviewed-evidence-only, with provenance and expiry | nothing without review |
| org → member | **the task payload projection only** + explicitly granted read scopes | a member does not see org memory |
| member → org | resolution/submission artifact, through the org's checker | the org does not see the member's estate |
| estate → estate | A2A task artifacts; knowledge packs (traps → fixtures) | nothing; the catalog shows cards, not contents |

## 7. Access — the authority stack

```text
Authenticated principal
  ├─ Person -> Membership (estate, role: owner×N | member)  ← role in app_metadata
  └─ External MCP client -> MCP access binding              ← explicit Projects/scopes
       └─ Role/binding effect ceiling (CO-059 algebra)
           └─ Estate floor (money · deletion · publication — impassable)
               └─ Grant (named, specific, expiring; budgeted+windowed — CO-065)
                   └─ Connection binding (vault secret; members/clients never see it)
                       └─ Per-hop node credentials (bundle creds.env, scoped)
                           └─ Audit row: actor, action, outcome, POLICY REVISION
```

Supabase-specific invariants, from the security checklist read 2026-08-28:
authorization data lives in `app_metadata` (`user_metadata` is user-editable and
unsafe in any policy); JWT claims are stale until token refresh, so role removal
revokes sessions and sensitive operations verify `session_id`; every policy is
`TO authenticated` **plus** a membership predicate; UPDATE policies carry both
`USING` and `WITH CHECK`; views run `security_invoker`; `SECURITY DEFINER` never
answers a permission error; `service_role` exists only in the control plane —
runners and surfaces hold short-lived scoped JWTs minted per binding.

The federation plane owes the eight gateway duties (ADR-0017 §5), including
rug-pull detection — an advertised surface that changes after admission must be
noticed — and per-hop policy, because authority does not travel with context.

ADR-0026 adds a northbound MCP route into the same stack. One credential resolves to an
immutable Estate-owned binding with an explicit finite Project set and operation scopes.
It may read authorized projections or admit typed commands, but it never becomes a
membership, crosses the artifact aperture by implication or carries its credential into a
Run. If the caller is an autonomous peer receiving an opaque outcome rather than invoking
a Fabric-owned capability, the boundary remains A2A.

Policy is evaluated through ADR-0023's local decision port at every hop and before
credential release/effect. A valid signed last-known-good bundle can bridge a central
control-plane outage; an absent, expired, revoked or invalid decision cannot grant new
access or effects. Existing role projections may remain visible only under their
short-lived visibility lease and are marked stale.

Money: three wallet tiers (account → estate reserve → upstream key limit), markup at
exactly one boundary, `pg_advisory_xact_lock` per estate on every transfer, DB-first
with a compensating transaction and its audit row, spend-delta polling for spend
that happened without us. Who pays for a delegated slot is declared by the point
(default: the executor's estate; an org may attach a budgeted grant) — CO-070.

## 8. Runner agnosticism — why any agent works, and what is measured

Authority never lived in the harness: the floor is in the database, tools and
credentials arrive only through the per-node bundle, the money ceiling can sit on
the per-node key at the LLM seam, results are gated by checkers, and the fabric owns
the PTY — so observability survives even a harness with no structured event stream.
At the federation boundary, harness choice is invisible by construction: admission,
artifacts and checker verdicts are all an organization ever sees.

What remains is measurement, not architecture: **a supported runner is one that
passed the conformance suite** (spawn, stream, interrupt, resume, typed result,
budget, bare-mode against untrusted repositories), each harness carries a tier
passport, and the scheduler never places a node on a runner missing a capability the
node declares — CO-074. A binding also pins one ADR-0021 placement profile; local
unavailability queues work and never triggers an undeclared move to platform execution.

## 9. Decisions taken at v1, and when to revisit

| Decision | v1 | Revisit when |
|---|---|---|
| DB topology | one Postgres, RLS by membership, partitioned journal | an estate needs its own project — the seam already permits it |
| Identity | Supabase Auth | SSO/SAML when an organization asks |
| A2A binding | REST + push; well-known card; extended card for sensitive detail | gRPC on high-frequency cross-estate streams |
| Northbound control | MCP 2026-07-28 over Streamable HTTP; per-request binding/policy; Tasks extension or Fabric handle | another protocol only if it preserves Project scope, durable handles and the same receipts |
| Federation inbox | task table + edge-function endpoint, A2A states verbatim | a dedicated gateway process as hops grow |
| Artifacts | Storage, content-addressed, Part-compatible | CDN/chunking under media weight |
| Runners | placement declared per immutable provider binding; org #1 local first | platform-managed profile is introduced only after CO-045/069 isolation and custody gates |

## 10. Sequencing (ADR-0016 §5)

Org #1 (the operator's estate, the filed plan) → second owner (the cofounder) →
first members (the queue surface) → hosted personal estates + first delegated slot →
the open platform. Nothing platform-wide before org #1 lives on it.
