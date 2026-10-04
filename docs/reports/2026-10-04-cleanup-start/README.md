---
report:
  id: fabric/2026-10-04-cleanup-start
  title: "Fabric: cleanup, complete source coverage and Start execution"
  kind: review
  project: fabric
  domains: [architecture, auth, reliability]
  as_of: 2026-10-04
  status: draft
  valid_until: 2026-10-11
  summary: >-
    Six merged worktrees and an inactive Switchboard build cache removed after ownership checks.
    All twelve plan lanes re-read; 543 declared owner rows distinguish coverage from readiness.
    Start packets preserve five remaining deferrals; CO-180 target scan identity corrected.
    Native, release, external-provider and operator decisions keep their separate acceptance gates.
  sources:
    - name: "Source baseline"
      url: "https://github.com/passioncode-ai/fabric/tree/484600a338f2c413333e57c09a28712b8559c401"
      read_at: 2026-10-04
    - name: "Electron directory dialog contract"
      url: "https://www.electronjs.org/docs/latest/api/dialog"
      read_at: 2026-10-04
    - name: "MCP authorization specification"
      url: "https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-06-18/basic/authorization.mdx"
      read_at: 2026-10-04
  produced_by:
    agent: "Codex coordinator with three independent research/review agents"
    task: "cleanup-start-20261004"
  supersedes: []
  consumers: []
---

# Fabric: cleanup, complete source coverage and Start execution

## Current entry and authority

This is the new review of [RPT fabric/2026-10-04-unified-execution §Unified queue](../2026-10-04-unified-execution/README.md). Its dated research and historical receipts remain unchanged. The canonical [general plan](../../evidence/backlog.md#general-development-plan), [build order](../../evidence/backlog.md#build-order-by-layer) and registers still own product priorities and status; this report owns reviewed task context and measured checks, not a second completion register.

The [brief](brief.md) states scope, writer boundaries and the five-stage delivery profile. Three agents independently reviewed Start, lanes 2–9 and Reach/Horizon, and reported cross-task impacts immediately through the coordinator. A blocking finding is incorporated before the current writer proceeds; future discoveries are retained with affected canonical IDs and proof in the new cut. [Source reconciliation](raw/lanes-review.json), [Start context](raw/start-review.json), [Reach and cleanup review](raw/reach-cleanup-review.json) retain exact inspected source revisions. Branch receipts are separate from main, native acceptance and a release.

## Measured cleanup

[Cleanup receipt](raw/cleanup.json) records the checks and available-byte snapshots:

| Action | Result | Observed available-byte delta |
|---|---|---:|
| Remove inactive Switchboard Rust `target` only | Clean unmerged source worktree preserved; ignored cache, no open files/cwd, remote checkpoint preserved | 4,484,562,944 bytes |
| Normal `git worktree remove` for six merged Contract copies | Clean including untracked paths; dependencies-only ignored; remote ancestry, lease/activity and merge-tree checks passed | 42,287,104 bytes |
| `npm cache verify` | 114 contents verified; one garbage entry collected | 464,392 bytes reported by npm |

The two `df` deltas total about 4.22 GiB; concurrent writes can affect available space. APFS clone/dependency `du` totals are not physical reclamation. Of 51 inspected worktrees, 11 were dirty and were retained. All 3,509 inspected test-directory candidates were too recent or lacked sufficient inactive ownership proof; none were erased. Active Fabric/hub/native fixture/sync builds, unfinished branches, provider stores, Docker data and other sessions' files were preserved. Machine path/process inventory stays local, outside this Git report.

A [second requested cleanup pass](raw/cache-cleanup-second-pass.json) cleared the inactive `ccache` compiler cache through `ccache --clear` and removed one 129,743,965-byte Electron download ZIP. It measured another 207,699,968 available bytes: approximately **4.41 GiB total observed delta** across all three measurements. Installed Electron, referenced Playwright builds, active Swift/pnpm caches and unfinished worktrees were preserved.

A [third pass](raw/cleanup-third-pass.json) followed when the data volume reached 100% and the coordinating sessions stopped writing. It removed 7,620 Fabric test temporary entries older than two hours that no process held open, stopped five orphaned test-fixture processes from the previous day, removed 24 idle or merged worktrees (every unmerged branch kept locally and on origin; two dead-session diffs archived first as local `archive/wip/*` tags), deleted ten merged remote branches and archived eleven pre-publication branches as local `archive/pre-public/*` tags. Available space went from about 6.0 GiB to about 12 GiB. Worktrees of the still-running coordinator were kept.

### Defect found by the gate

The repository fast gate failed under host load on a repeated provider stop. Both stop controllers checked a repeat's fresh admission deadline before returning the stored outcome, so a slow authority read turned an already attempted stop into `refused/deadline` — an answer that reads as "nothing was sent". Stored and in-flight outcomes now answer first; the deadline still refuses a new execution. New tests in both controller suites were watched failing against the previous bytes; [receipt](raw/stop-cache-deadline-fix.json).

## All twelve sections

The previous 250 directional IDs covered 245 source-qualified owner rows. The main baseline's 13 declarations contain **543 rows**, including historical finished foundations: 298 omitted owner rows must be included as held source references, not become automatically ready. Inspected hub/convergence branches contain 557 rows; those are branch observations until integration. Another **43 capability/child IDs** already present in detailed research live outside the manifest's current parser declarations; [all 43 owner mappings](raw/supplemental-coverage.json) preserve the known CO-189 coverage deferral and source-owned status. [Exact inventory, parser pin and per-row proof](raw/lanes-review.json#inventories). Fabric-local coverage is separate from the organization-wide backlog inventory, which was not verified in this review.

| Lane | Current finding and next bounded work | Receipt |
|---|---|---|
| 1 · Start | P-01 remains partial. Account for CO-176…180 individually; measured sign-in status and target scan identity are independent from native first-release acceptance. | [Six packets](raw/start-review.json) |
| 2 · Release | P-08 stays Now. Main and convergence disagree on schema/release prerequisites; review and integrate the owning source correction, CO-179 containment, replacement I3 and exact-candidate gates. | [LR-03](raw/lanes-review.json) |
| 3 · First release | FR-A…G keep their own prerequisites. Hub success does not pass AD02 or context/provider replacement acceptance. | [Lane 3](raw/lanes-review.json) |
| 4 · Adoption | AD02 blocked with pure-tier receipt; AD03 may prepare from accepted inputs; AD04 waits for both acceptance receipts. | [Lane 4](raw/lanes-review.json) |
| 5 · Providers | Fresh CLI versions/sign-in booleans do not establish N1 real-provider quota, account continuity or all M199 capabilities. | [LR-06](raw/lanes-review.json) |
| 6 · Agents | AR partial walking skeleton retained; source/compiled-consumer compatibility is not full runtime acceptance. | [Lane 6](raw/lanes-review.json) |
| 7 · Memory | MEM-P0 baseline precedes dependent memory capabilities; history access/import and current execution authority stay separate. | [Lane 7](raw/lanes-review.json) |
| 8 · Learning | Prepare fresh P-06.1/P-07.1 against the merged event, append, projector, restore and hub epochs. Historical schema/source pins do not renew authority. | [LR-04, LR-07](raw/lanes-review.json) |
| 9 · Support | Verify each actual prerequisite: a ready label or long file does not settle M109/S02.store, native visuals or release containment. | [Lane 9](raw/lanes-review.json) |
| 10 · Reach | Preserve S4/S5/S6 prerequisites; pin actual leaf writer files in addition to broad source context before implementation. | [Reach review](raw/reach-cleanup-review.json) |
| 11 · V1 | Seven V1 milestones remain separate bounded design/implementation steps with source-specific dependencies. | [V1 review](raw/reach-cleanup-review.json) |
| 12 · Horizon | All 147 listed CO IDs retained. A future trigger does not authorize current external effects or broad implementation. | [Horizon review](raw/reach-cleanup-review.json) |

## Start order and implementation

The order inside Start remains P-01, CO-176, CO-177, CO-178, CO-179, CO-180. Readiness is per capability. CO-179's existing native visual/fixture owners retain their work; scheduled observation and Russian Estate terminology require explicit decisions in their established owner homes. Independent available work proceeds without erasing those dependencies.

| ID | Bounded outcome | Boundary |
|---|---|---|
| P-01 | Reconcile delivered first-run code and five linked deferrals; preserve partial umbrella | No blanket native/AD02 acceptance |
| CO-176 | Separate installed/connected from observed provider sign-in; exact-build read-only vendor status, bounded/redacted result | No stable account identity, admission, quota, login or model turn inferred |
| CO-177 | Specify persistent revocable root/owner/grant, cadence, scan coverage, restart/revocation/late-result fences | Stored path/window picker is not a persistent observation grant; accepted ADR needed before scheduling |
| CO-178 | Inventory Russian Estate use, compare bounded options and preserve domain meaning | Brand calibration decision precedes locale edits; no mechanical schema rename |
| CO-179 | Existing scoped native fixture and visual refinement, then exact native state matrix before the next release | Active peer ownership, AD02 and release gates preserved |
| CO-180.1 | Separate Project per ticked repository in legacy target scan; result summary, failed-row retry, imported-ID reuse, kept unchecked choices and manual-part warnings | Page-local prototype; no desktop IPC/filesystem/provider/database effect |

CO-180 replaced obsolete primary-plus-related batch grouping. A successful sibling keeps its Project identity and context during a failed-row retry. Select-all excludes nested/worktree parts; manual selection warns that it creates an independent Project. Partial list/overview status remains visible. Explicit reference sources within an existing Project and frozen task/Run packs are preserved. Scenarios → flows → screens → model/report were updated together; exact proof is in [independent source review](raw/co180-review.json), [browser receipt](raw/co180-browser.json) and the reusable `scripts/test/co180-scan.browser.cjs` harness. This does not promote SCN-128 to native accepted. Its owning CO-180 row remains open pending leased canonical status update and integration.

## Research, verification and handoff

[Research refresh](raw/research-refresh.json) adds official directory-dialog and authorization sources plus an Electron developer issue. The historical Windows issue informs a negative-test checklist; it does not assert a current macOS defect. Provider boolean sign-in remains distinct from audience/resource-bound authorization, as required by the [MCP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-06-18/basic/authorization.mdx). Folder selection and cancellation use the [Electron dialog API](https://www.electronjs.org/docs/latest/api/dialog); actual Fabric authority still belongs to its checked main-process contract.

The immutable current cut is generated only after reviewed source inputs are committed. [Current source execution](raw/execution.json) and independent receipts distinguish local code/process/component checks, the target browser and acceptance not yet run. Native packaged acceptance, release approval, operator DB migration and real-provider model-turn matrices have not been performed by this task. Canonical status changes require the exact resource lease; a concurrent owner currently holds the shared registers. We retain each unresolved item in its existing owner instead of inventing a duplicate status.
