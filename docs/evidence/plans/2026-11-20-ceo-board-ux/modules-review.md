# One Fabric, the rest as modules: a review of what Fabric re-implements

Date: 2026-11-20. Status: plan, nothing moved. Source: the owner's words, part 3 and part 4 of
[owner-words.md](owner-words.md) (keep one Fabric as the main product; Switchboard, Fabric Dashboards, Inbox and the
Fabric agent adapter become shared, reusable modules with thin wrappers, so no code is written twice; part 4: their
interfaces are not pulled whole into Fabric, everything stays «под капотом», Fabric shows only what is needed). The
decision this review supports is drafted in [adr-draft-one-fabric-modules.md](adr-draft-one-fabric-modules.md).

## 0. How this was read

- Fabric's code on branch `feat/ceo-board-ux` (worktree of 2026-11-20, head `d5b4b0cc`). Every Fabric claim cites
  `path#symbol` read for this review.
- The other products were NOT read in their repositories (operator rule: agents ask each other through their doors).
  What is said about them comes from (a) what Fabric's code calls or parses from them, (b) Fabric's ADRs and specs
  that describe them, (c) the MCP tool names visible in the session that asked for this review. The knowledge base
  (`workspace/knowledge/`) is not initialised in this worktree and was not read.
- A statement marked **[предположение, подтвердить у владельца проекта]** is inferred, not read. Section 7 turns
  each one into a question for its owner.

## 1. The products today

| Product | What it does (as Fabric sees it) | Runtime | Fabric's evidence |
|---|---|---|---|
| Fabric Switchboard | Claude Code and Codex accounts, session launch and host, dispatch of a run (also on another machine), limit stops and recovery, capacity, session holds, the agent catalogue, its duty officer | a Rust runtime and CLI (`switchboard-runtime/src/control.rs`, `capacity.rs#view`, quoted in `apps/desktop/src/main/boardDispatchWiring.ts#CONTROL_TIMEOUT_NOTE` and `#wireBoardDispatch`); an MCP server of about 110 `switchboard_*` tools (sessions, session_end, session_continue, sessions_restart_*, machines, remote, dispatch_stop, duty, recovery, handovers, agents, capacity, accounts, projects, mcp_homes) | ADR-0195 decisions 3 and 5 (W3: consoles move to Switchboard's session host); ADR-0197 decision 3 |
| Fabric Dashboards | a separate desktop app that hosts `fabric-service/0.1` services, opens their pages signed in, lists every coding session of the Mac in one merge, takes hand-overs and continues limit stops, runs consoles of its own | TypeScript/Electron (`src/core/sessions.ts`, `src/core/switchboard.ts`, `src/core/recovery.ts`, `packages/service-host`, named in Fabric's vendored header and in ADR-0139's evidence); MCP `search` and `execute` with operations `link`, `open`, `host_status`, `control`, `doctor`, `update` | ADR-0083 decision 2; ADR-0182 decisions 2 and 4; header of `apps/desktop/src/shared/vendor/dashboardsSessions.ts` |
| Fabric Inbox | a cloud mail product (Cloudflare Worker behind Access) that Fabric connects once by the product's consent and forwards narrowed MCP calls to | TypeScript Workers (`workers/mcp/tools.ts`) and a desktop connect helper (`desktop/connect.cjs`), both named in Fabric's comments | ADR-0115; ADR-0088 O2; `apps/desktop/src/main/productConnect.ts#FABRIC_INBOX` |
| Fabric Agent Contract and Fabric Agent Adapter | the contract: schemas and rules (service descriptor, provider entry, fabric links, folder attribution, secret shape). The adapter: skills and Python and Node reference kits that make any agent Fabric-compatible | the contract ships TypeScript sources Fabric vendors; the adapter ships skills and kits | ADR-0083 decision 3; ADR-0090 table; `apps/desktop/src/shared/contract/folder-attribution/pin.json` |
| Project Observatory (overlaps) | memory, workflows and hand-overs, credentials and vault, ops digests, folder attribution's canonical id | Python, a stdio MCP server at `<engine>/mcp/server.py` | ADR-0105, ADR-0166 decision 5; `apps/desktop/src/main/observatoryMemory.ts#findObservatoryServer` |

ADR-0090 already names Inbox, Dashboards and Switchboard as Fabric's tools that «also work on their own». The owner's
words do not undo that: they move the shared logic into modules, so each tool's own app is a wrapper over the same
code, and Fabric is the one main product.

## 2. What Fabric re-implements or wraps

### 2.1 Switchboard

| Fabric code | What it does | Note |
|---|---|---|
| `apps/desktop/src/main/switchboardSessions.ts#runSwitchboard` and `#withOneRetry` | runs `switchboard` with `execFile`, 30 s (`#SWITCHBOARD_SESSIONS_DEADLINE_MS`), one retry for reads only (`#readOnlySwitchboardCall`), 16 MB output | failure words in `#switchboardFailure` |
| `apps/desktop/src/main/boardDispatchWiring.ts#run` | runs `switchboard` with `spawn` in its own process group, 60 s (`CLI_DEADLINE_MS`), group killed at the deadline, 4 Mi characters | used for `agents status`, `capacity`, `dispatch`, `dispatch stop`, `dispatch status`, `sessions show` (`#wireBoardDispatch`) |
| `apps/desktop/src/main/agentCatalogRead.ts#readMachineAgentCatalog` | runs `switchboard --json agents status` with `execFile`, 5 s, 1 MB | parsed by `apps/desktop/src/shared/agentCatalog.ts#parseSwitchboardAgents` |
| `apps/desktop/src/main/sessionHolds.ts#createMachineSessionHolds` | runs `switchboard monitor hold` with `execFile`, 10 s (`#HOLD_DEADLINE_MS`), 256 KB | |
| `apps/desktop/src/main/switchboardSessions.ts#parseSessions`, `#parseStops` | parse `sessions --all` and `recovery` | mirrored from Dashboards' `src/core/switchboard.ts` and `src/core/recovery.ts` at `c43b38a` (its own comments) |
| `apps/desktop/src/main/ceoTools.ts#parseMachineRows` and `apps/desktop/src/main/machineSessions.ts#SwitchboardRow` | parse `sessions --rows` | a second session shape |
| `apps/desktop/src/main/boardDispatchWiring.ts#runStateOf`, `#launchSessionOf`, `#dispatchProvider` | parse `sessions show` and `agents status` inline | a second `agents status` parser |
| `apps/desktop/src/main/ceoTools.ts#createCeoOperations` | `sessions end`, `sessions continue` for the CEO | |
| `apps/desktop/src/main/diskSessions.ts#switchboardHomeRoots` | hard-codes Switchboard's data folder `Library/Application Support/ai.passioncode.fabric-switchboard/{runtimes,homes}` | reads another product's private layout |
| `apps/desktop/src/main/diskSessions.ts#liveClaudeSessions`, `apps/desktop/src/main/sessionLaunches.ts#claudeSessionOf`, `apps/desktop/src/main/ceoTools.ts#findTranscript` | read Claude Code's `<config>/sessions/<pid>.json` and transcripts, in the person's home and in every Switchboard home | the same file read in two modules |
| `apps/desktop/src/renderer/src/launch/SwitchboardSessions.tsx#SwitchboardSessionsPanel` | a sessions screen polling every 30 s (`#SWITCHBOARD_POLL_MS`) | «the rows Fabric Dashboards shows (the same merge)», its header |

`switchboard` is looked up on the PATH (`apps/desktop/src/main/executorDetect.ts#findOnPath`) at 11 call sites in
four files (`grep -rn "findOnPath('switchboard'\|bin('switchboard')" apps/desktop/src/main`: 6 in
`boardDispatchWiring.ts`, 3 in `switchboardSessions.ts`, 1 each in `agentCatalogRead.ts` and `sessionHolds.ts`).

### 2.2 Fabric Dashboards

| Fabric code | What it does | Note |
|---|---|---|
| `apps/desktop/src/shared/vendor/dashboardsSessions.ts#mergeSessions` (461 lines) | the session merge, copied from Dashboards' `src/core/sessions.ts` at `c43b38a` (2026-10-28) | «take a newer upstream copy whole, never edit this file in place»; no pin file or hash gate, unlike the contract's copy |
| `apps/desktop/src/main/agentRegistry.ts#readRegistry`, `#validateServiceDescriptor`, `#validateProviderEntry` | Fabric's own reader of `services/` and `providers/` | its header: Fabric reads these itself because `@passioncode-ai/fabric-service-host` «is private to the Fabric Dashboards workspace and unpublished», and «the Dashboards reader is the reference» |
| `apps/desktop/src/main/pty.ts#PtyManager`, `apps/desktop/src/main/consoleOpen.ts#createConsoleOpen` | Fabric's consoles | Dashboards runs consoles of its own (the vendored merge lists «this app's own consoles»; ADR-0182 decision 4 names «a Fabric Dashboards console») |
| none | building or opening `fabric-dashboards://` links | `grep -rn "fabric-dashboards://" apps/desktop/src` finds nothing; only the display name in `apps/desktop/src/renderer/src/launch/ContinueSessionAsk.tsx#APP_NAMES`. The owner's part 2 asks for a dashboard button per agent |
| `apps/desktop/src/main/hub.ts` region `hub-discovery` | says Fabric «publishes no `fabric-service` descriptor» | ADR-0139 decided Fabric writes `services/fabric.default.json`; `grep -rn "well-known/fabric-service" apps/desktop/src` finds no writer on this branch |

### 2.3 Fabric Inbox

| Fabric code | What it does | Note |
|---|---|---|
| `apps/desktop/src/main/productConnect.ts#FABRIC_INBOX` | the connect link and callback, «the contract on the wire is Fabric Inbox's (`desktop/connect.cjs`)» | the wire contract lives in a comment |
| `apps/desktop/src/shared/access.ts#normaliseInboxAccount` | normalises a mailbox id «exactly the way the product reads it (`parseAccount` in Fabric Inbox's `workers/mcp/tools.ts`)» | a re-implementation that must stay equal to the product's |
| `apps/desktop/src/main/productForwarder.ts` region `product-forward` | forwards narrowed calls; checks the server's `narrowingSince` version on every call | |

### 2.4 Contract and adapter

| Fabric code | Copied from | Integrity |
|---|---|---|
| `apps/desktop/src/shared/contract/fabricLinks.ts#parseFabricLink`, `#buildFabricLink` | fabric-agent-contract `src/fabric-links.ts` at `4c978495894e` | header comment only |
| `apps/desktop/src/shared/contract/folder-attribution/` | fabric-agent-contract at `ebfddce` | `pin.json` with sha256 per file |
| `apps/desktop/src/shared/contract/secretShape.ts` | fabric-agent-contract `src/secret-shape.ts` | header comment |

The agent id grammar `^[a-z][a-z0-9-]{1,62}(\.[a-z][a-z0-9-]{0,31})?$` is written three times:
`apps/desktop/src/main/agentRegistry.ts#AGENT_ID`, `apps/desktop/src/shared/access.ts#AGENT_ID_PATTERN`,
`apps/desktop/src/shared/contract/fabricLinks.ts#AGENT_ID`.

### 2.5 Observatory (where it overlaps)

| Fabric code | What it does |
|---|---|
| `apps/desktop/src/main/observatoryMemory.ts#findObservatoryServer` | finds Observatory's engine by reading the launcher's shebang and running `project-observatory full-path`, then starts `<engine>/mcp/server.py` |
| `apps/desktop/src/main/observatoryMemory.ts#createObservatoryClient` | called twice: the dispatcher (`apps/desktop/src/main/boardDispatchWiring.ts#wireBoardDispatch`) and the ops digest (`apps/desktop/src/main/boardCycle.ts`, `digestObservatory`), so two server children |
| `apps/desktop/src/main/observatoryVault.ts#createObservatoryVault` | the vault through `vault.py` and `use_secret.py` |
| `apps/desktop/src/main/fabricReadinessRead.ts#readFabricReadiness` | runs the PassionCode launcher's doctor, which checks the other products |

Folder attribution is already one rule set across Fabric, Switchboard and Observatory (ADR-0166). It is the model for
the rest: rules and vectors in the contract, each product a reader.

## 3. The duplication, ranked

1. **Four ways to run one CLI.** `switchboard` is run by four implementations with four deadlines and four output
   bounds: `switchboardSessions.ts#runSwitchboard` (30 s, retry, 16 MB), `boardDispatchWiring.ts#run` (60 s, process
   group, 4 Mi), `agentCatalogRead.ts#readMachineAgentCatalog` (5 s, 1 MB), `sessionHolds.ts#createMachineSessionHolds`
   (10 s, 256 KB). Only one has the failure words of the 2026-11-19 spec §5 and only one ends a hung ssh. Switchboard's
   own MCP server offers the same operations as typed tools.
2. **Switchboard's JSON parsed in five places, in three session shapes.** `sessions --all`
   (`switchboardSessions.ts#parseSessions`), `sessions --rows` (`ceoTools.ts#parseMachineRows`,
   `machineSessions.ts#SwitchboardRow`), `sessions show` (`boardDispatchWiring.ts#runStateOf`); `agents status` twice
   (`shared/agentCatalog.ts#parseSwitchboardAgents`, `boardDispatchWiring.ts#dispatchProvider`). Each guesses the
   shape from Switchboard's output; nothing versions it.
3. **Another product's private files read directly.** `diskSessions.ts#switchboardHomeRoots` hard-codes Switchboard's
   data folder; `ceoTools.ts#findTranscript` walks its homes; Claude Code's per-process file is read by both
   `diskSessions.ts#liveClaudeSessions` and `sessionLaunches.ts#claudeSessionOf`. Switchboard reads the same files to
   build `sessions --rows` with a pid **[предположение, подтвердить у владельца проекта]**. A change of Switchboard's
   layout breaks Fabric silently.
4. **Code shared by copying, three ways.** The Dashboards merge is a 461-line copy with no pin
   (`shared/vendor/dashboardsSessions.ts`); `fabricLinks.ts` and `secretShape.ts` are copies with a header;
   folder attribution is a copy with `pin.json` hashes. The registry reader (`agentRegistry.ts`) exists because
   Dashboards' package is unpublished. The agent id grammar is written three times.
5. **Two session screens and two console hosts.** Fabric's `SwitchboardSessions.tsx#SwitchboardSessionsPanel` and its
   «Сессии вне Fabric» (`machineSessions.ts#createMachineSessions`) show what Dashboards' «Сессии» shows from the same
   merge; Fabric's `pty.ts#PtyManager` and Dashboards' consoles both host terminals, and continuing a session exists in
   Dashboards (hand-overs, limit stops), in Fabric (`machineSessions.ts`, «Продолжить в Fabric») and in the CEO's
   `sessions continue` (`ceoTools.ts#createCeoOperations`).

Lower: Inbox's account parser re-implemented (`access.ts#normaliseInboxAccount`); Observatory's server located by its
private layout and started twice (`observatoryMemory.ts`).

## 4. The target split

The rule: **pure logic is shared as a versioned package; a running process is reached through its door** (MCP
`search` and `execute`, or a CLI with a published JSON schema). A product's app is a wrapper: its screens, its
settings, its packaging. Fabric is the main product and shows only what the owner's part 4 calls «нужное».

| Module (package name proposal) | Owner | Contract | Taken from | Wrappers |
|---|---|---|---|---|
| `@passioncode-ai/fabric-agent-contract` (published, not vendored) | fabric-agent-contract | schemas; grammars (`AGENT_ID`, capability name); `fabric://` links; folder attribution with its vectors; secret shape; one integrity rule | `shared/contract/*`, `access.ts#AGENT_ID_PATTERN`, `agentRegistry.ts#AGENT_ID` | every product; the adapter's Node kit |
| `@passioncode-ai/switchboard-client` | fabric-switchboard | one runner (deadline, process group, read-only retry, named failures, output bound); typed reads and acts for `sessions` (rows, all, show), `recovery`, `agents status`, `capacity`, `dispatch` (start, stop, status), `monitor hold`, `sessions end`, `continue`, the Claude homes list; each answer validated against a JSON schema Switchboard publishes per version | `switchboardSessions.ts`, `boardDispatchWiring.ts#run`, `agentCatalogRead.ts`, `sessionHolds.ts`, `ceoTools.ts#parseMachineRows` | Fabric (session manager, dispatcher, CEO), Dashboards, Switchboard's own app |
| `@passioncode-ai/sessions-core` | Fabric Dashboards today, moving to a shared owner (question D1) | the session model and merge (sources, states, groups, actions); readers of a runner's local session files and transcripts (Claude Code first) with redaction; the launch record format | `shared/vendor/dashboardsSessions.ts`, `diskSessions.ts`, `sessionLaunches.ts#claudeSessionOf`, `ceoTools.ts#transcriptTurns`, `#findTranscript`, `shared/sessionLaunches.ts#parseLaunchLine` | Fabric's «Сессии» screen and CEO tools, Dashboards' «Сессии» |
| `@passioncode-ai/service-registry` (the published reader part of `fabric-service-host`) | Fabric Dashboards | read and validate `services/` and `providers/`; resolve `id.instance`; build a `fabric-dashboards://` link from a service key and path | `agentRegistry.ts#readRegistry`, `#validateServiceDescriptor` | Fabric (consent, the agent's dashboard button), Dashboards |
| `@passioncode-ai/product-connect` (or inside the contract) | Fabric Inbox | the connect link and callback wire; the account normaliser; the narrowing version rule | `productConnect.ts#FABRIC_INBOX`, `access.ts#normaliseInboxAccount`, `productForwarder.ts` | Fabric; any later connectable product |
| `@passioncode-ai/observatory-client` | Project Observatory | locate and start (or reach) Observatory's server without its private layout; one shared child per process | `observatoryMemory.ts`, `observatoryVault.ts` | Fabric, Dashboards, Switchboard |

Not a package: the console host. ADR-0195 W3 already decides that consoles start through Switchboard's session host
and Fabric attaches. Dashboards' consoles take the same host **[предположение, подтвердить у владельца проекта]**.
Then a terminal is Switchboard's, and Fabric and Dashboards are viewers.

What stays Fabric's alone: the board, the journal, the CEO, the dispatcher's decisions, the sweep, the project graph,
the launch journal's storage. What stays each tool's: Switchboard's accounts, rotation and runtime; Dashboards'
service control and update; Inbox's cloud; Observatory's memory and vault.

## 5. Migration, in phases

Each phase is reversible on its own, leaves the old path working beside the new one for at least one release, and
lands behind Fabric's gates (`bash scripts/ci.sh fast`, the contract tests of the module).

| Phase | What | Needs | Reversal |
|---|---|---|---|
| 0. Agreement | this review and the ADR draft; one board request per owner (section 7) | nothing | none needed |
| 1. Fabric folds its own copies | inside Fabric only: one Switchboard runner module replacing the four, one parser per Switchboard answer, one Claude session file reader, one agent id grammar; the vendored merge gets a `pin.json` with a hash gate like folder attribution | nothing from other owners | revert the change; behaviour is pinned by the existing tests of each caller |
| 2. The contract as a package | fabric-agent-contract publishes `@passioncode-ai/fabric-agent-contract`; Fabric imports it with an exact version; vendored files kept until the package's vectors pass in Fabric's gate, then removed in a separate change | the contract owner; a package registry the CI can read | pin the vendored copy again |
| 3. Switchboard client | Switchboard publishes a JSON schema per `--json` answer and the client; Fabric's phase-1 module becomes a thin shim over it; the Claude homes list comes from Switchboard, not a hard-coded path | the Switchboard owner | the shim falls back to Fabric's phase-1 runner (a setting, one release) |
| 4. Sessions core and service registry | Dashboards publishes both; Fabric drops `shared/vendor/dashboardsSessions.ts` and delegates descriptor validation, keeping its strict identity checks for consent | the Dashboards owner | re-pin the vendored copy |
| 5. Inbox and Observatory clients | the connect wire and account normaliser from Inbox; the Observatory client from Observatory | those owners | keep Fabric's code path |
| 6. Fabric's screens over the modules | the session manager (machines, sessions per machine, rights), the agent's dashboard button through `service-registry` links, the service and load screen, each designed first (owner's part 4); Dashboards' and Switchboard's apps keep their own screens as wrappers over the same packages | the UI design of the CEO board work | a screen is added beside, nothing removed until its scenario is covered and the owner agrees |

Versions side by side: each package uses semver; Fabric pins exact versions; a breaking change is a new major that
Fabric takes in its own change; a product may stay on the old major while it moves.

## 6. Risks

| Risk | What limits it |
|---|---|
| A defect in a shared package reaches every product at once | exact pins, each product upgrades in its own change; the package carries the vectors its consumers run |
| Private packages cannot be pinned with a frozen lockfile (the reason `agentRegistry.ts` gave) | a registry the org's CI can read (GitHub Packages under `passioncode-ai`) is decided before phase 2; missing CI is not passing CI |
| Runtimes differ: Electron main, Node, Cloudflare Workers, a Rust CLI, Python | packages stay pure (no Node or Electron imports in the shared core, as `dashboardsSessions.ts` already is); Rust and Python owners publish schemas, the TypeScript client is generated or written against them |
| Switchboard is slow under load (median 28 s at a load average of 120, `switchboardSessions.ts#SWITCHBOARD_SESSIONS_DEADLINE_MS`) | the client keeps the 30 s deadline and read-only retry; acts are never retried |
| An owner does not agree or cannot schedule | phase 1 needs nobody; every later phase is per owner and Fabric keeps its current path until then |
| Licence and privacy | each package carries ADR-0092's licence; no private data (records, names, paths) moves into a package |
| Two masters for one screen | the owner's part 4: Fabric shows only what is needed; a tool's full interface stays in its own wrapper |

## 7. Questions for each owner (board requests)

**fabric-switchboard**
- S1. Will Switchboard publish a versioned JSON schema for `--json sessions --rows|--all|show`, `recovery`,
  `agents status`, `capacity`, `dispatch` (start, stop, status) and `monitor hold`, stable within a major?
- S2. Will Switchboard own `@passioncode-ai/switchboard-client` (TypeScript), or accept Fabric's phase-1 runner as its
  first version in Switchboard's repository?
- S3. Can the list of Claude homes (`runtimes`, `homes`) be read through the CLI or MCP, so Fabric stops hard-coding
  `ai.passioncode.fabric-switchboard`? Does Switchboard read Claude Code's `sessions/<pid>.json` itself?
- S4. Is the session host (ADR-0195 W3) the one console host for Fabric and Dashboards, and what is its attach API?
- S5. Should Fabric call the MCP tools (moving to `search` and `execute`) rather than the CLI, and from which version?
- S6. Is `machines` and `remote` the source for «which sessions on which machine» in Fabric's session manager?

**fabric-dashboards**
- D1. Will Dashboards publish `src/core/sessions.ts` as `@passioncode-ai/sessions-core`, and who owns it once Fabric
  and Dashboards both depend on it?
- D2. Will Dashboards publish the reader part of `packages/service-host` (descriptors, providers, links)?
- D3. Which Dashboards screens stay in its own app, and which may Fabric show through the shared packages (sessions,
  an agent's dashboard opened in place)?
- D4. Do Dashboards' consoles move to Switchboard's session host?

**fabric-inbox**
- I1. Will the connect wire (`desktop/connect.cjs`) and `parseAccount` be published (in the contract or a
  `product-connect` package), so Fabric stops mirroring them?
- I2. Is `narrowingSince` a stable rule Fabric may rely on?

**fabric-agent-contract and fabric-agent-adapter**
- C1. Will the contract be published as `@passioncode-ai/fabric-agent-contract`, with one integrity mechanism for
  every consumer?
- C2. Will the adapter's Node kit import the same package rather than its own copy?

**project-observatory**
- O1. Can Observatory offer a stable way to reach its MCP server (not the shebang, `full-path` and `mcp/server.py`
  layout), and a client package or a long-running endpoint?

**fabric-workspace and org-index**
- W1. Which package registry and CI authentication; the licence line for shared packages (ADR-0092); the rows in
  `org-index/repositories.json` for each new package.
