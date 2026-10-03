# Iteration 1 — plan / roadmap / workspace level

Probes: `scratchpad/iter1-probes/collect.mjs` (workspace collector over this repo), `gate.mjs` (planted cases for check-plan-ids).

## Findings, most severe first

**1. Lane 5 schedules work that is already done, and leaves out the live launch programme.** plan · blocking
Evidence: `docs/launch/adoption/receipts/AD00.json` and `AD01.json` both say `"status": "passed"`. `adoption/README.md:11,34` says "AD00/AD01 already have immutable passed receipts", and line 19 says AD01 *is* the existing OX-01/D01 work. Yet `backlog.md:62` lists AD00, AD01, OX-01 and D01 under Delivers, and the brief's source ledger repeats the stale `launch/README.md` line "Сейчас: AD00". The current launch work is missing from every lane: AD02 native acceptance (blocked), AD04–AD24 (CO-167), and FR-A…G (CO-168, `first-release-strategy.md:104-110,131`), which replaced AD03 on 2026-09-25.
Fix: Delivers for lane 5 becomes AD02, CO-167, CO-168/FR-D…G and L3c. Correct the ledger row and the "Сейчас" line in `docs/launch/README.md`.

**2. The lanes' entry rules add gates that the dependency map does not have.** This contradicts ADR-0044 §1, while ADR-0101 says it "replaces nothing". plan · blocking
Evidence:
- Lane 6 requires "AR-2 done". In the dependency map, M153 and M158 depend only on M152.commit (shipped), and M183.local's inputs are all shipped.
- Lane 4 requires "N1 accepted". The agent-registry plan (`:22-24`) gives AR-2 no such prerequisite; only AR-3 requires AR-2.
- Lane 7 holds back M98, M105, M187 and S11 until "lane 6 producing receipts". These are F7 rows: M105, M187 and S11 have no dependencies, and the build order says "M98 не становится общим стопором". Labelling them "Reach: connectors" is also wrong.
- Lane 3 waits for a release.

AGENTS.md says "readiness is per capability, not a blanket waterfall".
Fix: either word the entry rules as focus order and cite real dependency edges, or record the reordering as a new ADR. Move the F7 rows out of Reach.

**3. Brief D3 says "documents are corrected in this run", but they were not, and ADR-0065 is not mentioned.** code-docs · blocking
Evidence: these lines in `docs/ux/flows.md` still contradict ADR-0100:
- 1712-1714: "parent folder candidates → Select several sources and primary"
- 1833: "FLW-55 candidate selection creates one Project"
- 1843: "no personalisation form"

ADR-0065 §1 (accepted) says selected folders form ONE Project and "do not silently create nested Projects". ADR-0100 never names ADR-0065, which breaks R-001 (propagate an ADR's change to every affected document).
Fix: ADR-0100 states how it relates to ADR-0065 §1, FLW-55 gets amendment notes, and the D3 wording is corrected.

**4. P-01 duplicates rows that registers already hold.** ADR-0101 §2 allows a `P-*` row only for work no register held. plan · major
Evidence: FR-A (persona/entry), FR-B (early readiness), FR-C (picker and scan) and AD24 (folder discovery, "blocked-on-receipts") already cover this work. So does AR-2.1 (runner detection: catalogued argv, timeout; status "not recorded"), which `executorDetect.ts` partly implements. `git diff --stat` shows none of these registers was touched.
Fix: cite them in lane 1 and update their statuses with receipts.

**5. Deferred work has no ids (R-002, AGENTS rule 2).** plan · major
Evidence: `adr/0100:69-70` says "sign-in verification of a detected executor, and re-scanning on a schedule" are "owned by the plan", but the plan has no row for either. The carry-over file is unchanged (next free id is CO-176; there are no 2026-10-03 rows). The frozen REQ-02 still promises "signed-in", while `executorDetect.ts:11` says found is not signed in.
Fix: add CO rows, and get an operator ruling on REQ-02.

**6. The common backlog will show P-01 as "Не определено" (unknown).** workspace · major
Evidence: the collector probe prints `P-01 | unknown | built 2026-10-03; acceptance by P-02`. `normalizeStatus` (`workspace/lib/backlog.mjs:20-29`) has no rule for "built".
Fix: change the status to `partial — built 2026-10-03; acceptance by P-02`. Also add `"heading": "General development plan"` to the source.

**7. The plan-id gate is weaker than ADR-0101 §2 claims.** harness · major
Evidence from the planted cases in `gate.mjs`, all of which return `[]`:
- `FR-Q` passes: the prefix is outside the id regex, so it is ignored.
- `AR-2.99x` passes: it resolves as AR-2.
- Citing the shipped rows S02 and M97 passes.
- A lane whose Delivers is emptied to "TBD later" passes.

Fix: every lane must carry at least one id; unrecognised id-like tokens must fail; cited `done` rows should at least warn.

**8. Lane 2's entry rule contradicts the process actually being run.** plan · major
Evidence: the rule says "lane 1's code is on main", but P-02 is running on the unmerged branch (handoff steps 1-3). `origin/main` also has `49e9ebb8` (a workspace pin) that the branch lacks, so the map's "ветка выровнена с main" is now stale.
Fix: reword the entry rule. Re-merge before landing, with the MERGES entry and the map refresh inside that change.

**9. The plan cannot be reached from any entry point.** plan · major
Evidence: `git grep general-development-plan` finds it only in ADRs, the backlog and plans. AGENTS.md, CLAUDE.md, README, DOCMAP and `launch/README.md` do not link it, and CLAUDE.md still says the order lives in `#build-order-by-layer`. ADR-0101's path "vision → plan → build order" is not wired anywhere.
Fix: link it from all of those entry points.

**10. Open work is missing from every lane.** plan · major
Missing: AR-3…AR-6, AR-8…AR-10, M183.local/upstream, M102 (partly shipped), the M199.* subrows (M199.probe is the one that is ready), MEM-P0…P7, harness-r0 second slice and H09, OX-02…12. None of the 135 open CO rows is placed.
Release process: P-03 does not link `docs/launch/release-mac.md` or `scripts/release-mac.mjs`, and those files do not mention the release gate (grep finds nothing).

**11. The design map is not current.** code-docs · major
- The onboarding entry sends readers to `#screens`, which says "В текущем реестре 61 запись экрана". `screens.md` has 75 screens (69 at base), and SCR-70…75 do not appear in that section.
- The entry links neither the existing `product.html#view-first-run` / `#view-start-{add,scan,new,agent,convert}` anchors nor the plan.
- `#foundations-first` does not mention the general plan.

**12. Minor issues.** minor
- D9 says "the rule in ADR-0100"; it should be ADR-0101.
- P-04 (harness) is filed under lane 1, Start.
- There is no "now/next" marker: after P-03 the next task is N1, with Codex usage available from 2026-10-03 19:15.
- The handoff's "@7697923c" and its steps 1-2 are stale.
- `knowledge/plans.md` lists AR-1 as "done"; the canonical table says partial.
- Outside my level: the handoff says the operator's transcript export was moved to the scratchpad and that the scratchpad was later cleared. That user data is gone.

## Workspace: edits required after landing

1. Merge `origin/main` (`49e9ebb8`). Run `check-design-map --refresh`, write the MERGES entry in the same change, run `ci.sh fast`, then fast-forward.
2. On main, run `node scripts/workspace.mjs publish`, then `check --require-child`, then commit the pin. Status is stale right now, which is expected.
3. Open a fabric-workspace PR against **remote main** (`fb5e339`). The pinned submodule is behind: remote `products.md` already shows Dashboards 0.4.0 and Switchboard 0.5.2.
   - `plans.md`: add a dated "Fabric general development plan" section that links `fabric/blob/main/docs/evidence/backlog.md#general-development-plan` and ADR-0101. Link it rather than copying it, and name the current lane (P-02/P-03, then N1). Change AR-2 from "**next**" to "after N1 (plan lane 4)", or follow the canonical table. Correct AR-1 to partial.
   - `products.md`, with P-03: change the Fabric row from 0.2.0 to 0.3.0. Its Check becomes "first run: name/look → Claude Code/Codex found/needs setup/missing → five start paths", with the date of the check.
4. Run `node scripts/workspace.mjs sync`. The handoff leaves the KB pages until after the release, but `plans.md` becomes false as soon as the plan lands.

## Checked and correct

- The `P-*` source parses: 0 errors for the fabric owner, rows at lines 69-72, no duplicates. The only error is the missing org-index inventory, which is expected in a standalone probe.
- `check-plan-ids` and its test pass and are part of `gates:docs` (`package.json:17`). All 39 cited ids resolve.
- L3c is the only open L row (`launch-ui-plan.md:43`). V1-M1…M7 and S4…S6 are open; M199 is proposed.
- `check-registers` passes. The ADR index's next free id is 0103, and moving the reservation to 0102 is documented.
- The map entries count eight lanes, which is correct, and their links resolve.

## Not checked

- Whether the agent-sync lease was held during the edits: I did not read the record plane.
- The live wiki.
- The map's claim that the Playwright run passed 15 of 15.
- The native app.
