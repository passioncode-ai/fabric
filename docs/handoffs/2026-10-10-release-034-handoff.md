# Handoff — Fabric 0.3.4: a fresh install starts, one universal DMG (2026-10-10)

## Objective

Release Fabric 0.3.4: every fresh install since 0.2.0 stopped at "identity could not be established" (CO-241); 0.3.4
fixes the seed and repairs a database only the old seed touched
([ADR-0131](../adr/0131-a-database-only-the-old-seed-has-touched-is-given-to-the-local-operator.md)), and carries
universal macOS (fabric#27). Operator decisions 2026-10-10: the fix ships now as 0.3.4, with universal macOS; the
Windows/Linux port is 0.3.5 (CO-238).

## Done

| What | Receipt |
|---|---|
| Found at the 0.3.3 release close (CO-228): the installed 0.3.3 stopped on the operator's database | [0.3.3 ledger, state 2026-10-10](../evidence/plans/2026-10-08-release-033-verification.md#release-close-state-2026-10-10) |
| Root cause measured on a disposable stack (migrations 79 + seed: `not_a_member`) | [0.3.4 ledger, How it was found](../evidence/plans/2026-10-10-release-034-verification.md#how-it-was-found) |
| Fix: `supabase/seed.sql`, `apps/desktop/src/main/seedRepair.ts`, the identity gate before the retry point and the hub (`apps/desktop/src/main/index.ts#bootstrapReady`), startup cause `identity-refused`, the stack folder (`apps/desktop/src/shared/stackFolder.ts`), the workspace-pin preflight (`scripts/lib/release-mac.mjs#workspacePinProblem`), `thinMachO` | `first-install-db`, `seed-repair`, `stack-folder`, `startupFailure`, `universal-mac`, `release-mac` tests in the fast tier, planted defects watched |
| Three iterations: candidates `41c2b62c` → `a0ab055c` → `06c5234c`, final `2e040731` rechecked at five levels; 96 findings with the rechecks, 7 blocking, all disposed (V1-1…V1-25, V2-1…V2-19, V3-1…V3-20) | the ledger; reports under `docs/evidence/reviews/0.3.4/`; rechecks `docs/handoffs/2026-10-10-release-034-i3-recheck-*.md` |
| `bash scripts/ci.sh fast` green at `2e040731`; `bash scripts/ci.sh full` green at `06c5234c` (disposable stack) | logs kept outside git |
| The operator's database read from its dump: one seed event, `…0002` owner, no decisions — predicted repaired | ledger *Release close* item 3 |
| Knowledge base: 0.3.3 released, 0.3.4 in verification | fabric-workspace PR #92 (`8639492c`); PL-09 in PR #86 (DEC-0032, DEC-0033) |

## Open (the ledger's *Release close*, in order)

1. Land the release commit on `main` by fast-forward after `bash scripts/ci.sh fast`; `node scripts/release-mac.mjs --check-only --tag v0.3.4`.
2. Tag `v0.3.4`; the operator's two approvals (macOS build, publish), each as a direct link.
3. Download and check the DMG; install over 0.3.3 (`~/.cache/fabric-release-033/Fabric-0.3.2.app` stays as the rollback until 0.3.4 is seen running); start through the lifecycle broker; `identity.seed-repair` `ok` and the first run.
4. The site's `releases/products.json` asset pattern to `Fabric-{version}-universal.dmg` after publication; the live redirect receipt; CO-243 closes with it. Then `node scripts/workspace.mjs publish` and `check --require-child`.
5. Knowledge base and this repository's version/platform statements (`docs/brand/facts.md`, the overview guides, the map's family section, RM-19/LC-16, `products.md`); ADR-0121's status line; P-15 done.
6. Intel: not run on Intel hardware (recorded).
7. The runbook's Playwright smoke: not run (lifecycle rule); the chat's save and cold-restart read-back go undone in this release.

Then the cleanup the operator asked for (2026-10-10): merged and dead branches, worktrees (`~/.cache/fabric-release-034/cand1…4`, this one after landing), build outputs, caches, `fabric_test_*` volumes — coordinated with fabric-switchboard-93, which left the fabric repository's cleanup to this run.

## Next task

Item 1: land the release commit, then the tag.
