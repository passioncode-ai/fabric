# ADR-0088 — Fabric reaches the operator on three surfaces — the Mac, the Quest and the phone — through one relay and the northbound MCP

**Status:** accepted direction across repositories; nothing in it is built; four choices remain
the operator's (§ Open). The kernel is unchanged.
**Date:** 2026-09-29. **Decided by:** the operator, accepting the proposal
[`docs/product/2026-09-28-fabric-remote-concept.html`](https://github.com/passioncode-ai/fabric-vr/blob/161d621/docs/product/2026-09-28-fabric-remote-concept.html)
in `fabric-vr` at `161d621` ("record this decision in our workspace, so agents know how we
want to connect VR, mobile and desktop"). Changes no meaning of Project, Agent, Provider,
Binding, Grant or MCP access binding.

## Context

- Fabric runs on the operator's Mac only. Its one live API is the agent-surface MCP on
  `127.0.0.1`, for the Agents it starts (`apps/desktop/src/main/agentSurface.ts:261,285`); the
  operator's commands travel over Electron IPC inside the app. Nothing is reachable from
  another device, and "nothing runs when the operator closes the laptop"
  ([`telegram-surface.md`](../architecture/telegram-surface.md) §1.4, ADR-0037).
- The northbound MCP control surface is decided (ADR-0026) and exists only as architecture
  ([`mcp-control-surface.md`](../architecture/mcp-control-surface.md): "no server is
  implemented in this repository").
- `fabric-vr` is a Meta Quest app for notes and voice dictation (whisper.cpp on the headset,
  a Markdown vault, a 2D panel and an immersive Space) with no connection to Fabric.
- Fabric Dashboards hosts local agent services on loopback only (ADR-0083); its design sends
  a remote client through "A2A 1.0 over HTTPS, or MCP behind an authenticated gateway" because
  loopback is not a network boundary (ADR-0081).
- On 2026-09-28 the operator asked for Fabric in VR and on the phone as a **remote control**:
  notes and voice notes, following Projects, updating the knowledge base, watching the Agents
  running in Fabric and giving them commands, and dashboards.

## Decision

1. **One product, three surfaces.** The Mac is where the Estate lives: journal, projections,
   policy, grants, Agents. The Quest and the phone are **remote surfaces** of the same Fabric.
   They are not a second Fabric, not a second control plane, and hold no copy of the journal.
   The `fabric-vr` repository builds both, from one client core. Android comes first because
   the Quest is Android. iOS is open (O3).
2. **A remote surface speaks only the northbound MCP (ADR-0026).** It never reaches the
   agent-surface MCP, Electron IPC, Supabase, a terminal, or a `fabric-service` loopback port.
   Reads are projections. Writes are typed commands, each carrying an idempotency key. A state
   changes on the surface only when Fabric's receipt arrives. Until then the surface says
   *sent, awaiting confirmation*. That is the rule behind "a signal … is never a receipt"
   (`apps/desktop/src/main/managedStop.ts:1-2`).
3. **One relay carries every remote surface.** It is an always-on, authenticated endpoint that
   terminates the northbound MCP for remote clients. **The Mac connects out to it**, so the Mac
   opens no inbound port. It holds a projection cache and a command queue, and **no
   authority**: policy, journal and grants stay on the Mac. When the Mac is offline the relay
   says so with the time it was last seen, queues commands, and never reports them done.
   - It is narrower than the hosted estate of ADR-0016 (horizon 4). A hosted estate runs the
     kernel; this relay only carries it.
   - ADR-0037's "no always-on process" still describes the kernel. The relay is a separate
     component, the same way Fabric Inbox's worker is.
   - The Telegram bot of ADR-0037 becomes one more client of this relay once it exists, not a
     separate path.
4. **The relay is the first build step of this direction.** Remote reading needs
   `project.read` and `run.read`. Remote action needs `interaction.respond` and `run.cancel`.
   Both need the relay first. `run.start` comes after both.
5. **Remote bindings start below the Mac's effect ceiling.** A surface's MCP access binding
   (the Estate-owned authorization record in [`CONTEXT.md`](../../CONTEXT.md)) lets it:
   - answer a Question;
   - decide a Proposal;
   - stop a TaskRun;
   - issue a Grant for one TaskRun.

   It does not issue standing access or any effect on production. Those stay at the Mac until
   the operator widens the ceiling with a new binding revision. Every effect is shown before it
   runs, in the shape it will take.
6. **Capture is local first.** Notes and voice are captured on the device and work with no
   connection. Captured text reaches Fabric only as a typed command: a memory fact, a task
   draft, or a message to the CEO. It is sent from a durable outbox, after the person has
   reviewed the text, as the R0 interaction contract requires
   ([`operator-interaction.md`](../architecture/operator-interaction.md)).
7. **Fabric Dashboards stays a Mac host (ADR-0083).** A remote surface sees services only as
   projections the relay carries from the Mac (health, `degraded`, events), never by reaching a
   service port. A person's own dashboard views on a remote surface are **Role workspaces**
   (platform §8), not Fabric Dashboards.
8. **Remote surfaces use the shared PassionCode design system (ADR-0070).** They adapt it for
   the headset where the display requires:
   - no palette channel below 13/255, which lifts `#0a070d`;
   - 3:1 control edges;
   - 72 dp targets.

   The adaptation is recorded in `fabric-vr`, not here.

## Open — the operator's

| # | Question | Recommendation |
|---|---|---|
| O1 | Store name: "Fabric" on the Quest and the phone, or separate "Fabric VR" / "Fabric Mobile" products with their own glyphs | "Fabric": one product, so the passion-fruit mark stays and `fabric-vr` remains a code name. This also follows the 2026-09-07 brand audit's advice against splitting Fabric into sub-products |
| O2 | Where the relay runs | a Cloudflare Worker behind Access, as Fabric Inbox already runs |
| O3 | iOS: after Android, or at once; Compose Multiplatform over the client core, or a native app | after the first remote actions work on Android |
| O4 | Where the relay sits against R0 acceptance of the desktop app | the operator's scheduling call; this record fixes the order within the direction only |

## Consequences

- `fabric-vr` records the product redefinition as its own decision, superseding its
  "notes-first" framing (its `DEC-0064`). Its product definition and UX scenarios follow in that
  repository. Its brand alignment needs nothing from this repository and can start at once.
- Before any relay is built, an architecture document for it is written in `docs/architecture/`:
  the tunnel, the cache, the queue, the offline states, the binding for a remote surface.
  [`mcp-control-surface.md`](../architecture/mcp-control-surface.md) stays the contract it
  terminates; this record adds no tool to it.
- The protocol table in [`passioncode-platform.md`](../architecture/passioncode-platform.md) §6
  gains the row for a remote surface, and `CONTEXT.md` gains **Remote surface** and **Relay**.
- Agents an operator builds for themselves are not remote surfaces and are not named in this
  record (ADR-0083).
- Reversal needs a new ADR. A surface that talks to anything except the northbound MCP is a
  reversal of Decision 2, not a shortcut.
