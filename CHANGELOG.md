# Changelog

Release notes for Fabric. The next version's section is written as `## X.Y.Z (unreleased)` (or `## Unreleased`
before its number is known); the release pull request renames it `## X.Y.Z`, and the release workflow publishes
that section as the notes of the `vX.Y.Z` release
([docs/launch/release-mac.md](docs/launch/release-mac.md), [ADR-0111](docs/adr/0111-fabric-is-released-from-ci.md)).
Earlier versions: 0.2.0 (2026-09-29), receipt [`docs/releases/fabric-0.2.0-mac.json`](docs/releases/fabric-0.2.0-mac.json).

## 0.3.3 (unreleased)

Fabric becomes the way into PassionCode.ai: the first screen offers four actions, and the work behind the two agent
actions happens in the console of a coding agent you already use, not in a chat of Fabric's own
([ADR-0129](docs/adr/0129-onboarding-is-four-actions-and-agent-work-runs-in-the-coding-agents-console.md),
[ADR-0123](docs/adr/0123-the-conversation-is-the-runtimes-console-and-the-ceo-is-a-session.md)). The CEO chat itself
stays in this release; it moves to a session in a later one (amendment 1 of ADR-0123).

**Upgrading.** No schema change: a database at schema 79 (0.3.2) opens as it is. A database still at 75 (0.3.0)
or 78 (0.3.1) needs the upgrade to 79 first, backup and rehearsal included
([release runbook](https://github.com/passioncode-ai/fabric/blob/main/docs/launch/release-mac.md#upgrading-an-existing-database)).

- **Four actions to start.** The first run and **+ Project** offer two pairs. *Agent:* create a new one, or adapt
  one you built elsewhere. *Project:* open one (one folder, or a folder of them), or create one. The role agent of
  a project is made from that project's Team.
- **Create an agent.** A name, one sentence on what it will do, where its folder goes and which coding agent
  builds it. Fabric creates the folder as a git repository and a project for it, then opens the coding agent's
  console with the `creating-fabric-agents` skill; the agent asks the rest there, one question at a time.
- **Adapt an existing agent.** Choose its folder: Fabric reads it without running anything and opens the coding
  agent's console with the `adapting-projects-to-fabric` skill. The agent shows its plan and waits for your yes;
  a folder that is not yet a repository is committed as it is first, with anything that looks like a secret kept
  out; the work goes on a new branch `fabric-adapter`, and the conformance report says what passed. Fabric writes
  nothing in the folder and does not admit the agent to its registry.
- **The Fabric Agent Adapter skills are checked before either starts**, with the version: for Claude Code, Codex,
  Kilo and Hermes in the folder each reads; for Cline and Kimi Code, which have no folder Fabric knows, only the
  shared `~/.agents/skills`, and the screen says so. When they are missing, the one command that installs them is
  shown to copy, with a note when it does not cover the chosen agent. Fabric installs nothing itself.
- **A retry is the same attempt.** A launch that fails after the folder or the project was made continues with
  the same folder, project and task, also after leaving the screen and coming back; a console that did not open
  is brought forward again; *Use another coding agent* gives the same project a new task, and *Start over* is the
  only way to another name or place.
- **A scanned project arrives with what its repository says it is** (the manifest's description, else the
  README's first paragraph), kept as the repository's words — "From README.md: …" — not as yours; a repository that
  says nothing gets none.
- **"Set up this project with the agent"**, the first shortcut on a project's task panel and the scan's next
  step: the agent reads the repository, records what it learns with the file each fact came from, asks you to
  confirm a one-sentence purpose and files the next three pieces of work. It changes no file, and it runs only on a
  coding agent that connects to Fabric's tools: by name, through a created agent, or through the fallback order,
  which passes over agents that do not.
- **Fallback order** (Settings): a list of coding agents a launch may walk, each with whether to start a new
  session or use an open one ([ADR-0125](docs/adr/0125-an-agent-launch-may-follow-the-operators-fallback-order.md)).
- **Kimi Code** is in the coding-agent list and the launch menu, launched as itself; it does not connect to
  Fabric's tools.
- **Usage counts wait for your answer.** They stay on by default, but a release build sends nothing, the install
  included, until you have answered the switch once, on a first-run notice or in Settings
  ([ADR-0127](docs/adr/0127-no-usage-count-leaves-before-the-person-has-answered-the-switch.md), [docs/ANALYTICS.md](docs/ANALYTICS.md)).
  An install from 0.3.2, which already sent counts, is told so on that notice.
- **The launch screens follow the prototype**: «Discuss with Fabric ↗» (it opens the CEO chat), *Profile* and the
  Fabric strip in the top bar, a compact network-exposure warning, and nothing wider than the window. The default
  workspace reads *My workspace*.
- **Smaller fixes on the project page:** the toolbars wrap instead of running past the window, a task's subtitle
  names its agent and date instead of a raw id, and Home's «+ Add a topic» opens the board with its form.
- **Russian.** Every screen string, the startup failure dialog, the folder pickers and the app menu are in
  Russian when the app is. Not yet: messages written by the main process, the terminal prompts of ACP agents and the
  feed's verification tooltips are still in English (CO-225).
- Provider pins move to the installed Claude Code and Codex versions; the README names the commercial-licensing
  path (passioncode.ai/business).

## 0.3.2

A release built from a full audit of the 0.3.2 candidate (`e19e1b9e`, 0.3.1 plus the work merged after it): all 134 scenarios against their screens and code,
plus the trust boundaries ([report](docs/reports/2026-10-05-release-032-audit/README.md)). Every P0 and P1
finding is fixed or carried to a named row. It also ships the work that landed on `main` after 0.3.1.

- **Schema 78 → 79** (migration `20261005000081_project_board.sql`, the project board's core). Fabric 0.3.2
  does not migrate an existing database itself: it refuses a database below schema 79 and names the upgrade
  procedure ([release runbook, upgrading an existing database](https://github.com/passioncode-ai/fabric/blob/main/docs/launch/release-mac.md#upgrading-an-existing-database)).
  Once a database is migrated to 79, Fabric 0.3.1 can no longer open it, so take the backup the procedure
  asks for first. The rehearsal is one command: `node scripts/rehearse-upgrade.mjs` runs the upgrade on a copy
  of your dump in a separate, disposable stack.
- **Usage counts, on by default in a release build, from the first start.** Fabric sends installs, days of use
  and how many projects, products and agents are connected, to PassionCode's self-hosted analytics. Every event
  carries the app version, the OS name, a session id and a random installation id that every PassionCode app on
  this Mac shares; never names, paths or content. Settings → *Share usage counts* turns it off for every
  PassionCode app on the Mac ([docs/ANALYTICS.md](docs/ANALYTICS.md)). Builds from source send nothing.
- **The project board.** Agents that connect to Fabric's surface (Claude Code, Kilo, Hermes) get the project-board tools (`com.submit`, `com.list`,
  `com.get`, `com.read_ack`, `com.status`): durable, project-addressed messages that survive the session
  ([ADR-0117](docs/adr/0117-fabric-hosts-the-project-board-of-fabric-project-comms.md)).
- **More coding agents in the launch menu: Kilo Code, Hermes Agent and Cline.** Hermes runs over the Agent Client
  Protocol through Fabric's terminal shell; Kilo through its session-config variable
  ([ADR-0119](docs/adr/0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md)).
- **The editor never damages a file it cannot show as text.** Binary and non-UTF-8 files open read-only and
  are never written back; a save no longer rebuilds the editor, so typing during a save is kept; "Keep mine"
  overwrites only the version you were shown; a conflict puts the focus on its explanation, not on the
  destructive button.
- **Agents run through ACP behave.** A turn has no two-minute deadline; a line typed ahead never answers a
  permission question, and Ctrl-C during one answers it as cancelled; stopping an agent ends its whole process
  group, including the tools it started, even when Fabric has to force the stop; Kilo and Hermes do not start
  in a mode their bundle cannot honour; one failed request no longer closes the stdio bridge.
- **Your project's servers go with Fabric's surface to every agent that connects to it.** Hermes, which takes no HTTP MCP servers,
  reaches each granted server through its own stdio bridge; a session whose granted servers cannot be carried
  is not opened.
- **Cline asks before each tool.** It now starts in Ask (`--auto-approve false`); Bypass is the only mode in
  which it approves tools on its own.
- **Keys stay out of transcripts in more spellings:** Kilo's config, ACP header pairs, the bridge's
  `FABRIC_BRIDGE_AUTHORIZATION`, escaped JSON and Python dicts (ADR-0119, amendment 4).
- **Not yet:** restoring a private-history archive into a new estate does not bring back project-board messages
  (CO-212); the archive keeps the board's events, not its stored messages.
- **Attention, Board, digest and history read true.** A granted refusal leaves the queue and repeats are one
  item; an answered question keeps its receipt on the Board screen (the project page's panel does not yet, CO-222); the digest no longer marks lines read while you read
  them and is no longer cut at 1000 rows; an agent's history shows its newest 200 events and says when earlier
  ones may exist.
- **Windows hold only Fabric.** A window can show only Fabric's own page, links leave for your browser, the
  built page carries a Content-Security-Policy, and the bridge refuses any other caller. A failure in a window
  is sent to Diagnostics; a broken screen shows a recovery screen, and a window whose page process died is
  reloaded instead of staying blank.
- **Fabric tells you when your local database is reachable from the network.** The Supabase CLI publishes the
  stack's ports on every interface with its default password, and Fabric cannot bind them to this Mac alone.
  Fabric checks after start and again while it is open, at most about ten minutes apart (and retries a check
  that failed); if the ports answer on your network address, a warning above every screen gives the remedy for
  OrbStack or Docker Desktop.

## 0.3.1

- **The hub: a local agent reaches a cloud product through Fabric, on your consent**
  ([ADR-0115](docs/adr/0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md)). Fabric listens
  for agents registered on this Mac on a stable loopback port, `FABRIC_HUB_PORT` (default 47070), published in
  `~/Library/Application Support/ai.passioncode.fabric/hub.json` beside a door token (both 0600, rewritten on
  start, removed on quit). An agent asks once with `fabric.access.request`; you answer once in a native prompt,
  or from the attention queue when Fabric is in the background; on Allow the agent collects a revocable binding
  credential and calls the product with `agent.call`, narrowed by your grants and again by the product.
  **Settings → Agent access** lists products, waiting requests, agents with their grants (Revoke, Revoke all)
  and standing denials (Clear).
- **Fabric Inbox connects once, by its own consent.** Connect opens the Fabric Inbox app; its key goes to
  Project Observatory's vault, never into Fabric's database or logs. It needs a Fabric Inbox **server** with
  account narrowing (fabric-inbox#24). Fabric checks that the runtime reports version 0.9.0 or later, but a
  version check does not prove narrowing: the deployed source and a live acceptance remain open (CO-195,
  [fabric-inbox#26](https://github.com/passioncode-ai/fabric-inbox/issues/26)). The 0.9.0 app supplies the connect link.
- **Hardening from three verification iterations:** a per-request poll secret, so only the agent that asked
  can read its answer and collect its credential; the registry reads regular files only and never blocks the
  app; the connect callback answers the product within its 10 seconds and keeps nothing it could not confirm,
  except a late record whose withdrawal itself failed, which stays and is shown to you as such; hub authority
  restored from an archive comes back revoked, for you to approve again; each estate keeps its own product
  secret slot; the consent, grant and queue wording is in English and Russian; a call whose outcome is unknown
  is never sent again under the same key; a caller that disconnects no longer holds an admission slot; quitting
  can no longer hang on a special file planted at `hub.json`.
- **First run shows whether Claude Code and Codex are signed in** (CO-176), read with each tool's own read-only
  status command on the exact builds Fabric has verified; any other answer is shown as unknown, never as signed
  in, and the step never waits for it.
- **Stopping an agent:** asking again to stop a Claude Code or Codex run whose stop was already sent answers with
  that first outcome instead of a refusal that would read as "nothing was sent".
- **Smaller fixes:** the onboarding launcher no longer covers the project controls, onboarding scrolls inside
  narrow windows, and restoring saved drafts reads one consistent snapshot.
- **Schema 75 → 78** (migrations 76, 77 and the file with suffix 80; the schema version is the migration count).
  Fabric 0.3.1 does not migrate an existing database itself: it refuses a database below schema 78 and names the
  upgrade procedure ([release runbook, upgrading an existing database](https://github.com/passioncode-ai/fabric/blob/main/docs/launch/release-mac.md#upgrading-an-existing-database)).
  Once a database is migrated to 78, Fabric 0.3.0 can no longer open it, so take the backup the procedure
  describes first.
- **Not done yet:** `agent.call` takes product tool names the agent contract's `capabilityName` pattern refuses
  (CO-193); a session Fabric starts cannot reach a product through Fabric (CO-194); no live end-to-end run with
  the Fabric Inbox app yet (CO-195); the knowledge base needs final released facts (CO-196); final-source workspace
  publication and acceptance remain open (CO-197).

## 0.3.0

- **Releases are built and signed in CI.** A `vX.Y.Z` tag on main runs `.github/workflows/release.yml`:
  after a member of `release-approvers` approves, the DMG is signed with the organization's CI Developer ID,
  notarized and stapled, then attested (Sigstore), listed in a GPG-signed `SHA256SUMS` and published as a
  prerelease of this repository while Fabric is an early preview. No signing identity or team id is written into the repository any more; a
  build made on a laptop is a debug build and is never published.
