# ADR-0134 — Any coding agent enrolls into a project through the hub, on consent

**Status:** accepted · 2026-10-11 · operator decision D-03 of the
[0.4.0 plan](../evidence/plans/2026-10-11-release-040-agents-first.md#decisions) · extends
[ADR-0115](0115-a-local-agent-reaches-a-cloud-product-through-fabric-on-consent.md) (a third principal beside the
door and the binding) · applies [ADR-0026](0026-fabric-exposes-a-project-scoped-policy-enforced-mcp-control-surface.md) (a binding
names a finite set of Projects) · plan row P-16, canvas node C1, REQ-01…REQ-04, REQ-33.

## Context

Fabric's working tools (`fabric_*`, `com.*`) are served only behind a per-session bearer minted for sessions Fabric
launches itself (`agentSurface.ts#mint`, scope `AgentScope`). The hub's door serves agents *registered* on the Mac
(`services/`, `providers/`) asking for a product, and nothing else (`hubTools.ts#HUB_TOOLS`). A coding agent the
person opens in a terminal therefore cannot report work, read the board or use memory; a static MCP registration
cannot work either, because the door token rotates per start and `hub.json` is removed at quit; Codex, Cline and Kimi
Code get no Fabric tools even when Fabric launches them (`shared/agents.ts`, `surfaceAdapter: 'none'`). The operator
chose (D-03) the full working set in a project, on one consent per agent and project.

## Decision

1. **`fabric-mcp`, a stdio launcher shipped with the app outside the asar** (macOS
   `Contents/Resources/bin/fabric-mcp`, Windows `resources\bin\fabric-mcp.cmd`, Linux `resources/bin/fabric-mcp`),
   reads `hub.json` on every connect, refuses a dead or foreign `pid`, reads the door token from the file `hub.json`
   names, and relays to the hub's origin exactly as written. A registration therefore holds no secret and survives
   restarts: `claude mcp add --scope user fabric -- <path>/fabric-mcp`, `codex mcp add fabric -- <path>/fabric-mcp`.
2. **Enrollment is a door tool**, `fabric.session.enroll {cwd, runtime, runtimeSessionId}`. Fabric resolves the
   folder to a Project ([ADR-0136](0136-a-folder-joins-a-project-by-a-pick-or-by-consent.md)); without a standing
   grant for (runtime, project) it asks the operator once — the prompt names the agent, the folder and the Project,
   through the existing consent presenter. Allow mints a **session principal of its own kind**, served by a server of
   its own built from the same tool catalogue a launched session gets (`shared/surfaceTools.ts`), scoped to that one
   Project. ADR-0115's rule stands: authority is the server a principal is given; the door never serves session tools.
3. **The grant is standing and revocable** (Agents & access), per (runtime, project); every enrollment, renewal and
   revocation is journalled. A revoked grant refuses the next call.
4. **One catalogue, three ways in.** Launched sessions, enrolled sessions and sessions handed off by another
   product's console ([ADR-0140](0140-a-session-is-handed-its-context-in-one-format-session-handoff-1.md)) see the
   same tools; `fabric_whoami` returns the context pack's text itself, not a path an ACP runner may not see.
5. **Family products in sessions (CO-194).** A session's `mcp.json` may carry a product's server when the operator
   granted that product to that Project, consented in Agents & access; Fabric-launched sessions keep
   `--strict-mcp-config`.
6. **Codex, Cline, Kimi Code** reach the same set through `fabric-mcp`; a runner is marked connected only by a probe
   ([ADR-0119](0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md) §4).

## Consequences

- New tables for enrollment grants (grants and RLS in migration 4's shape), new `event_types` rows with feed
  sentences, a principal kind in `accessService.ts#HubPrincipal`, a branch in `hubTools.ts#hubServerFor`, its own
  budget key in `agentSurface.ts`.
- A port alone still proves nothing: `fabric-mcp` re-reads `hub.json` and checks the `pid` before every connect.
- The same-user floor (CO-090) is restated: any process of this user can read the door token; consent, not the
  token, is what admits a session.

## Evidence

- The harness audit, 2026-10-10 (the plan, F-01; `agentSurface.ts#mint`, `hubTools.ts#HUB_TOOLS`, `hub.ts#publishHub`, `hub.ts#withdrawHub`).
- CLIs measured 2026-10-11: Claude Code 2.1.296 `claude mcp add --scope user <name> -- <cmd>`; Codex 0.162.1
  `codex mcp add <name> -- <cmd>`.

## Amendments

### Amendment 1 — 2026-10-11: what wave 1 built

- **The binding credential of an enrolled coding agent is a 0600 file, not a vault entry.** `fabric-mcp` keeps it in
  Fabric's registry root, `enrollments/<runner>.credential`, beside the door token, written atomically with the
  owner-only ACL on Windows (`hub.ts#writeAtomic`). ADR-0115 §2 stores a product agent's credential in Observatory's
  vault; a coding agent has no vault of its own and the vault is absent on Windows (CO-245), and the file sits on the
  same same-user floor as the door token (CO-090). Revoked, it is deleted and the agent asks again.
- **`fabric.session.enroll` is also a door tool, and there it only names the project.** Through the door it answers
  `needs-grant` with the folder's project (so the agent can ask for exactly that resource) and never a session; with
  a binding it mints the session (`sessionEnroll.ts#enrollSession`).
- **The enrollment ask rides ADR-0115's flow unchanged**: callee `fabric`, capability `session.enroll`, one resource
  `project:<uuid>`; the asker is a runner of the catalogue, refused before any prompt otherwise
  (`accessService.ts`, region `session-enroll-request`); the prompt names the agent and the project
  (`accessWords.ts#consentPrompt`).
- **Found on the way and fixed:** the desktop journal refused every hub event (CO-254) — see that row.
- **Proved end to end** with a real MCP client over stdio against the built app on a disposable stack: waiting before
  consent, the operator's Allow, the session's tools, `fabric_whoami` naming the project, and a restart that keeps
  working without asking (0.4.0 wave 1 verification).

### Amendment 2 — 2026-10-11: what the wave 1 fix round settled

The blind reviews of wave 1 failed it; the fix round (fabric commits `ce630523`, `8bd4066d`, `74247ab4`, `4fe456f4`,
`47ab8a59`, `4476c031`, `b3464d4b`) settled the following, each planted back and watched failing:

- **Registering `fabric-mcp`.** With no secret, once per coding agent: `claude mcp add --scope user fabric --
  "<Fabric>/bin/fabric-mcp" --runner claude-code`; `codex mcp add fabric -- "<Fabric>/bin/fabric-mcp" --runner codex`.
  `<Fabric>/bin` is `Fabric.app/Contents/Resources/bin` on macOS, the install folder's `resources/bin` on Windows
  (`fabric-mcp.cmd`) and Linux. An AppImage mounts at a new path each start, so a registration pointing into it breaks
  on the next start; the `.deb` is the Linux install that keeps a stable path (wave 7 writes the per-OS setup paths).
  The runner must be one the catalogue knows **and** one found on this computer, or the ask is refused before any
  prompt (`pty.ts#launchOption`).
- **The folder is Fabric's fact.** `fabric.access.request` takes an optional `folder`; for callee `fabric` Fabric
  resolves it with the enrollment's own resolver (`sessionEnroll.ts#resolveAgentFolder`), refuses a folder of another
  project before any prompt, and records `registry.project {id, name, root, how}` — what the prompt shows, never the
  agent's string. `within` treats only `..` and `..` + separator as leaving a root; the worktree probe is
  asynchronous with a 3 s deadline (`folderResolver.ts#gitCommonDir`).
- **Revocation ends the sessions.** Revoking the binding or the enrollment grant ends every enrolled session minted
  under it at the surface, so its bearer is refused on the next request (`sessionEnroll.ts#EnrolledSessions`,
  `AccessService.onGrantRevoked`). After a mint the binding and grant are read again; revoked meanwhile, the session is
  ended and the answer is `needs-grant`. A journal that refuses `session.enrolled@1` ends the minted session.
- **The loop is bounded.** An unspent bearer for the same binding, project and grant is handed out again (no new mint,
  no new event); past 8 live sessions per binding the oldest ends. A folder that is no project backs off 30 s.
- **Files.** Credentials are `enrollments/<runner>/<sha8>.credential`, one per binding, each tried (the wave-1
  single file is migrated); the waiting request is `enrollments/<runner>.pending.json`, kept 0600 by resource so a
  restarted or second `fabric-mcp` polls the same request instead of asking again, deleted on every terminal state.
  Both are in Fabric's registry root and outlive an uninstall (CO-257).
- **Failures say what is known.** A client-side MCP error (a timeout, an output-schema mismatch) keeps the session
  and says the outcome is unknown — check the effect before acting again; a transport failure drops and re-enrolls;
  only a refusal before the call ran (401/403/404, no connection) says nothing was done.
- **Words.** The consent is "Let <coding agent> work in <project>?" with the folder on its own line, what it gets, the
  same-user floor ("Fabric cannot prove this is <name>…") and "for a year, unless you revoke it"; Allow is only Allow —
  an enrollment never offers to connect anything (`accessWords.ts#sayRequest`, SCR-76, SCN-137).

### Amendment 3 — 2026-10-12: Codex and Kimi Code have surface adapters

The context above ("Codex, Cline and Kimi Code get no Fabric tools even when Fabric launches them") describes the
tree when this decision was taken. Main has since connected Codex (`codex-config-home`) and Kimi Code
(`acp-session`) by probe ([ADR-0119](0119-acp-is-the-generic-runner-drive-and-runners-are-catalogue-rows.md)
Amendment 6), so a session Fabric launches in either gets Fabric's tools without `fabric-mcp`; `fabric-mcp` remains
the path for an agent the person opens in a terminal, and for Cline. Ships in 0.3.5. Found by the 0.3.5
verification, iteration 1 (DO-14).

### Amendment 4 — 2026-10-12: which session a full binding ends, and how a session leaves

From the 0.3.5 verification, iteration 2 (ER-3, ER-4, ER-5):

- Past 8 live sessions per binding, the **least recently active** one ends, judged by its last call, not by when it was
  minted (`sessionEnroll.ts#enrollSession`). Its next call is told it was evicted and that its claims were released.
- An MCP client that leaves sends DELETE with its bearer and `mcp-session-id` (`agentSurface.ts#leave`,
  `fabricMcpClient.ts#openSessionLink`). For an enrolled session, the agent's own bearer leaving ends the session and
  releases its claims; a rejoin's bearer, or a launched session's, takes only itself.
- A rejoin holds at most one bearer per session (`EnrolledSessions#rejoinBearer`); unclaimed bearers past the claim
  window are swept at the next mint.
- Fabric's own refusals (HTTP 400, 408, 413, 429) keep the session and reach the agent as Fabric's refusal — nothing was
  done, and no re-enrollment happens (`fabricMcp.ts#classifyFailure`), so a fresh enrollment never resets the call budget.

### Amendment 5 — 2026-10-12: the enrollment is also the board enrollment; responding is asked apart

[ADR-0149](0149-who-answers-a-projects-requests-participation-comes-with-a-session-responding-is-a-grant.md) §1
settles ADR-0117 §3's "board enrollment" for a coding agent: this record's grant **is** its board enrollment for that
one Project — the session takes part in the project board (`com.submit`, `com.list`, `com.get`, `com.read_ack`,
`com.reply`, `com.cancel`, `com.status`) as a `trusted` principal, like a session Fabric launched. The consent says so:
`access.enroll.what` now names "messages with other projects" beside the tasks, board and memory (en and ru, SCN-137,
`docs/brand/strings.md`). **Answering** another Project's requests is not part of this grant: it is the
`board.respond` grant of ADR-0149 §2, asked and shown on its own (its words arrive with COM-03).

### Amendment 6 — 2026-10-13: a terminal session on the project board — what Fabric gives the session hooks

Measured against the fabric-agent-adapter v0.23.0 `working-with-fabric` session hooks (their needs D1–D6 and
`scripts/fabric_session.py`) on main `7eace021`, with Fabric 0.3.5 running on the operator's machine:

- **D1–D5 were served** (`hub.ts#HUB_FEATURES` publishes `session-hooks/1`; the rejoin in `fabricMcp.ts`;
  `fabric_session_observe` and `fabric_work_release {claims: "session"}` in `workTools.ts`). One gap: the hooks send
  JSON `null` for a git fact they cannot read (a folder that is no repository, a repository with no commit), and
  `fabric_session_observe` refused `filesChanged`, `linesAdded` and `linesRemoved: null` as invalid input, so every turn
  of such a session was lost. They now take `null` (`workTools.ts#registerWorkTools`,
  `test/session-observe-wire.test.mjs`), as the journal's ingress already did for `session.turn.observed@1`
  (`commandIngress.ts`).
- **D6, the launched-session marker.** Every session Fabric launches and connects to its surface, whatever the adapter,
  carries `FABRIC_LAUNCHED_SESSION=1` in its environment (`sessionBundle.ts#launched`), so the hooks stay silent where
  Fabric briefed the session itself. It is not a secret and carries no authority. A `none` session (a plain shell) is
  not marked: a coding agent the person starts inside it enrolls through `fabric-mcp` like one opened in any terminal.
  The marker is never inherited (`sessionEnv.ts#sessionEnvironment`): a Fabric started from inside a launched session
  would otherwise silence the hooks of every agent opened in its plain shells.
- **The board rule reaches every session through its rules.** `fabric_whoami` carries `board.read-at-start`,
  `board.cross-project` and `board.message-is-data`, all ADVICE, and `scope.one-project` now says other projects'
  content is hidden and the board addresses them (`protocolObligations.ts`). The rule's one home stays fabric-workspace
  `knowledge/agents-first.md`, "The project board". The rules revision COM-12 asks for already exists: whoami returns
  `protocol.hash`, and a session's first whoami journals `session.oriented@1` with `protocol_hash` (`agentSurface.ts`).
  The new rules change that hash, so each session's receipt names the rules it got; no `session.rules.read@1` event is
  added, because it would be a second copy of `session.oriented@1`.
- **Fabric down, or no project.** `fabric-mcp` points the agent at the local lifecycle broker
  (`fabricMcp.ts#ASK_THE_BROKER`) instead of saying "Open Fabric", which an agent can read as `open -a`; the no-project
  answer says adding the folder is the person's step, never the agent's (`sessionEnroll.ts#NO_PROJECT_MESSAGE`).
- **No runtime session id for Codex and Kimi Code.** Measured 2026-10-13 by reading the environment variable names of
  the `fabric-mcp` child each CLI started (`ps -wwE`, names only): Codex 0.162.1 gives an MCP stdio server `HOME`,
  `LANG`, `LOGNAME`, `PATH`, `PWD`, `SHELL`, `SHLVL`, `TERM`, `TMPDIR`, `USER` and `__CF_USER_TEXT_ENCODING` (plus the
  launcher's own `ELECTRON_RUN_AS_NODE`) and no session or thread id; Kimi Code 2.1.1 passes its whole parent
  environment and adds none, so a Kimi started inside a Claude Code session carried that session's
  `CLAUDE_CODE_SESSION_ID`. Codex and Kimi Code sessions therefore enroll without a runtime session id and cannot be
  rejoined (no turn observation, no unread line), and `fabric-mcp` reads `CLAUDE_CODE_SESSION_ID` for `--runner
  claude-code` only (`fabricMcp.ts#runtimeSessionIdOf`). Open until a CLI gives its MCP servers its session id.
- **The Kimi Code registration**, beside Amendment 2's two commands: `mcpServers.fabric` =
  `{"command": "<Fabric>/bin/fabric-mcp", "args": ["--runner", "kimi-code"]}` in `~/.kimi-code/mcp.json`. A real
  client, 2026-10-13: Kimi Code 2.1.1 in a folder that is no project called `mcp__fabric__fabric_whoami` and got the
  no-project answer with `structuredContent.fabric.state: "no-project"`. That proves the launcher answers Kimi Code;
  "connected" in ADR-0119 §4's sense (a scripted session's Fabric tool answered) waits for a project the operator adds.
- **A real Claude Code client** (R-010), 2026-10-13: Claude Code 2.1.296, `claude -p --strict-mcp-config --mcp-config
  <fabric only>` in a folder that is no project. The adapter's SessionStart preamble was printed (Fabric running, the
  server registered, the board lines and the service line); `fabric_whoami` answered no-project; the Stop worker's rejoin
  found no session and the adapter logged it as `outcome=unknown`, a wording for the adapter to make exact.
- **LC-19.** fabric-workspace `knowledge/lifecycle.md` LC-19 records the user-scope registration of `fabric-mcp` as its
  one exception, citing Amendment 2, on three conditions this decision keeps: the registration holds no secret, the
  launcher keeps nothing running, and enrollment grants nothing without the operator's consent.
- **OpenCode and pi get no catalogue rows yet.** ADR-0119 §4 calls a runner connected only when a scripted session's
  Fabric tool answers, and with no project in the estate an enrollment can only answer no-project; a row also needs its
  own drive (CO-220, ADR-0147 §5). `fabric-mcp` still exits 2 for them.

### Amendment 7 — 2026-10-13: the responder grant is asked in its own words (COM-03)

Amendment 5 left responding to a grant asked apart; COM-03 builds the ask (ADR-0149 §2). Of Fabric itself an agent
now asks either `session.enroll` (this record) or `board.respond` on 1 to 8 resources `board:<project>/<capability>`
of one Project (`shared/access.ts`, `normaliseRespondAsk`). The asker is a coding agent of the runner catalogue or a
registered service; anything else, an unknown Project, a second Project or a `folder` is refused before any prompt
(`accessService.ts`, region `board-respond-request`). The prompt says: "Let <agent> answer <capabilities> requests for
<project>?", then "It may take and answer the requests other projects send to <project> for these capabilities. It
cannot spend, publish or delete through this.", the same-user floor and "For a year, unless you revoke it under Agent
access in settings." (en and ru, `shared/accessWords.ts`, checked in `accessWords.test.ts`). A launched or handed-off
session answers under its runner's grant; an enrolled one under its own binding's (ADR-0149 §3).

### Amendment — ADR-0160 (2026-10-15): no consent dialog on the operator's own machine

On the operator's own machine a coding agent's request to enroll into a project is granted at once and recorded as the agent's act;
the person sees it in История and Агенты and revokes it with **Отключить**, which also keeps that agent out until the
person lets it back in. The native dialog, the board's access-request item and the pending queue for it are
retired by the 0.3.7 plan's wave 3 (until it ships, 0.3.6 still asks); the credential, its scope and its expiry are unchanged. Across the machine boundary (ADR-0144) nothing
changes. See [ADR-0160](0160-on-the-operators-machine-an-act-happens-at-once-is-recorded-and-can-be-undone.md).

### Amendment 8 — 2026-10-17: an unknown eligible Git repository enrolls through canonical admission

The immediate local decision in ADR-0160 also applies to a folder no Project holds yet. `resolveAgentFolder` proposes a
stable project id without a write; `AccessService.request` admits only after the catalogue runner, the binding identity
and a standing denial have been checked. `projectAdmission.ts` is the shared main-process service for this agent path,
`projects.create`, `repos.attach` and `repos.detach`, so admission cannot diverge into a second set of rules or a fake
Electron IPC event. The first credential and session then follow the same grant, journal and revocation path as every
other enrollment. `project.created@1` and `project.repo.attached@1` name the coding agent as actor; revoking the
binding still ends the sessions and keeps the agent out, and a manual detach still wins over later automation.

Evidence: immediate-allow tests in `session-enroll-request.test.mjs`, the immediate-poll test in `fabric-mcp.test.mjs`,
and end-to-end create/attach/detach/worktree cases in `project-admission.test.mjs`.
