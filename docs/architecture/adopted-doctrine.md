# Adopted doctrine — what the operator's own standards impose

`external-contracts.md` records what the outside world imposes. This file records what the
operator's **own** published standards impose, which is binding in the same way and for the
same reason: ADR-0005 already resolved a design question by citing adopted doctrine rather
than by re-deciding it.

Three sources — the first two read on **2026-08-19**, the third on **2026-08-27**:

| Source | What it is | Where |
|---|---|---|
| **Proof of Done** | the agentic software development manifesto — when agents write the code, `done` is a state of the system that can be proven | `~/DATA/pod-manifesto/manifesto.md`, 477 lines, at `b96beff`; published at `ssheleg/pod-manifesto` |
| **The ssheleg skill family** | eight members, one launcher, one manifest — what a hired agent is actually made of | `~/DATA/sshlg-skills/skills.json`; published at `ssheleg/sshlg-skills` |
| **The agent-stack pack** | four skills of production agent doctrine — the orchestrator loop, evals, interop, the harness | installed 0.13.5 under `~/.claude/plugins/cache/agent-stack/`; published at `ssheleg/agent-stack` |

Nothing below is a new decision. It is a list of what the fabric must satisfy, and where it
already does.

---

## 1. Proof of Done — the node's return contract

**The definition** (`manifesto.md:44`): every completion claim between an intended outcome
and an accepted result must point to its supporting record at an address another actor can
resolve. If the address does not resolve, the claim is not proven.

### The four fields are the node result

`manifesto.md:54-67` gives the smallest useful protocol, and it is exactly the shape a node
must return:

```text
DONE          what became true
PROOF         what was executed or observed, and where the result lives
SCOPE         the commit, environment, requirements and surfaces covered
NOT VERIFIED  what was not checked, could not be checked, or remains uncertain
```

`NOT VERIFIED: none within the stated scope` is a valid answer; silence is not. This lands
directly on `outputFormat: {type:'json_schema'}` — see `external-contracts.md:46`. **The
node's JSON schema is these four fields**, not a free-text summary.

### `done` is six states, not one

`manifesto.md:87-95`: `generated` → `executed` → `passed` → `verified` → `validated` →
`accepted`. The common failure is jumping from `generated` to `done`. The fabric's node
status vocabulary must be these six; a single boolean `done` column re-creates the failure
the manifesto exists to name.

### Three graphs, and the fabric currently has one

`manifesto.md:108-150`. The **intent** graph says why the change should exist, the
**execution** graph how it will be produced, the **evidence** graph how the result will be
known. Done is not a status on the task node — it is a *coverage relation*: for every
required outcome there is a continuous path through the work that implemented it, the check
that observed it, and the acceptance that closed it.

The fabric has an execution graph (`CONTEXT.md` — node, edge) and an implicit intent graph
(goals). **It has no evidence graph.** Building it after the code exists lets the output
decide what counts as success.

### Where the fabric already agrees, word for word

- **A node has one job** (`manifesto.md:156`) — `CONTEXT.md` defines Node identically, down
  to the same example: "research it, summarise it and check the sources" is three nodes
  wearing one name.
- **An edge carries a named artifact** (`manifesto.md:160-166`) — `CONTEXT.md` defines Edge
  identically: an edge whose payload cannot be named is deleted. The manifesto's phrasing of
  the failure: *an edge that carries no named artifact is chronology drawn as architecture.*
- **Stable graph, bounded discovery** (`manifesto.md:190`) — this is ADR-0005. Discovery may
  propose a new graph but may not silently become one.
- **The mechanism owns enforcement** (`manifesto.md:200`) — "a test is stronger than an
  instruction, a precondition is stronger than a warning". This is ADR-0004's floor.
- **Observation is not judgement** — `CONTEXT.md` already draws it.

### Where the fabric has nothing yet

| Requirement | Receipt | Lands in |
|---|---|---|
| A **checker** node before every convergence; it confirms every expected output arrived, matches its contract, carries its evidence and does not contradict a sibling | `manifesto.md:170-188` | M2 — the graph |
| The checker itself needs proof: a guard that has never been watched rejecting a planted defect is "another agent-shaped source of confidence" | `manifesto.md:188-190` | already the rule in `docs/evidence/verification.md`; extend it to graph checkers |
| Proof is **scoped, versioned and perishable** — a green on commit A does not prove commit B, staging evidence does not become production evidence | `manifesto.md:48`, `:304` | M1 — observation schema carries a validity domain, not only a timestamp |
| **Delivery acceptance ≠ outcome validation.** `unobserved` is a legitimate product state | `manifesto.md:150` | M1. Sharp here: a side project's site returning 200 is delivery-verified; traffic recovering is a later, separate observation |
| **Independence of the reviewer** — implementer and reviewer sharing model, context and specification produce one correlated mistake reported twice | `manifesto.md:210` | M6/M7 — the CEO may not review its own decomposition with a same-context agent |
| **Provenance of the run** — model, runtime, policy and instruction versions, tools, permissions, retries, abstentions, trace | `manifesto.md:208` | M1 — the run record. The SDK gives most of it (`external-contracts.md:54`) |
| **Loop guard** — stop when a change returns A→B→A, the same file is edited twice for the same finding, or a closed finding is resurrected | `manifesto.md:220-230` | M7 — the CEO's continuous loop |
| **One item to its gate**, then re-read the goal and queue from an artifact, never from recollection | `manifesto.md:216-218` | M7 |

### The three gate types map onto the autonomy levels

`manifesto.md:202-204`. An **automatic** gate decides a fact a machine can establish; a
**judgment** gate evaluates what has no deterministic check and is labelled as judgment; a
**manual** gate protects ambiguity, external publication, irreversible action, money
movement, production access and scope change.

That third list is the fabric's floor, arrived at independently. The manifesto adds the part
`CONTEXT.md` does not name: a judgment gate is **not** a manual gate, and calling an agent's
verdict a check is how the two get collapsed.

---

## 2. The skill family — what a hired agent is made of

`skills.json` is already the registry the fabric needs when it hires an agent. Per member:
`name`, `repo`, `dir`, `skillNames`, `pluginMarketplace`, `pluginInstall`, `version`,
`entry`, `role`, `npm`, `shape`, `shapeWhy`.

**`role` is the department's answer**, and the eight are already written:

| Member | `entry` | `role` | Skills shipped |
|---|---|---|---|
| `super-ux` | `/ux` | what the interface must do and how it sounds | 7 |
| `task-pipeline` | `/task-pipeline` | how a change reaches the repository | 2 |
| `agent-sync` | `/agent-sync` | who is holding this file right now | 1 |
| `make-skill` | `/skill-audit` | how the skill or plugin itself is built | 1 |
| `sheleg-design` | `/sheleg-design` | how it looks and moves | 1 |
| `seo-aeo-audit` | `/seo-aeo-audit` | whether a machine will find it | 1 |
| `sheleg-dev` | — | integrations: money in, tracking, sign-in, speed | 6 |
| `agent-stack` | — | agent orchestrators, their evals, the protocols they speak, and the wallet under LLM resale | 4 |

**A department is a lookup, not an invention** — `CONTEXT.md` already says so, and this is the
table it looks into.

### What the launcher already solves, and the fabric must not re-solve

- One command provisions every agent: `npx --yes sshlg-skills@latest update`. It takes no
  member argument by design — a member updated alone leaves the set in a combination nobody
  tested.
- **Claude Code has two channels and they conflict.** A plain copy under
  `~/.claude/skills/<name>` shadows the plugin of the same name and serves its frozen version
  forever. The launcher installs Claude via plugin and clears shadowing plain copies last.
- Twelve non-Claude agents are provisioned through the skills CLI: `cursor`, `opencode`,
  `kilo`, `kimi-code-cli`, `hermes-agent`, `openclaw`, `codex`, `gemini-cli`, `windsurf`,
  `zed`, `kiro-cli`, `goose`.
- `sshlg-skills conflicts` reports installed skills standing on a router's ground;
  `sshlg-skills injectors` names who else speaks at `SessionStart`.

### The conflict this creates for the fabric

**Skill provisioning is per-agent-global; the node contract wants it per-node.** The launcher
installs into `~/.claude/plugins` and each agent's own directory — machine-wide state. The
Agent SDK exposes `skills` and `plugins` per query (`external-contracts.md:50`), which is
per-node. Two different granularities for the same thing.

This is not academic: gotcha #2 in `external-contracts.md:74-80` requires `--bare` /
`settingSources: []` for nodes that run in cloned repositories, and `--bare` does not read the
machine's settings — **so a node hardened against an untrusted repository cannot see the
globally installed family at all.** Recorded as CO-022.

---

## 3. The agent-stack pack — what the agent doctrine imposes

Read 2026-08-27: the four SKILL.md bodies (1 046 lines) plus
`agent-orchestrator/references/governance.md` and `references/runtime.md`. The fabric is
an agent system, which is exactly what this pack is the operator's published standard
for. Nothing below is a new decision — it is the list of what the fabric must satisfy,
and where it already does.

### Where the fabric already agrees, in places word for word

Edge-carries-payload and the fake-edge test; static graph where a run must be auditable;
a checker before every convergence; mechanism decides topology, the model decides
content; scheduled health probes for providers marked unhealthy; retries and fallbacks
capped **in total**; the prompt and the tool list built in one pass from the same flags.
Each of these already has a fabric home (`CONTEXT.md`, ADR-0005, `agent-composition.md`
§4/§6/§9/§11) — the pack confirms them independently, which is worth more than an
argument.

### What it imposes that the fabric does not have yet

| # | Requirement | Receipt | Lands in |
|---|---|---|---|
| 1 | **The checker contract has six failure classes** — missing, empty, unevidenced, malformed, contradictory, off-topic — four decided by code checks, two by a judge; **every verdict is stored as a score bound to the run** with `source: code_check \| llm_judge`; the rejection rate is surfaced, because a checker at zero rejections is either a perfect upstream or a broken gate and only stored verdicts tell which | `agent-evals` §5a | CO-060 — this is the shape `checkerPolicyRef` currently lacks |
| 2 | **Two clocks:** the *observable* (pass/fail criterion) is written before the implementation exists; the *corpus* (inputs) grows from production only — a corpus authored up front tests imagination. Every production failure is minimised into a permanent fixture | `agent-evals` §6 | `agent-production.md` eval stage (amended in this change); the trap→fixture rule for produced agents is this clock transplanted — a source project's recorded failures count as production |
| 3 | **Instrument first:** durable queryable traces (a live stream is a view, never the record); scores as first-class records `(run_id, key, value, source)`; whole prompts stored, not summaries; state snapshots at turn boundaries | `agent-evals` §7 | M1 — the trace/score schema |
| 4 | **Four boundaries, four control sets** (model call, tool call, external server, agent-to-agent), and **policy enforced at each hop** — a sub-agent that inherits its caller's authority silently widens it. The fabric's authority atom is the node: a sub-agent inside a node shares that node's ceiling, and anything needing a narrower one must be its own node — stated, so nobody assumes finer enforcement exists | `references/governance.md` | M3, M6 |
| 5 | **The audit row carries the policy version that applied** — "the control was on" is unprovable without it. The effects-algebra decision record (CO-059) therefore stores: effects requested, filters applied in order, and the deciding filter *with its revision* | `references/governance.md` | extends CO-059 |
| 6 | **Fail-open or fail-closed, decided per workload and written down** — ADR-0023 now closes the policy path: valid signed local policy may continue, uncertainty never grants a new effect/read/scope, and an existing projection needs a short-lived visibility lease. Checker and governor outages remain CO-061 | `references/governance.md`; ADR-0023 | ADR-0023 + remaining CO-061 |
| 7 | **Failover must be policy-equivalent, not merely available** — a fallback filters on the policy tag before it filters on health; capability resolution never falls below the binding's declared tier floor | `references/governance.md` | CO-062 |
| 8 | **Runtime:** checkpoint every iteration, not only the stages a human reviews; interrupt and resume are **one contract** (a question, an approval and a checkpoint are the same suspend); a pause frees the worker; double-texting is decided per surface — enqueue, reject, interrupt or rollback, and a system that never chose has chosen the worst by accident | `references/runtime.md`; ADR-0022 | ADR-0022 durable port/reference profile; M6/M16 implementation; CO-016 API detail |
| 9 | **Workflow or agent is decided first**: if every step can be named now, it is a workflow — an agent buys flexibility with latency, cost and a new failure class, and a capability served by a fixed pipeline must not be built as an autonomous agent | `agent-harness` | `agent-production.md` intake gate (amended in this change) |
| 10 | **The vocabulary is enumerated in the prompt or the model invents it** — instruction packs carry the controlled vocabulary (node states, capability names, status enums) generated from `CONTEXT.md` and the schema, never restated by hand | `agent-harness` rule zero | CO-055's instruction-pack template |
| 11 | **Model resolution has explicit precedence** — node override → department policy → estate default — because a silent precedence inversion is how a cheap model gets billed at a premium one's rate | `agent-orchestrator` §6 | CO-055's `model_policy` |
| 12 | **A protocol claim without a date is a guess** — every interop surface pins its revision, and a deprecation sweep runs at every revision bump (MCP 2026-07-28: `server/discover` replaces `initialize`, stateless per-request `_meta`; `sampling`, `roots`, `logging` and dynamic client registration are deprecated; `subscriptions/listen` is the opt-in notification stream) | `agent-interop` rule zero; MCP deprecation register re-checked 2026-08-30 | upstream: `fabric-agent-contract` CI |

## 4. What this changes

1. The node's typed result is **DONE / PROOF / SCOPE / NOT VERIFIED**, and that schema is
   written in M1, not discovered in M6.
2. Node status is a **six-state vocabulary**, not a boolean.
3. The schema needs an **evidence graph**, not only goals and nodes — M2 grows a third
   relation, and every requirement must have a resolvable path to the check that observed it.
4. Observations carry a **validity domain**, not just a source and a timestamp.
5. **Checker nodes** are a first-class node kind, and each one must be watched rejecting a
   planted defect before its green counts.
6. `skills.json` is the **department registry** the CEO hires from — it is not rebuilt here.
7. `checkerPolicyRef` gets a shape: the six-class contract with verdicts stored as scores (CO-060).
8. The M1 schema gains **score records with a `source`** — which is also the mechanical form of the automatic/judgment distinction §1 already demands of gates.
9. The eval stage of agent production runs on **two clocks**: observables at intake, corpus from production.
