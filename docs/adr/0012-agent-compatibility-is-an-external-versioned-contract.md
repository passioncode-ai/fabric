# Agent compatibility is an external versioned contract

- **Status:** Accepted
- **Partially supersedes:** ADR-0010 clauses 2 and cardinality wording only; its project-first organisation remains accepted
- **Consequences / affects:** `CONTEXT.md`, `README.md`, `docs/architecture/agent-composition.md`, `docs/architecture/work-producing-agents.md`, `docs/evidence/backlog.md`, `docs/evidence/specs/2026-08-16-software-fabric-carryover.md`
- **Source:** operator design interview and private Fabric Agent Contract PR #1, merged 2026-08-26

Fabric remains the estate product and owns its project graph. The reusable rules
for independently developed agents do not live inside that product's design
proposal: they now have one private, versioned owner.

**Decided:**

1. The normative provider, capability, admission, binding, result, evidence,
   memory, coordination, execution-context, governance and conformance semantics
   live in [`passioncode-ai/fabric-agent-contract`](https://github.com/passioncode-ai/fabric-agent-contract/tree/489737051828fafec92463df04b6a6fd3280c7b7).
   Fabric consumes an exact contract revision and does not copy its schemas.
2. The transports remain MCP for host-owned capabilities, A2A for opaque peer
   agents and a constrained local-runner profile for terminal agents. The
   contract profiles those protocols; it does not invent a fourth wire protocol.
3. Discovery and admission grant no project access. A project receives a provider
   only through an immutable binding revision that pins admission, execution
   context, account pool, grants and checker policy.
4. The base roles are one CEO per estate, exactly one **product manager** per
   project and one or more selectable developers where development work exists.
   `product manager` replaces the earlier `project manager` term. Optional roles
   register dynamically and never become another decomposition authority.
5. Fabric owns its controlled capability vocabulary; the external contract owns
   the shape and conformance rules for declaring and probing it. A provider may
   map onto a registered name but cannot create a Fabric capability by spelling a
   new string in its manifest.

## Why the repository boundary matters

The contract must be usable by an author who never reads Fabric internals and by
another host that implements the same safety boundary. Keeping it inside
`agent-composition.md` would make every external implementer depend on a moving
product proposal and would leave JSON shapes untestable.

The other extreme — making Fabric a general-purpose public framework — is still
rejected by ADR-0011. This repository is a private reusable contract owned by the
same organisation, not a marketplace, hosted agent service or new customer
surface.

## Compatibility receipt

Contract PR #1 passed its GitHub `contract` job before merge. The merged revision
contains 13 Draft 2020-12 schemas, 22 positive/negative fixture cases, 34 Vitest
tests and the author/operator scenarios. A planted fixture missing `notVerified`
was observed failing before green acceptance.
