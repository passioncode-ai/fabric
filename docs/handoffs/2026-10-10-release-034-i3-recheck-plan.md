# 0.3.4 verification, iteration 3 recheck — plan and roadmap

Final candidate: `2e04073125db85d1fe3763267cd85c3d78fabaf2`, in the detached checkout `<cache>/cand4`. Delta reviewed:
`06c5234c65d3f4cbdbf5f2a6c50740a9c556d6b3..2e04073125db85d1fe3763267cd85c3d78fabaf2` (26 files, +1198/−36; five of
the files are the iteration-3 reports).

I worked read-only. I made no edits or commits in the checkout and did not start or stop any app. I did not touch the
operator's database or `~/Library/Application Support`. `git status --short` was clean after all runs. My only
network call was `git ls-remote origin 'refs/agent-sync/ids/*'`. The counter commit it named was already present
locally, and I read it with `git cat-file`.

## What I ran (in the final candidate)

| Command | Exit | Result |
|---|---|---|
| `node scripts/check-plan-ids.mjs` | 0 | PASS general plan |
| `node scripts/check-registers.mjs` | 0 | 243 carry-over rows, 197 milestones, 1618 verification rows; PASS (counts recompute) |
| `node scripts/check-operator-plan.mjs` | 0 | PASS (planning references) |
| `node scripts/check-handoff.mjs` | 0 | generated coordination document current |
| `node scripts/check-references.mjs` | 0 | 16 composite references |
| `node scripts/build-plan-projection.mjs --check` | 0 | PASS, 8 milestones, 10 batches |
| `node scripts/check-design-map.mjs` | 0 | PASS, stamp 4616 files, 546 anchors; stamp iteration `2026-10-10-release-034-i3` |
| `node scripts/check-regions.mjs` | 0 | PASS, 202 markers |
| `bash scripts/check-docs.sh` | 0 | PASS |
| `node --experimental-strip-types apps/desktop/test/seed-repair.test.mjs` | 0 | "seed-repair: all green" (includes the new `max_rows` check, `seed-repair.test.mjs:124-131`) |
| `node apps/desktop/test/run-first-install-db.mjs` | 0 | 13 PASS lines, "all green", full migration chain on isolated PostgreSQL |
| gate probe: `releaseGateProblems` over this ledger with a hypothetical 0.3.4 gate naming the three candidates (ledger rules only; same probe as iteration 3) | 0 | one problem left: "iteration 3 must end with its one line "Exit for iteration 3: …"". Iterations 1 and 2 now pass. Iteration 3's line is written in the release commit (item 1) |
| `git ls-remote origin 'refs/agent-sync/ids/*'` → `git cat-file -p 82710942` | 0 | CO counter `{"next": 244, "rkey": "release-034-i3-site-known-issue", "ts": "2026-10-10T09:23:47Z"}`: CO-243 was reserved race-free under the key the row cites |

## Iteration-3 plan findings: do their dispositions hold?

| Finding | Holds? | Evidence |
|---|---|---|
| PL-1 → V3-11 (ADR-0121/0123 targets) | yes, with a residual (PLR-2) | Amendment 2 added to ADR-0121 ("after 0.3.4 … order with 0.3.5 … not decided … copies ≤ 0.3.4") and to ADR-0123 ("the release after 0.3.4 … 0.3.4 ships the CEO chat unchanged"). Index rows at `docs/adr/README.md:110-111` now say "after 0.3.4 (amendments 1, 2)". These match P-12 and P-13 (`backlog.md:120-121`). ADR-0121's status line (`:5`) still says "target release 0.3.3"; PL-1's fix named it and V3-11 does not mention it |
| PL-2 → V3-12 (knowledge-base RM-19/LC-16/products.md) | yes, as ruled | *Release close* item 5 now names "`products.md`'s Fabric release and the roadmap's RM-19 and LC-16 rows, which still date self-update after 0.3.3 (iteration 3, PL-2)". The LC-16 *Next* line (roadmap l.565) is not named separately; "LC-16 rows" reasonably covers it. The knowledge-base edit is deferred to after publication, as the row says |
| PL-3 → V3-13 (site interim state, CO-243) | yes | CO-243 is at `carryover.md:254`, with a dated source, the operator's call, latest "when v0.3.4 is live", and status open. Next free ID is `CO-244`. The reservation ref is confirmed above. Lane 1 cites CO-243 (`backlog.md:93`). *The website meanwhile* ends "Its home is CO-243". V2-15 now reads "ruled CO-243". Item 4 holds the redirect receipt that closes it; item 4 does not mention CO-243 itself, which is acceptable because the row points at item 4 |
| PL-4 → V3-5 (exit lines, receipts) | yes | "Exit for iteration 1: … Blocking findings open: none." and the same line for iteration 2 are present. The gate probe no longer reports iterations 1 and 2. Item 1 names "the fifteen receipts `docs/evidence/reviews/0.3.4/iteration-N/<level>.json`" and the exit lines. P-15 reads "iterations 1 and 2 closed 2026-10-10, iteration 3 at its final candidate" |
| PL-5 → V3-6 (P-15 range, lane 2) | yes | P-15: "a database only the old seed (0.2.0, 0.3.0–0.3.3) has touched". Lane 2: "P-14 released 0.3.3 on 2026-10-09 the same way (release commit `1404dffe`, verified commit `fa9cdf6b`)". `fa9cdf6b` matches `v0.3.3:docs/launch/release-gate.json` `verifiedCommit` |
| PL-6 → V3-14 (CO-238 carries 0.3.5) | yes | CO-238's latest-decision cell: "before Fabric is offered outside macOS — the port is 0.3.5 (the operator's call 2026-10-10)" |
| PL-7 → V3-15 (fabric#26 in no register) | yes | P-15: "out of its scope: fabric#26, the analytics build mode (`analytics.ts`'s `isDebug: false`, as in 0.3.3), left to its own PR" |
| PL-8 → V3-16 (item 7's undone checks) | yes | Item 7: "It covers the start, the window and the repair; it does not cover step 7's chat — a message saved and read back after a cold restart — which goes undone in this release (iteration 3, PL-8)" |

## The delta at plan level

**Plan and register files.** These changed only as the V3 rows say, and the gates pass:
- `backlog.md`;
- `carryover.md`;
- the ledger;
- the ADRs;
- `plan.json`;
- the resolution-matrix pin;
- `completeness.html`, which carries a fingerprint only.

The register numerators were recomputed: 243 carry-over rows, and the exposure counts rose by one.

**Other docs in the delta.**
- ADR-0131 §2 now says `EVENT_READ_LIMIT` (999), so that reading one more event stays within `max_rows`. This matches
  `seedRepair.ts:32`, `seedRepair.ts:103` (`.limit(EVENT_READ_LIMIT + 1)`) and `supabase/config.toml:18`
  (`max_rows = 1000`).
- No living file states the old ceiling of 1000. I grepped `CHANGELOG.md`, `docs/adr`, `docs/launch`, the plan
  registers and `apps/desktop/src`. The "1000 событий" in the i2 map entry is dated history.
- The new top map entry `iteration-2026-10-10-release-034-i3` matches the ledger (21 findings, none blocking,
  V3-1…V3-16, CO-243, amendments 2) and names the next step: the recheck, then the release commit.

The delta introduced nothing false or broken at my level. It did leave the two release-close gaps below.

## New findings

### PLR-1: *Release close* item 1 does not name the final candidate or say where the rechecks go. Read literally, the preflight refuses it. Non-blocking.

**Evidence.**
- Item 1 says `verifiedCommit` = "the iteration-3 candidate". The Iteration 3 section names only `06c5234c` (what the
  five reviewers read). It says "the fixes below … make the final candidate" without naming that commit.
- `verifiedCandidateProblem` (`scripts/lib/release-mac.mjs`) refuses any path changed after `verifiedCommit` that is
  outside the metadata set. The delta from `06c5234c` changes `apps/desktop/src/main/seedRepair.ts`, the i18n files,
  `docs/adr/*` and `scripts/ci.sh`. So `verifiedCommit = 06c5234c` is refused, and the gate must name `2e040731…`.
- `release-gate.mjs:47-48` requires iteration 3's `candidateCommit` to equal `verifiedCommit`. Iteration 3's receipts
  must therefore bind to `2e040731…`, while their reports read `06c5234c`. The 0.3.3 precedent did exactly this:
  `verifiedCommit` = iteration-3 `candidateCommit` = `fa9cdf6b`, "the final candidate", with rechecks recorded in the
  ledger.
- These recheck reports are written after `2e040731`. The metadata set admits only:
  - the review `report`/`receipt` paths (`validatedReviewArtifactPaths`, `release-gate.mjs:93-96`; one report per
    level);
  - `releaseMetadata` entries matching `docs/(handoffs|reports)/….md`.

  A recheck report committed under `docs/evidence/reviews/0.3.4/iteration-3/` is therefore refused as an unverified
  change. 0.3.3 declared its NB-1 recheck under `docs/handoffs/` in `releaseMetadata`. Item 1 says none of this.

**Why it matters.** The preflight catches it, so nothing wrong ships. But the release operator following item 1 will
hit a refusal, or will leave the rechecks that clear the final candidate out of the tagged tree.

**Smallest fix (release commit).**
1. Item 1 and the Iteration 3 intro name `2e04073125db85d1fe3763267cd85c3d78fabaf2` as the final candidate. It is
   both `verifiedCommit` and iteration 3's `candidateCommit`.
2. The recheck reports are committed as `docs/handoffs/2026-10-10-release-034-*-recheck.md`, listed in the gate's
   `releaseMetadata`.
3. The iteration-3 exit line cites those rechecks.

### PLR-2: Item 5 lists the ADR amendments as after-publication work, though they already landed, and ADR-0121's status line still says 0.3.3. Non-blocking.

**Evidence.**
- Item 5 lists "… and ADR-0121/ADR-0123 here (their amendments 2)" among the edits made "after publication".
  Both amendments are already in the final candidate (`git diff 06c5234c..2e040731 -- docs/adr`).
- `docs/adr/0121-…md:5` still says "· target release 0.3.3". PL-1's smallest fix asked for the status line, and
  V3-11 neither changes it nor rules it out (for example, as append-only).

**Why it matters.** A close-out reader may re-amend ADRs that are already amended. The ADR's own header still gives
the target that two amendments have since moved twice. The index and amendments are right, so this is only noise.

**Smallest fix (close commit).**
- Item 5's clause becomes "ADR-0121/ADR-0123 amendments 2 landed in the final candidate (V3-11)".
- Then either set ADR-0121's status line to "target release after 0.3.4 (amendments 1, 2)", or add to V3-11 "the
  status line is left as written; the index row and amendment 2 carry the target".

VERDICT: 0 blocking, 2 non-blocking
