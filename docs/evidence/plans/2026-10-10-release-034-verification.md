# Release verification — Fabric 0.3.4, a fresh install starts: three independent iterations

Run `2026-10-10-release-034-verification`. The operator's rule (2026-10-03, plan row P-02, kept for every release):
before the DMG and the release, three independent testing iterations across every level of the project, every
finding fixed, and only then the release. This file is the ledger for **Fabric 0.3.4** — plan row
[P-15](../backlog.md#general-development-plan): every fresh install of 0.3.0–0.3.3 stopped at "identity could not be
established" (CO-241), and 0.3.4 fixes it — the seed names the app's own person as the default estate's owner, and a
database only the old seed has touched is granted to the local operator at start
([ADR-0131](../../adr/0131-a-database-only-the-old-seed-has-touched-is-given-to-the-local-operator.md)). 0.3.4 also
carries universal macOS — one DMG for Apple silicon and Intel Macs ([fabric#27](https://github.com/passioncode-ai/fabric/pull/27),
CO-237) — which reached `main` before the fix. No schema change: 0.3.4 runs on schema 79. The operator decided on
2026-10-10 that the fix ships now as 0.3.4, and, once #27 had landed, that 0.3.4 carries it; the Windows/Linux port
is 0.3.5 (CO-238). 0.3.3 was cleared by its own ledger,
[2026-10-08-release-033-verification.md](2026-10-08-release-033-verification.md).

## Protocol

The protocol is 0.3.3's, unchanged ([0.3.3 ledger, Protocol](2026-10-08-release-033-verification.md#protocol)): fresh
reviewers per iteration, one per level (UX-n, ER-n, DO-n, DA-n, PL-n), a finding `V<iteration>-<n>` with a
disposition (**fixed** with its watched test, **ruled** with a register id, or **not a defect** with the measurement),
and iteration 3 ends with zero open blocking findings. Reviewers work read-only in a detached checkout of the
candidate; their reports are committed under `docs/evidence/reviews/0.3.4/iteration-N/`.

The change is small and sits on one seam — the database a new install gets and the identity boundary that reads it
— so every level reads it from its own side: what a person sees on a new Mac and on a Mac whose 0.3.3 install
never started (UX), what fails and how it is said (ER), whether the documents say what the code does (DO), whether
the grant can reach a database somebody used (DA), and whether the plan, the roadmap and the version numbers say
what was decided (PL).

## How it was found

The 0.3.3 release close, item 4 (CO-228): the installed 0.3.3, started through the lifecycle broker on the operator's
database, exited with no window; `startup-failure.log` said "identity could not be established: that person is not
a member of this estate". The same refusal was in the operations log since 2026-10-09 00:48 UTC, on 0.3.2, after
the 2026-10-08 reset for a fresh onboarding. A disposable stack built the way a new install builds one
(`node scripts/test-stack.mjs up <dir>`: migrations 79 + seed) answered `resolve_subject('…0001', '…000a')` →
`not_a_member`. The operator's database was dumped before anything else touched it
(`~/Library/Application Support/Fabric/backups/pre-0.3.4-seed-repair-2026-10-10.dump`, 1 145 101 bytes,
`pg_restore --list` 1 418 lines) and is left unrepaired, so the installed 0.3.4 repairs it as a user's would be.

## Release close

What 0.3.4's release has to do besides the gate. Each line is checked off with its receipt when it is done.

1. The release commit: `apps/desktop/package.json` 0.3.4 (nothing else in that file), `## 0.3.4` finalized in
   `CHANGELOG.md`, `docs/launch/release-gate.json` (version, this ledger, `verifiedCommit` = the iteration-3
   candidate, three receipt groups), a new top entry in `docs/reports/map.html` and the `docs/MERGES.md` entry;
   landed on `main` by fast-forward after `bash scripts/ci.sh fast`.
2. The tag `v0.3.4`; the release run's two protected approvals (macOS build, publish), each given to the operator as
   a direct link once it waits.
3. The downloaded DMG checked (`SHA256SUMS`, its GPG signature, `spctl`, the staple); installed; started through the
   lifecycle broker on the operator's database, which it must repair (`identity.seed-repair` `ok` in the operations
   log) and open. Before that, the dump named above is read in a disposable cluster: the `org #1` journal's count and
   types, so the repair's outcome is predicted, not hoped for (iteration 1, DA-1). A new Mac's first start is checked on a disposable stack built from the tag's `supabase/`
   (`node scripts/test-stack.mjs up <dir>`, then `resolve_subject` for the default estate and the app's person): the
   packaged app's bundled stack has one fixed project id, and on this Mac that stack is the operator's.
4. The website's release PR (runbook step 9): its `releases/products.json` asset pattern becomes
   `Fabric-{version}-universal.dmg` once v0.3.4 is published — until then the resolver skips 0.3.4 and keeps
   offering 0.3.3, which a new Mac cannot start — with the page's platform copy (Apple silicon and Intel); the
   receipt is `curl -sI https://passioncode.ai/fabric/download/macos` naming `v0.3.4/Fabric-0.3.4-universal.dmg`
   (iteration 1, PL-1). Then the workspace publication after the tag (`node scripts/workspace.mjs publish`,
   `check --require-child`).
6. Intel: no Intel Mac is on hand, so the packaged universal app is not run on Intel hardware before the release;
   the notes say so ("measured on Apple silicon, natively and under Rosetta"), and a first Intel run is recorded
   here when one is available (iteration 1, PL-11).
5. The knowledge base after publication: the roadmap's released column for Fabric, `products.md` and `plans.md`
   Now in fabric-workspace; this repository's own statements of the released version and platform, which still
   name 0.2.0 on Apple silicon (`docs/brand/facts.md` "current implementation status",
   `docs/guides/passioncode-overview.md` and `.ru.md`; iteration 1, PL-7); then the close commit marking P-15 done,
   with its handoff.

## Iteration 1

Five fresh reviewers, 2026-10-10, against `41c2b62c` (`41c2b62ca9ee3ce8307a4b58dd0235035d4eec8b`, the head of
`agent/fix-fresh-install-034`), read-only in a detached checkout. Reports (committed as written, machine paths replaced):
[scenarios/UX/UI](../reviews/0.3.4/iteration-1/2026-10-10-ux.md) (UX-n, 2 blocking + 5),
[errors and boundaries](../reviews/0.3.4/iteration-1/2026-10-10-errors.md) (ER-n, 0 + 6),
[code ↔ documents](../reviews/0.3.4/iteration-1/2026-10-10-docs.md) (DO-n, 0 + 12),
[data, memory, orchestration, harness](../reviews/0.3.4/iteration-1/2026-10-10-data.md) (DA-n, 1 + 3),
[plan and roadmap](../reviews/0.3.4/iteration-1/2026-10-10-plan.md) (PL-n, 1 + 10).
40 findings, 4 blocking; where reviewers found one thing they share a row. Every *watched* fix had its test run with
the fix reverted in place and seen failing, then restored. Two reviewers could not run `universal-mac.test.mjs`,
`runtime-admission.test.mjs` or `ci.sh` (the checkout had no `node_modules`): NOT_RUN for them, run here instead.

| ID | Source | Finding (short) | Disposition |
|---|---|---|---|
| V1-1 | DA-1, ER-3 (blocking) | A 0.3.1–0.3.3 database whose failed start let the hub write `access.requested@1` was never repaired; 0.3.4 also opened the hub first | fixed: `seedRepair.ts#seedOnlyProblem` admits after the creation only `access.requested@1` by `system/fabric-hub` (within `EVENT_READ_LIMIT`); the repair runs before the retry point and `startHub` (`index.ts` region `seed-repair-wiring`); `seed-repair.test.mjs` hub cases and the wiring-order check, `first-install-db.test.mjs` `legacy` hub case (watched: admitting any system event, and moving the repair after the hub, each fail) |
| V1-2 | UX-1, ER-1 (blocking) | A refusal the repair did not cover said "could not work out why"; its reason reached only the log | fixed: startup cause `identity-refused` (`shared/startupFailure.ts`, en/ru `startup.identity-refused.*`, `docs/brand/strings.md`); the thrown message carries the repair's reason, so the dialog's details and `startup-failure.log` say it; `startupFailure.test.ts` identity case (watched: failed before the cause existed) |
| V1-3 | UX-2, DO-1 (blocking) | "An install that could not start, starts" was false for 0.3.0/0.3.1 (schema 75/78) and the range left out 0.2.0 | fixed: CHANGELOG, ADR-0131 §5, the runbook's *Upgrading* section and CO-241 say "since 0.2.0" and that a 75/78/69 database takes the upgrade first; an **Upgrading** line; the runbook names the shorter way (`supabase stop --no-backup`, only for a database Fabric never opened, flag checked with `supabase stop --help`) |
| V1-4 | PL-1 (blocking) | After 0.3.4 the site's resolver would skip it (its policy asks for `-arm64.dmg`) and keep offering 0.3.3 | fixed: runbook step 9 describes the resolver (`releases/products.json`, read 2026-10-10) and the site PR that changes the pattern to `Fabric-{version}-universal.dmg` after publication; ledger *Release close* item 4 names it, with the live redirect as receipt. The site change itself is that close item |
| V1-5 | DA-2 | A revoke through the door would be granted again on the next start | fixed: `seedOnlyProblem` refuses when any `membership_commands` row is on record (`seedRepairDb#decisions`); unit case and `legacy` revoke case (watched: removing the check fails) |
| V1-6 | DA-3 | The real reads and the RPC arguments were untested: `.limit(1)` or a null revision passed every tier | fixed: `seed-repair.test.mjs` drives `seedRepairDb` with a recording client and holds the reads, the limit and the RPC arguments; the wiring order is read from `index.ts` (watched: `.limit(2)` and `p_expected_revision: null` each fail) |
| V1-7 | ER-2 | A failed repair was logged at `info`, below a successful one | fixed: a refusal is `error`, a grant `warn` (`index.ts` region `seed-repair-wiring`) |
| V1-8 | ER-4 | A conflict refused startup even when the operator had become a member meanwhile | fixed: identity is read again after any repair attempt, so a grant made meanwhile is found; checked by the wiring-order case |
| V1-9 | ER-5 | `thinMachO` passed a Mach-O lipo could not read and skipped 64-bit fat headers | fixed: `0xcafebabf` is a Mach-O magic; an unreadable one is reported (`[unreadable]`, or lipo's own `unknown`); `universal-mac.test.mjs` corrupt and fat64 cases (watched: without the magic it fails) |
| V1-10 | DO-9 | No gate ran the universal-mac test | fixed: `scripts/ci.sh` fast runs `scripts/test/universal-mac.test.mjs` |
| V1-11 | UX-3, DO-7, UX-4 | A repaired database keeps `…0002` as a second owner, and its tenure counts from the failed install; no open row | ruled CO-242: no screen shows members today; decided before any person or member surface; the CHANGELOG says the old first owner stays listed |
| V1-12 | UX-5, DO-8, PL-11 | The Intel note claimed more than was measured and spoke builder shorthand | fixed: one user-facing bullet, "measured on Apple silicon, natively and under Rosetta; not yet run on an Intel Mac", mechanics left to the runbook's *Universal macOS*; ledger *Release close* item 6 records that no Intel Mac is on hand |
| V1-13 | UX-6 | Scenarios, flows and screens described startup as a build/schema check only | fixed: amendment lines on SCN-095 *Preconditions*, FLW-55 *Before entry*, SCR-36 *Startup boundary* (ADR-0131); `docs/ux/lint.py` exit 0 |
| V1-14 | UX-7, DA-4, PL-6, DO-2 | CO-238 and the x86_64 receipt dated universal macOS to 0.3.5 | fixed: CO-238 says 0.3.4; `checks.md` §Intel (x86_64) gains a dated amendment, its measurement unchanged |
| V1-15 | DO-3, ER-6, PL-7 | README, the runbook header, `release.yml` and `release-mac.mjs` said Apple silicon only | fixed: each says one universal DMG for Apple silicon and Intel from 0.3.4. `docs/brand/facts.md` and the overview guides (still 0.2.0) are updated at *Release close* item 5, once 0.3.4 is published |
| V1-16 | DO-4 | README's owned-runner counts were stale | fixed: eighteen runners, five in the fast tier, `run-first-install-db` named |
| V1-17 | DO-5 | The MERGES entry gave the wrong base and fabric#27 had no entry | fixed: base `9ef939e6`; an entry for `agent/platform-matrix-20261009 → main` |
| V1-18 | DO-6, PL-2, PL-3 | CO-228 stayed open; P-14's close and the site's own move to 0.3.3 were unrecorded | fixed: CO-228 resolved citing CO-241; the 0.3.3 ledger gains a dated *Release close — state on 2026-10-10*; P-14 says the site follows releases itself and offers a build a new Mac cannot start until 0.3.4 |
| V1-19 | PL-4 | P-15 was in no lane | fixed: lanes 1 and 2 cite P-15 (lane 2 in place of the released P-14; lane 1 drops the resolved CO-228) |
| V1-20 | PL-5, PL-10 | Next, P-12, P-13 and the recompile promise still said "after 0.3.3" | fixed: re-dated to after 0.3.4, the order with 0.3.5 marked undecided; Next names 0.3.5 (CO-238) |
| V1-21 | PL-8 | P-15 named no roadmap track; the roadmap does not name 0.3.4 | fixed: P-15 names RM-09; the roadmap's released column is *Release close* item 5 |
| V1-22 | PL-9 | CO-241 read as resolved and ADR-0131's rule was credited to the operator before verification | fixed: CO-241 is "fixed in the 0.3.4 candidates, resolved when v0.3.4 is published"; ADR-0131's status says the rule is this run's design and the operator decided the release |
| V1-23 | DO-10 | New feature code had no region markers | fixed: `seed-repair-wiring` (`index.ts`), `after-pack-universal`, `measured-runtimes` (`runtimeAdmission.ts`); `check-regions.mjs` PASS, 202 markers |
| V1-24 | DO-11 | Two documented commands did not run as written | fixed: `node scripts/test-stack.mjs up <dir>` in the ADR and the ledger; the test comment says to run from `apps/desktop` |
| V1-25 | DO-12 | "The sign-in readers know the x64 builds" read as any version | fixed: the runbook says those exact builds, any other reported as unverified (the CHANGELOG no longer states versions) |

## Iteration 2

Not yet run.

## Iteration 3

Not yet run.
