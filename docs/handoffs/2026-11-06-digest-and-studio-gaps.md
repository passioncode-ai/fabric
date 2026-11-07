# Digest edges, the digest collector, and Fabric's gaps for the Studio (2026-11-06)

## Objective

After 0.3.16's rollout: CO-509 (the digest's edges), CO-503 (the daily digests to Observatory), and the operator's word
of 2026-11-05 relayed on the board (thread `1fe66e6e`): Fabric's gaps for the organization's machines and the Studio.

## Done (on `main`, hosted CI green on each)

- `1af5c3da`: CO-509, the digest written as the contract's DEC-0153 says (the quit hour kept and written at start,
  `previous` from the last hourly line, slept hours not written, 4095 names a day plus `ops.overflow`, pruning).
- `7fcbd647`: the digest's tests run in the package's test chain (they never did).
- `26620e1a`: CO-503, the contract's DEC-0153 vectors pinned with their source receipt
  (`apps/desktop/test/fixtures/fabric-agent-contract-ops-digest/`), `foldDay` fixed to pass all 15; the OD-9 collector
  (`apps/desktop/src/main/opsDigestCollector.ts`), not wired yet.
- `5db38233`: [the Studio gaps spec](../evidence/specs/2026-11-06-studio-spaces-gaps.md), rows CO-513 to CO-518.
- `603da12f`: CO-517, a run that cannot take a board request asks the operator (`board.read-at-start`).
- `620dac15`: CO-518, [moving Fabric to another machine](../launch/release-mac.md#moving-fabric-to-another-machine-or-another-macos-user).
- `b8c0a38c`: the rule's words for a session without a slot (answer once, no work, end).
- 0.3.16 rolled out on the operator's Mac (the 0.3.16 ledger, «Rollout on the operator's Mac»).
- `79d86736`, `f6818ca0` and the change after them: CO-520, private data out of the public tree (home path, denylisted
  terms, real addresses) and the gate `scripts/check-private.mjs` in `scripts/ci.sh fast` and the operator's pre-push
  hook. Rewriting the already published history is the operator's decision (ADR-0096, amendment of 2026-11-06).
- The change after `b36199a0`: CO-510 (a retried «Поручить агенту B» files no second task), CO-521 / SCN-179 (a task in
  review asks one decision: the agent's words, «Принять», «Вернуть в работу», «Отменить задачу», a comment the agents
  read in `fabric_work_list`), CO-522 / SCN-180 filed (Fabric coordinating every coding session, draft), and
  [Fabric's part of the estate reconciliation](../reports/2026-11-06-estate-flows-fabric/README.md) (board thread
  `eefa7959`, due 2026-11-07 10:00 UTC).

## Open, with what each waits on

- **CO-513, CO-514**: the contract's DEC-0154 (draft on branch `agent/studio-ports-owner-20261106`, accepted and tagged
  by 2026-11-07). Claim names agreed: `ai.passioncode.desktop.hub`, `ai.passioncode.desktop.stack`.
- **CO-503, the collector wired** (2026-11-06, `apps/desktop/src/main/opsDigestSend.ts`): Observatory 0.34.0 shipped
  `ops_digest_record`; what is left is the access binding the operator issues in a terminal, written to
  `<userData>/observatory/ops-digest-binding.token` (`project-observatory full access-binding issue service:fabric --project
  project:<Fabric's slug> --scope ops.digest.record ...`, board thread `f7758225`, `917a0ec0`). Other services' lines
  wait for the hub's delegation token.
- **CO-515** with the contract's G7; **CO-516** with the organization slice (PLAT-137).
- Human gates: the analytics secret (thread `cb1df3d5`), the person's look at 0.3.16, and whether to rewrite the
  published history that still holds the private bytes CO-520 removed from the tree.

## Checks run

`bash scripts/ci.sh fast` (exit 0) before each commit; hosted `ci` success on `1af5c3da`, `7fcbd647`, `26620e1a`,
`5db38233`, `603da12f`, `620dac15`.

## Next task

The organization paused new work until the shared source of truth (board `1d417ba1`); what the operator asks
directly stays allowed.

Done since the pause, all on `main`, each with hosted `ci` green:
- CO-522 waves A to C (`a7ea01c5`, `f21e7c3f`, `eb6aecc1`, `de3d35cd`):
  - a start says whose work it runs into;
  - both sessions of an overlap are told, and one that stands is the person's item;
  - «Написать агенту».
- Wave D's [spec](../evidence/specs/2026-11-06-fabric-manager-agent.md) and its
  [eval spec](../evidence/specs/2026-11-06-fabric-manager-agent-evals.md). Both build on the manager already designed:
  M176's evaluator (shipped), M194's role slot and binding, ADR-0046 and M166's deterministic core (all proposed).
- CO-523 and CO-524, filed for the operator's access levels and the North Star's G11.
- CO-525: a run on a board request is told what a refused `com.enroll` means (`6977ff2f`, raised by
  fabric-agent-adapter).

- Wave D's code, steps 1 and 2: four hard violations over M176's evaluator (`797e8f0d`) and M166's deterministic
  core, first slice (`apps/desktop/src/shared/ceoCore.ts#planCeoCore`, `3803c1b6`).
- CO-512: four of its edges (the dispatcher's unreadable deadline, the closed-workflow stand-in, `SessionWindow.tsx`'s
  comments, a note after a register row's closing pipe).

First:
1. Answer the reconciliation's follow-ups on thread `eefa7959`, if any reach Fabric.
2. Wave D, step 3 (M194's `ceo` role slot and binding) waits on fabric-agent-contract: D-MGR-01/02 need a contract
   version whose binding and execution context can name the estate (asked on the board, thread `77d88a2e`; taken as the contract's CT-252, design by 2026-11-13,
   DEC by 2026-11-21). Fabric
   builds no slot and no field of its own before that answer. Then step 4, the runner (through `agent-stack`).
3. Wave E (CO-457): the branch is already read in an enrolled session's folder (CO-498); left are the Dashboards consoles
   mark (asked of fabric-dashboards, thread `b250bec9`) and the project's main session with its move (DEC-0140), scenario
   first.
4. Done 2026-11-07, all on `main` with hosted `ci` green: CO-512 resolved (its last edges included), CO-526 (every
   session learns this machine's agents in `fabric_whoami`), CO-514 whole (the listener's and the caller's account,
   macOS, Linux and Windows, `23c3a0af`) and CO-489 (a session attaches and detaches its own project's folders).
5. Waiting, each with its owner: CO-527 (the operator's choice of a filter for the agent list), CO-513 (the contract's
   CT-228 claim-file schema), Wave D step 3 (CT-252), wave E's console mark (fabric-dashboards' FD-166), CO-409's
   Claude Code fallback (fabric-switchboard, thread `327c7290`, by 2026-11-19), and CO-503's Observatory binding (the
   operator's terminal act, the command in CO-503's row), CO-528 (fabric-mcp's check on the open connection, once the
   contract's CT-254 is on `main` and tagged; thread `1fe66e6e`).
6. Done 2026-11-07 later the same day, each on `main` with hosted `ci` green: CO-409's ER-5, ER-6, ER-7, ER-8, ER-9,
   NB-2, NB-5, `timed-out`, the request followed outside the read, the `crash` reason, the wake on a stored request
   (§3.1) and the operator's mandate in the packet (DEC-0125); CO-514 narrowed by the contract's CT-254; CO-366 (not
   reproduced), CO-315 (a lost board file in a backup) and CO-378 (the agent's pid on Windows).
7. Next free work: CO-409's last items each wait on something: the journal events of §7 need a schema step (migration
   128 is reserved by the task-pipeline persistence contract), the permissions screen §6.1 goes through the scenarios
   first (super-ux), the live session's wake §3.2 and Windows runs need Switchboard; CO-336 needs the contract's
   job-limits vectors vendored at a repin; CO-308 needs a migration. Without those, take the next open row by its
   date from the [general development plan](../evidence/backlog.md#general-development-plan).

CO-524's decisions are due 2026-11-13 with Observatory (OBS-380).

Earlier plan below.


When DEC-0154 is tagged: CO-513 (a recorded port block per macOS user for the bundled stack,
`apps/desktop/src/main/bundledStack.ts`), then CO-514 (fabric-mcp checks the hub listener's uid). Until then, take the
next open row by its date from the [general development plan](../evidence/backlog.md#general-development-plan).
