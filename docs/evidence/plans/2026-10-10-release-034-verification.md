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
(`node scripts/test-stack.mjs up`: migrations 79 + seed) answered `resolve_subject('…0001', '…000a')` →
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
   log) and open. A new Mac's first start is checked on a disposable stack built from the tag's `supabase/`
   (`node scripts/test-stack.mjs up`, then `resolve_subject` for the default estate and the app's person): the
   packaged app's bundled stack has one fixed project id, and on this Mac that stack is the operator's.
4. The website's release PR (runbook step 9) — 0.3.0 to 0.3.3 cannot start on a new Mac, so the site points at 0.3.4
   — and the workspace publication after the tag (`node scripts/workspace.mjs publish`, `check --require-child`).
5. The knowledge base after publication: the roadmap's released column for Fabric, `products.md` and `plans.md`
   Now in fabric-workspace; then the close commit marking P-15 done, with its handoff.

## Iteration 1

Not yet run.

## Iteration 2

Not yet run.

## Iteration 3

Not yet run.
