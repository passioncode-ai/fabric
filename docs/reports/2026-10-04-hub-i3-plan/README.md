---
report:
  id: fabric/2026-10-04-hub-i3-plan
  title: "Hub iteration 3: canonical plan and integration review"
  kind: review
  project: fabric
  domains: [architecture]
  as_of: 2026-10-04
  status: active
  valid_until: 2026-10-05
  summary: >-
    The frozen hub candidate and newer main have different source sets.
    Main's unified graph validates 250 canonical IDs but excludes the current COM-01–14 source.
    The communications queue makes optional Telegram a transitive acceptance prerequisite.
    Canonical P-08 still has obsolete schema/status wording; release and owner acceptance remain open.
  sources:
    - name: Frozen hub candidate
      url: "https://github.com/passioncode-ai/fabric/tree/3b2878fc9283db5fc9a81697ba8538a01630b8d9"
      read_at: 2026-10-04
    - name: Observed main integration input
      url: "https://github.com/passioncode-ai/fabric/tree/4b992f587255ca2e2aa87536707075c6ebcfa40e"
      read_at: 2026-10-04
    - name: Workspace architecture integration
      url: "https://github.com/passioncode-ai/fabric-workspace/pull/33"
      read_at: 2026-10-04
    - name: Measured source excerpts and checks
      path: raw/source-review.json
      read_at: 2026-10-04
  produced_by:
    agent: codex
    task: hub-i3-plan-20261004
  supersedes: []
  consumers: [fabric]
---

<sub>ssheleg skills — task-pipeline · evidence-docs · project-reports · working-in-passioncode</sub>

# Hub iteration 3: canonical plan and integration review

**Verdict: planning integration requires correction; this review does not clear 0.3.1.** The source review is of `3b2878fc9283db5fc9a81697ba8538a01630b8d9`, with `4b992f587255ca2e2aa87536707075c6ebcfa40e` inspected separately as the pending main integration input. Later changes require an appended exact-SHA recheck. The ledger at the frozen candidate still says iteration 3 has not started; no full-stack, native, installed, paid-provider or release acceptance is claimed here.

## Scope, method and independence

Read Fabric `AGENTS.md`, `docs/AGENT_SYNC.md`, canonical backlog/manifest/AR-3/carry-over sources, release code/runbook, and the knowledge README, vision, principles, how-to-work, rules and backlog contract. Findings were formed from these sources and executable checks, rather than copying the earlier reviewer reports. The canonical ledger and source-owned disposition handoff were read for current ownership/history. This is the PLAN level, not all five review levels.

The bounded task-pipeline profile is source inspection → discriminating checks → report/handoff. Its scope is this dated report and raw receipts; dependencies are the frozen candidate and separately observed main; evidence is [source-review](raw/source-review.json), [source excerpts](raw/source-excerpts.json), [checks](raw/checks.json) and [owner issue reads](raw/owner-issues.json); resume starts with the exact integration SHA. The coordinator owns guarded backlog/ADR/map/ledger changes and the one wiki index. No generated page, shared register, live service or production source was changed by this reviewer.

## Findings

| ID | Priority and scope | Evidence | Required disposition |
|---|---|---|---|
| I3-PLAN-01 | Blocking before claiming one unified dispatch queue | Main's `scripts/unified-plan.mjs check` passes 12 lanes/582 packets/250 IDs. Direct enumeration finds **zero COM IDs, zero communications source pins, zero COM source declarations on that main tree**. Frozen candidate manifest does declare COM-01–14. [Measured graph/source sets](raw/source-review.json); main `scripts/unified-plan.mjs` derives coverage from `general-plan` lanes, not every declared task source. | Preserve the canonical COM source during main integration; connect it to the canonical priority model and refresh the unified graph/pins so COM status stays in one source. Either explicitly bound the old graph to its dated scope or extend coverage to the current manifest; do not label 250-ID green as current COM coverage. Verify missing COM coverage refuses and earliest COM dispatch waits for hub convergence. |
| I3-PLAN-02 | Blocking for canonical schema/release instructions | Frozen `docs/evidence/backlog.md:80` and main equivalent `:90` still say migration/live schema 76 and I1-only obsolete branch status. Frozen runbook `docs/launch/release-mac.md:128` says compiled schema 78; AR-3.1 `:73` correctly distinguishes filenames 76/77/80 from count 78. | Update P-08, Now and lane-2 entry wording against actual converged schema/check/landed receipts, under the owning lease. Keep P-08 open while release, installation, final-source publication and named acceptance are outstanding. Count migrations/schema_version rather than deriving schema from a timestamp suffix. |
| I3-PLAN-03 | Blocking before communications acceptance is frozen | `docs/evidence/plans/2026-10-04-project-communications.md:45–52`: COM-12 requires COM-09; COM-14 is a P0 release gate requiring COM-09 and COM-12. COM-08 owner `:155` calls its service optional; COM-08 acceptance `:160` requires the board work with Telegram down. | Make optional transport acceptance explicit. Separate core board/provider replacement acceptance from enabled Telegram acceptance, or use an explicit feature-conditioned dependency. A deferred optional integration must not silently make core board delivery impossible. Keep Telegram failure/loop tests mandatory when the transport is enabled. |
| I3-PLAN-04 | Nonblocking wording defect; fix before dispatch | Communications execution prose `:17` says COM-05 can follow COM-02; its canonical row `:43` requires COM-02 **and COM-03**, consistent with consumer identity/claims in COM-05 `:120–128`. | Correct prose to follow both prerequisites. Do not weaken the canonical dependency to match the shortcut sentence. |
| I3-PLAN-05 | Acceptance coverage gap; blocking if structural gate is used as sole protocol proof | `scripts/lib/release-gate.mjs:36–62` checks one syntactic report link per iteration and table dispositions, not link existence, five levels, reviewer freshness or exact source receipts. A synthetic three-iteration ledger with one nonexistent report per iteration returns `problems=[]`; [probe receipt](raw/checks.json). | The release owner must inspect five actual fresh reports for each of three iterations, disposition every finding by ID and bind final review to the exact converged runtime/build source. Retain this manual coverage receipt, or strengthen the validator. Structural ledger green alone cannot prove the operator's review protocol. This report contributes one PLAN review only. |

The coordinator was notified immediately about I3-PLAN-01, -03 and -04 before integration, and about the gate's limited proof scope. These are report findings; they do not duplicate writable COM/P/CO status or reserve carry-over IDs.

## Checked boundaries that are already correct

The new graph does **not** falsely close P-08. Its `UP-01` and `P-08.preflight` nodes are done with digest-bound evidence for compilation/preflight only; canonical `P-08` remains `owned-elsewhere`, with acceptance requiring full exact-source checks, human signing approval, installation and download receipts. [Node enumeration](raw/source-review.json). Preserve this distinction when joining COM work.

AR-3 remains partial: external ingress/consent in AR-3.1/3.4 does not imply project-session config writing, CEO tools, jobs or the walking skeleton are done (`docs/evidence/plans/2026-09-29-agent-registry-plan.md:73–78`). COM-03 specifies Claude→Codex replacement with generation/lease fencing and rejects old-generation ack/reply/renew/complete (`docs/evidence/plans/2026-10-04-project-communications.md:95–106`). A stable project address is the desired contract; current session messaging and this team's mailbox are not its implementation.

CO-193 remains open for consumer pin adoption and argument validation after the owner's compatible schema correction. CO-195 remains open for source-attested server narrowing and real connected-product acceptance; a deployment UUID or desktop version is insufficient (`docs/evidence/specs/2026-08-16-software-fabric-carryover.md:204–206`). A source-compatible widening must continue accepting old valid names and rejecting invalid boundaries; a contract PR's merge is not consumer acceptance.

Private consumer recovery keeps its own queue; public examples remain `example-agent` (communications source `:21–22`, COM-12 `:197–206`; knowledge principles §7). No private consumer identity is published by this review.

Five communications owner issues were independently read and are open: [Adapter #31](https://github.com/passioncode-ai/fabric-agent-adapter/issues/31), [Dashboards #26](https://github.com/passioncode-ai/fabric-dashboards/issues/26), [Switchboard #36](https://github.com/passioncode-ai/fabric-switchboard/issues/36), [Observatory #146](https://github.com/passioncode-ai/project-observatory-dashboard/issues/146), [website #37](https://github.com/passioncode-ai/passioncode-ai.github.io/issues/37). Owner issues are execution addresses, not proof of delivered code, installed plugin bytes, active-session policy reading or release. Explicit per-session ACK remains a separate obligation (COM-12 `:197–206`). Workspace PR #33 is actually merged at `3f725d37490a753ce5e06673fb3a98395ce9a845`; the frozen hub pins workspace `b105e4ff`, newer main pins `1f155eb2`, so neither pin incorporates that later owner merge yet. Final publication must prove its manifest source commits, deployed identity and parent/child relationship independently.

## Integration and verification

A read-only `git merge-tree --write-tree 3b2878fc 4b992f5` exits 1 with conflicts only in `docs/reports/map.html` and `docs/reports/completeness.html`. The result tree `421e2cabd215fb90cbd2f95323a3bea2bae2abb9` preserves the COM manifest entry and release `verifiedCandidateProblem`/`changelogProblem`. Endpoint differences showing main lacks those newer hub additions do not mean a three-way merge deletes them. Resolve generated/map conflicts from sources, refresh artifacts and source pins, and rerun gates over the combined diff. [Preview receipt](raw/source-review.json).

Actually run:

- On observed main: unified graph validator → exit 0; its regression suite → 13 pass, 0 fail.
- On frozen candidate: release helper tests → exit 0, 20 pass, 0 fail, 1 skip (electron-builder absent).
- Synthetic ledger probe → structural gate accepts; this is a demonstrated coverage limit.
- Remote API reads → exact main, merged workspace PR and seven open owner issue records.
- Observatory updates check → exit 0, empty output. No stable runtime session ID was exposed; no session acknowledgement is claimed.

The isolated fast gate exited **1** at the design-map freshness guard (this delegated report changes sources; the coordinator owns the single map update). Its machine path is sanitized; the original log digest is retained. The result is recorded in [raw/fast.sanitized.log](raw/fast.sanitized.log) and [raw/fast.exit](raw/fast.exit); it is not a converged candidate/full-tier verdict. Full disposable-database, browser/native visuals, real Claude/Codex replacement, live Inbox, provider spend, signed build/install, hosted CI and final wiki UI acceptance are **NOT_RUN** by this reviewer. No full CI dispatch was made; nightly policy remains in force.

## Handoff and exact next task

Objective completed: fresh PLAN source review and independently measured integration/ownership checks. Open work: findings above and exact-SHA recheck once hub fixes plus current main are converged. No new product policy or deferral was settled here. Coordinator owns the central source, map, ledger and wiki indexing; this branch contains only this report and raw receipts.

**Next task:** coordinator integrates current main and pending hub fixes, reconciles P-08/COM canonical dependencies and graph coverage, regenerates/pins the source graph, then sends the frozen merged SHA for PLAN recheck. Only the complete five-level review matrix, closed finding dispositions and appropriate exact-source fast/full/upgrade evidence can support the later version/gate/release preparation.

Actually used: task-pipeline bounded scope/dependencies/resume; evidence-docs supplied checkable receipt distinctions; project-reports created this dated source-owned cut; working-in-passioncode enforced owner/release/privacy boundaries. No UI or public copy was authored, so UX/design/copywriting skills were not applied.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — bounded isolated I3 review
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — commit-addressed findings
- `project-reports` — dated report and source receipts — not a skill this family ships
- `working-in-passioncode` — ownership and release rules — not a skill this family ships

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>

## Additional reproduction receipt — 2026-10-04

The complete synthetic input, baseline source digest and observed empty problem list are now retained in [raw/release-gate-probe.json](raw/release-gate-probe.json). Reproduce with `node docs/reports/2026-10-04-hub-i3-plan/raw/release-gate-probe.mjs`; it calls only the pure text helper and takes no release action. The helper bytes match the frozen source (`git diff 3b2878fc HEAD -- scripts/lib/release-gate.mjs` is empty at the report-only branch).

The coordinator reports 21 pass/0 skip in its dependency-initialized checkout on the same candidate. That does not contradict this reviewer’s measured 20 pass/1 skip: the isolated worktree skips electron-builder when that dependency is absent. The newer-main check in this report is the separate 13-test unified-plan suite, not a release-helper suite. No receipt here is borrowed from the coordinator’s run.
