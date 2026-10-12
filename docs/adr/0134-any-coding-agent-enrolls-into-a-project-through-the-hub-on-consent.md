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
