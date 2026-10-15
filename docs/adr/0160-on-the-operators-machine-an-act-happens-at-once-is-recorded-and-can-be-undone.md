# ADR-0160 — On the operator's own machine an act happens at once, is recorded, and can be undone; no confirmation dialogs

**Status:** accepted · 2026-10-15 · records the operator's instruction of 2026-10-15 («никаких вот этих пермишенов,
всплывающих окон не надо, но все должно логироваться, все должно быть понятно исторически, каждое действие
отматываемое всегда у нас в системе») and the operator's standing rule of 2026-10-11 that this machine is the
operator's workplace · implemented by [the 0.3.7 plan](../evidence/plans/2026-10-15-fabric-simple/README.md) ·
amends [ADR-0134](0134-any-coding-agent-enrolls-into-a-project-through-the-hub-on-consent.md) and
[ADR-0115](0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md).

## Context

Fabric asks the person to confirm in sixteen kinds of places (the renderer inventory of 2026-10-15, recorded in the
0.3.7 plan §1): native dialogs, `window.confirm`, inline «Отмена / Да» rows and banners. One of them guards a real
boundary — a coding agent opened outside Fabric asking to join a project (ADR-0134) — and it is shown three times.
The others are steps that make the person approve what they have just asked for. At the same time nothing the person
does can be taken back from the interface, except a granted access: the safety the dialogs promise is not there
after the press.

Vision §5.3 asks that every effect have a boundary, an owner and a receipt. A dialog is none of the three: the
receipt is the record, the owner is the actor written into it, and the boundary is what the record lets the person
reverse.

## Decision

1. **No confirmation dialogs on the operator's own machine.** An act the person starts happens at once. Native
   dialogs, `window.confirm`, «Вы уверены?» rows and confirmation banners are removed from those acts.
2. **Every act is recorded with its actor and, where one exists, its inverse.** The record is the journal (ADR-0014):
   who acted (the person, Fabric, a named agent), when, on what, and how to reverse it. История lists acts with
   **Отменить**; reversing is itself an act, recorded the same way. An act with no inverse — a message delivered to
   another project, a published release, a sent email — is marked as such with the reason, before and after.
3. **A coding agent that asks to join a project is let in** (amends ADR-0134 §Decision, the consent step, and
   ADR-0115's prompt for a local agent on this machine): the enrollment is granted at once, recorded as an act of the
   agent, and shown in История and Агенты with **Отключить**, which revokes the binding, ends its sessions and keeps
   that agent out until the person lets it back in from Агенты. The credential, its scope and its expiry are
   unchanged; only the dialog goes.
4. **What still stops and asks** — in one place, a question on Главная, never a pop-up: an act on another person's
   machine (ADR-0144: a share grant, a delegation token, an approval per effect); spending money above a project's
   limit or a key's ceiling; publishing outward (a message to people, a public post, a release to users); deleting
   what cannot be restored. These are the human gates of the operator's rules; this decision does not widen or
   narrow them.
5. **Notices are not banners over every screen.** A question the person must answer once (usage counts) is asked in
   the first run; a warning that needs action (the local database reachable from the network) is a question on
   Главная with its fix.

## Consequences

- Wave 2 of the 0.3.7 plan gives the main process the inverse of each operator act it already performs (stop →
  start again, release → take again, detach → attach, discard → restore, answer → reopen, move → move back), each
  tested do-then-undo with both acts in the journal.
- ADR-0134's denial list keeps its meaning for **Отключить**; the "Fabric cannot prove this is {name}" floor moves
  from the dialog into the agent's row in Агенты, as a fact the person can read rather than a gate they must pass.
- Scenarios that describe a confirmation (SCN for release, stop, detach, discard, the enrollment consent) are amended
  or retired in wave 1 with this ADR as the reason; the board's access-request item is retired.
- A machine that is not the operator's own (RM-21, a shared machine) keeps per-effect approval: this ADR is scoped to
  the operator's workplace and changes nothing across the machine boundary.
