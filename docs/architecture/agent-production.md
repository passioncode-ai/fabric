# Agent production — the foundry as ordinary machinery

> Current implementation audit (2026-09-26): [harness modules and readiness](harness-runtime.md), [source receipts and correction plan](../audit/2026-09-26-harness/README.md). The historical design below is not an installation/load/conformance receipt.

**Status: DESIGN, 2026-08-27.** The model is decided in
[ADR-0015](../adr/0015-agent-production-is-a-pipeline-over-an-ordinary-project.md);
the milestone is M37, decided-unscheduled. This document is the stage list, the
template, the cold-start shortcuts and the bootstrap order — the parts that are design
rather than decision, written the day they were designed.

`agent-composition.md` answers how an agent is *built into a node* and how it *talks*.
`work-producing-agents.md` answers where an agent's *output* enters the graph. This
document answers the question before both: **where agents come from.**

---

## 1. What was asked, stated precisely

The operator, 2026-08-27: producing an agent is a new project. The agent may become a
standalone project and live its own life, but it is factually a new project with a
defined task, and everything inside must conform to the protocol — the connections,
the contract, all of it. And: starting from zero there are no agents, so the process
of making them — with its shortcuts and its starter kits — must be described so that
developer agents make the right architectural decisions immediately.

## 2. The ontological mapping — everything already exists

| In agent production | In the ontology | Record |
|---|---|---|
| The agent as artifact: repository, manifest, service | **Asset** — exists independently of work, outlives every goal | ADR-0003 |
| Production + operating it "its own life" | **Project** — persistent workspace, one PM | ADR-0013 |
| The order "we need agent X" | **Goal** in the owning project (or the first goal of a new templated project) | ADR-0013 §2 |
| The production route | **Pipeline** — versioned, operator-editable stages | ADR-0009 |
| What the agent can do | **Capability** from the controlled vocabulary; the provider maps onto it | ADR-0012, CO-041 |
| Hiring the produced agent into a project | **Binding** — immutable revision, pinned by runs | ADR-0012 §3 |
| The right to act unsupervised | Admission → canary binding → earned promotion | CO-042, ADR-0015 §5 |

Two creation routes, both already legal: **(a)** an existing project needs the agent
(PassionCode.ai needs an SEO agent) → a goal in PassionCode.ai, the deliverable is an admitted provider
plus a binding; **(b)** the agent is a standalone product → the CEO creates a project
from the `agent-product` template and the production goal is its first goal. In
neither case does the foundry become a second decomposition authority: it produces
*providers*; who hires whom is still the CEO's and the PMs' call (ADR-0010).

> **The load-bearing distinction (ADR-0015 §3): a provider is produced once and bound
> many times.** Production is rare and expensive — a goal, a pipeline run, an
> admission. Binding is cheap and reversible. Whoever conflates the axes gets a
> project per hire.

## 3. The pipeline, as data

The first non-default pipeline record the fabric will hold (ADR-0009 defines the
shape; this is its v1 content):

```yaml
pipeline: agent-production            # v1 — versioned per ADR-0009
stages:
  - id: intake
    department: architecture
    gate: |
      capability named in the vocabulary (or the vocabulary change approved first);
      a CONSUMER named — the project or routine that will call it;
      transport chosen by the §5 rule (MCP = capability, A2A = peer,
      local-runner = terminal agent);
      workflow-or-agent decided: if every step can be named now, it is a
      workflow behind a capability, not an autonomous agent (adopted-doctrine §3);
      floor-adjacency and tenancy assumptions recorded per agent (ADR-0015 §7)
  - id: scaffold
    department: engineering           # skill: fabric-agent-adapter (exists, non-destructive)
    gate: manifest + schemas + safe fixture pass the contract check against the pinned revision
  - id: instructions
    department: architecture
    gate: instruction pack revision created; results are DONE / PROOF / SCOPE /
      NOT VERIFIED by construction, not by review
  - id: build
    department: engineering           # ordinary task-pipeline inside the agent's workspace
    gate: the task-pipeline acceptance is green
  - id: evals
    department: qa
    gate: |
      N golden tasks pass AND M planted-defect tasks are REJECTED — watched,
      not asserted (the verification ledger's rule, applied to a provider)
  - id: admission
    department: architecture
    gate: shape conformance → protocol negotiation → side-effect-free semantic
      probes → an immutable admission record (CO-042, ADR-0012)
  - id: canary-binding
    department: operations
    gate: |
      bound with a MANDATORY checker on output and a budget cap, regardless of
      trust tier; removing supervision is a later recorded promotion decision
      citing eval results and run history (ADR-0015 §5)
```

The intake gate's sharpest line: **no agent without a named consumer.** The nineteen
roles in `agent-family.md` are a catalogue, not a production queue; only what a
routine or goal will actually call gets produced.

**The eval stage runs on two clocks** (adopted-doctrine §3): the *observables* — what
would count as this agent working — are written at intake, before anything is built,
because a criterion attached after the code exists lets the output decide what counts
as success. The *corpus* — golden and planted fixtures — grows from production only,
and for a produced agent the source project's recorded failures count as production:
that is what the trap→fixture rule transplants. A corpus authored from imagination is
green on inputs no consumer will ever send.

## 4. The template — what the starter kit contains

| In the template | Why |
|---|---|
| `provider.manifest.json` | contract revision pinned; capability mapping; transport; cost hint. `fabric-agent-adapter` scaffolds it today |
| `capabilities/*.schema.json` | input/output as Draft 2020-12; a schema change is a new capability version |
| `fixtures/golden/` + `fixtures/planted/` | **one fixture format, three uses**: the eval gate, the admission probe, the regression suite — not three systems |
| result envelope helper | DONE / PROOF / SCOPE / NOT VERIFIED as the typed result — conformance by construction |
| `AGENTS.md`, pre-loaded | the estate's doctrine inside the agent: the envelope, "an edge carries a named payload", observation ≠ judgement, the `CONTEXT.md` glossary |
| CI: the contract check | the conformance gate on every push, so protocol compliance cannot degrade silently |
| the `.fabric/bundle/` expectation | the agent is born expecting the compiled per-node bundle (`creds.env`, `mcp.json`, prompt sections) — compatible with `agent-composition.md` §4 from day one |
| health + heartbeat | a provider that is not watched is not operated (CO-057) |

Three template profiles, chosen by the one-liner in `agent-composition.md` §5:
**`mcp-capability`** — the default for owned capabilities with a known schema;
**`a2a-peer`** — only where a real task lifecycle and opaque internals exist;
**`local-runner-pack`** — a terminal agent: instructions + skills + manifest, **no
service at all**.

## 5. Cold-start shortcuts

1. **The first agents are instructions, not services.** A produced agent at cold
   start = a department instruction pack + skills + a capability manifest over the
   `local-runner` profile. No server, no deployment, no health endpoint — production
   collapses to: write instructions, write fixtures, register. A service appears only
   where a lifecycle demands A2A. Eight departments in `skills.json` are already half
   written — it is the registry the CEO hires from (`adopted-doctrine.md` §2).
2. **Capability-first: a script before a model.** Chains bind to capabilities
   (`agent-composition.md` §2), so a capability can be served by a deterministic
   script first — a probe, a collector — and swapped for an LLM agent later with zero
   chain edits. Deterministic providers first (they are also the checkers' food);
   model-backed second.
3. **Eval = admission probe = regression.** The contract already wants a safe
   fixture; the doctrine wants planted defects; operations will want regression. One
   `fixtures/` directory, replayed by three gates.
4. **No registry UI.** The vocabulary, providers and admission records are declared
   data per ADR-0002: YAML, mirrored, diffed, linted in CI. A screen comes when the
   file starts to hurt.
5. **Reuse what is measured and running:** `fabric-agent-adapter` (scaffold +
   conformance check), `agentgateway` (MCP auth, secrets at mode 600, roles),
   `skills.json` (departments), `example-agent` (an external SEO agent; the first external provider,
   measured 2026-08-26). Foundry v1 is almost entirely registration and instructions,
   not infrastructure.

## 6. Bring Your Agent — bootstrap recipe into this pipeline

ADR-0019 adds a front door without adding a second production system. PassionCode.ai
generates a copyable, version-pinned Agent Bootstrap Recipe for one of two intents:

- **adapt** — inspect an existing repository/service and add the smallest compatible
  wrapper, manifests, fixtures and CI without taking ownership of its application code;
- **create** — seed a new provider project from the appropriate profile and run the
  normal production pipeline.

The coding agent that receives the recipe performs `inspect → dry-run plan →
adapt/create → local validate → package`. Fabric then performs `conformance → admission
→ project binding → canary → promotion`. The seam matters: copied prompt text can create
files, but cannot create trust or authority. The recipe pins the contract, adapter and
skill revisions, verifies integrity, is idempotent, preserves user changes and embeds no
long-lived secret. Its outputs are a provider bundle, change report and validation
receipts that the ordinary admission stage can inspect.

The adapter repository already proves the local wrapping path. The remaining product
work is the recipe generator, short-lived authentication exchange, provenance/signing,
hosted conformance service and UX specified by FLW-07/SCN-015..017.

## 7. Bootstrap order — the foundry's first products are the watcher

The review's "Watcher slice" and this pipeline are one plan read from two sides: the
first produced agents are the observer's collectors.

| # | Foundry product | Profile | What it validates |
|---|---|---|---|
| 1 | `probe.http@estate`, `collect.zones@cloudflare`, `collect.repos@github` — deterministic (shortcut 2) | script → mcp | vocabulary, admission, the observation store, the quota ledger, heartbeats — on code with no LLM in it |
| 2 | Instruction packs: `product-manager`, `developer` | local-runner | the template, the bundle expectation, instruction-pack revisions pinned by runs |
| 3 | `report.estate-daily` — observations → one page + one notification carrying its receipt | local-runner | the first LLM agent through the FULL pipeline: evals, planted defects, canary, checker |
| 4 | Binding `seo.findings@site` → `example-agent` | mcp (external) | the foreign-provider path: admission without owning the code, and the resolution-store seam (CO-051) |

Why this is the right first product project: the foundry exercises every subsystem —
goals, graph, checker, admission, binding, terminals — on work that produces the
workforce, with org #1 as the first customer (ADR-0016 sequencing). And it forces the
capability vocabulary to exist: every produced agent adds entries, which is CO-041
getting mechanics instead of intent.

## 8. Boundaries and risks, named where the decision is

- **The foundry is not a second decomposition authority.** It produces providers;
  goals and graphs are still written by the CEO and PMs (ADR-0010). A produced agent
  that "decides what to do by itself" is a violation, not a feature.
- **Not a project per binding.** See the load-bearing distinction in §2.
- **v2 is a new provider revision through the same pipeline.** Bindings pin
  revisions; rollout is rebinding, never mutation.
- **A produced agent that becomes a product enters PassionCode.ai entitlement and
  marketplace governance.** The intake gate records tenancy and floor-adjacency per
  provider; ADR-0025 owns the internal primary subscription unit while CO-080 retains
  marketplace trust/liability rather than hiding either in admission.
- **Instructions are a supply chain.** CO-044 (the bundle as an injection surface)
  extends to instruction packs: a pack produced by an agent passes the same eval gate
  as code.

## 9. What this forces — the schema objects

| Object | Minimum fields | Without it | Row |
|---|---|---|---|
| `eval_set` | fixtures (golden/planted), last-run verdicts, provider revision | "the agent works" is a claim, not an observation | CO-056 |
| `promotion` | binding, before→after (supervision/cap), cited runs, author | the checker comes off silently | CO-056 |
| production provenance | on the provider revision: source repo, producing run, eval set, admission | "where did this agent come from" is unanswerable | CO-056 |
| `instruction_pack` / `model_policy` | revisioned, content-hashed, pinned by runs | prompt history is unrecoverable — permanently | CO-055 |

## 10. What this does not answer

- Which department's instruction packs ship first beyond PM and developer — the
  bootstrap order in §6 is a proposal, not a grill result.
- Whether the admission probes for a `local-runner-pack` (instructions, no service)
  need a shape beyond replaying its fixtures — the contract profiles services more
  richly than packs.
- The default pipeline question (CO-026) is untouched: `agent-production` is a second
  pipeline record beside the development default, not a replacement for it.
