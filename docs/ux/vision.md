# Product vision — Fabric within PassionCode.ai

<!-- Managed with super-ux. This layer sits above foundation, flows and scenarios. -->

This vision governs Fabric, the CEO AI agent in development, within the PassionCode.ai
toolkit ([ADR-0070](../adr/0070-passioncode-toolkit-and-product-design-system.md)).
Switchboard is a separate enabling tool: account management is not presented as delivery
of the Project operating loop. The anti-vision and alignment test below remain binding
on Fabric capabilities. This narrative iteration adds no new runtime capability.

## 1. Essence

Fabric is being developed for AI-native teams, to change how builders direct their work:
from managing agents one by one to operating durable Projects and the teams around them.

## 2. Core idea

Agent capability is abundant. Project-level coherence is scarce. Fabric is intended to bridge
the gap by making the Project — its purpose, team, authority, work, Evidence and learning
loop — the durable operating unit.

## 3. What the system does

It observes what a Project owns and what is happening; turns signals into accountable
work; routes that work through people, agents and deterministic processes; keeps authority
visible; verifies outcomes independently; preserves Evidence and learning; and schedules
the next observation. It lets the implementation of an Agent change without discarding
the Project's operating model or history.

## 4. The user's role

The user becomes the operator and designer of Projects. They set purpose, decide who and
what may act, shape recurring loops, judge exceptions and remain accountable for external
effects. They do not carry every prompt, session, handoff and status in their head.

## 5. Principles

1. We operate Projects, not agent conversations; a chat is an execution surface, not the
   home of purpose or history.
2. We keep agents replaceable, not central; capability binds through explicit contracts
   while role, Routines and Evidence remain with the Project.
3. We automate explicit loops, not implied authority; every effect has a boundary, an
   owner and a receipt.
4. We surface sourced state, not confidence theatre; an unknown remains unknown until an
   observation or check changes it.
5. We let a Project grow from zero to one progressively, not through a mandatory complete
   organisation designed before useful work begins.

## 6. Anti-vision

Fabric refuses to become:

- a multi-chat cockpit that makes one person supervise more agent sessions without
  changing the operating unit;
- a proprietary agent runtime that requires Projects to adopt one model, vendor or
  private session format;
- a human task tracker with agents attached as assignees;
- an autonomous-company simulator that erases accountable people or lets model confidence
  stand in for authority;
- a generic integration dashboard that copies provider state without closing a Project's
  observe-to-verify loop.

## 7. Horizon

Within two to three years, a Project should be able to enter Fabric at any stage —
an idea, a repository, a running service or a cross-project function — and progressively
make its team, operating loops, evidence and boundaries explicit. People should be able to
change Agents and providers, collaborate across organisations and improve automation
without rebuilding how the Project is governed.

## 8. The one sentence

**From vibe coding to passion coding: stop managing agents one by one and start operating
Projects.**

## 9. The alignment test

Before a proposed capability enters the product, ask:

1. Does it strengthen the Project as the durable operating unit, or merely add another
   place to control an agent session?
2. Can the Agent or Provider change without losing purpose, authority, Routines, Evidence
   or history?
3. Does every new effect have an explicit owner, boundary and receipt?
4. Does the capability close or clarify an operating loop from observation through
   verification and learning?
5. Can a Project adopt it progressively from its current stage, without pretending that
   unimplemented automation already exists?
