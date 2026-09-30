# The agent family — a proposal, recorded 2026-08-24

**Status: ROLE CATALOGUE PROPOSAL, amended 2026-08-29.** The product-scope question this
document originally forced is settled by ADR-0016/0018: PassionCode.ai serves multiple
estates and Fabric is the reusable kernel. The roles and their sequencing remain proposed.

Source: the operator's description on 2026-08-24. Facts about what already exists were
measured the same day and carry their evidence.

---

## 1. The scope question it forced — now settled

At the time of the proposal, `docs/vision.md` said two things it contradicted:

> **Not a hosted product.** It runs on the operator's desktop…
> **Not a general-purpose agent framework.** It exists to run *this* estate.

The proposal says each agent performs its function independently, generates revenue, and
serves as an onboarding entry point for new users, who may arrive through the blog, through
UGC content or through development.

An agent that generates revenue has customers who are not the operator. **Both statements
cannot be true.** This is not a wording problem; the two branches build different systems:

| | Estate tool (what is recorded) | Product family (what is proposed) |
|---|---|---|
| Who it serves | one operator | paying users |
| Tenancy | single | multi-tenant, isolated |
| The floor | protects one person's money | becomes a compliance surface |
| Terminals inside it (ADR-0008) | the operator's own machine | somebody else's code on our machine |
| Support | none | a role, and an obligation |
| Failure cost | a bad afternoon | a refund and a reputation |

This was recorded as **CO-028, STOP AND ASK** because the answer changed every milestone
below. The paragraph is retained as the decision's evidence, not as current state.

> **Superseded answer:** ADR-0011 first chose the estate-tool branch; ADR-0016 then met
> its explicit reversal condition and ADR-0018 named the final product/kernel boundary.
> The product-family column is now direction, while org #1 still builds first. ADR-0025
> fixes the internal primary subscription unit without setting prices; marketplace trust
> remains CO-080.

---

## 2. The loop, and what it actually is

The proposed loop runs idea → product → analytics → feedback → improvements → media
updates, and then back to analytics.

**This needs no new machinery.** A named sequence of stages, each naming the department that
holds it and the gate that closes it, is exactly a `pipeline` as ADR-0009 defines one. The
growth loop is a pipeline the operator can edit, not a second engine beside the graph.

The inner loop the operator named separately — *analytics → feedback → improvements → media
updates* — is the same pipeline with its first two stages skipped, which is what a pipeline
version is for.

---

## 3. The roles

A `department` is a lookup, not an invention (`CONTEXT.md`). These are candidate rows in
that lookup — **role types, not an org chart.** ADR-0010 puts the org chart inside each
project: a project instantiates the roles it needs, and two projects each running a
copywriter have two agents and one department. **"Exists" was measured on 2026-08-24, not recalled.**

| Role | What it owns | Consumes | Produces | Exists today |
|---|---|---|---|---|
| `trend-research` | what the market is talking about | the open web | research briefs | no |
| `seo-advisor` | what to fix, as tasks rather than a report | Search Console, Analytics, crawl | ready-to-hold nodes | no |
| `ops-watch` | production logs, Sentry, crashes — and setting *itself* up per project | error streams, deploy events | incident nodes | no |
| `scriptwriter` | turning research into a content brief | research briefs | shot lists, outlines, hooks | no |
| `content-maker` | video for media | briefs | rendered media | no |
| `blog-writer` | long-form SEO/AEO pages that stand on their own | briefs, keyword sets | published articles | no |
| `copywriter` | how it sounds, in every locale | brand pack, scenarios | strings, headlines, localised copy | no — but the doctrine exists (`super-ux` ships `brand-voice` and `copywriting`) |
| `publisher` | getting it out — social, press, forums | finished assets | posts, with their ids | **third-party** — Postiz, AGPL-3.0, 35 080 stars, already forked and cloned locally |
| `domain-scout` | auction domains against a parameter list | auction feeds | buy/skip verdicts with evidence | no |
| `pbn-operator` | acquiring, hosting and posting on the network | scout verdicts | pages and links | no — see §6 |
| `performance-marketing` | Meta, Google, TikTok | budgets, creatives, attribution | campaigns and their spend | no |
| `attribution` | one number from many sources | every publishing surface, every ad network | touchpoints a marketer can plan against | no — see §5 |
| `marketer` | what to do next with the budget | attribution | plans, as goals | no |
| `support-manager` | the person who wrote in | tickets, product state | answers, and defects as nodes | no |
| `emailer` | outbound and lifecycle email | lists, product events | sent mail, and its deliverability | no — added 2026-08-25 |
| `reddit-voice` | replying where the subject already comes up | threads, product knowledge | comments under a named account | no — added 2026-08-25 |
| `x-voice` | the same, on X | mentions, timelines | replies under a named account | no — added 2026-08-25 |
| `linkedin-voice` | writing and collecting leads | profiles, posts, replies | posts, connections, a lead list | no — added 2026-08-25 |
| `developer` | the code | **a backlog that arrives from the others** | changes, through `task-pipeline` | this is the fabric's own M6 / M17 |

**Two of these are not peers of the rest.**

- **`copywriter` is consumed, not scheduled.** The developer building an interface and the
  publisher shipping a post both call it. That makes it a *service department* — the first
  one in this design, and the schema has no notion of one yet.
- **`attribution` is a tool, not an agent.** It has no goal and holds no node; it answers a
  question every other role asks. Modelling it as a department would give it work it cannot
  do and hide the dependency everything else has on it.

---

## 4. The developer works from a backlog it did not write

As proposed, the developer agent uses a platform skill that says which agents exist, how
to talk to them and how to code, and that a backlog of tasks arrives from elsewhere for it
to close.

That "elsewhere" is the point. `seo-advisor`, `ops-watch` and `support-manager` all emit
work. Today the fabric has one producer of nodes — the CEO. This proposal adds three more,
and the CEO stops being the only thing that decides what is worth doing.

**Unresolved:** whether those agents file *goals* the CEO decomposes, or *nodes* directly.
The first keeps one decomposition authority and one place where autonomy is set. The second
is faster and puts three agents inside the graph with no goal above them, which ADR-0004
would have to answer for. Recorded as **CO-035**.

---

## 5. Attribution is the dependency nobody can route around

Every publishing role and every ad network needs one consolidated view, and the marketer
cannot plan without it. It introduces an object the ontology does not have: a **touchpoint**
— a source, a campaign, a surface, a time, and an identity that has to survive across
systems that each name the same visitor differently.

This is the hardest data problem in the proposal and the least visible one. Recorded as
**CO-032**.

---

## 6. PBN — the risk, stated where the decision is

Buying expired domains to host articles that link to a main resource is a **link scheme**
under Google's spam policies. The measured risk is not that the network gets deindexed —
it is that **manual action can land on the money site**, which in this estate is the live
property the network exists to help.

This is the operator's estate and the operator's call. It is recorded here rather than
argued, so that a later run reading this document does not have to rediscover it, and so
the decision is made with its cost visible. Recorded as **CO-033, status `recorded`.**

---

## 7. A2A, and the two things it actually buys

The operator proposes A2A so modules can be swapped, added and plugged in — a Google
Analytics agent, a Sentry agent, a Reddit agent, a Product Hunt press-release agent.

**What it buys, and both are real:**

1. **Replaceability.** A department behind a protocol boundary can be swapped without
   touching the fabric, which is the only way "keep adding agents" stays cheap at fifteen
   roles and does not at fifty.
2. **A licence boundary.** Postiz is **AGPL-3.0**. A separate process that the fabric talks
   to over a protocol is a materially different combination from one linked into the
   product, and the difference decides whether the fabric's own source falls under §13 the
   moment it is offered to a user over a network. **If the answer to §1 is "product family",
   this stops being an architecture preference and becomes a licensing constraint.**

**What it costs:** a network hop per call, authentication and versioning per agent, a
discovery layer, and a direct tension with ADR-0008 — if departments are separate services,
"the terminal runs inside the fabric" has to say *whose* terminal. A2A between our own
in-process departments would be machinery bought for no buyer.

Recorded as **CO-029** (where the A2A boundary falls) and **CO-030** (the AGPL question).

---

## 8. The four that speak *as* the operator, and why they are a different kind

`emailer`, `reddit-voice`, `x-voice` and `linkedin-voice` were added on 2026-08-25. Every
role above them **produces** something a human then ships. These four **are** the shipping,
in public, in real time, under a name that belongs to a person.

Four consequences, and the first one is not solvable by any of the others.

### 8.1 They run straight into the floor, and ADR-0007 already closed the easy exit

ADR-0004 puts **outward publication under the operator's name** on the floor — never
automatic, at any level, including `maximum`. ADR-0007 then said the floor is the one thing
the fabric may **never** answer on the operator's behalf.

A reply agent that waits for per-reply approval is not an agent; it is a drafting tool with
extra latency. So one of three things has to be true, and none is free:

| | What it means | What it costs |
|---|---|---|
| Per-item approval | every reply is a manual gate | the agent's whole value is the latency it removes |
| A **standing channel grant** | a named, expiring grant scoped to one account, one surface, one topic range | the floor gets a new grant *shape* — continuous rather than single-action — and ADR-0004's "named, specific, expiring" has to survive it |
| Move it off the floor | replying is not "publication under the operator's name" | it plainly is, and rewriting the floor to fit a feature is how a floor stops being one |

The middle one is the only serious candidate, and it is a change to ADR-0004's grant model,
not a configuration. Recorded as **CO-036**.

### 8.2 Sending reputation is a shared asset, and the registry cannot see it

A cold-outreach agent that burns the sending domain does not burn only its own campaign. It
burns **transactional mail for every product in the estate** — password resets, receipts,
alerts — because deliverability attaches to the domain and the IP, not to the campaign.

The registry records `mail_only` as a *state* (4 domains hold it). It records nothing about
sending identity, warm-up, authentication posture, or bounce history. That is not a missing
field; it is a missing asset kind. Recorded as **CO-037**.

### 8.3 The accounts these agents speak from are assets, and none of them is registered

`CONTEXT.md` defines an asset as "a domain, a repository, a deployed application, **an
account with a provider**". The registry holds 40 domains. Its `accounts:` block holds three
Cloudflare accounts as *context* — an id, an email, a zone count — not as assets with
measured state.

So the four roles above cannot be assigned at all: there is nothing to assign them **to**.
Before any of them exists, the estate needs the account kinds it already claims to cover —
social accounts, sending identities, ad accounts — with the same rule the domains got:
every field measured, never recalled.

This also settles a question the operator has not been asked yet. The estate holds two live
personal sites (BL-014). **Do these agents speak from
the operator's own identity, or from product identities?** The first puts a person's
reputation inside an autonomy level; the second needs accounts that do not exist yet.
Recorded as **CO-038**.

### 8.4 Two risks recorded rather than argued

**Platform automation.** Reddit, X and LinkedIn each carry terms covering automated posting,
replying and connection requests, and LinkedIn is the strictest of the three — restriction
lands on the account, which by §8.3 is an asset. **Lead collection is personal data**: a
list of people gathered from LinkedIn is processing under GDPR if any subject is in the EU,
which means a lawful basis, retention, and a subject-access path — and under CO-028's
"product family" branch it stops being the operator's own exposure and becomes a customer's.

Both are the operator's estate and the operator's call. Recorded as **CO-039** and
**CO-040**, status `recorded`, for the same reason PBN was: so the decision carries its cost
and no later run rediscovers it.

## 9. One thing this proposal proves about the product

On 2026-08-24 another project's site was described as nearly finished. The registry,
measured 2026-08-16, records that zone as holding **zero DNS records**, and that project's
own ADR names it the product's home.

Both statements are true: the code is nearly done and the world serves nothing. That gap —
between what was declared somewhere and what a probe returns — is the exact failure this
project exists to notice, and it appeared inside the conversation proposing the project's
next fifteen agents.

It is already BL-007. It is now also the best argument for M4.
