# PassionCode.ai guide

> **PassionCode.ai — A toolkit for AI-native teams.**
>
> *Where people and agents run the business together.*

**From vibe coding to passion coding.** Vibe coding directs prompts, chats and agent
tasks. Passion coding moves the control point up one level: stop managing agents one by
one and start operating Projects. A Project keeps its purpose, team, Routines, authority,
work, Evidence and feedback loop together while agents and Providers can change.

PassionCode.ai is the organization; its toolkit is for AI-native teams. **Fabric** is its
product, the CEO AI agent for coordinating agents and Projects; 0.2.0 is an early preview for
macOS on Apple silicon, downloadable from [its product page](https://passioncode.ai/fabric/). **Fabric Switchboard**, or Switchboard,
is the first publicly downloadable product: a desktop beta for managing AI-provider
accounts. Open source under the GNU AGPL-3.0, with a commercial license available; releases
up to 0.4.0-beta.1 were released under PolyForm Noncommercial or Internal Use, and earlier ones
under MIT, and keep those terms.
See the [Switchboard page](https://passioncode.ai/switchboard/)
for release and platform details.

**Fabric Inbox**, or Inbox, is the toolkit’s desktop email product in development
preview. See the [Inbox page](https://passioncode.ai/inbox/). Cloudflare and Gmail
have local/synthetic implementation evidence; real-account acceptance and production
deployment remain unverified. Outlook and general IMAP are planned.

The rest of this guide describes Fabric’s intended operating model. Fabric the kernel
keeps its technical meaning: portable contracts, durable work, policy and Evidence.
A Switchboard release does not mean the Fabric CEO is publicly available.

This guide explains the model without requiring the reader to know the implementation.
The [platform architecture](../architecture/passioncode-platform.md) is the canonical
source for system boundaries and open questions.

## The shortest useful model

An **Estate** is the ownership and isolation boundary for a person or organization.
An Estate contains **Projects**. A Project keeps one purpose, its roles, Agents,
Routines, work and history together.

An **Agent** is a durable role with capabilities and policy. A **Provider** is the
replaceable implementation serving that role. Replacing the Provider does not replace
the Agent's identity, schedules or work history.

```text
Estate
├── People and memberships
├── Projects
│   ├── Purpose and roles
│   ├── Agents → Providers
│   ├── Routines → Runs
│   ├── Work, evidence and artifacts
│   └── Role workspaces
└── Shared identity, policy and connections
```

A Project may begin as an idea at zero, an existing repository or a running product.
PassionCode.ai is intended to make its operating model progressively explicit and
automated rather than requiring a complete organisation before useful work starts.

## What the system owns

Fabric’s target operating model owns the lifecycle around the work:

**Observe → propose → decide → execute → verify → learn → schedule the next action.**

The loop separates three kinds of responsibility:

| Responsibility | Best fit | Why |
|---|---|---|
| Repeatable transformation and routing | deterministic workflow | predictable, testable and inexpensive to replay |
| Open-ended analysis and creation | Agent | judgment is required and the route cannot be fully enumerated |
| Sensitive decision or externally consequential Effect | person with explicit authority | accountability cannot be inferred from model confidence |

The same work item may pass through all three. Its identity and Evidence stay attached.

## A concrete company loop

Imagine a founder running a business-to-business software product.

1. A support Agent reads a customer message, answers within its approved knowledge and
   creates an Interaction point when human judgment is required.
2. A production Agent watches logs, tests and release health. It connects a crash to
   the affected Project and submits Evidence rather than a bare alert.
3. A research Agent scans approved sources and proposes topics. A content Agent drafts
   from accepted topics. A person approves any outward publication that requires it.
4. A search Agent reports discoverability problems as work, with the affected page and
   check attached.
5. A development Agent takes approved work, produces a change and runs the required
   checks. A release monitor observes the result and either closes the loop or opens
   follow-up work.

This is not a chain of agents talking to one another without control. Each transition is
a typed handoff with an owner, allowed actions and Evidence.

## How people work inside it

An owner configures Projects, roles, Agents, connections and policy. A specialist sees a
**Role workspace** containing only the queue, context and actions required for their
role. The same person may serve similar roles across several Estates without receiving
their credentials or unrelated memory.

When an Agent cannot resolve a task safely, it creates an Interaction point. The person
can answer, approve, refuse or provide an artifact. The resolution is recorded once with
its actor, policy and any Effect receipt.

## How to bring an agent

The lightest onboarding path starts in the Agent foundry:

1. Choose **adapt an existing repository** or **create a new Provider**.
2. Select the capability and target environment.
3. Copy a versioned **Agent Bootstrap Recipe** into the coding agent you already use.
4. Review the proposed repository changes before applying them.
5. Run local conformance fixtures and inspect the precise gate results.
6. Admit the Provider revision, choose its Project scope and bind it to an Agent role.

The recipe is a reproducible authoring handoff. It is not the compatibility contract and
it grants no access. Conformance proves shape and behaviour; admission accepts a revision;
project binding grants the declared role and scope.

## What agent-agnostic means

PassionCode.ai does not require every agent runtime to expose the same internals. It
requires a Provider to declare capabilities and conform at the boundary where work,
Evidence, artifacts and Effects cross into Fabric.

This keeps three things stable while implementations change:

- the Project's purpose and history;
- the Agent's role, policy and Routines;
- the work lifecycle and its proof.

## Safety boundaries

- **Identity:** every person, Agent and Provider revision is explicit.
- **Authority:** compatibility, admission and project binding are separate states.
- **Credentials:** Projects receive scoped connection bindings, never raw secrets.
- **Memory:** project and Estate boundaries apply before retrieval and promotion.
- **Effects:** publication, deployment, deletion and other external changes require a
  policy decision and a receipt.
- **Views:** extensions receive declared data and tools; the host owns layout, access and
  fallback behaviour.

## What exists today

Fabric is in development. This repository, public since 2026-10-01, holds architecture,
contracts, UX scenarios and the macOS application; its early preview 0.2.0 is the signed DMG on
[its product page](https://passioncode.ai/fabric/).
Switchboard has its own [source repository](https://github.com/passioncode-ai/fabric-switchboard)
and [product page](https://passioncode.ai/switchboard/). Platform downloads, signatures
and acceptance are stated with the release rather than implied by the toolkit name.

Continue with the [high-level architecture](../architecture/passioncode-platform.md),
the [UX scenarios](../ux/scenarios.md) or the [Fabric repository guide](../../README.md).
