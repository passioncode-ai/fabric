# Agent composition — how a bundle is built, how agents chain, how they are added

> Current implementation audit (2026-09-26): [harness modules and readiness](harness-runtime.md), [source receipts and correction plan](../audit/2026-09-26-harness/README.md). The historical design below is not an installation/load/conformance receipt.

**Status: DESIGN PROPOSAL, 2026-08-25.** It answers a question the operator asked directly,
and it proposes answers to CO-022 and CO-029 without closing them — those rows belong to
stage 2 and this document is written before it.

**Historical amendment 2026-08-26 by ADR-0011:** §13 was placed out of scope. That scope
decision was superseded by ADR-0016 and ADR-0018; §13 is live again as costed direction.
ADR-0025 now fixes the internal primary commercial unit; marketplace governance remains
open in CO-080.

**Amended 2026-08-26 by ADR-0012.** This file remains Fabric's product-level design.
The normative cross-repository objects, profiles and conformance rules are owned by
[`Fabric Agent Contract 0.1.0`](https://github.com/passioncode-ai/fabric-agent-contract/tree/74d3852f122f5ca5cbc4138a201483531dfa5006).
Where this proposal differs from that pinned revision, the contract owns provider
compatibility and this file owns only how Fabric consumes it.

**Amended 2026-08-27 by ADR-0013.** A Project is now the persistent workspace and a
Routine owns recurrence. Any older sentence here that attaches a schedule directly to a
Goal or treats a Project as one Goal's child is superseded by that record and by
`project-workspaces.md`.

**Amended 2026-08-27 by ADR-0015.** §8's tiers describe who a provider *is*; they do
not skip probation. A freshly produced provider — our own included — enters under a
**canary binding**: a checker mandatory on its output and a budget cap, with promotion
to unsupervised a recorded decision citing watched runs. Where a provider comes from at
all is `agent-production.md`.

**Amended 2026-08-29 by ADR-0019/0020.** A user may enter §8 through a version-pinned
Agent Bootstrap Recipe, but admission and project binding remain separate gates. A
provider may also contribute an MCP Apps-compatible sandboxed view; the host owns layout,
scope and fallback.

**Spec pinned:** MCP as of the 2026-07-28 docs revision, A2A v1.0, agentgateway with
`gateways` (not the deprecated `binds`). Every one of these moved in the last twelve months
in ways that break code written against the previous revision. **Fetch the specification
before writing wire-level code** — this document tells you which protocol answers which
question, not what the bytes look like.

---

## 1. What was asked, stated precisely

1. Connect an agent — Claude Code as the developer — and its plugins and skills load and
   set themselves up.
2. Choose which other agents it works with; **a combined bundle forms from the enabled
   set** and that is what the runtime connects.
3. Agents chain. The Reddit publisher needs a researcher that finds the hottest topic on a
   schedule, then a copywriter, then the publisher posts.
4. Agents are added and removed **independently**. Some already exist and connect over MCP,
   a CLI, or an internal API with a key. Users add their own, describe the task and the
   connection, and it joins the workflow.

Requirement 4 is the one that decides the architecture. The other three are mechanism.

---

## 2. The one decision everything else follows from

> **A chain binds to a capability, never to an agent.**

If the publisher's chain names `reddit-researcher`, then removing that agent breaks every
chain that named it, and adding a better one means editing all of them. Independent add and
remove is impossible by construction — not by bad implementation.

If the chain names `research.trending@reddit`, the provider is resolved **at hire time**
from whatever is enabled and healthy. Adding an agent is a registry write. Removing one is a
registry write. Swapping one for a cheaper one is a policy change, and no chain is touched.

Everything below is the machinery that makes that sentence true.

---

## 3. Four objects the ontology does not have yet

| Object | What it is | Lifetime |
|---|---|---|
| **`capability`** | a named, versioned, schema'd thing that can be *asked for* — `research.trending@reddit`, `copy.write.reply`, `publish.comment@reddit`. Input schema, output schema, and whether it is floor-adjacent | outlives every provider of it |
| **`provider`** | something that *offers* capabilities: a transport, an auth method, a manifest, a health probe, a cost hint, and a trust tier | added and removed freely |
| **`binding`** | the versioned project choice that pins *(capability → provider revision)* together with admission, execution context, account pool, grants and checker policy | project configuration; immutable, and each run pins one revision |
| **`bundle`** | the materialised surface handed to one runtime for one node: skills, MCP config, prompt sections, scoped credentials, and a lockfile | one node |

**The controlled vocabulary is the hard part, and it is not a detail.** If every provider
invents its own capability name, there will be nineteen names for "write a reply" and
resolution degrades to string matching. The fabric owns the vocabulary; the Agent Contract
owns its declaration and conformance shape. A provider *maps
onto* it and declares the mapping in its manifest. A provider claiming a capability that
does not exist in the vocabulary fails registration rather than inventing one.

---

## 4. The bundle compiler — and why it dissolves CO-022

CO-022 recorded a conflict that looked unresolvable: `sshlg-skills` installs machine-wide
per agent; the SDK takes `skills` and `plugins` **per node**; and `--bare` with
`settingSources: []` — the untrusted-repository mitigation from `external-contracts.md`
§1 — cannot see machine-wide installs at all. A node hardened against a cloned repository
could not see the globally installed departments.

**The resolution is to stop treating those as two mechanisms.** The bundle is compiled per
node and materialised into the worktree; the runner then reads *nothing* from the machine.
The security constraint and the provisioning mechanism become the same mechanism, and the
one that looked like an obstacle is what makes composition reproducible.

```
stage (department, required skills, gate)
        +
enabled providers  ──►  BUNDLE COMPILER  ──►  <worktree>/.fabric/bundle/
        +                                        skills/            ← union, namespaced
capability vocabulary                            mcp.json           ← only bound servers, strict
        +                                        prompt.md          ← one section per live capability
trust tier                                       creds.env          ← scoped to this node's hops
                                                 bundle.lock        ← content hashes of all of it
```

Four rules that are the compiler's, not the prompt's:

- **A capability the node was not bound to contributes no tool and no prompt section.** The
  tool list and the prompt are built in the same pass from the same flags, so they cannot
  disagree — a prompt describing a tool the agent was not given is how a model spends a turn
  calling something that is not there.
- **Skills are namespaced by provider.** Two providers shipping a `publish` skill is normal;
  resolving that collision by load order is how the wrong one wins silently.
- **The lockfile makes a run reproducible and a bundle reviewable.** A diff of two bundles
  is a diff of two lockfiles, which is also how you answer "what changed since it last
  worked".
- **Credentials are scoped per hop, never handed down whole.** The gateway already does this
  (§5); the compiler must not undo it by writing a superset into `creds.env`.

---

## 5. Transports — five, and the rule for choosing

| Transport | Use it when | Auth |
|---|---|---|
| `inproc` | it is one of our own departments | none — same process |
| `mcp` | a capability whose shape we control, with a schema | ~~through the gateway, role key per node~~ — **superseded by [ADR-0115](../adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md)** (noted 2026-10-04): the machine gateway is off since 2026-09-14; an agent registered on this Mac reaches a product through Fabric's hub with a binding credential and standing grants; a session's declared server through Fabric still refuses (CO-194) |
| `cli` | an existing agent that only speaks argv, stdin and stdout — Cursor, OpenClaw, Codex | process env, scoped |
| `http` | a service with a key and a request/response shape | header key from the secret store |
| `a2a` | a **peer agent** whose insides we deliberately cannot see, and whose work has a task lifecycle | agent card, per-hop authorization |

**The rule, and it is a one-liner:** MCP connects a model to a *capability*; A2A connects
you to a *peer* whose internals are not yours. The tell that you picked wrong: if you find
yourself inventing a task lifecycle, a progress channel and a resumable handle on top of
`tools/call`, you wanted A2A. If you are publishing an agent card for something that is one
HTTP call with a JSON schema, you wanted MCP.

So for the family: **`researcher` and `copywriter` are MCP capabilities. A user's own
autonomous agent is an A2A peer.** That is a proposed answer to CO-029 — the A2A boundary
falls at the edge of what we own, not between our own departments, where it would be
machinery bought for no buyer.

### What already exists and must not be rebuilt

`~/.config/agentgateway` on this machine, measured 2026-08-25: **10 MCP servers declared**,
each as `{name, url, auth: {secret, header}}` with upstream keys in `secrets/` at mode 600,
and **three roles** — `docs`, `full`, `research` — each a bearer key stored as a sha256 in
the generated config, with `deny_tools` per role.

That is the provider manifest, the credential store and per-hop authorization, running. The
fabric's `mcp` transport is a client of it, not a reimplementation of it.

---

## 6. The chain, drawn

The operator's example: hourly, find the hottest topic in a subject, write a reply under
rules, post it. The project owns the persistent context; the goal owns autonomy; the
routine owns the schedule.

```
PROJECT  "Reddit presence"
  ├─ GOAL     "presence in r/<topic>"   autonomy: guarded
  └─ ROUTINE  "hourly topic-to-reply"   schedule: hourly
       └─ each tick instantiates a NEW RUN of this graph (never mutates a running one)

     n1  research.trending@reddit ──ranked topics──►  n2  copy.write.reply
                                                            │
                                                          draft
                                                            ▼
                                                       n3  CHECKER
                                                            │
                                                    usable / not usable
                                                            ▼
                                                   n4  publish.comment@reddit
                                                       ▲ standing channel grant (CO-036)
```

Four properties of that picture are load-bearing:

- **Every edge carries a named payload.** `n1 → n2` carries ranked topics; `n2 → n3` carries
  a draft. An arrow with no nameable payload is chronology drawn as architecture, and gets
  deleted.
- **The checker is not optional and it is not the publisher's judgement.** It decides
  *usable / not usable* and nothing else, and `n4` depends on **the checker**, never
  directly on `n2`. It is also where the standing grant's topic range is enforced
  mechanically rather than by asking a model to remember it.
- **An idempotency key on `(goal, tick, topic_id)`.** An hourly job that retries must not
  post twice. This is the cheapest line in the design and the most expensive one to add
  after the first duplicate comment.
- **The graph is static.** The shape is drawn before the run and does not pick its own next
  nodes, because a shape that changed mid-run cannot be reconstructed afterwards, and a run
  that cannot be reconstructed cannot be shown to have completed.

---

## 7. Scheduling — routines, not agents or nodes

"Every hour, find the hottest topic" is a **Routine** inside a Project, and each tick
creates a new immutable run. The Routine targets a capability and resolves an eligible
project agent binding when the run starts. Attaching the schedule to an Agent would lose
the schedule when that provider is replaced; attaching it to a Node would mutate a graph
while it runs, which ADR-0005 already refuses.

Two policies must exist from the first schedule, because both failures are silent:

- **Concurrency:** what happens when the tick fires and the previous run is still going.
  Default `skip`, because an hourly job that takes ninety minutes otherwise stacks until
  something falls over.
- **Catch-up:** what happens after the machine was asleep for six hours. Default `latest
  only` — replaying six hours of "hottest topic right now" posts six stale comments.

---

## 8. A user adds their own agent

ADR-0019 makes the low-friction entry explicit: the user may start this flow by copying
a version-pinned Agent Bootstrap Recipe into a coding agent. That recipe adapts an
existing repository or creates a provider bundle, but it cannot skip any step below or
grant itself access.

The flow, and step 2 is the one that is usually skipped:

1. **Bootstrap/package** — inspect, dry-run, adapt or create, then emit the pinned
   manifest, schemas, fixtures, provenance and local validation report.
2. **Describe** — which capability from the vocabulary it claims, the transport, the auth,
   and a cost hint.
3. **Probe** — a health check *and* a canned task with a known-good answer. A provider that
   has never been watched producing a right answer is a claim, not a capability. This is the
   same rule the verification ledger applies to checks, applied to providers.
4. **Admit/tier** — the exact revision starts at `user` and cannot promote itself.
5. **Bind** — one project grants the admitted revision a capability, scope and effects
   ceiling; canary results may later support promotion.

### Trust tiers, enforced by mechanism rather than by instruction

> **Historical vocabulary (marked 2026-08-31, ADR-0028 §5).** The canonical tier set is
> the contract's — `untrusted / verified / admitted / privileged` — and ADR-0015's
> canary (mandatory checker + budget cap) applies **regardless of tier**. The table
> below records the reasoning that produced the mechanism, not the current enum.

| Tier | Who | What it may do |
|---|---|---|
| `core` | our own departments, in-process | anything the node's autonomy level allows |
| `verified` | pinned version, known publisher | as `core`, minus floor-adjacent capabilities |
| `user` | added by the operator, unvetted | never floor-adjacent; output always passes a checker; credentials limited to its own; tools namespaced so it cannot shadow a core tool |

**Every provider's output is untrusted input — including our own.** A capability result that
flows into a prompt is a place where somebody else's text becomes our instruction, and the
`user` tier is where that is most likely and least visible. The checker is not there because
user agents are bad; it is there because the alternative is trusting a string.

---

## 9. The line between mechanism and model

The orchestration is deterministic wherever it can be. The model chooses **content**; it
never chooses topology or permission.

| Mechanism decides | The model decides |
|---|---|
| which provider serves a capability | what the reply says |
| the order of layers, by dependency | which topic is hottest, within the schema it must return |
| the checker's verdict shape | how to phrase a draft |
| whether a grant covers this action | — |
| what enters the bundle | — |

A design where the model picks its own next node is flexible and unauditable, and this
estate has already decided which of those it needs.

---

## 10. What this forces, and what it proposes to close

**Proposes answers to:** CO-022 (bundle compiled per node into the worktree, so `--bare` and
provisioning stop fighting) and CO-029 (A2A at the edge of what we own; MCP inside).

**Forces new rows:** the capability vocabulary and who owns it; the provider probe as an
admission gate; the two schedule policies; and the bundle as a supply-chain surface —
CO-041 through CO-044.

---

## 11. Risks, named where the decision is

- **Vocabulary drift** is the failure that makes requirement 4 quietly untrue. It shows up
  as capabilities that differ only in name, and it needs a lint, not discipline.
- **The bundle is a supply chain.** Composing skills from many providers into one prompt
  surface is prompt injection with a build step. Namespacing handles collisions; it does not
  handle a `user` skill whose text instructs the agent to ignore what came before.
- **Retries and fallbacks multiply.** Three providers with three retries is nine calls for
  one capability. Cap the total, not the per-provider count.
- **A health probe that runs only on failure never recovers.** A provider marked unhealthy
  needs a scheduled probe, or the chain permanently runs one provider short and nobody
  notices, because the requests still succeed.
- **Protocol churn.** Every specification this design touches moved within the last year.
  The revision built against belongs in a constant, not in a memory.

---

## 12. What Cursor shipped, measured 2026-08-25

The operator pointed at Cursor as the closest working analogue. Read from its own changelog
and blog rather than from coverage of them, because the two disagree.

**Confirmed by primary sources:**

| What | Where |
|---|---|
| **Subscriptions** — an agent can monitor a PR, watch a Slack thread, or run scheduled tasks. Agents auto-subscribe to PRs they create and advance them to completion, including fixing CI failures and addressing bot feedback | changelog 08-19-26 |
| **Subagents on their own machines** — "each gets an isolated copy of the project with clean context in its own cloud environment" | changelog 08-19-26 |
| **`/goal`** — a long-lived objective the agent works toward until complete, pairable with a recurring check-in | changelog 08-19-26 |
| **Custom modes** — any skill promoted to a persistent always-on mode | changelog 08-19-26 |
| **Steering** — follow-ups wait for the next tool call instead of cutting the agent off mid-action | changelog 08-19-26 |
| **Plugins bundle MCP servers together with the skills that instruct an agent how to use them** | blog, new-plugins |
| **Third parties publish them** — 30+ from Atlassian, Datadog, GitLab, Glean, Hugging Face, monday.com, PlanetScale | blog, new-plugins |
| **Private team marketplaces** on Teams and Enterprise | blog, new-plugins |

**What the secondary coverage claims and the primary sources do not confirm:** that plugins
also bundle subagents, rules and hooks, and that there are three install modes (Default Off
/ Default On / Required). Those may well be true and are documented elsewhere; they are not
on the two pages read, so they are not stated here as fact.

### What this confirms about the design above, and what it does not

Four of our decisions have a working precedent, which is worth more than an argument:

- **A bundle is MCP servers plus the skills that teach their use** — §4's compiler, arrived
  at independently and shipped by someone else.
- **A subagent gets an isolated copy of the project with clean context** — §4's per-node
  bundle materialised into a worktree.
- **A long-lived project with recurring routines** — §7 as amended by ADR-0013.
- **An agent that wakes on an event rather than on a prompt** — the family's `seo-advisor`,
  `ops-watch` and `support-manager` as producers of work.

**And one thing is not there at all.** Neither page mentions authors earning revenue, paid
plugins, or a paid marketplace. The closest comparable product distributes third-party
plugins **for free**. That is not proof the idea is wrong; it is evidence that nobody in
this category has shipped it, which makes it an opening or a warning and not a detail.

---

## 13. A marketplace where users deploy agents — reopened by ADR-0016/0018

> ADR-0011's scope decision was superseded by ADR-0016 and the product/kernel boundary
> was settled by ADR-0018. The surfaces costed below are therefore live architectural
> obligations, but they are not yet an implementation plan. ADR-0025 fixes only the
> internal primary subscription unit; marketplace trust/liability is CO-080.

Proposed by the operator on 2026-08-25: users add and deploy their own agents, those agents
join a workflow, they may require the user's own API keys, and their authors could earn from
usage.

§8's trust tiers already cover a user **registering** a provider they host themselves. The
proposal goes further in three directions, and each is a surface the fabric does not have.

| Surface | What changes | The hard part |
|---|---|---|
| **Deploy**, not just register | third-party code executes on infrastructure we are responsible for | this is not the `user` trust tier, it is a sandbox. Cursor's answer is an isolated machine per subagent, and it is the cheap answer only if you already run the fleet |
| **Earn** | usage is metered per author, and money moves | a payout obligation, tax residency, refunds when an agent misbehaves, and metering that survives a disputed invoice. It also makes the LLM tokens an agent burns somebody's cost of goods |
| **Hold the user's API keys** | the fabric becomes a credential custodian for third-party providers | §4 scopes credentials per hop for *our* providers. Holding a customer's key so a third party's agent can spend it is a different obligation, and a breach is theirs, not ours |

ADR-0016/0018 answer the old scope question. They do **not** answer how deployment,
payouts, credential custody, provider review, emergency revocation, disputes or liability
work. Execution placement is now ADR-0021 and the primary package is ADR-0025; vault,
delegated-slot settlement and marketplace trust/liability remain separately visible in
CO-069/070/080 instead of being smuggled in as implementation details.
