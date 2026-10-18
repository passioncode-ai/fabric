# Handoff: automatic project registration through Fabric enrollment

## Objective

RM-09 / REQ-001, with REQ-004/005 boundaries: when a coding agent opens an eligible unknown Git repository or worktree on the operator's own machine, Fabric must create or attach the correct Project through its canonical main-process enrollment/admission path. The separate manual **+ Project → Open a project** step is removed. Registration is local, idempotent, journalled and reversible; it grants no account move, provider-fallback change, credential/memory grant or write to a sibling product store.

Branch: `agent/auto-project-registration-20261017`. Approved base: `7ee0060e`; local `origin/main` was integrated by rebase, with no conflicts. Implementation checkpoint: `f24d3d82` (the branch may move for this handoff and final gate evidence).

## Decisions

- ADR-0136 amendment 2: exact real path → longest admitted ancestor → worktree common Git directory → normalized remote. Ambiguity is refused. An otherwise unknown eligible repository gets a deterministic project id and is created once; clones attach instead of duplicating.
- ADR-0160 amendment 1: on the operator's own machine `session.enroll` is allowed at once as the coding agent's act. Runner identity, binding identity and standing denial are checked before any project write. Other products and other machines keep their existing approval behavior.
- `projectAdmission.ts` is the one main-process create/attach/detach service for agent enrollment and IPC. No Electron event is fabricated.
- `project_repo_removals` records detach tombstones. Automation does not resurrect detached or archived Projects; an explicit attach clears a tombstone. Re-entry and partial-retry are idempotent.

## Implemented

- `apps/desktop/src/main/folderResolver.ts`: identity resolution, normalized scp/URL remote keys without userinfo, ambiguity refusal, deterministic folder project ids, lazy remote reads with bounded concurrency.
- `apps/desktop/src/main/projectAdmission.ts`: canonical create/attach/detach/enroll service with actor, remote/kind metadata, idempotent retries and archived/detached refusal.
- `apps/desktop/src/main/sessionEnroll.ts`: read-only proposal of an eligible unknown Git folder; non-Git, broad, detached and ambiguous answers stay refusals.
- `apps/desktop/src/main/accessService.ts`: admission after runner/binding/denial checks and immediate local allow; standing denial, revocation and other access flows preserved.
- `apps/desktop/src/main/index.ts`: one service instance wired to IPC and the hub, with file-root refresh and workspace mirror.
- `apps/desktop/src/main/fabricMcp.ts`: an already-allowed request is collected without the consent-interval wait.
- `apps/desktop/src/main/hubTools.ts`: agent-facing tool guidance matches the new path.
- `supabase/migrations/20261018000113_project_repo_identity.sql` (count 91; first written as `20261017000109`, renamed after wave 2's `20261017000112` landed) and `supabase/migration-ledger.json`: remote/kind identity, estate-path uniqueness, detach tombstones and projection. `20261018000114_private_archive_source.sql` (count 92) admits schemas 91 and 92 as private-archive sources.
- `apps/desktop/src/shared/commandIngress.ts` and `apps/desktop/src/shared/access.ts`: repository identity fields and resolution kinds accepted.
- Tests: `folder-resolver.test.mjs`, `project-admission.test.mjs`, `session-enroll-request.test.mjs`, `session-enroll.test.mjs`, `fabric-mcp.test.mjs`, `command-ingress-db.test.mjs`.
- ADR-0134/0136/0160, CONTEXT, SCN-137, FLW-77, SCR-76, CHANGELOG, AGENTS, the 0.4.0 plan status, MERGES and the design map are updated to the same behavior.

## Checks actually run

| Command | Exit | Result |
|---|---:|---|
| `node --experimental-strip-types --test apps/desktop/test/folder-resolver.test.mjs` | 0 | 13/13 |
| `node --experimental-strip-types --test apps/desktop/test/project-admission.test.mjs` | 0 | 4/4 |
| `node --experimental-strip-types --test apps/desktop/test/session-enroll-request.test.mjs` | 0 | 14/14 |
| `node --experimental-strip-types --test apps/desktop/test/session-enroll.test.mjs` | 0 | 34/34 |
| `node --experimental-strip-types --test apps/desktop/test/fabric-mcp.test.mjs` | 0 | 46/46 |
| `node test/run-command-ingress-db.mjs` (cwd `apps/desktop`) | 0 | 6 groups, 90 actual migrations, owned PostgreSQL stopped and removed |
| `pnpm --filter @fabric/desktop typecheck` | 0 | desktop node and web typechecks |
| `node scripts/check-design-map.mjs --refresh && node scripts/check-design-map.mjs` | 0 | map source stamp, 700 anchors and 2032 link targets |
| `node scripts/check-migration-order.mjs --record` | 0 | 90 migrations recorded |
| `node scripts/check-regions.mjs` | 0 | 426 code regions closed and resolving |
| `node scripts/check-ops.mjs` | 0 | all catches record or explain |
| `node scripts/check-actor.mjs`, `check-commands.mjs`, `check-scope.mjs`, `check-ipc-contract.mjs`, `check-unread-boundary.mjs`, `check-written-never-read.mjs`, `check-references.mjs` | 0 | all source guards passed |
| `bash scripts/check-docs.sh`, `bash scripts/check-narrative.sh`, `python3 docs/brand/lint.py`, `python3 docs/ux/lint.py` | 0 | documentation, narrative, brand and UX gates pass with existing advisory warnings |
| `git diff --check` | 0 | no whitespace errors |
| `git rebase origin/main` | 0 | seven newer main commits integrated without conflict |

Added 2026-10-18 (Claude Code, continuing the run after Kimi's quota ran out):

| Command | Exit | Result |
|---|---:|---|
| `node --experimental-strip-types --test apps/desktop/test/automatic-registration-scenario.test.mjs` | 0 | 2/2: two rounds of three coding agents (repository, its worktree, a clone by remote) through the real `resolveAgentFolder` → `AccessService.request/status` → `projectAdmission` wiring of `index.ts` over real temporary Git repositories; round 2 writes no Project or repository event; detach and a standing denial hold for two rounds; plain and broad folders refused |
| `node --experimental-strip-types --test apps/desktop/test/project-admission.test.mjs` | 0 | 4/4; it was in no test chain before, now in `scripts/ci.sh` fast and `pnpm test` with the scenario |
| `bash scripts/ci.sh fast` (first run) | 1 | one failure only: `scripts/test/build-unified-plan.test.mjs` needs the `workspace` submodule, which this worktree had not initialized (environment, not code); `git submodule update --init workspace`, then rerun below |

The scenario composes the main-process pieces, not the packaged app: the real `fabric-mcp` client against a running hub is exercised only by `fabric-mcp.test.mjs` against a fake hub. A run against an installed Fabric needs a release and install, which this run does not do.

**Overlap found 2026-10-18:** Fabric's own session (run `r-44ae60a75316`, CO-328, ADR-0164 «a folder with no project is attributed by Fabric, never handed to the person») has an uncommitted second implementation of the same behaviour in `/Users/sshlg/DATA/_wt/fabric-co328` (`folderAttribution.ts`, `folderResolver.ts#decideAttribution`, the same ADR-0134/0136 and `sessionEnroll.ts`). It was notified. This branch is not landed on `main` until that session decides which implementation Fabric keeps or merges them; the branch is pushed for it to read.

Not run: hosted nightly CI; a packaged-app run; any release/install.

## Blockers and limits

- `agent-sync status` exits 1 because `.env.agent-sync` is absent; the record plane is local/degraded. Git leases are cross-machine and were held for every guarded write. Initial `reconcile` exits 1 because ADR/CO baselines were never set; no baseline was created in this feature run.
- No real running app was restarted, replaced or probed, and no sibling repository/store was written.

**Integrated with 0.3.7 wave 2 (2026-10-18):** rebased onto `agent/fabric-simple-w2`; migrations renamed to sort after
`20261017000112_acts_and_reopened_answers.sql` (schema 90), so this branch moves the schema to 92; `apply_projections`
keeps wave 2's `apply_question_answer_reopen`. The folder attach IPC goes through `projectAdmission.attach` and records
wave 2's `repo.attach` act; detach goes through wave 2's `repo.detach` act, whose executor now writes path, remote and
kind, so the detach leaves the `project_repo_removals` tombstone, and its undo (`repo.attach`) brings the identity
back and clears it (`actExecutors.ts`; checks added to `acts-db.test.mjs`). ADR-0164 records the decision, CO-328 is
resolved and CO-329 carries Switchboard's owner and work rules, at the request of Fabric's session.

## Exact next task

Fabric's session (CO-328 owner) chooses between this branch and its ADR-0164 work, or merges them; whichever lands carries `project_repo_removals` (automation never reattaches what the operator detached) and the two-round scenario test. Then land by fast-forward after `bash scripts/ci.sh fast` exits 0 on the merged head, and record the landed SHA in org-index `docs/runs/2026-10-17-automatic-project-registration/README.md`.
