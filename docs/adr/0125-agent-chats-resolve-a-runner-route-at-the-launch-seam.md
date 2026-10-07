# ADR-0125 — Agent chats resolve a contract runner route at the launch seam

**Status:** proposed · 2026-10-07 · operator request («везде, где есть чаты с агентом — терминальные
агенты по настройке с fallback; нет сессии Claude Code — отвечает запущенный Hermes»), grounded in
the host-code seams read at `591aefb6` · plan CO-223 · the contract side is DEC-0026
(`fabric-agent-contract`, merged 2026-10-07; Fabric's consumer pin is older and moves by its own
release, per the contract's versioning rule — this ADR is the design the repin lands with).

## Context

The contract's DEC-0026 defines the **runner route**: an immutable, ordered list of admitted
terminal-runner candidates for one capability, each with a session policy (`attach: preferred|never`
× `spawn: allowed|never`), availability fallback, an `exhausted` declaration and recorded switches.
Admission (DEC-0010) is untouched: a route grants nothing.

What the host has today (read at `591aefb6`):

- **One session factory**: `PtyManager.open` (`apps/desktop/src/main/pty.ts:276-469`). Every chat —
  the ad-hoc terminal (`index.ts:4149-4175`), a managed task start (`prepare`,
  `index.ts:2768-2796`), chain advance (`chainAdvance.ts#createChainAdvance`), routine tick
  (`routineTick.ts:142,249`) — ends there. One runner id in, one spawn or one thrown refusal
  (`pty.ts:302-304`): **there is no fallback chain**, and three hardcoded `'claude-code'`
  fallbacks (`managedLaunch.ts#createManagedLaunch`, `chainAdvance.ts#createChainAdvance`, `routineTick.ts`) plus a silent client-side
  availability fallback in the pickers (`Tasks.tsx:158-167`, `ProjectHome.tsx:1462-1477`).
- **Runner rows are code** (`shared/agents.ts:139-291`); ADR-0119 §3's catalogue
  (`registry/runners.json`) does not exist yet (its Amendment 4 says so; plan AS-03).
- **No attach substrate**: every Fabric session is a Fabric-spawned PTY; there is no discovery of
  sessions Fabric did not start, and sessions do not survive an app restart. DEC-0026's
  `attach: preferred` has nothing external to attach to today.
- **Two event disciplines**: estate facts are journal `@1` events (`terminal.opened@1`,
  `context.compiled@1`); device-local facts stay out of the journal on purpose
  (`providerAccounts.ts:10-14`, the account-switch coordinator's `switch-operations.json`).
- **Constraints that bind the answer** (ADR-0119): connected is a probe result, not a flag; Fabric
  answers permissions, per launch; an unknown quota never runs a routine unattended. And
  (ADR-0123): the conversation is the runtime's console — a route picks *which console opens*, it
  never introduces a Fabric-rendered chat, and it must not hook into the retiring CeoChat stack.

## Decision

1. **One seam: `PtyManager.open` is where the route resolves.** Every launch path funnels there,
   and it already owns the unknown/unavailable refusal — the candidate walk replaces that throw
   with "try, record, try next", and exhaustion returns a typed capability-unavailable naming every
   candidate and its probe result. The hardcoded `'claude-code'` fallbacks in `prepare`, chain
   advance and routine tick, and the pickers' silent client-side fallback, are retired in favor of
   reading the resolved route — so the picker and the launch can never disagree.
2. **The project pins one runner-route revision per chat capability; until the contract repin
   lands, the host synthesizes the route**: `projects.default_agent` is the first preference, then
   the operator's estate-wide preference list (an ordered runner list in Settings — the "выбор в
   чем есть" of the request), then the remaining available catalogue rows. A synthesized route is
   recorded exactly as a pinned one would be, with its revision basis named, so the later repin is
   a data change, not a redesign.
3. **A candidate's `runnerKind` resolves to a catalogue row; availability is the honest three
   states.** Until AS-03 ships the catalogue, the code rows in `shared/agents.ts` are it
   (id == kind); a kind with no row is unavailable — recorded, not an error. The probe is the
   catalogue's version argv with the 5-second bound (`executorDetect` shape);
   installed/responding/connected, never a bare `binaryExists` pretending to be connected
   (ADR-0119).
4. **`attach: preferred` is scoped to sessions Fabric holds.** Resolution attaches to a live
   Fabric-held PTY session of the same kind in the same project when one is running
   (`PtyManager.sessions`, by option id and project); Fabric cannot see sessions it did not start,
   so foreign attach (tmux, Terminal.app) is **deferred with its own later decision** — "no session
   Fabric holds" is recorded and resolution proceeds to spawn. `spawn: allowed` launches through
   the existing bundle compile; `spawn: never` skips to the next candidate. This is the request's
   scenario in host terms: no live Claude Code session held → the next available candidate spawns
   and answers (Hermes).
5. **Permissions and quota travel with the launch, never with the route.** A switch changes no
   session's permission mode silently; the mode is per launch and is journalled with it
   (ADR-0119, `terminal.opened@1`). An unattended launch (routine, chain) never lands on a
   candidate whose quota basis is unknown (ADR-0119's rule); an operator-started launch may, with
   the usual mode checks. A route that would change an unattended launch's account/quota basis
   refuses and names why.
6. **Every selection and switch is a journal event, estate-shaped.** `runner.selected@1` beside
   `terminal.opened@1`: route reference (id, revision, content hash), candidate, kind, session,
   attach-or-spawn, actor, unattended flag, and the probe results of the candidates walked past.
   `runner.switched@1` when a later selection of the same conversation differs: from, to, reason,
   route reference. Transition-based appends (the `session.observed@1` pattern), never re-probe
   spam. These are estate facts and belong in the journal — deliberately unlike the device-local
   account-switch state (`providerAccounts.ts:10-14`), which stays out.
7. **Sticky by construction in 0.1.** A running conversation never switches mid-conversation
   (ADR-0123: the conversation is the runtime's console); `recovery: reprobe` applies at the next
   launch only. `exhausted: hold` is deferred; capability-unavailable is the honest answer until a
   consumer exists that can wait.

**Deferred, each with its own later decision:** `registry/runners.json` (AS-03, the catalogue as
data), foreign-session attach, `binding.runnerRoute` pinning in project settings (lands with the
contract repin), mid-conversation runtime migration, non-PTY runners.

## Consequences

- **Modules when implemented**: `pty.ts` (the walk beside the refusal), `launchOptions` /
  `executorDetect` (probe states), `prepare`/chain/routine (fallbacks retire), the pickers
  (`Tasks.tsx`, `ProjectHome.tsx` read the resolved route), the Settings page (the estate runner
  preference list), the journal schema (`runner.selected@1`, `runner.switched@1`).
- **Dependencies**: AS-03 (catalogue as data) and AS-09 (probes and states) in the agent-support
  plan; the contract repin that brings `runner-route.schema.json` to this consumer — today the
  vendored fixture tree does not carry it.
- **Registers**: CO-223 stays open until the implementation lands; its row named this ADR as the
  first step, and this is it. ADR-0119 stays the runner-row authority; ADR-0123 stays the
  conversation authority — this ADR routes launches, it does not redraw either.
- **Vision check** (docs/ux/vision.md §9): principle 2 — the agent serving a conversation changes
  without losing the Project's purpose, history or evidence; it is not a chat cockpit, the console
  stays the runtime's own.
