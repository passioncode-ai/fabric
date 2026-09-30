# Agent onboarding is a bootstrap-and-admission lifecycle

- **Status:** Accepted
- **Extends:** ADR-0012 (external versioned compatibility contract) and ADR-0015
  (agent production is a pipeline over an ordinary project)
- **Consequences / affects:** `CONTEXT.md`, `docs/architecture/passioncode-platform.md`,
  `docs/architecture/agent-production.md`, `docs/ux/`, `fabric-agent-adapter`,
  `fabric-agent-contract`
- **Source:** operator onboarding scenario, 2026-08-29

The easiest legitimate way to bring an agent into PassionCode.ai is a copyable,
version-pinned **Agent Bootstrap Recipe**. A person opens an existing repository or an
empty workspace in their coding agent, pastes the recipe, and that agent either adapts
the existing project or creates a compatible provider.

The recipe is not the compatibility contract and never carries authority. The lifecycle
is:

`recipe → inspect → plan → adapt/create → local validate → package → conformance → admission → project binding → canary → promotion`

The following are invariants:

1. The recipe pins the contract, adapter and required skill-pack revisions and verifies
   their integrity before use. “Latest” is not a reproducible input.
2. It is idempotent, produces a dry-run/change plan before modifying an existing
   repository, preserves user code, and leaves a machine-readable manifest and report.
3. No long-lived Fabric or estate secret is embedded in copied text. Authentication is
   an explicit short-lived exchange after local validation.
4. Conformance proves shape and behaviour; admission records a reviewed provider
   revision; binding separately grants one project a capability and effects ceiling.
5. A newly admitted or materially changed provider begins watched, with checker-backed
   canaries. Promotion is evidence attached to that provider revision, never a toggle
   detached from its evaluation history.
6. The same lifecycle serves a repository, local process, HTTP API, MCP server, A2A
   peer or hosted provider. Adapters translate surfaces; they do not weaken the
   contract.

