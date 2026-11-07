# Fabric's gaps for the organization's machines and the Studio's spaces

Carry-over rows CO-513 to CO-518. Asked by the operator on 2026-11-05 (relayed verbatim by Project Observatory on the
board, thread `1fe66e6e`, from its session `456ad510`; paraphrased under ADR-0096 §5: read Workspace's plan for the
move to another machine and the organization's connection, write a detailed spec for each gap, and close them in
waves). Read on 2026-11-06 against fabric-workspace `origin/main` (`docs/plans/2026-11-04-studio-spaces/`,
`knowledge/plans.md`, `knowledge/integration.md`) and Fabric `main` at `26620e1a`.

## 1. What the plan asks of Fabric

| Plan line | Asks | State in Fabric |
|---|---|---|
| studio-spaces README Q1 (a), runbook 2.7 | Fabric runs natively under each macOS user (`sshlg`, `private23`), one per user, side by side | the hub's port is per user (CO-505, `apps/desktop/src/main/hub.ts#userHubPort`, in 0.3.16); **the local stack's ports are not** (§2.1) |
| runbook 2.10 | a Fabric development session on the Studio passes `fabric_whoami` and Fabric's tests | nothing Fabric-side beyond §2.1 |
| placement.md, the contract's norm (thread `1fe66e6e`, `14b4dc86`, `d6035cae`) | a client checks that the loopback listener belongs to its own OS account before it sends a secret; `foreign-user` otherwise | fabric-mcp checks only that `hub.json`'s pid is alive (§2.2) |
| Workspace's answer 5 (`d2de8a54`), the contract's G7 | an estate belongs to its installation; a restore does not carry an installation's identity to another computer | a restored dump keeps its estate id (§2.3) |
| Workspace's answer 7 (`d2de8a54`) | the organization's entitlement reaches sessions through the hub | the hub reads none (§2.4) |
| access.md §3, a project on thread `1add3c03` (`a6c27ee1`) | a request a run could not take is seen by the operator | a gate answer settles the request for the dispatcher (§2.5) |
| runbook 2.3 to 2.10 | what moves with Fabric to the Studio and what starts fresh | no runbook for Fabric's own move (§2.6) |
| access.md §2, integration.md I1-2 | organization-context tokens, the hub's delegation, joining an organization | already rows: CO-337, CO-422, CO-319, CO-320 (the organization slice, 2026-11-21); self-update CO-501 |

## 2. The gaps

### 2.1 The local stack's ports are the same for every user (CO-513, P1)

- **Now:** the bundled stack's `supabase/config.toml` fixes API 54321, DB 54322, shadow 54320, and 54323, 54324, 54327,
  54329 (`supabase/config.toml` `[api] port`, `[db] port`); `bundledStack.ts#materializeStack` copies it unchanged into
  each user's `userData/stack`. With Colima per user (README, «Containers»), each user's Docker publishes those ports on
  the host's loopback, so the second user's `supabase start` fails on a port the first holds.
- **Needed:** the contract's norm (thread `1fe66e6e`, `14b4dc86`): a recorded port block per OS account. Fabric writes
  the block into the materialized `config.toml` (a base per user, `54321 + 100 × (uid − 501)` on macOS as the default,
  checked free on the host and recorded in `userData/stack/ports.json`), reads every stack origin from that record
  (never a literal 54321), and keeps a single-user Mac on its historical ports. Docker container names stay apart by
  each user's own Docker daemon; a shared daemon also needs the `project_id` per user.
- **Acceptance:** two macOS users on one Mac start Fabric and both stacks run; a test over the materialized config;
  the stack exposure check (`stackExposure.ts`) reads the recorded ports.
- **Depends on:** the contract's DEC on ports (due 2026-11-07).

### 2.2 fabric-mcp does not check who listens on the hub's port (CO-514, P1)

- **Now:** fabric-mcp sends a binding credential only to the hub `hub.json` names, with that pid alive
  (`apps/desktop/src/main/fabricMcp.ts`, «Each credential leaves only for the hub hub.json names now, with its pid
  alive (ER-7)»). On a host with several accounts a process of another account can listen on the port while the
  pid named in this user's `hub.json` lives. The hub itself takes a connection from any local account.
- **Needed:** the norm's point 2 (a): before a credential leaves, the server end of the connection is owned by this
  uid (macOS: the socket table, `netstat -anv -p tcp` or `sysctl net.inet.tcp.pcblist64`, then the pid's uid; Linux:
  `/proc/net/tcp`; Windows: `GetExtendedTcpTable`); otherwise `foreign-user` and nothing is sent; an owner that cannot
  be told is a refusal too. The hub refuses a connection from another account before reading it (point 2 (b)), and
  its door token is already rewritten at every start (point 3).
- **Acceptance:** a test with a listener of another uid (a fake socket table) refuses; the session's bearer path is
  under the same check.
- **Depends on:** the contract's DEC on ports and listeners.
- **Built 2026-11-07, the client half:** DEC-0154 is accepted (`v0.1.0+2026-11-07.1`). `apps/desktop/src/main/listenerOwner.ts`
  reads the listener's owner (macOS `lsof -Fpu`, Linux `/proc/net/tcp`), and `apps/desktop/src/main/hub.ts#locateHub`
  refuses another account's, or one that cannot be told, as `foreign-user` before any token; fabric-mcp passes the
  check (`apps/desktop/src/main/fabricMcpMain.ts`). Tests: `apps/desktop/test/listener-owner.test.mjs`. Left: point 2
  (b) on the hub, and Windows.

### 2.3 A restored dump gives a second installation the same estate (CO-515, P2)

- **Now:** the estate is a row of the installation's own database (`supabase/migrations/20260831000001_migration_one.sql`,
  `estates`); a move is `pg_dump`, restore and `migration up` (`docs/launch/release-mac.md`), which keeps the estate's id.
  Two machines restored from one dump run two live estates with one id.
- **Needed:** the contract's G7: a restore on another computer does not carry the installation's identity. Fabric
  records the machine it last ran on beside the estate; a start on another machine with a live original asks the person
  to move (the old one stops) or to start a new estate.
- **Acceptance:** a restored dump started under another machine identity does not present the old estate as its own.

### 2.4 The hub reads no organization entitlement (CO-516, P3)

- **Now:** no code in `apps/desktop/src` reads an entitlement (searched 2026-11-06).
- **Needed:** decide with the platform (PLAT-137) and the organizations' service which rows the hub needs (paid agents, members) and how it
  gets them; until then no row for that service. Part of the organization slice.

### 2.5 A run's gate answer is invisible to the operator (CO-517, P2)

- **Now:** a request answered by its target is settled for the dispatcher (`boardDispatchRun.ts`, `SETTLED` holds
  `answered`), so a run that answered «cannot be taken now» leaves nothing in «На проверке».
- **Needed:** the rule `board.read-at-start` tells a run that answered with a gate to ask the operator with
  `fabric_question_ask` (kind `access`, `about` `board.gate.<capability>`, `commandId` the UUID v5 of the name `board.gate` in the namespace of the request's id, as fabric-agent-adapter 0.69.0 derives it),
  as agreed with a project and the adapter (thread `1add3c03`, `a58b4280`, `ac9f8d34`).
- **Acceptance:** the rule's test; a run's question appears on the home.

### 2.6 No runbook for Fabric's own move (CO-518, P2)

- **Needed:** what moves (the stack's dump, `settings.json`, the project folders' links) and what starts fresh
  (`hub.json`, the door token, agent bindings: agents enroll again; Keychain items; the installation id), with the
  checks a moved Fabric must pass; one section of `docs/launch/release-mac.md`.

## 3. Waves

1. CO-517 (rule words, no dependency) and CO-518 (runbook).
2. CO-513 and CO-514, after the contract's DEC on ports (2026-11-07).
3. CO-515 with the contract's G7; CO-516 with the organization slice.
