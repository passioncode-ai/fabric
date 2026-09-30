# Agent production is a pipeline over an ordinary project

- **Status:** Accepted
- **Consequences / affects:** `docs/architecture/agent-production.md` (new),
  `docs/architecture/agent-composition.md` §8 (amendment note: canary binding),
  `docs/evidence/backlog.md` (M37), carry-over rows CO-055 and CO-056
- **Source:** operator decision, 2026-08-27, accepting Part II of the architecture
  review of the same day; the framing is the operator's own: producing an agent is a new
  project, the agent may live its own life, and everything inside it conforms to the
  protocol

The framing is correct, and it needs **no new machinery** — it is a composition of
records already accepted. What it does need is one distinction named out loud, because
the model collapses without it.

**Decided:**

1. **The agent as artifact — repository, manifest, deployed service — is an asset**
   (ADR-0003). **Its production and subsequent operation is a project** (ADR-0013):
   persistent, one Product Manager, surviving every goal aimed at it. An agent needed
   by an existing project arrives as a goal in that project; a standalone agent
   product arrives as a new project seeded from a template.
2. **The production route is a pipeline record** (ADR-0009), versioned and
   operator-editable: intake grill → scaffold → instructions → build → evals →
   admission → canary binding. Stage list v1 lives in
   [`agent-production.md`](../architecture/agent-production.md).
3. **A provider is produced once and bound many times.** Production is the rare,
   expensive path — a goal, a pipeline run, an admission. Hiring is the cheap,
   reversible one — a binding revision (ADR-0012). Conflating the two axes produces a
   project per hire: nineteen roles across N projects is nineteen providers and N×
   bindings, never 19×N projects.
4. **No agent is produced without a named consumer.** The intake gate requires the
   project or routine that will call the claimed capability. The role catalogue in
   `agent-family.md` is a catalogue, not a production queue.
5. **Trust is earned by watched runs, not by authorship.** A freshly produced
   provider enters under a **canary binding** — a checker mandatory on its output and
   a budget cap — regardless of trust tier, our own included. Removing supervision is
   a recorded **promotion** decision citing eval results and run history. This is the
   verification ledger's own rule — a green nobody has watched fail is not evidence —
   applied to providers.
6. **A new version of an agent is a new provider revision through the same
   pipeline.** Bindings pin revisions; rollout is rebinding, never mutation — the
   discipline ADR-0005 and ADR-0013 already set, applied to providers.
7. **The intake gate records floor-adjacency and tenancy assumptions per agent**, so
   ADR-0011's product seam stays visible on each produced agent instead of being
   rediscovered across all of them at once.

**What this does not decide:** the milestone itself (M37) is recorded
decided-unscheduled and has not been through an intake grill; the schema objects the
canary rule needs — eval sets, promotions, production provenance, instruction packs —
are carry-over rows CO-055 and CO-056, due at M1/stage 2, not details of this record.
