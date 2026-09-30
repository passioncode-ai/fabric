# Adoption implementation — first integrity slice

Operator approval (paraphrased): proceed through to the end, continuing the 25 packets in [the accepted execution plan](../README.md). Starting source: `ac9e286cb312e9d895e76758ecb046aedb1a62a4`. This slice fixes AD00 and implements the bounded AD02 draft path; it does not close the remaining adoption program.

## Scope and decisions

- AD00: `scripts/sync-product-ux.mjs` exports the real projection path and bounds entries at equal/senior Markdown headings. Explicit keyed appendix paragraphs extend named owners only; metadata comes from the entry. `scripts/check-product-model.mjs` imports that parser instead of keeping a second defective boundary algorithm. Test owner: `scripts/test/product-model.test.mjs`. All 85 view IDs retained; no scenario product observation promoted.
- AD02: `apps/desktop/src/renderer/src/App.tsx` allocates independent UUID draft IDs, merges late hydration with current typing and retains its active tab. Read errors remain visible beside dropped-tab notices. `apps/desktop/src/main/onboardingDrafts.ts` treats `default_missing` as known empty so a first installation can persist its first draft. This main-file scope expansion is necessary: the actual renderer→disk regression found first-save permanently disabled. Scope also includes `apps/desktop/src/main/localState.ts` and `apps/desktop/test/local-state.test.mjs`: unresolved quarantine/invalid recovery stays unreadable across fresh reads, while a genuinely new installation can save. `apps/desktop/src/renderer/src/components/TabStrip.tsx` gives same-variant actions distinct React keys; named drafts use their own names so all four restored tabs are distinguishable. No business Project is fabricated, identity of a restored Project draft is unchanged, no storage migration.
- AD02 tests: `apps/desktop/src/renderer/src/onboardingDraft.persist.test.tsx` mounts the actual App and invokes actual createDrafts/readLocal/updateLocal in a temporary directory, with the same save-result mapping as the current IPC handler. Other services are controlled read stubs. This exercises renderer/main storage semantics and real disk; it does not launch Electron or prove the IPC transport, cloud, provider execution or user value.
- Canonical propagation: SCN-031, FLW-18, SCR-27, generated product model/report. Report wording/states describe the native path; no new visual design, provider grant or source scan.

## Observed checks

| Check | Before | After | Proof |
|---|---|---|---|
| `node --test scripts/test/product-model.test.mjs` | exit 1: appendix boundary, duplicate ID, real SCR-63 contamination | exit 0: 30/30 | pure production parser/projection |
| `pnpm --filter @fabric/desktop exec vitest run src/renderer/src/onboardingDraft.persist.test.tsx` | exit 1: two newly created drafts replaced draft-1/2; hydration erased early input | exit 0: 9/9 including disk/remount, corrupt-file and first-install checks | renderer + actual main filesystem, controlled IPC facade |
| Same first-install test | exit 1: no saved draft after typing | exit 0 after `default_missing` mapping | actual storage path |
| `node --experimental-strip-types apps/desktop/test/onboarding-drafts.test.mjs` | existing baseline | exit 0 | bounded main store |
| `pnpm --filter @fabric/desktop typecheck` | — | exit 0 | node + renderer types |
| `node scripts/check-product-model.mjs` | — | exit 0: 63 screens, 85 views, 94 scenarios, 54 flows | canonical links + pinned evidence, not runtime coverage |

An initial test selector matched multiple “New project” buttons; it was corrected to the labelled tab action before recording the product failures above. The corrupt-file fixture initially had a valid last-good copy; it was corrected to corrupt both test-owned files before checking unreadable behavior. These were harness errors, not product findings.

## Remaining acceptance and next task

Independent reader found three real correctness gaps: corrupt state became empty after quarantine/remount; mixed-owner refinements were skipped; fenced appendix examples became links. Each now has a failing-before/passing-after regression. Round 2 additionally found abbreviated cross-reference IDs in mixed keys; the full key stream now normalizes each prefix before reference extraction. A fourth acceptance gap was fixed by restoring the actual four-tab working set and opening all four forms after remount. Desktop production build passed. The isolated native harness launched, but CUA could not inspect it: macOS Accessibility/Screen Recording permissions remained pending on two attempts. The test-owned Electron process was stopped with SIGINT; native acceptance remains not-run, not failed or passed. `bash scripts/ci.sh fast` passed (exit 0, “fast tier green”); stack-backed probes were not run. The native harness source is `apps/desktop/test/adoption-native-harness.mjs`; its three fixture preparations and syntax check passed, but this is not native UI acceptance. No passed receipt for AD02 is asserted by these component tests alone. AD00 immutable receipt follows its implementation commit; AD01 then binds actual producers and the outstanding native ports. Existing CO-167 owns remaining AD01–24; no inferred completion from a green report.

Rollback: revert parser/projection together; existing legacy draft IDs remain readable and new UUID IDs are plain keys in the same DraftFile schema. Do not delete user draft files when rolling back. Test directories are disposable fixtures removed by their tests. The isolated native harness was started and stopped; production main, live agents and user projects were not started or mutated.
