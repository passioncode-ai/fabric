# The CEO agent is named Fabric

- **Status:** Accepted
- **Supersedes:** nothing. ADR-0018's product/kernel boundary stands unchanged; this
  record adds a third meaning to the name and says how the three coexist.
- **Consequences / affects:** `docs/vision.md` (§ The names, Amendments),
  `docs/brand/facts.md`, `docs/ux/plans/2026-09-12-v1-context-reentry.md`, future
  product copy for the manager surfaces (SCN-042, SCN-044), `docs/brand/terminology.md`
  when the manager surfaces ship their strings
- **Source:** operator decision, 2026-09-12, in the V1 context re-entry brief; ratified
  the same day through the grill of run `2026-09-12-v1-reentry-deep`

## The decision

The estate's CEO agent — the manager the vision has carried since ADR-0010 («one CEO
per estate») — bears the name **Fabric**. The product is named after its protagonist:
the agent that watches every project, compiles the digests and decision bands, routes
questions and proposals, and answers from any surface ending in an artefact.

The name now has three coordinated meanings, one boundary each:

1. **PassionCode.ai** stays the user-facing product and platform (ADR-0018, unchanged).
2. **Fabric the kernel** stays the agent-agnostic technical kernel and compatibility
   layer (ADR-0018, unchanged).
3. **Fabric the CEO** is the named character the operator talks to: the estate manager
   agent. It is the reason the kernel's name is on the window — the protagonist and the
   weave are one name, and that is deliberate, the operator's own reconciliation of why
   PassionCode.ai and Fabric both exist.

## What this does and does not claim

- The CEO's name does not grant authority. The manager's authority lifecycle stays
  ADR-0010/ADR-0034 territory and SCR-44's surface; a name and an avatar «не определяют
  исполнителя, роль или полномочия» (mockup contract, verbatim, and it survives this
  record).
- The name does not promise proactive insight or motivation mechanics. V1 scope for
  Fabric-the-CEO is exactly what the scenario base already records: digest and decision
  compilation (SCN-040), routing (SCN-041), conversation ending in an artefact
  (SCN-042), the measurable estate record (SCN-044). Anything beyond is a later
  decision, not an implication of the naming.
- Provider replaceability is untouched: which model or CLI runs the CEO role remains a
  binding decision (SCN-061); the NAME survives a provider replacement, which is the
  same rule the whole product applies to agents.

## Reversal condition

If the public brand ever needs the CEO character to carry a different name than the
kernel (e.g., trademark or clarity pressure at launch), a new ADR renames the CHARACTER
only; the kernel keeps its name, and `docs/brand/facts.md` is the register that changes.
