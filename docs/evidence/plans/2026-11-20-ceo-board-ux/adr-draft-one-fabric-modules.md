# ADR (draft): One Fabric; Switchboard, Dashboards, Inbox and the adapter share their logic as modules with thin wrappers

**Status:** Draft, number reserved at acceptance · 2026-11-20 · not in `docs/adr/` until accepted · records the owner's
words of 2026-11-20 in the CEO window ([owner-words.md](owner-words.md), part 3, paraphrased: keep only one Fabric as
the main project, the others as modules, not built into Fabric, shared and reusable so the same code is not written
twice, with a different thin wrapper and slightly different behaviour each; part 4: the interfaces of Observatory,
Dashboards and Switchboard are not pulled whole into Fabric, everything stays under the hood and Fabric shows only
what is needed) · the review behind it: [modules-review.md](modules-review.md) · relates to
[ADR-0083](../../../adr/0083-local-agent-services-follow-fabric-service-and-dashboards-hosts-them.md) (Dashboards hosts
services), [ADR-0090](../../../adr/0090-names-passioncode-is-the-organization-fabric-is-the-ceo-and-its-tools-carry-its-name.md)
(Fabric's tools carry its name and work on their own),
[ADR-0166](../../../adr/0166-one-attribution-of-folders-to-projects-across-fabric-switchboard-and-observatory.md) (one
rule set in the contract), [ADR-0182](../../../adr/0182-fabric-does-not-write-session-handoff-1.md),
[ADR-0195](../../../adr/0195-the-board-runs-apart-from-the-app-and-its-supervisor-continues-left-work.md) (Switchboard
runs sessions; W3: its session host holds consoles),
[ADR-0197](../../../adr/0197-the-ceo-is-a-console-session-fabric-keeps-with-a-fallback-runner.md) (the CEO's session
tools).

## Context

Fabric reaches four tools of its own (ADR-0090) and Observatory, and today it does so by re-implementing parts of them:

- `switchboard` is run by four implementations with four deadlines and output bounds
  (`apps/desktop/src/main/switchboardSessions.ts#runSwitchboard`, `apps/desktop/src/main/boardDispatchWiring.ts#run`,
  `apps/desktop/src/main/agentCatalogRead.ts#readMachineAgentCatalog`,
  `apps/desktop/src/main/sessionHolds.ts#createMachineSessionHolds`), and its JSON is parsed in five places in three
  session shapes (`switchboardSessions.ts#parseSessions`, `apps/desktop/src/main/ceoTools.ts#parseMachineRows`,
  `boardDispatchWiring.ts#runStateOf`; `apps/desktop/src/shared/agentCatalog.ts#parseSwitchboardAgents` and
  `boardDispatchWiring.ts#dispatchProvider` for `agents status`).
- Fabric reads Switchboard's private data folder by a hard-coded path
  (`apps/desktop/src/main/diskSessions.ts#switchboardHomeRoots`) and Claude Code's per-process files in two modules
  (`diskSessions.ts#liveClaudeSessions`, `apps/desktop/src/main/sessionLaunches.ts#claudeSessionOf`).
- Shared code travels by copy, three ways: Dashboards' session merge with no pin
  (`apps/desktop/src/shared/vendor/dashboardsSessions.ts#mergeSessions`), the contract's links with a header
  (`apps/desktop/src/shared/contract/fabricLinks.ts`), folder attribution with hashes
  (`apps/desktop/src/shared/contract/folder-attribution/pin.json`). Fabric's registry reader exists because Dashboards'
  `@passioncode-ai/fabric-service-host` is unpublished (`apps/desktop/src/main/agentRegistry.ts`, header). The agent id
  grammar is written three times (`agentRegistry.ts#AGENT_ID`, `apps/desktop/src/shared/access.ts#AGENT_ID_PATTERN`,
  `fabricLinks.ts#AGENT_ID`).
- Inbox's account parser is mirrored (`access.ts#normaliseInboxAccount`); Observatory's server is located through its
  private layout and started twice (`apps/desktop/src/main/observatoryMemory.ts#findObservatoryServer`,
  `#createObservatoryClient`).
- Sessions are shown on two screens from one merge (Fabric's
  `apps/desktop/src/renderer/src/launch/SwitchboardSessions.tsx#SwitchboardSessionsPanel`, Dashboards' «Сессии») and
  consoles are hosted by two apps (Fabric's `apps/desktop/src/main/pty.ts#PtyManager`; Dashboards' own, ADR-0182
  decision 4).

Each copy is correct today and drifts tomorrow: a change in Switchboard's output or folders, Dashboards' merge or
Inbox's parser breaks Fabric with no failing test on the owner's side. ADR-0166 already showed the cure for one
area: the rules live once, in the contract, with vectors every product runs.

## Decision

1. **Fabric is the one main product.** The person's work (board, CEO, sessions, agents, projects) is in Fabric.
   Switchboard, Fabric Dashboards and Fabric Inbox stay products that work on their own (ADR-0090), each as a thin
   wrapper (its app, CLI or cloud surface) over shared modules; none is built into Fabric's process, and Fabric does
   not take over their interfaces whole (the owner's part 4).
2. **Pure logic is shared as versioned packages; a running process is reached through its door.** A rule, a parser, a
   merge or a grammar used by two products lives once, in a package its owner publishes. A process (Switchboard's
   runtime, Observatory's server, Inbox's worker) is reached through its MCP `search` and `execute` doors or a CLI
   whose JSON answers have a published schema. No product reads another's private files or folders.
3. **The modules.** Proposed, each with its owner:
   - `@passioncode-ai/fabric-agent-contract` (fabric-agent-contract): schemas, grammars, `fabric://` links, folder
     attribution, secret shape, published instead of vendored.
   - `@passioncode-ai/switchboard-client` (fabric-switchboard): one runner and typed reads and acts, checked against
     Switchboard's schemas, including the list of its Claude homes.
   - `@passioncode-ai/sessions-core` (Fabric Dashboards, owner to be agreed): the session model and merge, readers of
     a runner's local session files and transcripts with redaction, the launch record format.
   - `@passioncode-ai/service-registry` (Fabric Dashboards): the descriptor and provider reader and the
     `fabric-dashboards://` link builder.
   - `@passioncode-ai/product-connect` or a part of the contract (Fabric Inbox): the connect wire, the account
     normaliser and the narrowing version rule.
   - `@passioncode-ai/observatory-client` (Project Observatory): reaching Observatory's server without its layout.
4. **The console host is Switchboard's session host** (ADR-0195 W3), for Fabric and, if its owner agrees, Dashboards;
   both are viewers. No console package is made.
5. **What stays Fabric's alone:** the board, the journal, the CEO, the dispatcher's decisions, the sweep, the project
   graph and the launch journal's storage. Fabric never writes another product's state (ADR-0166 decision 6 extended to
   every product).
6. **Migration in reversible phases** ([modules-review.md §5](modules-review.md#5-migration-in-phases)): first Fabric
   folds its own copies (one runner, one parser per answer, one session file reader, one grammar, a pin for the
   vendored merge), needing no other owner; then each module is published by its owner and taken by Fabric with an
   exact version, the old path kept beside for one release; Fabric's screens over the modules come last, designed
   first, adding beside and removing nothing until the scenario is covered.
7. **Versions side by side.** Packages use semver; each product pins exact versions and upgrades in its own change; a
   breaking change is a new major a product may keep the old one of while it moves.
8. **Each owner agrees per module.** A module moves only after its owner answers the board request
   ([modules-review.md §7](modules-review.md#7-questions-for-each-owner-board-requests)); until then Fabric keeps its
   current path.

## Consequences

- A change in Switchboard's output, Dashboards' merge, Inbox's parser or the contract is made once and fails in the
  owner's own tests before it reaches Fabric.
- Fabric drops copied or mirrored code over the phases (the 461-line vendored merge, four runners, five parsers, the
  registry reader's validation, three grammars) and gains package dependencies it must pin and keep up with.
- Fabric needs a package registry its CI can read; until it exists phase 2 and later wait, and phase 1 does not.
- Each tool's own app becomes thinner; its full interface stays in it, and Fabric shows only what the person needs.
- Packages must stay free of Node, Electron or Workers imports in their core, since their consumers run on all three;
  Rust and Python owners publish schemas, not TypeScript cores.
- The design map, the carry-over ledger and `org-index/repositories.json` gain rows when a phase lands, not with this
  draft.

## Alternatives considered

1. **One repository for everything (a monorepo under Fabric).** Ends drift at once, but builds every tool's release
   with Fabric's, mixes runtimes (Rust, Python, Workers, Electron) in one CI and contradicts ADR-0090's «works on its
   own». Rejected.
2. **Fold the tools into Fabric's app.** The owner's part 3 says the others are modules «не встроенный Fabric», and
   part 4 says their interfaces are not pulled in whole. Rejected.
3. **Keep vendoring, with a pin and hash gate for every copy.** Cheap and already proven for folder attribution, but
   the copy is still written by hand, the owner's tests never run against the consumer, and a mirrored re-implementation
   (`normaliseInboxAccount`, `parseMachineRows`) has no upstream file to pin. Kept only as the bridge in phase 1.
4. **Doors only, no shared code (every product talks MCP).** Right for processes and kept for them (decision 2), but
   pure logic (a merge, a grammar, a parser of a local file) would then be re-implemented behind each door, which is
   the duplication this record ends.

## Open before acceptance

- The answers to the owners' questions (S1 to S6, D1 to D4, I1, I2, C1, C2, O1, W1 in the review).
- The package registry and its CI access.
- ADR-0139 decided that Fabric publishes a `fabric-service` descriptor; `apps/desktop/src/main/hub.ts` (region
  `hub-discovery`) says it publishes none, and no writer was found on this branch. The service registry module should
  settle which is true before Fabric's dashboard button is built on it.
