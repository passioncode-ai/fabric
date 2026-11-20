# ADR-0204: The owner's agents reach Fabric Inbox with no question on his own machine, and Fabric connects itself to it

**Status:** accepted · 2026-11-21 · board request `85e5af41` (Fabric Inbox's session `93d0f261`) · records the owner's words
of 2026-11-20, 22:50, said in the CEO window and relayed to Fabric session `8343a070`: «с фабрик инбокс не работает …
подключение там доступа к агентам, вообще это все должно быть автоматически, не надо никакой подключать» · narrows
[ADR-0160](0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md) §4 (an agent's ask of a
product's resources is a question on Главная) for one product on one kind of machine · keeps
[ADR-0115](0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md) (the connection and the grant are
recorded and revocable).

## Context

An agent on the owner's machine that called Fabric Inbox through the hub failed until two things happened by hand: the
person pressed Allow on the agent's ask, and the person connected Fabric to Inbox (the connect began only from that
Allow). Measured 2026-11-20: Inbox's own server answered agents (MCP `initialize` 200, `list_accounts` 200), and agents
still could not reach it through Fabric. The owner said it must be automatic.

## Decision

1. On a machine marked as the operator's own (`machineTrust` `mine`), an agent's ask of Fabric Inbox
   (`OWNER_DEFAULT_PRODUCTS`) is allowed at once, as Fabric's local lanes are: the request, the decision and the
   revocable grant are journalled, and the operations log keeps the owner's words as the reason
   (`hub.access.owner-default`). On an organization's machine, or one not marked, it is a question as before. No other
   product is allowed this way (`main/accessService.ts`).
2. On such a machine Fabric starts the connect to Inbox by itself when Inbox is in the registry and no connection lives:
   at the hub's start, on every registry change and every 5 minutes; never while a connect waits, never after the
   person's denial, and a failed connect not again within 30 minutes (`main/inboxAutoConnect.ts`). Inbox lets a signed
   Fabric.app of the same team in without its dialog (Fabric Inbox 1.9.1).
3. Both are undone where they always were: revoking the agent or the connection in Agent access.

## Consequences

The owner's agents use Inbox with nothing pressed. A person who wants a question back marks the machine as an
organization's. Any further product allowed by default is a new decision recorded here, not an entry added to the set.
