<sub>ssheleg skills — task-pipeline · evidence-docs</sub>

# Release review receipt author packet

Objective: harden PL10 / I3PLAN05 without publishing or rewriting historical reviews.
Base: `7011ce429d2593951b9d99940f78ab5850f17309`. This is an author branch, not an
independent review, release approval, release or installation receipt.

## Scope and plan

1. Inspect the actual release gate and independently reproduce fabricated closure.
2. Agree a minimum versioned receipt contract with the root owner.
3. Add counterexamples first, implement bounded artifact checks, verify both exits.
4. Commit and push this author packet for independent review and root integration.

Owned files: release-gate library/tests and this packet. No guarded registers,
historical ledgers, gate JSON, living map, release workflow or production action.
Root owns committed-file loader wiring and integration metadata. Existing model
and authorization are inherited; no further intake questions are needed.

## Requirements and checks

| Requirement | Check |
|---|---|
| Three iterations with all five review levels | negative missing-level and positive closed-fixture tests |
| Each artifact exists in the candidate release commit | committed-file loader test, not working-tree reads |
| Exact reviewed commit and structured closure | stale candidate/open receipt counterexamples |
| Existing unfinished hub ledger always refuses | unconditional real hub ledger assertion |
| Historical evidence remains untouched | scoped Git diff and source file checks |
| No claim of cryptographic reviewer independence | explicit trust boundary below |

## Sources and first reproduction

`AGENTS.md`, `docs/AGENT_SYNC.md`, `docs/evidence/plans/2026-10-04-hub-verification.md`
(Protocol), `scripts/lib/release-gate.mjs`, `scripts/test/release-gate.test.mjs`,
`scripts/release-mac.mjs`, `scripts/lib/release-mac.mjs` were read at the base commit.
The local organization knowledge README, vision, principles, how-to-work and rules
were read. The policy check printed no pending update. Task-pipeline and
evidence-docs provide the selected source-only profile: intake/contract → TDD →
bounded validation → draft handoff; deployment and independent acceptance remain open.

A direct Node import of the actual gate at the base, given three closed sections
with one nonexistent report link each, returned `{"problems":[]}`. This reproduces
the source defect; it neither builds the app nor runs a release.

## Trust boundary

Committed bytes, content hashes, exact candidate declarations, level coverage and
structured closure can be checked mechanically. Reviewer identifiers are declared
provenance. Uniqueness cannot prove an agent had fresh context or was independent;
the review owner must verify reviewer provenance and freshness separately.

## Selected receipt contract

The root owner selected `fabric-release-reviews/1`, fail closed for legacy gates.
`gate.reviewReceipts` contains `schema` and exactly three `iterations`. Each
iteration names its integer `iteration`, exact 40-character `candidateCommit` and
five `reviews`: `ux`, `errors`, `docs`, `data`, `plan`, once each. Each review names
its `level`, repository-relative `report` Markdown and `receipt` JSON under `docs/`.
Artifact paths are globally unique; no folder naming convention encodes the
iteration. Iteration 3's candidate equals `gate.verifiedCommit`.

Each receipt names `schema`, `version`, `iteration`, `level`, `candidateCommit`,
`report`, SHA-256 `reportSha256`, declared `reviewerRun`, `status: "closed"`,
`blockingFindingsOpen: []` and `findings`. Declared reviewer runs are unique across
all fifteen reviews. A finding has unique `id`, disposition `status` (`fixed`,
`ruled`, `not-a-defect`, `not-recoverable`, `stopped`) and a nonempty string array
`evidence`. An empty findings array records no findings. Evidence strings describe
the reviewer declaration; this checker does not resolve every evidence reference.

`releaseGateProblems` accepts `readCommitted(path)` supplied by the release owner.
The callback must return raw committed UTF-8 bytes as a string, preserving trailing
newlines; trimmed command output is insufficient. Missing/unreadable files fail
closed. The pure checker performs no disk reads or Git calls. The release owner
retains the Git candidate ancestry/runtime-change guard and manual provenance gate.
Historical `0.3.0` artifacts were neither changed nor supplied invented receipts;
their text remains auditable but cannot newly qualify a release.

## Checks

Fresh TDD red: `node --test --test-name-pattern='PL10'
scripts/test/release-gate.test.mjs` exited 1 before implementation, with
`fabricated closures without review artifacts were accepted`; after implementation
the same check exited 0.

`node --test scripts/test/release-gate.test.mjs scripts/test/release-mac.test.mjs`
exited 0: 26 tests, 25 passed, 1 skipped (`electron-builder` absent). Gate tests
covered missing files, hash mismatch, invalid JSON/path, duplicate level/artifact/
declared run, unsupported schema, mismatched candidate and receipt fields,
nonclosed/open findings, missing callback, and valid complete closures. A temporary
Git repository proved disk-only files refuse, committed files pass, disk changes
do not replace committed bytes, and committed changed report bytes fail the hash.

The existing ledger in this exact base still marks iteration 3 `_Not started._`.
The replacement regression unconditionally checks refusal of both those actual
bytes and a variant saying `Started; findings remain open.`; it cannot pass by
skipping an assertion when the heading's wording changes. The exact local script
tests do not establish hosted CI, signing, release qualification, app installation
or physical UI acceptance. Full project gates remain with root integration.

`node scripts/check-regions.mjs` exited 0: 113 markers checked, all closed and
all references resolved. `git diff --check` exited 0. Only this handoff,
`scripts/lib/release-gate.mjs` and `scripts/test/release-gate.test.mjs` are changed.

A fresh depth-1 sparse checkout from the pushed branch at
`c6d2db98b6a1661e9a7f92b702dbf46fb542340b` resolved this handoff and the owned
sources plus their ledger inputs. `node --test scripts/test/release-gate.test.mjs`
there exited 0: 13 passed, zero skipped. The task-owned temporary checkout was
removed afterward; the owning Git branch remains the durable delivery location.

## Resume

Next: root integrates this author branch, supplies the raw `HEAD:path` loader in
`scripts/release-mac.mjs`, extends its candidate guard only for validated declared
receipt metadata, and runs its source/map/documentation gate. Then independent
fresh reviewers may produce genuine candidate-bound receipts. Do not fabricate
historical review records or treat this author packet as a reviewer receipt.

Open: independent review, root loader integration, guarded map/ledger/handoff,
full local gates and hosted CI; release/signing/operator approval remain outside
this source-only task. No report was published to the wiki from this branch.

---

**Made with [ssheleg skills](https://github.com/ssheleg/sshlg-skills)**

- [`task-pipeline`](https://github.com/ssheleg/task-pipeline) — bounded source-only TDD author packet
- [`evidence-docs`](https://github.com/ssheleg/task-pipeline) — verification scope and committed handoff

<sub>A star on [the bundle](https://github.com/ssheleg/sshlg-skills) helps.</sub>
